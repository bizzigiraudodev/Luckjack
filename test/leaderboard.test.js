const test = require('node:test');
const assert = require('node:assert');
const Leaderboard = require('../js/leaderboard.js');
const handler = require('../api/leaderboard.js');

test('ranking local: ordena según el ranking y guarda una fila por jugador', () => {
  let list = [];
  for (const [pid, value] of [['a', 90000], ['b', 60000], ['a', 120000], ['a', 50000]]) {
    ({ list } = Leaderboard.insert(list, { pid, name: pid, value }, 'asc'));
  }
  assert.deepStrictEqual(list.map((e) => [e.pid, e.value]), [['a', 50000], ['b', 60000]]);

  let chips = [];
  for (const v of [300, 900, 150]) ({ list: chips } = Leaderboard.insert(chips, { pid: 'x', value: v }, 'desc', false));
  assert.deepStrictEqual(chips.map((e) => e.value), [900, 300, 150], 'en el dispositivo se guardan todas las partidas');
});

test('formato de tiempo', () => {
  assert.strictEqual(Leaderboard.formatTime(65000), '1:05');
  assert.strictEqual(Leaderboard.formatTime(3725000), '1:02:05');
});

test('API: valida ranking, valor, jugador y limpia el nombre', () => {
  assert.ok(handler.validate({ board: 'nada', value: 5, pid: 'abcdefgh12' }).error);
  assert.ok(handler.validate({ board: 'cycles', value: 0, pid: 'abcdefgh12' }).error);
  assert.ok(handler.validate({ board: 'cycles', value: 3, pid: 'x' }).error);
  const ok = handler.validate({ board: 'cycles', value: 3.7, pid: 'abcdefgh12', name: '  <b>Coco</b> con un nombre larguísimo ', hands: 40 });
  assert.strictEqual(ok.value, 3);
  assert.strictEqual(ok.entry.name, 'bCoco/b con un n');
  assert.strictEqual(ok.entry.hands, 40);
});

// Redis falso en memoria que entiende los comandos que usa la API.
function fakeRedis() {
  const z = {};
  const h = {};
  const kv = {};
  return async (url, opts) => {
    const [cmd, key, ...args] = JSON.parse(opts.body);
    let result = null;
    const set = (z[key] = z[key] || new Map());
    const sorted = (rev) => [...set.entries()].sort((a, b) => (rev ? b[1] - a[1] : a[1] - b[1]));
    switch (cmd) {
      case 'ZADD': {
        const [mode, , score, member] = args;
        const old = set.get(member);
        const better = old === undefined || (mode === 'GT' ? score > old : score < old);
        if (better) set.set(member, Number(score));
        result = better ? 1 : 0;
        break;
      }
      case 'ZRANGE': {
        const rev = args.includes('REV');
        result = sorted(rev).slice(0, 10).flatMap(([m, s]) => [m, String(s)]);
        break;
      }
      case 'ZRANK': case 'ZREVRANK': {
        const i = sorted(cmd === 'ZREVRANK').findIndex(([m]) => m === args[0]);
        result = i < 0 ? null : i;
        break;
      }
      case 'HSET': (h[key] = h[key] || {})[args[0]] = args[1]; result = 1; break;
      case 'HGET': result = (h[key] || {})[args[0]] || null; break;
      case 'HMGET': result = args.map((f) => (h[key] || {})[f] || null); break;
      case 'INCR': kv[key] = (kv[key] || 0) + 1; result = kv[key]; break;
      case 'EXPIRE': result = 1; break;
      default: throw new Error(`comando no soportado: ${cmd}`);
    }
    return { ok: true, json: async () => ({ result }) };
  };
}

function call(method, { query, body, ip = '1.2.3.4' } = {}) {
  return new Promise((resolve) => {
    const res = {
      code: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.code = c; return this; },
      json(data) { resolve({ code: this.code, data }); },
    };
    handler({ method, query, body, headers: { 'x-forwarded-for': ip } }, res);
  });
}

test('API: guarda la mejor marca de cada jugador y devuelve el puesto', async () => {
  process.env.KV_REST_API_URL = 'https://redis.example';
  process.env.KV_REST_API_TOKEN = 'token';
  global.fetch = fakeRedis();

  let r = await call('POST', { body: { board: 'story', pid: 'jugador0001', name: 'Coco', value: 300000, hands: 45 } });
  assert.deepStrictEqual(r.data, { improved: true, rank: 1 });
  r = await call('POST', { body: { board: 'story', pid: 'jugador0002', name: 'Pepa', value: 200000, hands: 40 } });
  assert.strictEqual(r.data.rank, 1);
  r = await call('POST', { body: { board: 'story', pid: 'jugador0001', name: 'Coco', value: 400000, hands: 50 } });
  assert.deepStrictEqual(r.data, { improved: false, rank: 2 }, 'una marca peor no reemplaza la mejor');

  r = await call('GET', { query: { board: 'story' } });
  assert.deepStrictEqual(r.data.entries.map((e) => [e.name, e.value, e.hands]), [['Pepa', 200000, 40], ['Coco', 300000, 45]]);

  r = await call('POST', { body: { board: 'chips', pid: 'jugador0001', name: 'Coco', value: 900 } });
  r = await call('POST', { body: { board: 'chips', pid: 'jugador0002', name: 'Pepa', value: 500 } });
  r = await call('GET', { query: { board: 'chips' } });
  assert.deepStrictEqual(r.data.entries.map((e) => e.value), [900, 500], 'en fichas gana el mayor');

  assert.strictEqual((await call('POST', { body: { board: 'chips', pid: 'x' } })).code, 400);
  for (let i = 0; i < 10; i++) await call('POST', { ip: '9.9.9.9', body: { board: 'cycles', pid: 'jugador0003', value: 2 } });
  assert.strictEqual((await call('POST', { ip: '9.9.9.9', body: { board: 'cycles', pid: 'jugador0003', value: 2 } })).code, 429, 'límite de envíos');

  delete process.env.KV_REST_API_URL;
  assert.strictEqual((await call('GET', { query: { board: 'story' } })).code, 503, 'sin base de datos configurada');
});
