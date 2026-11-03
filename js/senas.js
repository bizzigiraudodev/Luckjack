// Señas del truco de a 4: solo las ve tu compañero (nunca las pesca un rival) y se puede mentir.
(function (root) {
  const SENAS = [
    { id: 'cejas', icon: '🤨', face: 'Levantar las cejas', means: 'Ancho de espadas' },
    { id: 'guino', icon: '😉', face: 'Guiñar un ojo', means: 'Ancho de bastos' },
    { id: 'boca_der', icon: '😏', face: 'Torcer la boca a la derecha', means: '7 de espadas' },
    { id: 'boca_izq', icon: '😒', face: 'Torcer la boca a la izquierda', means: '7 de oro' },
    { id: 'labio', icon: '😬', face: 'Morder el labio', means: 'Un tres' },
    { id: 'trompa', icon: '😗', face: 'Hacer trompita', means: 'Un dos' },
    { id: 'ceno', icon: '😠', face: 'Fruncir el ceño', means: 'Tengo envido' },
    { id: 'ojos', icon: '😌', face: 'Cerrar los ojos', means: 'No tengo nada' },
  ];

  const getSena = (id) => SENAS.find((s) => s.id === id);

  // Qué le dice una seña al bot compañero.
  function hintsFrom(ids) {
    const h = {};
    for (const id of ids) {
      if (['cejas', 'guino', 'boca_der', 'boca_izq', 'labio', 'trompa'].includes(id)) h.strong = true;
      if (id === 'ceno') h.envido = true;
      if (id === 'ojos') h.nada = true;
    }
    return h;
  }

  // Las señas que haría un bot honesto con sus cartas: la de su mejor carta brava y la del envido.
  function senasFor(cards, envido) {
    const out = [];
    const has = (n, s) => cards.some((c) => c.n === n && (!s || c.s === s));
    if (has(1, 'espada')) out.push('cejas');
    else if (has(1, 'basto')) out.push('guino');
    else if (has(7, 'espada')) out.push('boca_der');
    else if (has(7, 'oro')) out.push('boca_izq');
    else if (has(3)) out.push('labio');
    else if (has(2)) out.push('trompa');
    if (envido >= 27) out.push('ceno');
    if (!out.length) out.push('ojos');
    return out;
  }

  const Senas = { SENAS, getSena, hintsFrom, senasFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = Senas;
  else root.Senas = Senas;
})(typeof window !== 'undefined' ? window : globalThis);
