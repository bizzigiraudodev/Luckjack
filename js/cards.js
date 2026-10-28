// Mazo, cartas y valor de manos.
(function (root) {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function cardValue(card) {
    if (card.rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    return Number(card.rank);
  }

  function isFace(card) {
    return ['J', 'Q', 'K'].includes(card.rank);
  }

  function isRed(card) {
    return card.suit === '♥' || card.suit === '♦';
  }

  // Devuelve { total, soft } contando ases como 11 mientras no se pase de `limit`.
  function handValue(cards, limit = 21) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
      total += cardValue(c);
      if (c.rank === 'A') aces++;
    }
    while (total > limit && aces > 0) {
      total -= 10;
      aces--;
    }
    return { total, soft: aces > 0 };
  }

  function isBlackjack(cards) {
    return cards.length === 2 && handValue(cards).total === 21;
  }

  function shuffle(arr, rng = Math.random) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildDeck(numDecks = 2, extraAces = 0, rng = Math.random) {
    const deck = [];
    for (let d = 0; d < numDecks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) deck.push({ rank, suit });
      }
    }
    for (let i = 0; i < extraAces; i++) deck.push({ rank: 'A', suit: SUITS[i % 4] });
    return shuffle(deck, rng);
  }

  const Cards = { SUITS, RANKS, cardValue, isFace, isRed, handValue, isBlackjack, shuffle, buildDeck };
  if (typeof module !== 'undefined' && module.exports) module.exports = Cards;
  else root.Cards = Cards;
})(typeof window !== 'undefined' ? window : globalThis);
