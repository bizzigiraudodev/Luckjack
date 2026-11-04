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

// --- Salas de 4 ---

async function room4(humans = 2) {
  const a = await post({ action: 'create', name: 'Coco', target: 15, players: 4 });
  const tokens = [a.data.token];
  for (let i = 1; i < humans; i++) tokens.push((await post({ action: 'join', code: a.data.code, name: `Amigo ${i}` })).data.token);
  return { code: a.data.code, tokens, a: a.data };
}

test('sala de 4: espera al creador, arma parejas y completa con bots', async () => {
  global.fetch = fakeRedis().fetch;
  const r = await room4(2);
  let v = (await get({ code: r.code, token: r.tokens[1] })).data;
  assert.strictEqual(v.size, 4);
  assert.strictEqual(v.status, 'waiting', 'de a 4 no arranca solo');
  assert.strictEqual(v.seat, 1);
  assert.strictEqual((await post({ action: 'start', code: r.code, token: r.tokens[1] })).code, 403, 'solo empieza el creador');
  // el creador pone a su amigo de compañero (asiento 2)
  let res = await post({ action: 'swap', code: r.code, token: r.tokens[0], a: 1, b: 2 });
  assert.strictEqual(res.code, 200);
  v = (await get({ code: r.code, token: r.tokens[1] })).data;
  assert.strictEqual(v.seat, 2);
  assert.strictEqual(v.players[2].pos, 0, 'cada uno se ve abajo');
  assert.strictEqual(v.players[0].pos, 2, 'y a su compañero arriba');
  res = await post({ action: 'start', code: r.code, token: r.tokens[0] });
  assert.strictEqual(res.data.status, 'playing');
  const bots = res.data.players.filter((p) => p.bot);
  assert.strictEqual(bots.length, 2);
  assert.strictEqual(res.data.hand.myCards.length, 3);
  assert.strictEqual((await post({ action: 'join', code: r.code, name: 'Tarde' })).code, 409, 'ya empezó');
});

test('sala de 4: los bots juegan solos y nadie ve las cartas ajenas', async () => {
  global.fetch = fakeRedis().fetch;
  const r = await room4(1);
  const res = await post({ action: 'start', code: r.code, token: r.tokens[0] });
  const v = res.data;
  // (o la mano ya terminó: por ejemplo, tu compañero bot cantó truco y el rival bot no quiso)
  assert.ok(v.hand.turn === 0 || v.hand.pending || v.hand.finished, 'los bots juegan hasta que le toca al humano');
  assert.strictEqual(JSON.stringify(v).includes('"cards"'), false);
  assert.deepStrictEqual(v.hand.counts[0], v.hand.myCards.length);
});

test('sala de 4: las señas solo las ve el compañero', async () => {
  global.fetch = fakeRedis().fetch;
  const r = await room4(4);
  // parejas: 0 y 2 contra 1 y 3
  await post({ action: 'start', code: r.code, token: r.tokens[0] });
  const s = await post({ action: 'sena', code: r.code, token: r.tokens[0], sena: 'guino' });
  assert.strictEqual(s.code, 200);
  const view = async (i) => (await get({ code: r.code, token: r.tokens[i] })).data;
  const partner = await view(2);
  assert.ok(partner.senas.some((x) => x.sena === 'guino' && x.from === 2), 'el compañero la ve (desde arriba)');
  for (const i of [1, 3]) assert.ok(!(await view(i)).senas.some((x) => x.sena === 'guino'), 'los rivales no');
  assert.strictEqual((await post({ action: 'sena', code: r.code, token: r.tokens[0], sena: 'cualquiera' })).code, 400);
});

test('sala de 4 con bots: una partida completa termina y la revancha la piden solo los humanos', async () => {
  global.fetch = fakeRedis().fetch;
  const r = await room4(2);
  await post({ action: 'start', code: r.code, token: r.tokens[0] });
  let v;
  for (let guard = 0; guard < 400; guard++) {
    v = (await get({ code: r.code, token: r.tokens[0] })).data;
    if (v.status === 'over') break;
    if (v.hand.finished) { await post({ action: 'next', code: r.code, token: r.tokens[0] }); continue; }
    let moved = false;
    for (const t of r.tokens) {
      const vv = (await get({ code: r.code, token: t })).data;
      const acts = vv.hand.actions;
      if (!acts.length) continue;
      const move = acts.find((a) => a.type === 'quiero') || acts.find((a) => a.type === 'play') || acts[0];
      const res = await post({ action: 'act', code: r.code, token: t, move });
      assert.strictEqual(res.code, 200, JSON.stringify(res.data));
      moved = true;
      break;
    }
    assert.ok(moved || v.hand.finished, 'siempre hay alguien que puede jugar');
  }
  assert.strictEqual(v.status, 'over');
  assert.ok(v.scores.us >= 15 || v.scores.them >= 15);
  await post({ action: 'rematch', code: r.code, token: r.tokens[0] });
  let w = (await get({ code: r.code, token: r.tokens[0] })).data;
  assert.strictEqual(w.status, 'over');
  assert.deepStrictEqual(w.rematch.waiting, ['Amigo 1']);
  await post({ action: 'rematch', code: r.code, token: r.tokens[1] });
  w = (await get({ code: r.code, token: r.tokens[0] })).data;
  assert.strictEqual(w.status, 'playing');
});
