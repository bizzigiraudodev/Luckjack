const test = require('node:test');
const assert = require('node:assert');
const fakeRedis = require('./helpers/fake-redis.js');
const account = require('../api/account.js');
const leaderboard = require('../api/leaderboard.js');
const Progress = require('../js/progress.js');

const HUMAN = { webdriver: false, clicks: 200, keys: 0, untrusted: 0, centered: 3, moves: 900, mouseClicks: 200, medianGap: 800, cv: 0.6 };

function call(handler, method, body, ip = '1.2.3.4') {
  return new Promise((resolve) => {
    const res = {
      code: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.code = c; return this; },
      json(data) { resolve({ code: this.code, data }); },
    };
    handler({ method, query: method === 'GET' ? body : undefined, body: method === 'POST' ? body : undefined, headers: { 'x-forwarded-for': ip } }, res);
  });
}
const acct = (body, ip) => call(account, 'POST', body, ip);

function setup() {
  process.env.KV_REST_API_URL = 'https://redis.example';
  process.env.KV_REST_API_TOKEN = 'token';
  const db = fakeRedis();
  global.fetch = db.fetch;
  return db;
}

test('progreso: combinar suma desbloqueos y se queda con los mejores récords', () => {
  const a = { storyDone: true, best: { cycles: 4, money: 900 }, playMs: 5000, trucoClassic: { wins: 3, losses: 9 }, basura: 'x' };
  const b = { trucoPampaBeaten: true, best: { cycles: 6, money: 100 }, playMs: 2000, bestClassic: 750, trucoClassic: { wins: 5, losses: 1 } };
  assert.deepStrictEqual(Progress.merge(a, b), {
    storyDone: true,
    trucoPampaBeaten: true,
    best: { cycles: 6, money: 100 },
    bestClassic: 750,
    playMs: 5000,
    trucoClassic: { wins: 5, losses: 9 },
  });
  assert.deepStrictEqual(Progress.clean({ storyDone: 'true', playMs: -5, best: 'mucho' }), {}, 'tipos raros no pasan');
});

test('cuentas: crear, usuario repetido, datos inválidos y contraseña hasheada', async () => {
  const db = setup();
  let r = await acct({ action: 'register', username: 'Pocho', password: 'mate123', pid: 'invitado0001', progress: { storyDone: true } });
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.data.username, 'Pocho');
  assert.strictEqual(r.data.pid, 'invitado0001', 'la cuenta se queda con el id de este dispositivo (y sus marcas)');
  assert.match(r.data.token, /^[a-f0-9]{48}$/);
  assert.deepStrictEqual(r.data.progress, { storyDone: true });

  const stored = db.kv.get('acct:pocho');
  assert.ok(stored && !stored.includes('mate123'), 'la contraseña nunca se guarda tal cual');
  assert.ok(JSON.parse(stored).salt && JSON.parse(stored).hash);

  assert.strictEqual((await acct({ action: 'register', username: 'POCHO', password: 'otra1234' })).code, 409, 'sin importar mayúsculas');
  assert.strictEqual((await acct({ action: 'register', username: 'Timbero', password: 'abcd' })).code, 409, 'reservado');
  assert.strictEqual((await acct({ action: 'register', username: 'ab', password: 'abcd' })).code, 400);
  assert.strictEqual((await acct({ action: 'register', username: 'con espacio', password: 'abcd' })).code, 400);
  assert.strictEqual((await acct({ action: 'register', username: 'Coco', password: '123' })).code, 400, 'contraseña corta');
  assert.strictEqual((await acct({ action: 'nada' })).code, 400);
});

test('cuentas: entrar desde otro dispositivo trae el progreso combinado', async () => {
  setup();
  await acct({ action: 'register', username: 'Pocho', password: 'mate123', pid: 'invitado0001', progress: { storyDone: true, playMs: 60000 } });
  assert.strictEqual((await acct({ action: 'login', username: 'pocho', password: 'mal' })).code, 401);
  const r = await acct({ action: 'login', username: 'pocho', password: 'mate123', progress: { trucoPampaBeaten: true, playMs: 1000 } });
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.data.username, 'Pocho', 'el usuario conserva cómo lo escribió al crearlo');
  assert.strictEqual(r.data.pid, 'invitado0001', 'el mismo id de jugador en todos los dispositivos');
  assert.deepStrictEqual(r.data.progress, { storyDone: true, trucoPampaBeaten: true, playMs: 60000 });

  // Sincronizar con la sesión: sube lo nuevo y devuelve todo.
  const s = await acct({ action: 'sync', token: r.data.token, progress: { trucoBest: { cycles: 3, money: 400 } } });
  assert.strictEqual(s.code, 200);
  assert.deepStrictEqual(s.data.progress.trucoBest, { cycles: 3, money: 400 });
  assert.strictEqual(s.data.progress.storyDone, true);
  assert.strictEqual((await acct({ action: 'sync', token: 'f'.repeat(48), progress: {} })).code, 401);

  // Cerrar sesión invalida el token.
  await acct({ action: 'logout', token: r.data.token });
  assert.strictEqual((await acct({ action: 'sync', token: r.data.token, progress: {} })).code, 401);
});

test('cuentas: después de 10 contraseñas mal, el usuario queda frenado un rato', async () => {
  setup();
  await acct({ action: 'register', username: 'Pocho', password: 'mate123' });
  for (let i = 0; i < 10; i++) {
    assert.strictEqual((await acct({ action: 'login', username: 'Pocho', password: `mal${i}`, }, `9.9.9.${i}`)).code, 401);
  }
  const r = await acct({ action: 'login', username: 'Pocho', password: 'mate123' }, '8.8.8.8');
  assert.strictEqual(r.code, 429, 'ni con la contraseña correcta, aunque cambie de IP');
});

test('rankings: temporada 2, marcas de la cuenta y nombres de cuenta protegidos', async () => {
  const db = setup();
  const reg = await acct({ action: 'register', username: 'Pocho', password: 'mate123', pid: 'invitado0001' });
  const token = reg.data.token;

  // Con cuenta: el nombre es el usuario y el id el de la cuenta, aunque el dispositivo mande otros.
  let r = await call(leaderboard, 'POST', { proof: HUMAN, board: 'story', pid: 'otrocelu0001', name: 'Cualquiera', value: 300000, hands: 45, token });
  assert.strictEqual(r.code, 200);
  r = await call(leaderboard, 'GET', { board: 'story', pid: 'invitado0001' });
  assert.deepStrictEqual(r.data.entries.map((e) => [e.name, e.acct, e.me]), [['Pocho', true, true]]);
  assert.ok(db.zsets.has('lb2:story') && !db.zsets.has('lb:story'), 'temporada 2: claves nuevas');

  // Un invitado no puede usar el nombre de una cuenta (sin importar mayúsculas).
  r = await call(leaderboard, 'POST', { proof: HUMAN, board: 'story', pid: 'invitado0002', name: 'pocho', value: 200000, hands: 45 });
  assert.strictEqual(r.code, 403);
  r = await call(leaderboard, 'POST', { proof: HUMAN, board: 'story', pid: 'invitado0002', name: 'Pepa', value: 200000, hands: 45 });
  assert.strictEqual(r.code, 200);

  // Sesión vencida: la marca no se guarda.
  r = await call(leaderboard, 'POST', { proof: HUMAN, board: 'story', pid: 'invitado0001', name: 'Pocho', value: 100000, hands: 45, token: 'a'.repeat(48) });
  assert.strictEqual(r.code, 401);
});
