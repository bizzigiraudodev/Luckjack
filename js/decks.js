// Mazos: cada uno modifica la chance de que te toque una carta buena.
(function (root) {
  const Cards = root.Cards || (typeof require !== 'undefined' && require('./cards.js'));

  const DECKS = {
    clasico: { id: 'clasico', name: 'Mazo Clásico', icon: '🂠', luck: 1,
      desc: 'Chances normales.' },
    gastado: { id: 'gastado', name: 'Mazo Gastado', icon: '🥀', luck: 0.85,
      desc: '15% menos de chances de una buena combinación.' },
    maldito: { id: 'maldito', name: 'Mazo Maldito', icon: '☠️', luck: 0.7,
      desc: '30% menos de chances de una buena combinación.' },
    dorado: { id: 'dorado', name: 'Mazo Dorado', icon: '✨', luck: 1.05, price: 200,
      desc: '5% más de chances de una buena combinación que el mazo clásico. Reemplaza tu mazo actual.' },
  };

  // Orden en que se van perdiendo los mazos: perder con el último es game over.
  const DECK_SEQUENCE = ['clasico', 'gastado', 'maldito'];
  const BETTER_DECK_CHANCE = 0.05;

  // Una carta es "buena" para el jugador si arma una buena combinación:
  // la primera carta es un As o vale 10; después, deja la mano entre 18 y el límite.
  function isGoodDraw(hand, card, limit = 21) {
    if (hand.length === 0) return Cards.cardValue(card) >= 10;
    const total = Cards.handValue([...hand, card], limit).total;
    return total >= 18 && total <= limit;
  }

  // Elige qué carta del mazo le toca al jugador. La chance de una carta buena
  // es (chance natural × suerte del mazo). Toma la carta más arriba del grupo
  // elegido, así el mazo sigue mezclado. Devuelve un índice de `deck`.
  function pickIndex(deck, hand, luck, limit, rng) {
    const top = deck.length - 1;
    if (luck === 1) return top;
    let topGood = -1;
    let topBad = -1;
    let good = 0;
    for (let i = top; i >= 0; i--) {
      if (isGoodDraw(hand, deck[i], limit)) {
        good++;
        if (topGood < 0) topGood = i;
      } else if (topBad < 0) {
        topBad = i;
      }
    }
    if (topGood < 0 || topBad < 0) return top;
    const pGood = Math.min(1, (luck * good) / deck.length);
    return rng() < pGood ? topGood : topBad;
  }

  function deckPrice(cycle = 1) {
    return Math.round((DECKS.dorado.price * (1 + 0.1 * (cycle - 1))) / 5) * 5;
  }

  const Decks = { DECKS, DECK_SEQUENCE, BETTER_DECK_CHANCE, isGoodDraw, pickIndex, deckPrice };
  if (typeof module !== 'undefined' && module.exports) module.exports = Decks;
  else root.Decks = Decks;
})(typeof window !== 'undefined' ? window : globalThis);
