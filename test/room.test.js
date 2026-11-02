const test = require('node:test');
const assert = require('node:assert');
const fakeRedis = require('./helpers/fake-redis.js');
const handler = require('../api/room.js');

process.env.KV_REST_API_URL = 'https://redis.example';
process.env.KV_REST_API_TOKEN = 'token';

function call(method, { query, body } = {}) {
  return new Promise((resolve) => {
    const res = {
      code: 200,
      setHeader() {},
      status(c) { this.code = c; return this; },
      json(data) { resolve({ code: this.code, data }); },
    };
    handler({ method, query, body, headers: {} }, res);
  });
}
const post = (body) => call('POST', { body });
const get = (query) => call('GET', { query });

async function newRoom(target = 15) {
  const a = await post({ action: 'create', name: 'Coco', target });
  const b = await post({ action: 'join', code: a.data.code, name: 'Pepa' });
  return { code: a.data.code, A: a.data.token, B: b.data.token, a: a.data, b: b.data };
}

// Juega por los dos lo que haga falta hasta terminar la mano (siempre la primera carta / no quiero).
async function finishHand(room) {
  for (let i = 0; i < 30; i++) {
    const va = (await get({ code: room.code, token: room.A })).data;
    if (!va.hand || va.hand.finished) return va;
    const vb = (await get({ code: room.code, token: room.B })).data;
    const [token, v] = va.hand.actor === 'me' ? [room.A, va] : [room.B, vb];
    const acts = v.hand.actions;
    const move = acts.find((a) => a.type === 'noquiero') || acts.find((a) => a.type === 'play');
    const r = await post({ action: 'act', code: room.code, token, move });
    assert.strictEqual(r.code, 200, JSON.stringify(r.data));
  }
  throw new Error('la mano no terminó');
}

test('crear y unirse: la partida arranca con 3 cartas para cada uno', async () => {
  global.fetch = fakeRedis().fetch;
  const a = await post({ action: 'create', name: 'Coco', target: 30 });
  assert.strictEqual(a.code, 200);
  assert.match(a.data.code, /^[A-Z]+-\d\d$/);
  assert.strictEqual(a.data.view.status, 'waiting');
  const b = await post({ action: 'join', code: a.data.code.toLowerCase().replace('-', ' '), name: 'Pepa' });
  assert.strictEqual(b.code, 200, 'el código acepta minúsculas y espacios');
  assert.strictEqual(b.data.seat, 1);
  const v = b.data.view;
  assert.strictEqual(v.status, 'playing');
  assert.strictEqual(v.target, 30);
  assert.deepStrictEqual(v.names, { me: 'Pepa', opp: 'Coco' });
  assert.strictEqual(v.hand.myCards.length, 3);
  assert.strictEqual(v.hand.oppCount, 3);
  assert.ok(!JSON.stringify(v).includes(JSON.stringify(a.data.view)), 'no se mezclan vistas');
  assert.strictEqual((await post({ action: 'join', code: a.data.code, name: 'Otro' })).code, 409, 'la sala se llena con dos');
});

test('cada uno ve solo sus cartas', async () => {
  global.fetch = fakeRedis().fetch;
  const room = await newRoom();
  const va = (await get({ code: room.code, token: room.A })).data;
  const vb = (await get({ code: room.code, token: room.B })).data;
  const key = (c) => `${c.n}${c.s}`;
  const mineA = va.hand.myCards.map(key);
  const textB = JSON.stringify(vb);
  for (const k of mineA) {
    const [n, s] = [k.match(/\d+/)[0], k.replace(/\d+/, '')];
    assert.ok(!textB.includes(`{"n":${n},"s":"${s}"}`), 'las cartas de A no aparecen en la vista de B');
  }
  assert.strictEqual(va.hand.actor === 'me', vb.hand.actor === 'opp');
});

test('jugadas: valida turno y token, y el truco no querido da 1 punto', async () => {
  global.fetch = fakeRedis().fetch;
  const room = await newRoom();
  const va = (await get({ code: room.code, token: room.A })).data;
  const [actor, other] = va.hand.actor === 'me' ? [room.A, room.B] : [room.B, room.A];
  assert.strictEqual((await post({ action: 'act', code: room.code, token: other, move: { type: 'truco' } })).code, 400, 'no es su turno');
  assert.strictEqual((await post({ action: 'act', code: room.code, token: 'falso', move: { type: 'truco' } })).code, 403);
  let r = await post({ action: 'act', code: room.code, token: actor, move: { type: 'truco' } });
  assert.strictEqual(r.data.hand.pending.kind, 'truco');
  r = await post({ action: 'act', code: room.code, token: other, move: { type: 'noquiero' } });
  assert.ok(r.data.hand.finished);
  assert.strictEqual(r.data.hand.winner, 'opp');
  assert.deepStrictEqual(r.data.scores, { me: 0, opp: 1 });
  const events = r.data.events.map((e) => e.type);
  assert.ok(events.includes('call') && events.includes('response') && events.includes('end'));
});

test('siguiente mano, polling con versión y partida completa con revancha', async () => {
  global.fetch = fakeRedis().fetch;
  const room = await newRoom(15);
  let v;
  let hands = 0;
  while (hands++ < 60) {
    v = await finishHand(room);
    if (v.over) break;
    const n = await post({ action: 'next', code: room.code, token: room.A });
    assert.strictEqual(n.data.handNumber, v.handNumber + 1);
    await post({ action: 'next', code: room.code, token: room.B }); // el segundo "siguiente" no reparte otra
    const again = (await get({ code: room.code, token: room.A })).data;
    assert.strictEqual(again.handNumber, v.handNumber + 1);
    const same = await get({ code: room.code, token: room.A, ver: again.ver });
    assert.ok(same.data.same, 'sin cambios devuelve "same"');
  }
  assert.ok(v.over, 'la partida termina');
  assert.ok(v.scores.me >= 15 || v.scores.opp >= 15);
  let r = await post({ action: 'rematch', code: room.code, token: room.A });
  assert.strictEqual(r.data.status, 'over');
  assert.deepStrictEqual(r.data.rematch, { me: true, opp: false });
  r = await post({ action: 'rematch', code: room.code, token: room.B });
  assert.strictEqual(r.data.status, 'playing');
  assert.deepStrictEqual(r.data.scores, { me: 0, opp: 0 });
});

test('frases rápidas, salir y volver a entrar', async () => {
  global.fetch = fakeRedis().fetch;
  const room = await newRoom();
  let r = await post({ action: 'say', code: room.code, token: room.A, phrase: 2 });
  assert.strictEqual(r.data.chat.at(-1).text, 'Andá a lavar los platos');
  assert.strictEqual((await post({ action: 'say', code: room.code, token: room.A, phrase: 1 })).code, 429, 'no se puede mandar frases muy seguido');
  assert.strictEqual((await post({ action: 'say', code: room.code, token: room.B, phrase: 99 })).code, 400);
  const vb = (await get({ code: room.code, token: room.B })).data;
  assert.strictEqual(vb.chat.at(-1).from, 'opp');

  r = await post({ action: 'leave', code: room.code, token: room.B });
  const va = (await get({ code: room.code, token: room.A })).data;
  assert.strictEqual(va.left, 'opp');
  const back = await post({ action: 'join', code: room.code, token: room.B });
  assert.strictEqual(back.data.seat, 1, 'vuelve a su lugar con el mismo token');
  assert.strictEqual(back.data.view.left, null);
});

test('sin base de datos configurada responde 503', async () => {
  const url = process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_URL;
  assert.strictEqual((await post({ action: 'create', name: 'x' })).code, 503);
  process.env.KV_REST_API_URL = url;
  global.fetch = fakeRedis().fetch;
  assert.strictEqual((await get({ code: 'NADA-11', token: 'x' })).code, 404);
});
