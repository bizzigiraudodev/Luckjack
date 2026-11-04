// API de rankings globales: Vercel Function + Upstash Redis (por su API REST, sin dependencias).
//   GET  /api/leaderboard?board=story|chips|cycles|trucoStory|trucoCycles|speedStory|speedTrucoStory|playtime&pid=...
//        → los 10 mejores (en playtime, los 200 que más jugaron)
//        (los ids de los jugadores no se devuelven: tu fila viene marcada con `me`)
//   POST /api/leaderboard  { board, pid, name, value, hands } → guarda la marca si mejora la anterior
// Cada jugador (pid, un id aleatorio de su dispositivo) tiene una sola fila por ranking: su mejor marca.

const BOARDS = {
  story: { order: 'asc', min: 5000, max: 24 * 3600 * 1000 }, // milisegundos: menos es mejor
  chips: { order: 'desc', min: 1, max: 1e8 },
  cycles: { order: 'desc', min: 1, max: 10000 },
  trucoStory: { order: 'asc', min: 5000, max: 24 * 3600 * 1000 },
  trucoCycles: { order: 'desc', min: 1, max: 10000 },
  // Modo speedrun (sin animaciones): rankings aparte para no competir con las partidas normales.
  speedStory: { order: 'asc', min: 5000, max: 24 * 3600 * 1000 },
  speedTrucoStory: { order: 'asc', min: 5000, max: 24 * 3600 * 1000 },
  // Tiempo total de juego (ms), de todos los jugadores: lista larga.
  playtime: { order: 'desc', min: 60 * 1000, max: 1e11, top: 200 },
};
const PLAYTIME_FIRST_MAX = 4 * 3600 * 1000; // la primera vez se aceptan hasta 4 horas acumuladas
const PLAYTIME_SLACK = 60 * 1000;
const TIME_BOARDS = ['story', 'trucoStory', 'speedStory', 'speedTrucoStory'];
const SPEED_BOARDS = ['speedStory', 'speedTrucoStory'];

// Clave de prueba (solo se guarda su hash): las marcas que la traen no las frena el anti-bot,
// pero van a un ranking de pruebas aparte y nunca aparecen en los públicos.
const TEST_KEY_SHA256 = '033a820510c0a8ee8ce3ecf470c6b1557d103b6c5fac886d6907dd82813e0b80';
const crypto = require('crypto');
const isTestKey = (key) => typeof key === 'string' && key.length >= 16 &&
  crypto.createHash('sha256').update(key).digest('hex') === TEST_KEY_SHA256;

// Anti-bot: con las estadísticas de cómo se jugó (js/antibot.js) decide si la marca es de un programa.
// Devuelve el motivo, o null si parece humana.
function botReason(proof, hands) {
  if (!proof || typeof proof !== 'object') return 'sin datos de la partida';
  const n = (k) => Math.max(0, Number(proof[k]) || 0);
  const clicks = n('clicks');
  const inputs = clicks + n('keys');
  if (proof.webdriver) return 'navegador automatizado';
  if (n('untrusted') > 3) return 'jugadas simuladas por código';
  if (inputs < hands) return 'menos jugadas que manos';
  if (clicks >= 20 && n('centered') / clicks > 0.6) return 'clics siempre en el centro exacto';
  if (inputs >= 20 && n('medianGap') < 120) return 'jugadas demasiado rápidas';
  if (inputs >= 30 && n('cv') < 0.15) return 'ritmo de máquina';
  if (n('mouseClicks') >= 20 && n('moves') < n('mouseClicks')) return 'el mouse no se mueve entre clics';
  return null;
}

const TOP = 10;
const RATE_LIMIT = 10; // envíos por minuto por IP
// Controles de plausibilidad: lo mínimo que hay que jugar para lograr cada marca.
const MIN_HANDS_STORY = 15; // 3 ciclos de al menos 5 manos
const MIN_MS_PER_HAND = 2000; // nadie juega una mano en menos de 2 segundos
const MIN_MS_PER_HAND_SPEED = 700; // sin animaciones se juega más rápido
const MAX_CHIPS_PER_HAND = 1000;
const MIN_HANDS_PER_CYCLE = 5;

const { config, redis, cleanName } = require('./_redis.js');

// Valida lo que manda el juego. Devuelve { board, pid, entry, value } o { error }.
function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'Falta el cuerpo' };
  const b = BOARDS[body.board];
  if (!b) return { error: 'Ranking desconocido' };
  const value = Number(body.value);
  const test = isTestKey(body.testKey);
  if (!Number.isFinite(value) || (!test && (value < b.min || value > b.max)) || value < 1) return { error: 'Valor fuera de rango' };
  const pid = String(body.pid || '');
  if (!/^[a-z0-9]{8,32}$/i.test(pid)) return { error: 'Jugador inválido' };
  const hands = Math.max(0, Math.min(1e6, Math.floor(Number(body.hands) || 0)));
  if (!test && !plausible(body.board, value, hands)) return { error: 'La marca no se guardó: es imposible jugando de verdad', bot: true };
  const proof = sanitizeProof(body.proof);
  const bot = test ? null : botReason(proof, hands);
  if (bot) return { error: `La marca no se guardó: parece un bot (${bot})`, bot: true };
  return {
    board: body.board,
    pid,
    test,
    value: Math.floor(value),
    entry: { name: cleanName(body.name), hands, date: new Date().toISOString().slice(0, 10), proof },
  };
}

function plausible(board, value, hands) {
  if (TIME_BOARDS.includes(board)) {
    const perHand = SPEED_BOARDS.includes(board) ? MIN_MS_PER_HAND_SPEED : MIN_MS_PER_HAND;
    return hands >= MIN_HANDS_STORY && value >= hands * perHand;
  }
  if (board === 'cycles' || board === 'trucoCycles') return hands >= value * MIN_HANDS_PER_CYCLE;
  if (board === 'chips') return value <= 100 + hands * MAX_CHIPS_PER_HAND;
  return true;
}

function sanitizeProof(p) {
  if (!p || typeof p !== 'object') return null;
  const out = { webdriver: !!p.webdriver };
  for (const k of ['clicks', 'keys', 'untrusted', 'centered', 'moves', 'mouseClicks', 'medianGap', 'cv']) {
    out[k] = Math.max(0, Math.min(1e6, Number(p[k]) || 0));
  }
  return out;
}

const keys = (board, test = false) => (test
  ? { scores: `lbtest:${board}`, info: `lbtest:${board}:info` }
  : { scores: `lb:${board}`, info: `lb:${board}:info` });

async function top(cfg, board, me = '') {
  const { scores, info } = keys(board);
  const limit = BOARDS[board].top || TOP;
  const cmd = BOARDS[board].order === 'asc'
    ? ['ZRANGE', scores, 0, limit - 1, 'WITHSCORES']
    : ['ZRANGE', scores, 0, limit - 1, 'REV', 'WITHSCORES'];
  const flat = (await redis(cfg, cmd)) || [];
  const pids = [];
  const values = [];
  for (let i = 0; i < flat.length; i += 2) {
    pids.push(flat[i]);
    values.push(Number(flat[i + 1]));
  }
  if (!pids.length) return [];
  const details = await redis(cfg, ['HMGET', info, ...pids]);
  const rows = [];
  for (let i = 0; i < pids.length; i++) {
    const { proof, ...data } = safeParse(details[i]);
    // Limpieza automática: si una marca guardada no pasa las reglas anti-bot actuales, se borra.
    if (proof && botReason(proof, data.hands || 0)) {
      await redis(cfg, ['ZREM', scores, pids[i]]);
      await redis(cfg, ['HDEL', info, pids[i]]);
      continue;
    }
    rows.push({ ...data, value: values[i], me: !!me && pids[i] === me });
  }
  return rows;
}

function safeParse(text) {
  try { return JSON.parse(text) || {}; } catch { return {}; }
}

async function submit(cfg, { board, pid, value, entry, test }) {
  const { scores, info } = keys(board, test);
  if (board === 'playtime') {
    // El tiempo jugado no puede crecer más rápido que el reloj desde el último envío.
    const old = safeParse(await redis(cfg, ['HGET', info, pid]));
    const now = Date.now();
    const cap = old.at ? (old.total || 0) + (now - old.at) + PLAYTIME_SLACK : PLAYTIME_FIRST_MAX;
    value = Math.min(value, cap);
    entry = { ...entry, at: now, total: Math.max(value, old.total || 0) };
  }
  const asc = BOARDS[board].order === 'asc';
  // GT/LT: solo se actualiza si la marca nueva es mejor. CH: devuelve 1 si cambió algo.
  const changed = await redis(cfg, ['ZADD', scores, asc ? 'LT' : 'GT', 'CH', value, pid]);
  if (changed) await redis(cfg, ['HSET', info, pid, JSON.stringify(entry)]);
  else {
    // Aunque no mejore, se actualiza el nombre por si lo cambió.
    const old = safeParse(await redis(cfg, ['HGET', info, pid]));
    await redis(cfg, ['HSET', info, pid, JSON.stringify({ ...old, name: entry.name })]);
  }
  const rank = await redis(cfg, [asc ? 'ZRANK' : 'ZREVRANK', scores, pid]);
  return { improved: !!changed, rank: rank === null ? null : rank + 1, ...(test ? { test: true } : {}) };
}

async function allowed(cfg, req) {
  const ip = String(req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
  const key = `rl:${ip}`;
  const count = await redis(cfg, ['INCR', key]);
  if (count === 1) await redis(cfg, ['EXPIRE', key, 60]);
  return count <= RATE_LIMIT;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = config();
  if (!cfg) return res.status(503).json({ error: 'Los rankings globales no están configurados' });
  try {
    if (req.method === 'GET') {
      const board = req.query && req.query.board;
      if (!BOARDS[board]) return res.status(400).json({ error: 'Ranking desconocido' });
      return res.status(200).json({ board, entries: await top(cfg, board, String(req.query.pid || '')) });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
      const data = validate(body);
      if (data.error) return res.status(data.bot ? 403 : 400).json({ error: data.error });
      if (!(await allowed(cfg, req))) return res.status(429).json({ error: 'Demasiados envíos, probá en un rato' });
      return res.status(200).json(await submit(cfg, data));
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo hablar con la base de datos' });
  }
}

module.exports = handler;
module.exports.validate = validate;
module.exports.BOARDS = BOARDS;
module.exports.plausible = plausible;
module.exports.botReason = botReason;
