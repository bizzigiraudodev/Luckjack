// Anti-bot: mientras jugás, junta estadísticas de cómo tocás la pantalla o el mouse. Se mandan con cada
// marca a los rankings y el servidor descarta las que parecen de un programa (ver api/leaderboard.js).
// No guarda qué tocaste, solo cuántas veces, a qué ritmo y qué tan centrado.
(function (root) {
  const state = { clicks: 0, keys: 0, untrusted: 0, centered: 0, moves: 0, mouseClicks: 0, gaps: [], last: 0 };

  function reset() {
    Object.assign(state, { clicks: 0, keys: 0, untrusted: 0, centered: 0, moves: 0, mouseClicks: 0, gaps: [], last: 0 });
  }

  function onPointer(e) {
    if (!e.target || !e.target.closest) return;
    const btn = e.target.closest('button, .card, .chip, input');
    if (!btn) return;
    if (!e.isTrusted) { state.untrusted++; return; }
    state.clicks++;
    if (e.pointerType === 'mouse') state.mouseClicks++;
    const r = btn.getBoundingClientRect();
    if (Math.abs(e.clientX - (r.left + r.width / 2)) < 1.5 && Math.abs(e.clientY - (r.top + r.height / 2)) < 1.5) state.centered++;
    const now = performance.now();
    if (state.last) state.gaps.push(now - state.last);
    if (state.gaps.length > 400) state.gaps.shift();
    state.last = now;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', onPointer, true);
    // Un .click() hecho por código no dispara pointerdown: esas jugadas simplemente no cuentan como humanas
    // (los atajos de teclado del juego usan .click(), pero ya cuentan por el keydown).
    document.addEventListener('pointermove', (e) => { if (e.isTrusted && e.pointerType === 'mouse') state.moves++; }, { capture: true, passive: true });
    // Los atajos de teclado también cuentan como jugadas humanas.
    document.addEventListener('keydown', (e) => {
      if (!e.isTrusted) { state.untrusted++; return; }
      if (e.repeat) return;
      state.keys++;
      const now = performance.now();
      if (state.last) state.gaps.push(now - state.last);
      state.last = now;
    }, true);
  }

  // Resumen que viaja con la marca.
  function proof() {
    const g = state.gaps.slice().sort((a, b) => a - b);
    const median = g.length ? g[Math.floor(g.length / 2)] : 0;
    const mean = g.length ? g.reduce((s, x) => s + x, 0) / g.length : 0;
    const sd = g.length ? Math.sqrt(g.reduce((s, x) => s + (x - mean) ** 2, 0) / g.length) : 0;
    return {
      webdriver: !!(typeof navigator !== 'undefined' && navigator.webdriver),
      clicks: state.clicks,
      keys: state.keys,
      untrusted: state.untrusted,
      centered: state.centered,
      moves: state.moves,
      mouseClicks: state.mouseClicks,
      medianGap: Math.round(median),
      cv: mean ? Math.round((sd / mean) * 100) / 100 : 0,
    };
  }

  root.AntiBot = { reset, proof };
})(typeof window !== 'undefined' ? window : globalThis);
