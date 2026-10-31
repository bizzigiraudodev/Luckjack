// Rival de truco: decide qué cantar, qué responder y qué carta jugar.
// La personalidad cambia cuánto miente (bluff) y cuánto arriesga (aggression).
(function (root) {
  const Truco = root.Truco || (typeof require !== 'undefined' && require('./truco.js'));
  const { rank, envidoOf } = Truco;

  const PERSONAS = {
    gaucho: { bluff: 0.18, aggression: 0.5 }, // zorro viejo: miente de vez en cuando
    diablo: { bluff: 0.4, aggression: 0.75 }, // miente todo el tiempo
    santo: { bluff: 0, aggression: 0.35 }, // nunca miente
  };

  // Qué tan buena es la mano para el truco, contando las bazas ya ganadas o perdidas.
  function power(hand, p) {
    const ranks = hand.cards[p].map(rank).sort((a, b) => b - a);
    const won = hand.bazas.filter((r) => r === p).length;
    const lost = hand.bazas.filter((r) => r === 1 - p).length;
    // Si el rival ya jugó en esta baza, importa si la puedo ganar.
    const i = hand.bazas.length;
    let edge = 0;
    if (hand.table[1 - p].length > i) {
      const opp = rank(hand.table[1 - p][i]);
      edge = ranks.some((r) => r > opp) ? 4 : -4;
    }
    return (ranks[0] || 0) + (ranks[1] || 0) * 0.5 + won * 8 - lost * 7 + edge;
  }

  const has = (acts, type) => acts.some((a) => a.type === type);

  function chooseCard(hand, p) {
    const cards = hand.cards[p];
    const ranks = cards.map(rank);
    const order = ranks.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]); // de menor a mayor
    const i = hand.bazas.length;
    // Juego segundo: la menor que gane; si no puedo ganar, la menor.
    if (hand.table[1 - p].length > i) {
      const opp = rank(hand.table[1 - p][i]);
      const winner = order.find(([r]) => r > opp);
      if (winner) return winner[1];
      const tie = order.find(([r]) => r === opp);
      // Empatar sirve si ya gané la primera.
      if (tie && hand.bazas[0] === p) return tie[1];
      return order[0][1];
    }
    // Juego primero.
    if (i === 0) return order.length >= 2 ? order[order.length - 2][1] : order[0][1]; // la del medio
    if (hand.bazas[0] === p) return order[0][1]; // ya gané una: la más baja
    return order[order.length - 1][1]; // necesito ganar: la más alta
  }

  // Devuelve la acción del rival ({ type, index? }).
  function decide(hand, p, persona = PERSONAS.gaucho, rng = Math.random) {
    const acts = hand.actions(p);
    if (!acts.length) return null;
    const env = envidoOf(hand.dealt[p]);
    const pow = power(hand, p);
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

    if (pend && pend.kind === 'truco') {
      if (has(acts, 'envido') && env >= 27) return { type: env >= 30 && rng() < 0.5 ? 'real' : 'envido' };
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
      if (pow >= need + 2 && rng() < 0.4 + persona.aggression * 0.4) {
        hand.aiAskedAt = hand.truco.level;
        return { type: 'truco' };
      }
      if (bluff() && rng() < 0.35) {
        hand.aiAskedAt = hand.truco.level;
        return { type: 'truco' };
      }
    }
    // Irse al mazo solo con la mano perdida y el truco querido alto.
    if (hand.truco.level >= 2 && pow < 2 && has(acts, 'mazo') && rng() < 0.5) return { type: 'mazo' };
    return { type: 'play', index: chooseCard(hand, p) };
  }

  const TrucoAI = { decide, power, chooseCard, PERSONAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = TrucoAI;
  else root.TrucoAI = TrucoAI;
})(typeof window !== 'undefined' ? window : globalThis);
