// Contadores para medir el marketing (solo totales, nada personal). Los usan las APIs de salas y
// de cuentas; se leen en GET /api/stats. Vercel no publica como ruta los archivos que empiezan con "_".
const { redis } = require('./_redis.js');

const KEEP = 400 * 24 * 3600; // los contadores semanales se guardan algo más de un año

// Lunes (UTC) de la semana de `date`, como AAAA-MM-DD: identifica la semana.
function weekOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Suma 1 al contador semanal `name` (y al total). Nunca hace fallar la acción que lo llama.
async function bump(cfg, name) {
  try {
    const k = `stats:${name}:${weekOf()}`;
    const n = await redis(cfg, ['INCR', k]);
    if (n === 1) await redis(cfg, ['EXPIRE', k, KEEP]);
    await redis(cfg, ['INCR', `stats:${name}:total`]);
  } catch { /* medir no puede romper el juego */ }
}

module.exports = { bump, weekOf };
