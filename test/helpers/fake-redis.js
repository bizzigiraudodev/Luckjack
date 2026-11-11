// Redis en memoria que entiende los comandos que usan las APIs (incluido el EVAL de control de versión).
module.exports = function fakeRedis() {
  const kv = new Map();
  const zsets = new Map();
  const hashes = new Map();
  const fetch = async (url, opts) => {
    const [cmd, ...args] = JSON.parse(opts.body);
    let result = null;
    switch (cmd) {
      case 'GET': result = kv.has(args[0]) ? kv.get(args[0]) : null; break;
      case 'SET': {
        const [k, v, ...rest] = args;
        if (rest.includes('NX') && kv.has(k)) { result = null; break; }
        kv.set(k, v);
        result = 'OK';
        break;
      }
      case 'EVAL': {
        // EVAL script 1 key prevVer newJson ttl → versión optimista
        const [, , k, prev, json] = args;
        if (!kv.has(k)) { result = -1; break; }
        if (JSON.parse(kv.get(k)).ver !== Number(prev)) { result = 0; break; }
        kv.set(k, json);
        result = 1;
        break;
      }
      case 'DEL': result = kv.delete(args[0]) ? 1 : 0; break;
      case 'INCR': kv.set(args[0], String(Number(kv.get(args[0]) || 0) + 1)); result = Number(kv.get(args[0])); break;
      case 'EXPIRE': result = kv.has(args[0]) ? 1 : 0; break;
      // Rankings: conjuntos ordenados y hashes.
      case 'ZADD': {
        const [k, mode, , score, member] = args;
        const z = zsets.get(k) || new Map();
        zsets.set(k, z);
        const old = z.get(member);
        const better = old === undefined || (mode === 'GT' ? Number(score) > old : Number(score) < old);
        if (better) z.set(member, Number(score));
        result = better ? 1 : 0;
        break;
      }
      case 'ZRANGE': {
        const z = [...(zsets.get(args[0]) || new Map()).entries()].sort((a, b) => (args.includes('REV') ? b[1] - a[1] : a[1] - b[1]));
        result = z.slice(0, Number(args[2]) + 1).flatMap(([m, sc]) => [m, String(sc)]);
        break;
      }
      case 'ZRANK': case 'ZREVRANK': {
        const z = [...(zsets.get(args[0]) || new Map()).entries()].sort((a, b) => (cmd === 'ZREVRANK' ? b[1] - a[1] : a[1] - b[1]));
        const i = z.findIndex(([m]) => m === args[1]);
        result = i < 0 ? null : i;
        break;
      }
      case 'ZREM': (zsets.get(args[0]) || new Map()).delete(args[1]); result = 1; break;
      case 'HSET': { const h = hashes.get(args[0]) || {}; h[args[1]] = args[2]; hashes.set(args[0], h); result = 1; break; }
      case 'HGET': result = (hashes.get(args[0]) || {})[args[1]] || null; break;
      case 'HDEL': delete (hashes.get(args[0]) || {})[args[1]]; result = 1; break;
      case 'HMGET': result = args.slice(1).map((f) => (hashes.get(args[0]) || {})[f] || null); break;
      default: throw new Error(`comando no soportado: ${cmd}`);
    }
    return { ok: true, json: async () => ({ result }) };
  };
  return { fetch, kv, zsets, hashes };
};
