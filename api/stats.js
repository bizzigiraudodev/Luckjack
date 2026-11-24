// Estadísticas públicas para el marketing: solo totales, nada personal.
//   GET /api/stats?weeks=8 → { weeks: [{ week, rooms2, rooms4, accounts }], totals: { rooms2, rooms4, accounts } }
// `week` es el lunes (UTC) de cada semana. Los contadores empezaron el 24 de noviembre de 2026.
const { config, redis } = require('./_redis.js');
const { weekOf } = require('./_stats.js');

const NAMES = ['rooms2', 'rooms4', 'accounts'];

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  const cfg = config();
  if (!cfg) return res.status(503).json({ error: 'Las estadísticas no están disponibles ahora.' });
  const n = Math.max(1, Math.min(52, Math.floor(Number(req.query && req.query.weeks) || 8)));
  const weeks = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    weeks.push(weekOf(d));
    d.setUTCDate(d.getUTCDate() - 7);
  }
  try {
    const keys = [...weeks.flatMap((w) => NAMES.map((k) => `stats:${k}:${w}`)), ...NAMES.map((k) => `stats:${k}:total`)];
    const values = (await redis(cfg, ['MGET', ...keys])).map((v) => Number(v) || 0);
    const out = weeks.map((week, i) => Object.fromEntries([['week', week], ...NAMES.map((k, j) => [k, values[i * NAMES.length + j]])]));
    const totals = Object.fromEntries(NAMES.map((k, j) => [k, values[weeks.length * NAMES.length + j]]));
    return res.status(200).json({ weeks: out, totals });
  } catch {
    return res.status(502).json({ error: 'No se pudo hablar con la base de datos.' });
  }
}

module.exports = handler;
