// Señas del truco de a 4: solo las ve tu compañero (nunca las pesca un rival).
// Con un toque le mostrás todas tus señas: tus cartas bravas y si tenés envido.
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

  // Qué le dicen las señas al bot compañero: cuántas cartas bravas, si hay envido o si no hay nada.
  function hintsFrom(ids) {
    const h = {};
    const bravas = {};
    for (const id of ids) {
      if (['cejas', 'guino', 'boca_der', 'boca_izq', 'labio', 'trompa'].includes(id)) bravas[id] = (bravas[id] || 0) + 1;
      if (id === 'ceno') h.envido = true;
      if (id === 'ojos') h.nada = true;
    }
    // Dos cartas iguales (dos treses) son dos señas iguales y cuentan las dos.
    const count = Object.values(bravas).reduce((s, n) => s + n, 0);
    if (count) h.strong = Math.min(3, count);
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

  // Cartas bravas y la seña de cada una, de la más alta a la más baja.
  const BRAVAS = [['cejas', 1, 'espada'], ['guino', 1, 'basto'], ['boca_der', 7, 'espada'], ['boca_izq', 7, 'oro'], ['labio', 3], ['trompa', 2]];

  // Lo que ve tu compañero cuando tocás "Señas": todas tus cartas bravas y si tenés envido (o "nada").
  function showFor(cards, envido) {
    const shown = [];
    const senas = [];
    for (const [id, n, s] of BRAVAS) {
      for (const c of cards) {
        if (c.n === n && (!s || c.s === s) && !shown.includes(c)) { shown.push(c); senas.push(id); }
      }
    }
    const hasEnvido = envido >= 27;
    if (hasEnvido) senas.push('ceno');
    if (!senas.length) senas.push('ojos');
    return { cards: shown.map((c) => ({ n: c.n, s: c.s })), senas, envido: hasEnvido };
  }

  // Anti-spam: cuántas veces por mano y cada cuánto se pueden mostrar las señas o mandar frases.
  const LIMITS = { showsPerHand: 3, showGapMs: 4000, phraseGapMs: 2500 };

  // Órdenes al compañero (solo las escucha él). `act` es el canto que hace cuando puede;
  // `callado` = no cantar nada en esta mano.
  const ORDERS = [
    { id: 'vino', text: '¡Cantá el vino, dale!', act: { type: 'envido' } },
    { id: 'doble', text: '¡Cantá doble!', act: { type: 'envido' } },
    { id: 'real', text: '¡Cantá real!', act: { type: 'real' } },
    { id: 'falta', text: '¡Cantá falta!', act: { type: 'falta' } },
    { id: 'segunda', text: '¡Cantá 2da!', act: { type: 'truco', level: 1 } },
    { id: 're', text: '¡Cantá el re!', act: { type: 'truco', level: 2 } },
    { id: 'vale4', text: '¡Cantá el vale cuatro!', act: { type: 'truco', level: 3 } },
    { id: 'pesca', text: 'Vamos a la pesca', callado: true },
    { id: 'callado', text: 'Jugá callado', callado: true },
  ];
  const getOrder = (id) => ORDERS.find((o) => o.id === id);

  // Respuestas de los rivales bots cuando los cargás.
  const COMEBACKS = [
    'Hablá menos y jugá más',
    '¿Y vos de qué te reís?',
    'Esa la vamos a ver',
    'Mucho ruido y pocas cartas',
    'Andá a cantarle a tu abuela',
    'Ya te vas a callar, ya',
  ];
  // Lo que contesta el compañero bot a una orden.
  const ACKS = ['¡Dale, compañero!', '¡Hecho!', 'Si puedo, lo canto', '¡Entendido!'];

  const Senas = { SENAS, getSena, hintsFrom, senasFor, showFor, LIMITS, ORDERS, getOrder, COMEBACKS, ACKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Senas;
  else root.Senas = Senas;
})(typeof window !== 'undefined' ? window : globalThis);
