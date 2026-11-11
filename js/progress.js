// Progreso del jugador que viaja con su cuenta: desbloqueos, récords y tiempo jugado.
// Lo usan el navegador (lee y escribe localStorage) y la API de cuentas (lo limpia y lo combina).
// Combinar nunca hace perder nada: los desbloqueos se suman y de los récords queda el mejor.
(function (root) {
  // Claves de localStorage (con el prefijo "luckjack.") y qué tipo de dato guarda cada una.
  const FIELDS = {
    seenIntro: 'flag',
    storyDone: 'flag', // historia del blackjack → Mazo Dorado y blackjack infinito
    trucoStoryDone: 'flag', // pampa en muerte súbita → Mazo Dorado en el truco
    trucoStoryBeaten: 'flag', // alguna historia del truco → resto de los modos de truco
    trucoPampaBeaten: 'flag', // pampa → historia del purgatorio
    best: 'run', // blackjack infinito: { cycles, money }
    trucoBest: 'run', // truco infinito: { cycles, money }
    bestClassic: 'num', // blackjack clásico: dinero máximo
    playMs: 'num', // tiempo total de juego
    trucoClassic: 'wl', // truco clásico: { wins, losses }
    truco4: 'wl', // truco de a 4: { wins, losses }
  };
  const MAX = 1e12;
  const num = (v) => Math.max(0, Math.min(MAX, Math.floor(Number(v) || 0)));

  // Deja solo los campos conocidos, con el tipo y el rango correctos.
  function clean(p) {
    const out = {};
    if (!p || typeof p !== 'object') return out;
    for (const [k, type] of Object.entries(FIELDS)) {
      const v = p[k];
      if (v === undefined || v === null) continue;
      if (type === 'flag') { if (v === true) out[k] = true; }
      else if (type === 'num') { if (num(v)) out[k] = num(v); }
      else if (typeof v === 'object') {
        out[k] = type === 'run' ? { cycles: num(v.cycles), money: num(v.money) } : { wins: num(v.wins), losses: num(v.losses) };
      }
    }
    return out;
  }

  // Lo mejor de los dos: desbloqueos sumados, el mejor récord y el mayor tiempo jugado.
  function merge(a, b) {
    a = clean(a);
    b = clean(b);
    const out = {};
    for (const [k, type] of Object.entries(FIELDS)) {
      const x = a[k];
      const y = b[k];
      if (x === undefined && y === undefined) continue;
      if (x === undefined || y === undefined) { out[k] = x === undefined ? y : x; continue; }
      if (type === 'flag') out[k] = true;
      else if (type === 'num') out[k] = Math.max(x, y);
      else if (type === 'run') out[k] = x.cycles > y.cycles || (x.cycles === y.cycles && x.money >= y.money) ? x : y;
      else out[k] = { wins: Math.max(x.wins, y.wins), losses: Math.max(x.losses, y.losses) };
    }
    return out;
  }

  // Navegador: leer y escribir el progreso en localStorage.
  function collect(storage) {
    const out = {};
    for (const k of Object.keys(FIELDS)) {
      try {
        const v = JSON.parse(storage.getItem(`luckjack.${k}`));
        if (v !== null) out[k] = v;
      } catch { /* dato roto: se ignora */ }
    }
    return clean(out);
  }

  function apply(storage, progress) {
    for (const [k, v] of Object.entries(clean(progress))) {
      try { storage.setItem(`luckjack.${k}`, JSON.stringify(v)); } catch { /* sin storage */ }
    }
  }

  const Progress = { FIELDS, clean, merge, collect, apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = Progress;
  else root.Progress = Progress;
})(typeof window !== 'undefined' ? window : globalThis);
