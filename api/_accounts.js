// Cuentas: lo que comparten la API de cuentas y la de rankings.
// Vercel no publica como ruta los archivos de /api que empiezan con "_".
const crypto = require('crypto');
const { redis } = require('./_redis.js');

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,16}$/;
const SESSION_TTL = 180 * 24 * 3600; // las sesiones duran 6 meses (se renuevan al usarlas)

const accountKey = (username) => `acct:${String(username).toLowerCase()}`;
const sessionKey = (token) => `sess:${token}`;

function safeParse(text) {
  try { return JSON.parse(text) || null; } catch { return null; }
}

async function getAccount(cfg, username) {
  if (!USERNAME_RE.test(String(username || ''))) return null;
  return safeParse(await redis(cfg, ['GET', accountKey(username)]));
}

// ¿Este nombre es de una cuenta? (para que nadie use el nombre de otro en los rankings)
async function isAccountName(cfg, name) {
  return USERNAME_RE.test(String(name || '')) && !!(await redis(cfg, ['GET', accountKey(name)]));
}

// Devuelve la cuenta dueña de la sesión, o null si la sesión no existe o venció.
async function sessionAccount(cfg, token) {
  if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null;
  const username = await redis(cfg, ['GET', sessionKey(token)]);
  if (!username) return null;
  await redis(cfg, ['EXPIRE', sessionKey(token), SESSION_TTL]);
  return getAccount(cfg, username);
}

async function newSession(cfg, username) {
  const token = crypto.randomBytes(24).toString('hex');
  await redis(cfg, ['SET', sessionKey(token), username, 'EX', SESSION_TTL]);
  return token;
}

// Contraseñas: scrypt con sal propia por cuenta (nunca se guarda la contraseña).
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 32).toString('hex') };
}

function checkPassword(password, account) {
  const { hash } = hashPassword(password, account.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(String(account.hash || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  USERNAME_RE, SESSION_TTL, accountKey, sessionKey, safeParse, getAccount, isAccountName,
  sessionAccount, newSession, hashPassword, checkPassword,
};
