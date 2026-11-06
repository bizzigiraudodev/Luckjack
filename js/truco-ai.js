// Rival de truco: decide qué cantar, qué responder y qué carta jugar.
// La personalidad cambia cuánto miente (bluff) y cuánto arriesga (aggression).
(function (root) {
  const Truco = root.Truco || (typeof require !== 'undefined' && require('./truco.js'));
  // Modo difícil: el cerebro con probabilidades (js/truco-brain.js), solo en el mano a mano.
  const brain = () => root.TrucoBrain || (typeof require !== 'undefined' && require('./truco-brain.js'));
  const { rank, envidoOf } = Truco;

  const PERSONAS = {
    gaucho: { bluff: 0.18, aggression: 0.5 }, // zorro viejo: miente de vez en cuando
    diablo: { bluff: 0.4, aggression: 0.75 }, // miente todo el tiempo
    santo: { bluff: 0, aggression: 0.35 }, // nunca miente
    // Historia del truco en la pampa
    luzmala: { bluff: 0.25, aggression: 0.5 }, // te encandila
    silbon: { bluff: 0.3, aggression: 0.85 }, // te engaña con el silbido: canta todo
    pombero: { bluff: 0.3, aggression: 0.6 }, // travieso: esconde y engaña
    familiar: { bluff: 0.35, aggression: 0.6 }, // tramposo como su patrón
    gil: { bluff: 0, aggression: 0.55 }, // justo: nunca miente
  };

  const teamOf = (hand, p) => (hand.team ? hand.team(p) : p);

  // La carta más alta jugada hasta ahora en la baza actual, y de qué pareja es.
  function currentBest(hand) {
    const i = hand.bazas.length;
    let best = -1;
    let team = null;
    hand.table.forEach((cards, q) => {
      if (cards.length > i) {
        const r = rank(cards[i]);
        if (r > best) { best = r; team = teamOf(hand, q); } else if (r === best && team !== teamOf(hand, q)) team = 'parda';
      }
    });
    return best < 0 ? null : { rank: best, team };
  }

  // Qué tan buena es la mano para el truco, contando las bazas ya ganadas o perdidas.
  // `hints`: lo que el compañero mostró con señas ({ strong: cuántas cartas bravas, envido, nada }).
  function power(hand, p, hints = {}) {
    const t = teamOf(hand, p);
    const ranks = hand.cards[p].map(rank).sort((a, b) => b - a);
    const won = hand.bazas.filter((r) => r === t).length;
    const lost = hand.bazas.filter((r) => r === 1 - t).length;
    // Si ya se jugó en esta baza, importa si la puedo ganar (o si ya la gana mi compañero).
    let edge = 0;
    const cur = currentBest(hand);
    // Si la carta que va ganando la baza es nuestra, cuenta como si la tuviéramos (antes se olvidaba
    // de ella: tiraba el ancho de basto en la 3ra y después decía "no quiero").
    if (cur && cur.team === t) {
      edge = 3;
      ranks.push(cur.rank);
      ranks.sort((a, b) => b - a);
    }
    else if (cur) edge = ranks.some((r) => r > cur.rank) ? 4 : -4;
    // Cada carta brava del compañero suma (si te mostró dos, cuenta las dos).
    const strong = hints.strong === true ? 1 : Math.min(3, Number(hints.strong) || 0);
    const partner = 5 * strong - (hints.nada ? 2 : 0);
    return (ranks[0] || 0) + (ranks[1] || 0) * 0.5 + won * 8 - lost * 7 + edge + partner;
  }

  const has = (acts, type) => acts.some((a) => a.type === type);

  function chooseCard(hand, p) {
    const t = teamOf(hand, p);
    const cards = hand.cards[p];
    const ranks = cards.map(rank);
    const order = ranks.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]); // de menor a mayor
    const i = hand.bazas.length;
    const cur = currentBest(hand);
    if (cur) {
      // La va ganando mi compañero: tiro la más baja.
      if (cur.team === t) return order[0][1];
      // Si no: la menor que gane; si no puedo ganar, la menor.
      const winner = order.find(([r]) => r > cur.rank);
      if (winner) return winner[1];
      const tie = order.find(([r]) => r === cur.rank);
      // Empatar sirve si ya ganamos la primera.
      if (tie && hand.bazas[0] === t) return tie[1];
      return order[0][1];
    }
    // Juego primero.
    if (i === 0) return order.length >= 2 ? order[order.length - 2][1] : order[0][1]; // la del medio
    if (hand.bazas[0] === t) return order[0][1]; // ya ganamos una: la más baja
    return order[order.length - 1][1]; // necesitamos ganar: la más alta
  }

  // Devuelve la acción del rival ({ type, index? }).
  // `hints`: señas del compañero (solo en parejas).
  function decide(hand, p, persona = PERSONAS.gaucho, rng = Math.random, hints = {}) {
    if (persona.smart && hand.n === 2 && brain()) return brain().decide(hand, p, persona, rng);
    return classic(hand, p, persona, rng, hints);
  }

  function classic(hand, p, persona, rng, hints) {
    const acts = hand.actions(p);
    if (!acts.length) return null;
    // Con señas sabe si su compañero tiene envido (y lo trata como un 30).
    const env = Math.max(envidoOf(hand.dealt[p]), hints.envido ? 30 : 0);
    const pow = power(hand, p, hints);
    const pend = hand.pending;
    const bluff = () => rng() < persona.bluff;

    if (pend && pend.kind === 'envido') {
      const chain = pend.chain;
      if (chain.includes('falta')) return { type: env >= 31 || (env >= 29 && rng() < 0.5) ? 'quiero' : 'noquiero' };
      if (env >= 32 && has(acts, 'falta') && rng() < 0.35 * persona.aggression + 0.1) return { type: 'falta' };
      if (env >= 30 && has(acts, 'real') && rng() < 0.5) return { type: 'real' };
      if (env >= 28 && has(acts, 'envido') && rng() < 0.3) return { type: 'envido' };
      if (env < 22 && has(acts, 'real') && bluff() && rng() < 0.4) return { type: 'real' };
      const need = 25 + chain.length * 1.5 + (persona.envidoNeed || 0);
      return { type: env >= need || (env >= need - 3 && rng() < 0.35) || bluff() ? 'quiero' : 'noquiero' };
    }

    // Desde la 2da baza (mano a mano) sabe la chance de ganar la mano con lo que se vio (recorre todas
    // las cartas que le pueden quedar al rival). Así no se achica con la mano ganada ni quiere una perdida.
    const late = hand.n === 2 && hand.bazas.length && brain() && (pend ? pend.kind === 'truco' : has(acts, 'truco') || has(acts, 'mazo'));
    const winP = late ? brain().trucoWinProb(hand, p, rng).win : null;

    if (pend && pend.kind === 'truco') {
      if (has(acts, 'envido') && env >= 27) return { type: env >= 30 && rng() < 0.5 ? 'real' : 'envido' };
      if (winP !== null) {
        if (winP > 0.999) return { type: has(acts, 'truco') ? 'truco' : 'quiero' };
        if (winP < 0.001) return { type: 'noquiero' };
        if (has(acts, 'truco') && (winP > 0.85 || (winP > 0.2 && bluff() && rng() < 0.3))) return { type: 'truco' };
        const needP = 0.5 - (persona.aggression - 0.5) * 0.2 + (persona.trucoNeed || 0) * 0.04;
        return { type: winP >= needP || (winP > 0.1 && bluff()) ? 'quiero' : 'noquiero' };
      }
      const need = 9 + pend.level * 3 + (persona.trucoNeed || 0);
      if (has(acts, 'truco') && (pow >= need + 6 || (bluff() && rng() < 0.4))) return { type: 'truco' };
      return { type: pow >= need || (pow >= need - 3 && rng() < persona.aggression * 0.5) || bluff() ? 'quiero' : 'noquiero' };
    }

    // Mi turno de jugar: primero ver si canto algo.
    if (has(acts, 'envido')) {
      if (env >= 31 && rng() < 0.25 * persona.aggression) return { type: 'falta' };
      if (env >= 29 && rng() < 0.6) return { type: 'real' };
      if (env >= 27 && rng() < 0.75) return { type: 'envido' };
      if (env <= 20 && bluff() && rng() < 0.5) return { type: 'envido' };
    }
    if (has(acts, 'truco') && hand.aiAskedAt !== hand.truco.level) {
      const need = 12 + hand.truco.level * 3;
      if (winP > 0.999 || ((winP !== null ? winP > 0.75 : pow >= need + 2) && rng() < 0.4 + persona.aggression * 0.4)) {
        hand.aiAskedAt = hand.truco.level;
        return { type: 'truco' };
      }
      if (!(winP < 0.001) && bluff() && rng() < 0.35) {
        hand.aiAskedAt = hand.truco.level;
        return { type: 'truco' };
      }
    }
    // Irse al mazo solo con la mano perdida y el truco querido alto.
    if (!(winP > 0.5) && hand.truco.level >= 2 && pow < 2 && has(acts, 'mazo') && rng() < 0.5) return { type: 'mazo' };
    return { type: 'play', index: chooseCard(hand, p) };
  }

  // El compañero bot obedece las órdenes de su pareja: si puede cantar lo que le pidieron, lo canta;
  // con "jugá callado" no canta nada (solo juega y responde). Devuelve { action, used }.
  const CALLS = ['truco', 'envido', 'real', 'falta'];
  function obey(hand, p, orders, action, getOrder) {
    if (!orders || !orders.length) return { action, used: null };
    const acts = hand.actions(p);
    const nextTruco = hand.pending && hand.pending.kind === 'truco' ? hand.pending.level + 1 : hand.truco.level + 1;
    for (const id of orders) {
      const o = getOrder(id);
      if (!o || !o.act) continue;
      if (!has(acts, o.act.type)) continue;
      if (o.act.type === 'truco' && o.act.level !== nextTruco) continue;
      return { action: { type: o.act.type }, used: id };
    }
    const quiet = orders.some((id) => { const o = getOrder(id); return o && o.callado; });
    if (quiet && action && CALLS.includes(action.type)) {
      if (has(acts, 'play')) return { action: { type: 'play', index: chooseCard(hand, p) }, used: null };
      if (has(acts, 'quiero')) return { action: { type: 'quiero' }, used: null };
    }
    return { action, used: null };
  }

  const TrucoAI = { decide, power, chooseCard, currentBest, obey, PERSONAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = TrucoAI;
  else root.TrucoAI = TrucoAI;
})(typeof window !== 'undefined' ? window : globalThis);
