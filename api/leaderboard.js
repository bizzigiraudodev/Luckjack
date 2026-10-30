// API de rankings globales: Vercel Function + Upstash Redis (por su API REST, sin dependencias).
//   GET  /api/leaderboard?board=story|chips|cycles  → los 10 mejores
//   POST /api/leaderboard  { board, pid, name, value, hands } → guarda la marca si mejora la anterior
// Cada jugador (pid, un id aleatorio de su dispositivo) tiene una sola fila por ranking: su mejor marca.

const BOARDS = {
  story: { order: 'asc', min: 5000, max: 24 * 3600 * 1000 }, // milisegundos: menos es mejor
  chips: { order: 'desc', min: 1, max: 1e8 },
  cycles: { order: 'desc', min: 1, max: 10000 },
};
const TOP = 10;
const RATE_LIMIT = 10; // envíos por minuto por IP

function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(cfg, command) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis respondió ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function cleanName(name) {
  return String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16) || 'Timbero';
}

// Valida lo que manda el juego. Devuelve { board, pid, entry, value } o { error }.
function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'Falta el cuerpo' };
  const b = BOARDS[body.board];
  if (!b) return { error: 'Ranking desconocido' };
  const value = Number(body.value);
  if (!Number.isFinite(value) || value < b.min || value > b.max) return { error: 'Valor fuera de rango' };
  const pid = String(body.pid || '');
  if (!/^[a-z0-9]{8,32}$/i.test(pid)) return { error: 'Jugador inválido' };
  const hands = Math.max(0, Math.min(1e6, Math.floor(Number(body.hands) || 0)));
  return {
    board: body.board,
    pid,
    value: Math.floor(value),
    entry: { name: cleanName(body.name), hands, date: new Date().toISOString().slice(0, 10) },
  };
}

const keys = (board) => ({ scores: `lb:${board}`, info: `lb:${board}:info` });

async function top(cfg, board) {
  const { scores, info } = keys(board);
  const cmd = BOARDS[board].order === 'asc'
    ? ['ZRANGE', scores, 0, TOP - 1, 'WITHSCORES']
    : ['ZRANGE', scores, 0, TOP - 1, 'REV', 'WITHSCORES'];
  const flat = (await redis(cfg, cmd)) || [];
  const pids = [];
  const values = [];
  for (let i = 0; i < flat.length; i += 2) {
    pids.push(flat[i]);
    values.push(Number(flat[i + 1]));
  }
  if (!pids.length) return [];
  const details = await redis(cfg, ['HMGET', info, ...pids]);
  return pids.map((pid, i) => ({ pid, value: values[i], ...safeParse(details[i]) }));
}

function safeParse(text) {
  try { return JSON.parse(text) || {}; } catch { return {}; }
}

async function submit(cfg, { board, pid, value, entry }) {
  const { scores, info } = keys(board);
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
  return { improved: !!changed, rank: rank === null ? null : rank + 1 };
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
      return res.status(200).json({ board, entries: await top(cfg, board) });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
      const data = validate(body);
      if (data.error) return res.status(400).json({ error: data.error });
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
