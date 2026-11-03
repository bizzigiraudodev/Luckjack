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
const TrucoAI = require('../js/truco-ai.js');
const Senas = require('../js/senas.js');
const { config, redis, cleanName } = require('./_redis.js');

const { TrucoMatch, TrucoHand, rank, envidoOf, PHRASES } = Truco;
const TTL = 2 * 3600;
const WORDS = ['MATE', 'PAMPA', 'TRUCO', 'FACON', 'PONCHO', 'RANCHO', 'OMBU', 'ASADO', 'GAUCHO', 'TANGO', 'POTRO', 'BOMBO', 'CHALA', 'TROPA'];
const MAX_EVENTS = 60;
const MAX_CHAT = 12;
const CHAT_GAP_MS = 1500;
const SEEN_EVERY_MS = 15000;
const ONLINE_MS = 30000;
const MAX_SENAS = 6; // por jugador y por mano
// Bots que completan una mesa de 4.
const BOTS = [
  { name: 'El Viejo', char: 'gaucho', persona: 'gaucho' },
  { name: 'El Diablo', char: 'diablo', persona: 'diablo' },
  { name: 'San Pedro', char: 'santo', persona: 'santo' },
];

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
    // Salas creadas antes de que existiera el truco de a 4.
    if (m.hand.n === undefined) Object.assign(m.hand, { n: 2, leader: m.hand.turn, bazaWinners: [] });
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

const sizeOf = (room) => room.size || 2;
const isBot = (room, p) => !!(room.players[p] && room.players[p].bot);

// Los bots le hacen señas a su compañero al empezar cada mano (honestas: es su pareja).
function botSenas(room, m) {
  const h = m.hand;
  if (sizeOf(room) !== 4 || !h) return;
  for (let p = 0; p < 4; p++) {
    if (!isBot(room, p) || isBot(room, (p + 2) % 4)) continue;
    for (const sena of Senas.senasFor(h.dealt[p], h.envidoValueOf(p))) {
      room.senas.push({ id: ++room.senaSeq, seat: p, sena, hand: m.handNumber });
    }
  }
}

// Juegan los bots hasta que le toque a un humano. Si cantan contra una pareja con algún humano,
// responde el humano.
function runBots(room, m) {
  const h = m.hand;
  if (!h) return;
  for (let guard = 0; guard < 80 && !h.finished; guard++) {
    let p;
    if (h.pending) {
      const responders = [...Array(h.n).keys()].filter((q) => h.canRespond(q));
      if (responders.some((q) => !isBot(room, q))) return;
      p = h.actor;
    } else {
      p = h.turn;
    }
    if (!isBot(room, p)) return;
    const partner = (p + 2) % h.n;
    const hints = Senas.hintsFrom(room.senas.filter((x) => x.seat === partner && x.hand === m.handNumber).map((x) => x.sena));
    const persona = TrucoAI.PERSONAS[room.players[p].persona] || TrucoAI.PERSONAS.gaucho;
    const a = TrucoAI.decide(h, p, persona, Math.random, hints);
    if (!a || !h.can(p, a)) return;
    h.act(p, a);
  }
}

// Después de una jugada: juegan los bots y, si terminó la mano, se suman los puntos.
function advance(room, m) {
  runBots(room, m);
  collectEvents(room, m);
  if (m.hand && m.hand.finished) {
    m.settle();
    if (m.over) room.status = 'over';
  }
  room.match = freeze(m);
}

function startMatch(room, firstMano) {
  const m = new TrucoMatch({ target: room.target, firstMano, players: sizeOf(room) });
  m.newHand();
  room.status = 'playing';
  room.matchNo = (room.matchNo || 0) + 1;
  room.rematch = room.players.map((p) => !!(p && p.bot));
  room.senas = [];
  room.senaSeq = room.senaSeq || 0;
  botSenas(room, m);
  advance(room, m);
}

function seatOf(room, token) {
  const seat = room.players.findIndex((p) => p && p.token === token);
  if (seat < 0) throw new HttpError(403, 'No sos parte de esta sala');
  return seat;
}

// --- Lo que ve cada jugador (todo relativo a él: 'me' / 'opp') ---
function view(room, s, since = 0) {
  if (sizeOf(room) === 4) return view4(room, s, since);
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

// --- Vista de una mesa de 4: posiciones relativas (0 vos, 1 derecha, 2 compañero, 3 izquierda) ---
function view4(room, s, since = 0) {
  const n = 4;
  const rel = (q) => (q === null || q === undefined ? q : (q - s + n) % n);
  const myTeam = s % 2;
  const relTeam = (t) => (t === null || t === undefined || t === 'parda' ? t : t === myTeam ? 'us' : 'them');
  const byPos = (arr) => [0, 1, 2, 3].map((pos) => arr[(s + pos) % n]);
  const m = room.match;
  const handNumber = m ? m.handNumber : 0;
  const v = {
    size: 4,
    code: room.code,
    ver: room.ver,
    status: room.status,
    target: room.target,
    seat: s,
    host: s === 0,
    players: room.players.map((p, q) => (p ? {
      name: p.name, bot: !!p.bot, char: p.char || null, seat: q, pos: rel(q),
      online: !!p.bot || Date.now() - p.seen < ONLINE_MS,
    } : { name: null, seat: q, pos: rel(q), empty: true })),
    left: room.left === null ? null : rel(room.left),
    rematch: { me: !!room.rematch[s], waiting: room.players.filter((p, q) => p && !p.bot && !room.rematch[q]).map((p) => p.name) },
    chat: room.chat.map((c) => ({ id: c.id, from: rel(c.seat), text: c.text })),
    events: room.events.filter((e) => e.id > since).map((e) => relEvent4(e, rel, relTeam, myTeam)),
    lastEvent: room.eventSeq,
    // Las señas solo las ven el que las hace y su compañero.
    senas: (room.senas || []).filter((x) => x.hand === handNumber && (x.seat === s || x.seat === (s + 2) % n))
      .map((x) => ({ id: x.id, from: rel(x.seat), sena: x.sena })),
  };
  if (!m) return v;
  v.matchNo = room.matchNo;
  v.scores = { us: m.scores[myTeam], them: m.scores[1 - myTeam] };
  v.handNumber = m.handNumber;
  v.over = m.over;
  v.winner = m.over ? relTeam(m.winner) : null;
  const h = m.hand ? revive(m).hand : null;
  if (h) {
    v.hand = {
      mano: rel(h.mano),
      myCards: h.cards[s],
      counts: byPos(h.cards).map((c) => c.length),
      table: byPos(h.table),
      bazas: h.bazas.map(relTeam),
      bazaWinners: h.bazaWinners.map(rel),
      turn: rel(h.turn),
      actor: h.finished ? null : rel(h.actor),
      pending: h.pending && { kind: h.pending.kind, caller: rel(h.pending.caller), level: h.pending.level, chain: h.pending.chain },
      canRespond: h.canRespond(s),
      truco: { level: h.truco.level, owner: relTeam(h.truco.owner) },
      envido: {
        done: h.envido.done,
        winner: relTeam(h.envido.winner),
        points: h.envido.points,
        holder: rel(h.envido.holder),
        values: h.envido.values ? { us: h.envido.values[myTeam], them: h.envido.values[1 - myTeam] } : null,
      },
      myEnvido: envidoOf(h.dealt[s]),
      finished: h.finished,
      winner: h.finished ? relTeam(h.winner) : null,
      points: { us: h.points[myTeam], them: h.points[1 - myTeam] },
      trucoPoints: h.trucoPoints || 0,
      // Al terminar la mano se ven las cartas que le quedaban a cada uno.
      reveal: h.finished ? byPos(h.cards) : null,
      actions: h.finished ? [] : h.actions(s),
    };
  }
  return v;
}

function relEvent4(e, rel, relTeam, myTeam) {
  const out = { ...e };
  if (e.who !== undefined) out.who = rel(e.who);
  if (e.winner !== undefined) out.winner = relTeam(e.winner);
  if (e.result !== undefined) out.result = relTeam(e.result);
  if (e.player !== undefined) out.player = rel(e.player);
  if (e.holder !== undefined) out.holder = rel(e.holder);
  if (e.values) out.values = { us: e.values[myTeam], them: e.values[1 - myTeam] };
  return out;
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
  const size = Number(body.players) === 4 ? 4 : 2;
  const token = newToken();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode();
    const room = {
      code, ver: 0, target, size, status: 'waiting', created: Date.now(),
      players: [{ name: cleanName(body.name), token, seen: Date.now() }, ...Array(size - 1).fill(null)],
      match: null, events: [], eventSeq: 0, chat: [], chatSeq: 0, lastChat: Array(size).fill(0),
      rematch: Array(size).fill(false), left: null, senas: [], senaSeq: 0,
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
    const free = r.players.findIndex((p) => !p);
    if (free < 0 || r.status !== 'waiting') throw new HttpError(409, 'La sala ya está llena');
    seat = free;
    token = newToken();
    r.players[seat] = { name: cleanName(body.name), token, seen: Date.now() };
    // Mano a mano arranca sola; de a 4 la empieza el que creó la sala.
    if (sizeOf(r) === 2) startMatch(r, Math.random() < 0.5 ? 0 : 1);
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
  advance(room, m);
}

// --- Sala de 4: armar parejas, empezar con bots y señas ---
function swap(room, seat, body) {
  if (seat !== 0) throw new HttpError(403, 'Solo el que creó la sala arma las parejas');
  if (room.status !== 'waiting' || sizeOf(room) !== 4) throw new HttpError(409, 'La partida ya empezó');
  const a = Number(body.a);
  const b = Number(body.b);
  if (![a, b].every((x) => Number.isInteger(x) && x >= 0 && x < 4) || a === b) throw new HttpError(400, 'Lugar inválido');
  if (a === 0 || b === 0) throw new HttpError(400, 'El que creó la sala se queda en su lugar');
  [room.players[a], room.players[b]] = [room.players[b], room.players[a]];
}

function start(room, seat) {
  if (seat !== 0) throw new HttpError(403, 'Solo el que creó la sala puede empezar');
  if (room.status !== 'waiting' || sizeOf(room) !== 4) throw new HttpError(409, 'La partida ya empezó');
  const used = new Set(room.players.filter((p) => p && p.bot).map((p) => p.name));
  const bots = BOTS.filter((b) => !used.has(b.name));
  room.players = room.players.map((p) => p || { ...bots.shift(), bot: true });
  startMatch(room, Math.floor(Math.random() * 4));
}

function sena(room, seat, body) {
  if (sizeOf(room) !== 4 || room.status !== 'playing') throw new HttpError(409, 'Las señas son para el truco de a 4');
  if (!Senas.getSena(body.sena)) throw new HttpError(400, 'Seña desconocida');
  const handNumber = room.match.handNumber;
  const mine = room.senas.filter((x) => x.seat === seat && x.hand === handNumber).length;
  if (mine >= MAX_SENAS) throw new HttpError(429, 'Ya hiciste muchas señas en esta mano');
  room.senas.push({ id: ++room.senaSeq, seat, sena: body.sena, hand: handNumber });
}

function next(room) {
  if (room.status !== 'playing') return;
  const m = revive(room.match);
  if (!m.hand || !m.hand.finished || m.over) return; // ya la empezó otro
  m.newHand();
  if (room.senas) room.senas = room.senas.filter((x) => x.hand >= m.handNumber - 1);
  botSenas(room, m);
  advance(room, m);
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
  if (room.rematch.every(Boolean)) {
    const prev = room.match;
    // En la revancha empieza siendo mano el siguiente.
    startMatch(room, prev && prev.hand ? (prev.hand.mano + 1) % sizeOf(room) : 0);
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
        case 'swap': return swap(r, seat, body);
        case 'start': return start(r, seat);
        case 'sena': return sena(r, seat, body);
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
