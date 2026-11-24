// Lo que se agregó para el marketing: el modo 5 de copas, los contadores (/api/stats) y la placa
// para compartir.
const test = require('node:test');
const assert = require('node:assert');
const fakeRedis = require('./helpers/fake-redis.js');
const Truco = require('../js/truco.js');
const TrucoAI = require('../js/truco-ai.js');
const room = require('../api/room.js');
const account = require('../api/account.js');
const stats = require('../api/stats.js');
const { weekOf } = require('../api/_stats.js');

const c = (n, s) => ({ n, s });

function call(handler, method, payload) {
  return new Promise((resolve) => {
    const res = {
      code: 200,
      setHeader() {},
      status(code) { this.code = code; return this; },
      json(data) { resolve({ code: this.code, data }); },
    };
    handler({ method, query: method === 'GET' ? payload : undefined, body: method === 'POST' ? payload : undefined, headers: { 'x-forwarded-for': '5.5.5.5' } }, res);
  });
}

test('modo 5 de copas: el 5 de copas le gana a todo, y solo mientras está activo', () => {
  assert.strictEqual(Truco.fiveOfCups, false, 'apagado por defecto');
  assert.ok(Truco.rank(c(5, 'copa')) < Truco.rank(c(1, 'espada')));
  Truco.setFiveOfCups(true);
  try {
    assert.ok(Truco.rank(c(5, 'copa')) > Truco.rank(c(1, 'espada')), 'le gana al ancho de espada');
    assert.strictEqual(Truco.rank(c(5, 'oro')), Truco.rank(c(5, 'basto')), 'los otros cincos no cambian');
    assert.strictEqual(Truco.envidoOf([c(5, 'copa'), c(7, 'copa'), c(1, 'oro')]), 32, 'el envido no cambia');
    // La IA lo sabe: con el 5 de copas contra el ancho de espada en la mesa, gana la baza.
    const order = [c(1, 'espada'), c(5, 'copa'), c(4, 'oro'), c(4, 'copa'), c(6, 'oro'), c(6, 'basto')].reverse();
    const h = new Truco.TrucoHand({ deck: order, mano: 0, faltaPoints: () => 15 });
    h.act(0, { type: 'play', index: h.cards[0].findIndex((x) => x.n === 1 && x.s === 'espada') });
    const a = TrucoAI.decide(h, 1, TrucoAI.PERSONAS.santo, () => 0.99);
    if (a.type === 'play') assert.deepStrictEqual(h.cards[1][a.index], c(5, 'copa'), 'mata el ancho con el 5 de copas');
  } finally {
    Truco.setFiveOfCups(false);
  }
  assert.ok(Truco.rank(c(5, 'copa')) < Truco.rank(c(4, 'oro')) + 2, 'vuelve a ser un 5 común');
});

test('estadísticas: cuenta salas online (de 2 y de 4) y cuentas creadas, sin datos personales', async () => {
  process.env.KV_REST_API_URL = 'https://redis.example';
  process.env.KV_REST_API_TOKEN = 'token';
  const db = fakeRedis();
  global.fetch = db.fetch;
  await call(room, 'POST', { action: 'create', name: 'Coco', target: 15 });
  await call(room, 'POST', { action: 'create', name: 'Pepa', target: 15 });
  await call(room, 'POST', { action: 'create', name: 'Tito', target: 15, players: 4 });
  await call(account, 'POST', { action: 'register', username: 'Pocho', password: 'mate123' });
  await call(account, 'POST', { action: 'register', username: 'pocho', password: 'otra123' }); // repetido: no cuenta

  const r = await call(stats, 'GET', { weeks: 2 });
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.data.weeks.length, 2);
  assert.deepStrictEqual(r.data.weeks[0], { week: weekOf(), rooms2: 2, rooms4: 1, accounts: 1 });
  assert.deepStrictEqual(r.data.totals, { rooms2: 2, rooms4: 1, accounts: 1 });
  assert.ok(!JSON.stringify(r.data).includes('Pocho'), 'nada personal');
  assert.strictEqual((await call(stats, 'POST', {})).code, 405);
});

test('estadísticas: la semana arranca el lunes (UTC)', () => {
  assert.strictEqual(weekOf(new Date('2026-11-24T12:00:00Z')), '2026-11-23'); // martes → lunes 23
  assert.strictEqual(weekOf(new Date('2026-11-29T23:00:00Z')), '2026-11-23'); // domingo → mismo lunes
  assert.strictEqual(weekOf(new Date('2026-11-30T00:30:00Z')), '2026-11-30'); // lunes nuevo
});

test('compartir: el texto lleva el resultado, el desafío y el link con UTM', () => {
  require('../js/share.js');
  const text = globalThis.Share.message({ title: '🌿 Me llevó el Pombero', lines: ['Noches superadas: 2/5'] });
  assert.match(text, /Me llevó el Pombero/);
  assert.match(text, /¿Llegás más lejos\?/);
  assert.match(text, /costumbres-arg\.vercel\.app\/\?utm_source=share&utm_medium=resultado/);
});
