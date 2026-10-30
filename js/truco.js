// Motor del truco argentino (mano a mano, sin flor). Sin DOM, para poder testearlo con Node.
// Jugadores: 0 = vos, 1 = el rival.
(function (root) {
  const SUITS = ['espada', 'basto', 'oro', 'copa'];
  const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

  function buildDeck(rng = Math.random) {
    const deck = [];
    for (const s of SUITS) for (const n of NUMBERS) deck.push({ n, s });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // Jerarquía del truco: 14 = ancho de espadas ... 1 = los cuatros.
  const BASE_RANK = { 3: 10, 2: 9, 1: 8, 12: 7, 11: 6, 10: 5, 7: 4, 6: 3, 5: 2, 4: 1 };
  function rank(c) {
    if (c.n === 1 && c.s === 'espada') return 14;
    if (c.n === 1 && c.s === 'basto') return 13;
    if (c.n === 7 && c.s === 'espada') return 12;
    if (c.n === 7 && c.s === 'oro') return 11;
    return BASE_RANK[c.n];
  }

  const envidoValue = (n) => (n >= 10 ? 0 : n);

  // Envido: dos cartas del mismo palo suman 20 + sus valores (las figuras valen 0);
  // si no hay dos del mismo palo, vale la carta más alta.
  function envidoOf(cards) {
    let best = Math.max(...cards.map((c) => envidoValue(c.n)));
    for (const s of SUITS) {
      const vals = cards.filter((c) => c.s === s).map((c) => envidoValue(c.n)).sort((a, b) => b - a);
      if (vals.length >= 2) best = Math.max(best, 20 + vals[0] + vals[1]);
    }
    return best;
  }

  // Quién gana la mano según las bazas (0, 1 o 'parda'); null si todavía no se sabe.
  function handWinner(bazas, mano) {
    const [a, b, c] = bazas;
    if (bazas.length < 2) return null;
    if (a !== 'parda' && a === b) return a;
    if (a === 'parda' && b !== 'parda') return b;
    if (a !== 'parda' && b === 'parda') return a;
    if (bazas.length < 3) return null;
    if (a === 'parda' && b === 'parda') return c === 'parda' ? mano : c;
    // una baza para cada uno: decide la tercera (si es parda, gana el que ganó la primera)
    return c === 'parda' ? a : c;
  }

  const TRUCO_NAMES = ['', 'Truco', 'Retruco', 'Vale cuatro'];
  const TRUCO_POINTS = [1, 2, 3, 4]; // puntos de la mano según el nivel querido
  const ENVIDO_NAMES = { envido: 'Envido', real: 'Real envido', falta: 'Falta envido' };
  const ENVIDO_POINTS = { envido: 2, real: 3 };

  class TrucoHand {
    // `faltaPoints(ganador)` dice cuánto vale la falta envido.
    constructor({ deck, mano, faltaPoints = () => 15 }) {
      this.mano = mano;
      this.cards = [[], []];
      for (let i = 0; i < 3; i++) {
        this.cards[mano].push(deck.pop());
        this.cards[1 - mano].push(deck.pop());
      }
      this.dealt = [this.cards[0].slice(), this.cards[1].slice()];
      this.table = [[], []]; // cartas jugadas por cada uno, en orden
      this.bazas = [];
      this.turn = mano;
      this.truco = { level: 0, owner: null }; // owner: quién puede subir la apuesta (el que dijo quiero)
      this.pending = null; // canto esperando respuesta
      this.envido = { done: false, chain: null, winner: null, points: 0, values: null, accepted: false };
      this.points = [0, 0];
      this.finished = false;
      this.winner = null;
      this.faltaPoints = faltaPoints;
      this.events = [];
    }

    // Quién tiene que actuar: el que responde un canto, o al que le toca jugar.
    get actor() {
      return this.pending ? 1 - this.pending.caller : this.turn;
    }

    emit(event) {
      this.events.push(event);
    }

    // Se puede cantar envido en la primera baza antes de jugar tu primera carta, si no se quiso el truco.
    canSingEnvido(p) {
      return !this.finished && !this.envido.done && this.truco.level === 0 &&
        this.bazas.length === 0 && this.table[p].length === 0;
    }

    actions(p) {
      if (this.finished || p !== this.actor) return [];
      const acts = [];
      const pend = this.pending;
      if (pend && pend.kind === 'envido') {
        acts.push({ type: 'quiero' }, { type: 'noquiero' });
        const ch = pend.chain;
        const envidos = ch.filter((c) => c === 'envido').length;
        if (envidos < 2 && !ch.includes('real') && !ch.includes('falta')) acts.push({ type: 'envido' });
        if (!ch.includes('real') && !ch.includes('falta')) acts.push({ type: 'real' });
        if (!ch.includes('falta')) acts.push({ type: 'falta' });
        return acts;
      }
      if (pend && pend.kind === 'truco') {
        acts.push({ type: 'quiero' }, { type: 'noquiero' });
        if (pend.level < 3) acts.push({ type: 'truco' });
        // "El envido está primero": ante el truco todavía se puede cantar envido.
        if (pend.level === 1 && !this.envido.done && this.bazas.length === 0 && this.table[p].length === 0) {
          acts.push({ type: 'envido' }, { type: 'real' }, { type: 'falta' });
        }
        return acts;
      }
      this.cards[p].forEach((_, i) => acts.push({ type: 'play', index: i }));
      if (this.truco.level < 3 && (this.truco.owner === null || this.truco.owner === p)) acts.push({ type: 'truco' });
      if (this.canSingEnvido(p)) acts.push({ type: 'envido' }, { type: 'real' }, { type: 'falta' });
      acts.push({ type: 'mazo' });
      return acts;
    }

    can(p, action) {
      return this.actions(p).some((a) => a.type === action.type && (a.index === undefined || a.index === action.index));
    }

    act(p, action) {
      if (!this.can(p, action)) throw new Error(`Acción inválida: ${action.type}`);
      const pend = this.pending;
      switch (action.type) {
        case 'play': return this.play(p, action.index);
        case 'mazo': {
          this.emit({ type: 'mazo', who: p });
          return this.finish(1 - p, TRUCO_POINTS[this.truco.level]);
        }
        case 'truco': {
          let level = this.truco.level + 1;
          if (pend && pend.kind === 'truco') {
            // Subir la apuesta implica querer la anterior.
            this.truco.level = pend.level;
            level = pend.level + 1;
          }
          this.pending = { kind: 'truco', caller: p, level };
          this.emit({ type: 'call', who: p, text: `¡${TRUCO_NAMES[level]}!` });
          return null;
        }
        case 'envido': case 'real': case 'falta': {
          if (pend && pend.kind === 'envido') {
            pend.chain.push(action.type);
            pend.caller = p;
          } else {
            // Cantado de cero o como respuesta al truco ("el envido está primero").
            this.pending = { kind: 'envido', caller: p, chain: [action.type], resume: pend || null };
          }
          this.emit({ type: 'call', who: p, text: `¡${ENVIDO_NAMES[action.type]}!` });
          return null;
        }
        case 'quiero': {
          this.emit({ type: 'response', who: p, text: '¡Quiero!' });
          if (pend.kind === 'envido') {
            this.resolveEnvido(true);
            this.pending = pend.resume;
          } else {
            this.truco.level = pend.level;
            this.truco.owner = p;
            this.pending = null;
          }
          return null;
        }
        case 'noquiero': {
          this.emit({ type: 'response', who: p, text: 'No quiero' });
          if (pend.kind === 'envido') {
            this.resolveEnvido(false);
            this.pending = pend.resume;
            return null;
          }
          return this.finish(pend.caller, TRUCO_POINTS[pend.level - 1]);
        }
        default: throw new Error('Acción desconocida');
      }
    }

    // Puntos del envido querido; si no se quiere, el que cantó último se lleva lo anterior (mínimo 1).
    envidoChainPoints(chain, accepted, winner) {
      if (accepted) {
        if (chain.includes('falta')) return this.faltaPoints(winner);
        return chain.reduce((s, c) => s + ENVIDO_POINTS[c], 0);
      }
      if (chain.length === 1) return 1;
      return chain.slice(0, -1).reduce((s, c) => s + (ENVIDO_POINTS[c] || 0), 0);
    }

    resolveEnvido(accepted) {
      const { chain, caller } = this.pending;
      const values = [envidoOf(this.dealt[0]), envidoOf(this.dealt[1])];
      let winner;
      if (accepted) winner = values[0] > values[1] ? 0 : values[1] > values[0] ? 1 : this.mano;
      else winner = caller;
      const points = this.envidoChainPoints(chain, accepted, winner);
      this.points[winner] += points;
      this.envido = { done: true, chain, winner, points, values: accepted ? values : null, accepted };
      this.emit({ type: 'envido', winner, points, values: accepted ? values : null, accepted });
    }

    play(p, index) {
      const card = this.cards[p].splice(index, 1)[0];
      this.table[p].push(card);
      this.emit({ type: 'play', who: p, card });
      const i = this.bazas.length;
      if (this.table[0].length > i && this.table[1].length > i) return this.resolveBaza(i);
      this.turn = 1 - p;
      return null;
    }

    resolveBaza(i) {
      const r0 = rank(this.table[0][i]);
      const r1 = rank(this.table[1][i]);
      const result = r0 > r1 ? 0 : r1 > r0 ? 1 : 'parda';
      this.bazas.push(result);
      this.emit({ type: 'baza', index: i, result });
      const w = handWinner(this.bazas, this.mano);
      if (w !== null) return this.finish(w, TRUCO_POINTS[this.truco.level]);
      this.turn = result === 'parda' ? this.mano : result;
      return null;
    }

    finish(winner, trucoPoints) {
      this.points[winner] += trucoPoints;
      this.finished = true;
      this.winner = winner;
      this.trucoPoints = trucoPoints;
      this.pending = null;
      this.emit({ type: 'end', winner, points: trucoPoints });
      return this;
    }
  }

  // Partida a `target` puntos. La mano (quién empieza) se alterna.
  class TrucoMatch {
    constructor({ target = 15, rng = Math.random, firstMano = 1 } = {}) {
      this.target = target;
      this.rng = rng;
      this.scores = [0, 0];
      this.mano = firstMano;
      this.handNumber = 0;
      this.hand = null;
      this.over = false;
      this.winner = null;
    }

    newHand() {
      if (this.over) throw new Error('La partida terminó');
      if (this.hand) this.mano = 1 - this.mano;
      this.handNumber++;
      this.hand = new TrucoHand({
        deck: buildDeck(this.rng),
        mano: this.mano,
        // La falta envido vale lo que le falta al que va ganando para llegar.
        faltaPoints: () => this.target - Math.max(...this.scores),
      });
      return this.hand;
    }

    // Suma los puntos de la mano terminada.
    settle() {
      const h = this.hand;
      if (!h || !h.finished || h.settled) return;
      h.settled = true;
      this.scores[0] = Math.min(this.target, this.scores[0] + h.points[0]);
      this.scores[1] = Math.min(this.target, this.scores[1] + h.points[1]);
      if (this.scores[0] >= this.target || this.scores[1] >= this.target) {
        this.over = true;
        // Si los dos llegan en la misma mano, gana el que se llevó más puntos en ella.
        this.winner = this.scores[0] >= this.target && (this.scores[1] < this.target || h.points[0] >= h.points[1]) ? 0 : 1;
      }
    }
  }

  const Truco = {
    SUITS, NUMBERS, TRUCO_NAMES, ENVIDO_NAMES,
    buildDeck, rank, envidoOf, handWinner, TrucoHand, TrucoMatch,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Truco;
  else root.Truco = Truco;
})(typeof window !== 'undefined' ? window : globalThis);
