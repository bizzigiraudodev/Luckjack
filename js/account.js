// Cuenta del jugador (opcional): usuario y contraseña, sin mail. Sin cuenta se juega como invitado,
// con el progreso y el id de jugador de este dispositivo. Con cuenta, el progreso y las marcas de los
// rankings te siguen a cualquier dispositivo. La API es api/account.js.
(function (root) {
  const KEY = 'luckjack.account'; // { username, token, pid }
  const API = 'api/account';

  const storage = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
    set(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* sin storage */ } },
  };

  const available = () => typeof location !== 'undefined' && location.protocol.startsWith('http');

  async function call(body) {
    if (!available()) throw new Error('Las cuentas necesitan internet (abrí el juego desde su página).');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
        cache: 'no-store',
      });
      let data = {};
      try { data = await res.json(); } catch { /* sin cuerpo */ }
      if (!res.ok) {
        const err = new Error(data.error || `Error ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('No hubo respuesta. Revisá la conexión y probá de nuevo.');
      if (e instanceof TypeError) throw new Error('No hay conexión. Probá de nuevo en un rato.');
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  // Guarda la sesión y devuelve el progreso de la cuenta (ya combinado con el de este dispositivo).
  function keep(data) {
    storage.set({ username: data.username, token: data.token, pid: data.pid });
    return data.progress || {};
  }

  const Account = {
    available,
    get user() { return storage.get(); },
    async register(username, password, pid, progress) {
      return keep(await call({ action: 'register', username, password, pid, progress }));
    },
    async login(username, password, progress) {
      return keep(await call({ action: 'login', username, password, progress }));
    },
    // Manda el progreso de este dispositivo y devuelve el de la cuenta combinado.
    // Si la sesión venció, se sale de la cuenta (y devuelve null).
    async sync(progress) {
      const u = storage.get();
      if (!u) return null;
      try {
        return keep(await call({ action: 'sync', token: u.token, progress }));
      } catch (e) {
        if (e.status === 401) storage.set(null);
        throw e;
      }
    },
    async logout() {
      const u = storage.get();
      storage.set(null);
      if (u) call({ action: 'logout', token: u.token }).catch(() => {});
    },
  };

  root.Account = Account;
})(typeof window !== 'undefined' ? window : globalThis);
