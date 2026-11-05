const test = require('node:test');
const assert = require('node:assert');
const Leaderboard = require('../js/leaderboard.js');
const handler = require('../api/leaderboard.js');
// Estadísticas de una partida jugada por una persona (ver js/antibot.js).
const HUMAN = { webdriver: false, clicks: 200, keys: 0, untrusted: 0, centered: 3, moves: 900, mouseClicks: 200, medianGap: 800, cv: 0.6 };

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
  assert.ok(handler.validate({ proof: HUMAN, board: 'nada', value: 5, pid: 'abcdefgh12' }).error);
  assert.ok(handler.validate({ proof: HUMAN, board: 'cycles', value: 0, pid: 'abcdefgh12' }).error);
  assert.ok(handler.validate({ proof: HUMAN, board: 'cycles', value: 3, pid: 'x' }).error);
  const ok = handler.validate({ proof: HUMAN, board: 'cycles', value: 3.7, pid: 'abcdefgh12', name: '  <b>Coco</b> con un nombre larguísimo ', hands: 40 });
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
        result = sorted(rev).slice(0, Number(args[1]) + 1).flatMap(([m, s]) => [m, String(s)]);
        break;
      }
      case 'ZRANK': case 'ZREVRANK': {
        const i = sorted(cmd === 'ZREVRANK').findIndex(([m]) => m === args[0]);
        result = i < 0 ? null : i;
        break;
      }
      case 'HSET': (h[key] = h[key] || {})[args[0]] = args[1]; result = 1; break;
      case 'HGET': result = (h[key] || {})[args[0]] || null; break;
      case 'ZREM': set.delete(args[0]); result = 1; break;
      case 'HDEL': if (h[key]) delete h[key][args[0]]; result = 1; break;
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

  let r = await call('POST', { body: { proof: HUMAN, board: 'story', pid: 'jugador0001', name: 'Coco', value: 300000, hands: 45 } });
  assert.deepStrictEqual(r.data, { improved: true, rank: 1 });
  r = await call('POST', { body: { proof: HUMAN, board: 'story', pid: 'jugador0002', name: 'Pepa', value: 200000, hands: 40 } });
  assert.strictEqual(r.data.rank, 1);
  r = await call('POST', { body: { proof: HUMAN, board: 'story', pid: 'jugador0001', name: 'Coco', value: 400000, hands: 50 } });
  assert.deepStrictEqual(r.data, { improved: false, rank: 2 }, 'una marca peor no reemplaza la mejor');

  r = await call('GET', { query: { board: 'story' } });
  assert.deepStrictEqual(r.data.entries.map((e) => [e.name, e.value, e.hands]), [['Pepa', 200000, 40], ['Coco', 300000, 45]]);

  r = await call('POST', { body: { proof: HUMAN, board: 'chips', pid: 'jugador0001', name: 'Coco', value: 900, hands: 30 } });
  r = await call('POST', { body: { proof: HUMAN, board: 'chips', pid: 'jugador0002', name: 'Pepa', value: 500, hands: 30 } });
  r = await call('GET', { query: { board: 'chips' } });
  assert.deepStrictEqual(r.data.entries.map((e) => e.value), [900, 500], 'en fichas gana el mayor');

  assert.strictEqual((await call('POST', { body: { proof: HUMAN, board: 'chips', pid: 'x' } })).code, 400);
  for (let i = 0; i < 10; i++) await call('POST', { ip: '9.9.9.9', body: { proof: HUMAN, board: 'cycles', pid: 'jugador0003', value: 2, hands: 20 } });
  assert.strictEqual((await call('POST', { ip: '9.9.9.9', body: { proof: HUMAN, board: 'cycles', pid: 'jugador0003', value: 2, hands: 20 } })).code, 429, 'límite de envíos');

  delete process.env.KV_REST_API_URL;
  assert.strictEqual((await call('GET', { query: { board: 'story' } })).code, 503, 'sin base de datos configurada');
});

test('API: no expone los ids de los jugadores y rechaza marcas imposibles', async () => {
  process.env.KV_REST_API_URL = 'https://redis.example';
  process.env.KV_REST_API_TOKEN = 'token';
  global.fetch = fakeRedis();
  await call('POST', { body: { proof: HUMAN, board: 'cycles', pid: 'victima0001', name: 'Coco', value: 4, hands: 60 } });
  await call('POST', { ip: '5.5.5.5', body: { proof: HUMAN, board: 'cycles', pid: 'otro000001', name: 'Pepa', value: 3, hands: 45 } });
  const r = await call('GET', { query: { board: 'cycles', pid: 'victima0001' } });
  assert.ok(r.data.entries.every((e) => e.pid === undefined), 'sin ids');
  assert.deepStrictEqual(r.data.entries.map((e) => [e.name, e.me]), [['Coco', true], ['Pepa', false]], 'tu fila viene marcada');

  const bad = (body) => handler.validate({ proof: HUMAN, ...body }).error;
  assert.ok(bad({ board: 'story', pid: 'abcdefgh12', value: 5000, hands: 1 }), 'historia en 1 mano');
  assert.ok(bad({ board: 'story', pid: 'abcdefgh12', value: 10000, hands: 20 }), 'menos de 2 segundos por mano');
  assert.ok(!bad({ board: 'story', pid: 'abcdefgh12', value: 120000, hands: 20 }));
  assert.ok(bad({ board: 'cycles', pid: 'abcdefgh12', value: 10000, hands: 50 }), 'más ciclos que manos');
  assert.ok(bad({ board: 'chips', pid: 'abcdefgh12', value: 1e8, hands: 10 }), 'fichas imposibles');
  assert.strictEqual((await call('POST', { body: { proof: HUMAN, board: 'story', pid: 'abcdefgh12', value: 5000, hands: 1 } })).code, 403);
});

test('anti-bot: frena navegadores automatizados y ritmos de máquina; la clave de prueba va a un ranking aparte', async () => {
  process.env.KV_REST_API_URL = 'https://redis.example';
  process.env.KV_REST_API_TOKEN = 'token';
  global.fetch = fakeRedis();
  const reason = (proof, hands = 20) => handler.botReason({ ...HUMAN, ...proof }, hands);
  assert.strictEqual(reason({}), null, 'una persona pasa');
  assert.ok(reason({ webdriver: true }), 'Playwright/Selenium');
  assert.ok(reason({ untrusted: 10 }), 'eventos simulados');
  assert.ok(reason({ clicks: 3, keys: 0 }, 20), 'menos jugadas que manos');
  assert.ok(reason({ centered: 190 }), 'siempre en el centro exacto');
  assert.ok(reason({ medianGap: 60 }), 'demasiado rápido');
  assert.ok(reason({ cv: 0.05 }), 'ritmo constante');
  assert.ok(reason({ moves: 10 }), 'el mouse no se mueve');
  assert.ok(handler.botReason(null, 20), 'sin datos');

  const bot = await call('POST', { body: { board: 'story', pid: 'robot00001', name: 'Bot', value: 90000, hands: 20, proof: { ...HUMAN, webdriver: true } } });
  assert.strictEqual(bot.code, 403);
  const test = await call('POST', { body: { board: 'story', pid: 'robot00001', name: 'Test', value: 90000, hands: 20, proof: { webdriver: true }, testKey: 'clave-equivocada-123' } });
  assert.strictEqual(test.code, 403, 'una clave equivocada no sirve');
  assert.strictEqual((await call('GET', { query: { board: 'story' } })).data.entries.length, 0, 'nada llegó al ranking público');
});

test('tiempo total de juego: lista larga y no crece más rápido que el reloj', async () => {
  process.env.KV_REST_API_URL = 'https://redis.example';
  process.env.KV_REST_API_TOKEN = 'token';
  global.fetch = fakeRedis();
  const send = (pid, value, ip) => call('POST', { ip, body: { proof: HUMAN, board: 'playtime', pid, name: pid.slice(0, 6), value, hands: 0 } });
  for (let i = 0; i < 15; i++) await send(`jugador${String(i).padStart(4, '0')}`, 60000 * (i + 1), `7.7.7.${i}`);
  const r = await call('GET', { query: { board: 'playtime' } });
  assert.strictEqual(r.data.entries.length, 15, 'aparecen todos, no solo 10');
  await send('tramposo01', 999 * 3600 * 1000, '8.8.8.8');
  const top = (await call('GET', { query: { board: 'playtime' } })).data.entries[0];
  assert.ok(top.value <= 4 * 3600 * 1000, 'la primera vez no se aceptan más de 4 horas');
  await send('tramposo01', 999 * 3600 * 1000, '8.8.8.8');
  const again = (await call('GET', { query: { board: 'playtime' } })).data.entries[0];
  assert.ok(again.value <= 4 * 3600 * 1000 + 61000, 'después, como mucho lo que pasó en el reloj');
});

test('se borran las marcas de la historia del truco vieja que están en la lista', async () => {
  process.env.KV_REST_API_URL = 'https://redis.example';
  process.env.KV_REST_API_TOKEN = 'token';
  global.fetch = fakeRedis();
  const body = (pid, name, value) => ({ proof: HUMAN, board: 'trucoStory', pid, name, value, hands: 40 });
  const real = Date.prototype.toISOString;
  Date.prototype.toISOString = function () { return '2026-11-04T12:00:00.000Z'; }; // la marca vieja es del 4/11
  await call('POST', { body: body('celular0001', 'Dev', 856750), ip: '1.1.1.1' });
  Date.prototype.toISOString = real;
  await call('POST', { body: body('compu00001', 'DevPC', 969498), ip: '2.2.2.2' });
  const rows = (await call('GET', { query: { board: 'trucoStory' } })).data.entries;
  assert.deepStrictEqual(rows.map((e) => [e.name, e.value]), [['DevPC', 969498]], 'solo queda la marca de la historia nueva');
});
