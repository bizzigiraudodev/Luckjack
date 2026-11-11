// API de cuentas: usuario y contraseña, sin mail ni links. Vercel Function + Upstash Redis.
//   POST /api/account { action: 'register', username, password, pid?, progress? }
//        → crea la cuenta si el usuario está libre. Se queda con el id de jugador de este
//          dispositivo (tus marcas pasan a la cuenta) y con tu progreso.
//   POST /api/account { action: 'login', username, password, progress? }
//   POST /api/account { action: 'sync', token, progress }   → combina el progreso y lo devuelve
//   POST /api/account { action: 'logout', token }
// register, login y sync devuelven { username, token, pid, progress }.
// En la base: acct:<usuario en minúsculas> = { username, salt, hash, pid, created, progress }
//             sess:<token> = usuario (vence a los 6 meses sin usarse)
const crypto = require('crypto');
const { config, redis } = require('./_redis.js');
const A = require('./_accounts.js');
const Progress = require('../js/progress.js');

const RATE_LIMIT = 30; // pedidos por minuto por IP
const MAX_FAILS = 10; // contraseñas mal seguidas por usuario antes de frenarlo 15 minutos
const FAIL_WINDOW = 15 * 60;
const RESERVED = ['timbero', 'invitado', 'admin', 'administrador', 'moderador', 'dev'];

const reply = (res, code, data) => res.status(code).json(data);
const publicAccount = (acct, token) => ({ username: acct.username, token, pid: acct.pid, progress: acct.progress || {} });

function validCredentials(username, password) {
  if (!A.USERNAME_RE.test(String(username || ''))) return 'El usuario tiene que tener de 3 a 16 letras, números, puntos, guiones o guiones bajos (sin espacios).';
  if (typeof password !== 'string' || password.length < 4 || password.length > 72) return 'La contraseña tiene que tener entre 4 y 72 caracteres.';
  return null;
}

async function register(cfg, body) {
  const { username, password } = body;
  const bad = validCredentials(username, password);
  if (bad) return [400, { error: bad }];
  if (RESERVED.includes(username.toLowerCase())) return [409, { error: 'Ese usuario está reservado. Probá con otro.' }];
  const pid = /^[a-z0-9]{8,32}$/i.test(String(body.pid || '')) ? String(body.pid) : crypto.randomBytes(8).toString('hex');
  const acct = { username, ...A.hashPassword(password), pid, created: new Date().toISOString().slice(0, 10), progress: Progress.clean(body.progress) };
  // NX: solo se crea si nadie tiene ese usuario (sin importar mayúsculas).
  const ok = await redis(cfg, ['SET', A.accountKey(username), JSON.stringify(acct), 'NX']);
  if (!ok) return [409, { error: 'Ese usuario ya existe. Si es tuyo, entrá con tu contraseña.' }];
  return [200, publicAccount(acct, await A.newSession(cfg, username))];
}

async function login(cfg, body) {
  const { username, password } = body;
  const bad = validCredentials(username, password);
  if (bad) return [401, { error: 'Usuario o contraseña incorrectos.' }]; // sin pistas de qué falló
  const failKey = `afail:${username.toLowerCase()}`;
  if (Number(await redis(cfg, ['GET', failKey])) >= MAX_FAILS) return [429, { error: 'Demasiados intentos con este usuario. Probá de nuevo en 15 minutos.' }];
  const acct = await A.getAccount(cfg, username);
  if (!acct || !A.checkPassword(password, acct)) {
    const n = await redis(cfg, ['INCR', failKey]);
    if (n === 1) await redis(cfg, ['EXPIRE', failKey, FAIL_WINDOW]);
    return [401, { error: 'Usuario o contraseña incorrectos.' }];
  }
  await redis(cfg, ['DEL', failKey]);
  if (body.progress) {
    acct.progress = Progress.merge(acct.progress, body.progress);
    await redis(cfg, ['SET', A.accountKey(acct.username), JSON.stringify(acct)]);
  }
  return [200, publicAccount(acct, await A.newSession(cfg, acct.username))];
}

async function sync(cfg, body) {
  const acct = await A.sessionAccount(cfg, body.token);
  if (!acct) return [401, { error: 'Tu sesión venció. Volvé a entrar.' }];
  const merged = Progress.merge(acct.progress, body.progress);
  if (JSON.stringify(merged) !== JSON.stringify(acct.progress || {})) {
    acct.progress = merged;
    await redis(cfg, ['SET', A.accountKey(acct.username), JSON.stringify(acct)]);
  }
  return [200, publicAccount(acct, body.token)];
}

async function logout(cfg, body) {
  if (/^[a-f0-9]{48}$/.test(String(body.token || ''))) await redis(cfg, ['DEL', A.sessionKey(body.token)]);
  return [200, { ok: true }];
}

const ACTIONS = { register, login, sync, logout };

async function allowed(cfg, req) {
  const ip = String(req.headers['x-forwarded-for'] || 'local').split(',')[0].trim();
  const key = `arl:${ip}`;
  const count = await redis(cfg, ['INCR', key]);
  if (count === 1) await redis(cfg, ['EXPIRE', key, 60]);
  return count <= RATE_LIMIT;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(res, 405, { error: 'Método no permitido' });
  }
  const cfg = config();
  if (!cfg) return reply(res, 503, { error: 'Las cuentas no están disponibles ahora.' });
  const body = typeof req.body === 'string' ? A.safeParse(req.body) : req.body;
  const action = body && ACTIONS[body.action];
  if (!action) return reply(res, 400, { error: 'Acción desconocida' });
  try {
    if (!(await allowed(cfg, req))) return reply(res, 429, { error: 'Demasiados pedidos. Probá en un minuto.' });
    const [code, data] = await action(cfg, body);
    return reply(res, code, data);
  } catch (e) {
    return reply(res, 502, { error: 'No se pudo hablar con la base de datos.' });
  }
}

module.exports = handler;
module.exports.RESERVED = RESERVED;
