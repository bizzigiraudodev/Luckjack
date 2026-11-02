// Salas de truco online (mano a mano). La partida vive en el servidor: el motor del truco corre acá,
// valida cada jugada y a cada jugador le muestra solo lo que puede ver (sus cartas, no las del otro).
//
//   POST /api/room { action: 'create', name, target }        → crea la sala, devuelve { code, token, seat, view }
//   POST /api/room { action: 'join', code, name, token? }    → entra (o vuelve a entrar) a la sala
//   GET  /api/room?code&token&ver&since                       → estado para ese jugador (polling)
//   POST /api/room { action: 'act', code, token, move }      → canta, responde o juega una carta
//   POST /api/room { action: 'next' | 'say' | 'rematch' | 'leave', code, token, ... }
//
// Los datos se guardan en Upstash Redis (una clave por sala, vence a las 2 horas sin actividad).

const Truco = require('../js/truco.js');
const { config, redis, cleanName } = require('./_redis.js');

const { TrucoMatch, TrucoHand, rank, envidoOf, PHRASES } = Truco;
const TTL = 2 * 3600;
const WORDS = ['MATE', 'PAMPA', 'TRUCO', 'FACON', 'PONCHO', 'RANCHO', 'OMBU', 'ASADO', 'GAUCHO', 'TANGO', 'POTRO', 'BOMBO', 'CHALA', 'TROPA'];
const MAX_EVENTS = 60;
const MAX_CHAT = 12;
const CHAT_GAP_MS = 1500;
const SEEN_EVERY_MS = 15000;
const ONLINE_MS = 30000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const key = (code) => `room:${code}`;

// Guarda solo si nadie la modificó desde que la leímos (versión igual).
const CAS = `
local cur = redis.call('GET', KEYS[1])
if not cur then return -1 end
if cjson.decode(cur).ver ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1`;

function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z]+)(\d+)$/, '$1-$2');
}

function newCode() {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${w}-${String(Math.floor(Math.random() * 90) + 10)}`;
}

function newToken() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

// --- La partida se guarda como datos y se "revive" con el motor en cada pedido ---
function revive(data) {
  const m = Object.assign(Object.create(TrucoMatch.prototype), data, { rng: Math.random });
  if (data.hand) {
    m.hand = Object.assign(Object.create(TrucoHand.prototype), data.hand);
    m.hand.rankOf = (c) => rank(c);
    m.hand.faltaPoints = () => m.target - Math.max(...m.scores);
    m.hand.events = m.hand.events || [];
  }
  return m;
}

function freeze(m) {
  const { rng, ...rest } = m;
  return JSON.parse(JSON.stringify(rest)); // las funciones (rankOf, faltaPoints) no se guardan
}

// Pasa los eventos nuevos de la mano al historial de la sala, con número correlativo.
function collectEvents(room, m) {
  const h = m.hand;
  if (!h) return;
  for (const e of h.events) room.events.push({ ...e, id: ++room.eventSeq, hand: m.handNumber });
  h.events = [];
  if (room.events.length > MAX_EVENTS) room.events = room.events.slice(-MAX_EVENTS);
}

function startMatch(room, firstMano) {
  const m = new TrucoMatch({ target: room.target, firstMano });
  m.newHand();
  room.status = 'playing';
  room.matchNo = (room.matchNo || 0) + 1;
  room.rematch = [false, false];
  collectEvents(room, m);
  room.match = freeze(m);
}

function seatOf(room, token) {
  const seat = room.players.findIndex((p) => p && p.token === token);
  if (seat < 0) throw new HttpError(403, 'No sos parte de esta sala');
  return seat;
}

// --- Lo que ve cada jugador (todo relativo a él: 'me' / 'opp') ---
function view(room, s, since = 0) {
  const rel = (x) => (x === s ? 'me' : x === 1 - s ? 'opp' : x);
  const opp = room.players[1 - s];
  const v = {
    code: room.code,
    ver: room.ver,
    status: room.status,
    target: room.target,
    seat: s,
    names: { me: room.players[s].name, opp: opp ? opp.name : null },
    oppOnline: !!opp && Date.now() - opp.seen < ONLINE_MS,
    left: room.left === null ? null : rel(room.left),
    rematch: { me: room.rematch[s], opp: room.rematch[1 - s] },
    chat: room.chat.map((c) => ({ id: c.id, from: rel(c.seat), text: c.text })),
    events: room.events.filter((e) => e.id > since).map((e) => relEvent(e, rel, s)),
    lastEvent: room.eventSeq,
  };
  const m = room.match;
  if (!m) return v;
  v.matchNo = room.matchNo;
  v.scores = { me: m.scores[s], opp: m.scores[1 - s] };
  v.handNumber = m.handNumber;
  v.over = m.over;
  v.winner = m.over ? rel(m.winner) : null;
  const h = m.hand ? revive(m).hand : null;
  if (h) {
    v.hand = {
      mano: rel(h.mano),
      myCards: h.cards[s],
      oppCount: h.cards[1 - s].length,
      table: { me: h.table[s], opp: h.table[1 - s] },
      bazas: h.bazas.map(rel),
      actor: h.finished ? null : rel(h.actor),
      pending: h.pending && { kind: h.pending.kind, caller: rel(h.pending.caller), level: h.pending.level, chain: h.pending.chain },
      truco: { level: h.truco.level, owner: h.truco.owner === null ? null : rel(h.truco.owner) },
      envido: {
        done: h.envido.done,
        winner: h.envido.winner === null ? null : rel(h.envido.winner),
        points: h.envido.points,
        values: h.envido.values ? { me: h.envido.values[s], opp: h.envido.values[1 - s] } : null,
      },
      myEnvido: envidoOf(h.dealt[s]),
      finished: h.finished,
      winner: h.finished ? rel(h.winner) : null,
      points: { me: h.points[s], opp: h.points[1 - s] },
      trucoPoints: h.trucoPoints || 0,
      // Al terminar la mano se ven las cartas que le quedaban al otro.
      oppReveal: h.finished ? h.cards[1 - s] : null,
      actions: h.finished ? [] : h.actions(s),
    };
  }
  return v;
}

function relEvent(e, rel, s) {
  const out = { ...e, who: e.who === undefined ? undefined : rel(e.who) };
  if (e.winner !== undefined) out.winner = rel(e.winner);
  if (e.result !== undefined) out.result = rel(e.result);
  if (e.values) out.values = { me: e.values[s], opp: e.values[1 - s] };
  return out;
}

// --- Acceso a Redis con control de versión ---
async function load(cfg, code) {
  const raw = await redis(cfg, ['GET', key(code)]);
  if (!raw) throw new HttpError(404, 'La sala no existe o ya venció');
  return JSON.parse(raw);
}

// Lee, aplica `fn` y guarda; si otro la modificó en el medio, reintenta.
async function update(cfg, code, fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const room = await load(cfg, code);
    const prev = room.ver;
    const result = fn(room);
    room.ver = prev + 1;
    const ok = await redis(cfg, ['EVAL', CAS, 1, key(code), String(prev), JSON.stringify(room), String(TTL)]);
    if (ok === 1) return { room, result };
    if (ok === -1) throw new HttpError(404, 'La sala no existe o ya venció');
  }
  throw new HttpError(409, 'Mucho movimiento en la sala, probá de nuevo');
}

// --- Acciones ---
async function create(cfg, body) {
  const target = Number(body.target) === 30 ? 30 : 15;
  const token = newToken();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode();
    const room = {
      code, ver: 0, target, status: 'waiting', created: Date.now(),
      players: [{ name: cleanName(body.name), token, seen: Date.now() }, null],
      match: null, events: [], eventSeq: 0, chat: [], chatSeq: 0, lastChat: [0, 0],
      rematch: [false, false], left: null,
    };
    const ok = await redis(cfg, ['SET', key(code), JSON.stringify(room), 'EX', TTL, 'NX']);
    if (ok === 'OK') return { code, token, seat: 0, view: view(room, 0) };
  }
  throw new HttpError(503, 'No se pudo crear la sala, probá de nuevo');
}

async function join(cfg, body) {
  const code = normalizeCode(body.code);
  let seat = null;
  let token = null;
  const { room } = await update(cfg, code, (r) => {
    // Volver a entrar con el mismo token (se cortó internet, se cerró la app...).
    const back = body.token && r.players.findIndex((p) => p && p.token === body.token);
    if (back !== null && back !== undefined && back >= 0) {
      seat = back;
      token = body.token;
      r.players[seat].seen = Date.now();
      if (r.left === seat) r.left = null;
      return;
    }
    if (r.players[1]) throw new HttpError(409, 'La sala ya está llena');
    seat = 1;
    token = newToken();
    r.players[1] = { name: cleanName(body.name), token, seen: Date.now() };
    startMatch(r, Math.random() < 0.5 ? 0 : 1);
  });
  return { code, token, seat, view: view(room, seat) };
}

function act(room, seat, body) {
  if (room.status !== 'playing') throw new HttpError(409, 'La partida no está en juego');
  const m = revive(room.match);
  const h = m.hand;
  const move = body.move || {};
  const action = { type: String(move.type || '') };
  if (action.type === 'play') action.index = Number(move.index);
  if (!h || h.finished || !h.can(seat, action)) throw new HttpError(400, 'Jugada inválida');
  h.act(seat, action);
  collectEvents(room, m);
  if (h.finished) {
    m.settle();
    if (m.over) room.status = 'over';
  }
  room.match = freeze(m);
}

function next(room) {
  if (room.status !== 'playing') return;
  const m = revive(room.match);
  if (!m.hand || !m.hand.finished || m.over) return; // ya la empezó el otro
  m.newHand();
  collectEvents(room, m);
  room.match = freeze(m);
}

function say(room, seat, body) {
  const i = Number(body.phrase);
  if (!Number.isInteger(i) || !PHRASES[i]) throw new HttpError(400, 'Frase desconocida');
  if (Date.now() - room.lastChat[seat] < CHAT_GAP_MS) throw new HttpError(429, 'Pará un poco, che');
  room.lastChat[seat] = Date.now();
  room.chat.push({ id: ++room.chatSeq, seat, text: PHRASES[i] });
  if (room.chat.length > MAX_CHAT) room.chat = room.chat.slice(-MAX_CHAT);
}

function rematch(room, seat) {
  if (room.status !== 'over') throw new HttpError(409, 'La partida no terminó');
  room.rematch[seat] = true;
  if (room.rematch[0] && room.rematch[1]) {
    const prev = room.match;
    // En la revancha empieza siendo mano el otro.
    startMatch(room, prev && prev.hand ? 1 - prev.hand.mano : 0);
  }
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = config();
  if (!cfg) return res.status(503).json({ error: 'El juego online necesita la base de datos (Upstash) configurada' });
  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      const code = normalizeCode(q.code);
      let room = await load(cfg, code);
      const seat = seatOf(room, String(q.token || ''));
      // Marca que sigue conectado (sin escribir en cada consulta).
      if (Date.now() - room.players[seat].seen > SEEN_EVERY_MS) {
        ({ room } = await update(cfg, code, (r) => { r.players[seat].seen = Date.now(); }));
      }
      if (Number(q.ver) === room.ver) return res.status(200).json({ same: true, ver: room.ver });
      return res.status(200).json(view(room, seat, Number(q.since) || 0));
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Método no permitido' });
    }
    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
    if (body.action === 'create') return res.status(200).json(await create(cfg, body));
    if (body.action === 'join') return res.status(200).json(await join(cfg, body));
    const code = normalizeCode(body.code);
    let seat = null;
    const { room } = await update(cfg, code, (r) => {
      seat = seatOf(r, String(body.token || ''));
      r.players[seat].seen = Date.now();
      switch (body.action) {
        case 'act': return act(r, seat, body);
        case 'next': return next(r);
        case 'say': return say(r, seat, body);
        case 'rematch': return rematch(r, seat);
        case 'leave': r.left = seat; return null;
        default: throw new HttpError(400, 'Acción desconocida');
      }
    });
    return res.status(200).json(view(room, seat, Number(body.since) || 0));
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    return res.status(502).json({ error: 'No se pudo hablar con el servidor' });
  }
}

module.exports = handler;
module.exports.normalizeCode = normalizeCode;
module.exports.view = view;
