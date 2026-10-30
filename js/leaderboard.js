// Rankings: globales si la API está disponible (Vercel), y siempre una copia en este dispositivo.
(function (root) {
  const BOARDS = {
    story: { title: 'Historia más rápida', icon: '⏱️', order: 'asc', format: (v) => formatTime(v) },
    chips: { title: 'Más fichas (infinito)', icon: '💰', order: 'desc', format: (v) => `$${v}` },
    cycles: { title: 'Más ciclos (infinito)', icon: '♾️', order: 'desc', format: (v) => `${v} ${v === 1 ? 'ciclo' : 'ciclos'}` },
  };
  const TOP = 10;
  const API = 'api/leaderboard';

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }

  // Mejor marca primero. Con `onePerPlayer`, una sola fila (la mejor) por jugador.
  function insert(list, entry, order, onePerPlayer = true) {
    const better = (a, b) => (order === 'asc' ? a < b : a > b);
    const old = onePerPlayer && list.find((e) => e.pid === entry.pid);
    if (old && !better(entry.value, old.value)) {
      old.name = entry.name;
      return { list, improved: false };
    }
    const next = (onePerPlayer ? list.filter((e) => e.pid !== entry.pid) : list.slice()).concat(entry);
    next.sort((a, b) => (order === 'asc' ? a.value - b.value : b.value - a.value));
    return { list: next.slice(0, TOP), improved: true };
  }

  // --- Navegador ---
  const hasWindow = typeof window !== 'undefined';
  const storage = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin storage */ } },
  };

  // Id aleatorio del dispositivo, para marcar tus filas y guardar una sola por jugador.
  function playerId() {
    let id = storage.get('luckjack.playerId');
    if (!id) {
      id = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
      storage.set('luckjack.playerId', id);
    }
    return id;
  }

  function localList(board) {
    return storage.get(`luckjack.lb.${board}`) || [];
  }

  function canUseApi() {
    return hasWindow && location.protocol.startsWith('http');
  }

  async function api(method, body, query = '') {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(`${API}${query}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  // Devuelve { entries, global }.
  async function load(board) {
    if (canUseApi()) {
      try {
        const data = await api('GET', null, `?board=${board}`);
        return { entries: data.entries || [], global: true };
      } catch { /* sin API: ranking local */ }
    }
    return { entries: localList(board), global: false };
  }

  // Guarda una marca. Devuelve { rank, global, improved }.
  async function submit(board, { name, value, hands }) {
    const entry = { pid: playerId(), name, value, hands, date: new Date().toISOString().slice(0, 10) };
    // En el dispositivo se guardan tus 10 mejores partidas (no solo la mejor).
    const local = insert(localList(board), entry, BOARDS[board].order, false);
    storage.set(`luckjack.lb.${board}`, local.list);
    if (canUseApi()) {
      try {
        const res = await api('POST', { board, pid: entry.pid, name, value, hands });
        return { rank: res.rank, global: true, improved: res.improved };
      } catch { /* sin API */ }
    }
    const rank = local.list.indexOf(entry) + 1;
    return { rank: rank || null, global: false, improved: local.improved };
  }

  const Leaderboard = { BOARDS, TOP, insert, formatTime, load, submit, playerId };
  if (typeof module !== 'undefined' && module.exports) module.exports = Leaderboard;
  else root.Leaderboard = Leaderboard;
})(typeof window !== 'undefined' ? window : globalThis);
