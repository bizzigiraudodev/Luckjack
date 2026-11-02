// Redis en memoria que entiende los comandos que usan las APIs (incluido el EVAL de control de versión).
module.exports = function fakeRedis() {
  const kv = new Map();
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
      default: throw new Error(`comando no soportado: ${cmd}`);
    }
    return { ok: true, json: async () => ({ result }) };
  };
  return { fetch, kv };
};
