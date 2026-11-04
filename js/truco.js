// Motor del truco argentino (mano a mano o de a 4 en parejas, sin flor). Sin DOM, para poder testearlo
// con Node. Mano a mano: 0 = vos, 1 = el rival. De a 4: 0 y 2 son una pareja, 1 y 3 la otra.
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

  // La falta envido vale lo que le falta al que va ganando para llegar a 15. En una partida a 30,
  // mientras nadie pasó a las buenas es lo que le falta para llegar a 15 (salir de las malas);
  // después, lo que le falta para ganar. Nunca vale más de 15.
  function faltaFor(target, scores) {
    const lead = Math.max(...scores);
    const goal = target > 15 && lead < 15 ? 15 : target;
    return Math.max(1, goal - lead);
  }

  // Una mano de truco para 2 (mano a mano) o 4 jugadores (parejas). Los asientos pares forman una
  // pareja y los impares la otra; en mano a mano cada jugador es su propia "pareja" (0 y 1).
  // Puntos, bazas y "quién tiene el quiero" van por pareja; las cartas y los turnos, por jugador.
  class TrucoHand {
    // `faltaPoints(parejaGanadora)` dice cuánto vale la falta envido. El resto de las opciones las usan
    // los bonuses: `cards` (manos ya armadas), `envidoBonus` (tanto extra por jugador), `pie` (qué pareja
    // gana la primera baza si es parda), `rankOf(carta, jugador)` y `flor` (quién juega con flor).
    constructor({ deck, mano, players = 2, faltaPoints = () => 15, cards = null, envidoBonus = null, pie = null, rankOf = null, flor = null }) {
      const n = players;
      this.n = n;
      this.mano = mano;
      if (cards) {
        this.cards = cards.map((c) => c.slice());
      } else {
        this.cards = Array.from({ length: n }, () => []);
        for (let i = 0; i < 3; i++) {
          for (let k = 0; k < n; k++) this.cards[(mano + k) % n].push(deck.pop());
        }
      }
      this.envidoBonus = envidoBonus || Array(n).fill(0);
      this.pie = pie;
      this.rankOf = rankOf || ((card) => rank(card));
      this.dealt = this.cards.map((c) => c.slice());
      this.table = Array.from({ length: n }, () => []); // cartas jugadas por cada uno, en orden
      this.bazas = []; // pareja que ganó cada baza (0, 1) o 'parda'
      this.bazaWinners = []; // jugador que ganó cada baza (para saber quién empieza la siguiente)
      this.leader = mano; // quién empieza la baza actual
      this.turn = mano;
      this.truco = { level: 0, owner: null }; // owner: pareja que puede subir la apuesta (la que dijo quiero)
      this.pending = null; // canto esperando respuesta
      this.envido = { done: false, chain: null, winner: null, points: 0, values: null, accepted: false };
      this.points = [0, 0]; // por pareja
      this.finished = false;
      this.winner = null;
      this.faltaPoints = faltaPoints;
      this.events = [];
      // Flor: tres cartas del mismo palo valen 3 puntos y anulan el envido.
      (flor || []).forEach((has, p) => {
        if (has && this.dealt[p].every((c) => c.s === this.dealt[p][0].s)) {
          const t = this.team(p);
          this.points[t] += 3;
          this.envido = { done: true, chain: null, winner: t, points: 3, values: null, accepted: false, flor: true };
          this.emit({ type: 'flor', who: p, winner: t, points: 3 });
        }
      });
    }

    team(p) {
      return p % 2;
    }

    next(p) {
      return (p + 1) % this.n;
    }

    envidoValueOf(p) {
      return envidoOf(this.dealt[p]) + (this.envidoBonus[p] || 0);
    }

    // Quién tiene que actuar: el que responde un canto (el primero de la otra pareja después del que
    // cantó; en parejas también puede responder su compañero) o al que le toca jugar.
    get actor() {
      if (!this.pending) return this.turn;
      return this.next(this.pending.caller);
    }

    // Puede responder un canto cualquiera de la pareja desafiada.
    canRespond(p) {
      return !!this.pending && this.team(p) !== this.team(this.pending.caller);
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
      if (this.finished) return [];
      const acts = [];
      const pend = this.pending;
      if (pend) {
        if (!this.canRespond(p)) return [];
        acts.push({ type: 'quiero' }, { type: 'noquiero' });
        if (pend.kind === 'envido') {
          const ch = pend.chain;
          const envidos = ch.filter((c) => c === 'envido').length;
          if (envidos < 2 && !ch.includes('real') && !ch.includes('falta')) acts.push({ type: 'envido' });
          if (!ch.includes('real') && !ch.includes('falta')) acts.push({ type: 'real' });
          if (!ch.includes('falta')) acts.push({ type: 'falta' });
          return acts;
        }
        if (pend.level < 3) acts.push({ type: 'truco' });
        // "El envido está primero": ante el truco todavía se puede cantar envido.
        if (pend.level === 1 && !this.envido.done && this.bazas.length === 0 && this.table[p].length === 0) {
          acts.push({ type: 'envido' }, { type: 'real' }, { type: 'falta' });
        }
        return acts;
      }
      if (p !== this.turn) return [];
      this.cards[p].forEach((_, i) => acts.push({ type: 'play', index: i }));
      if (this.truco.level < 3 && (this.truco.owner === null || this.truco.owner === this.team(p))) acts.push({ type: 'truco' });
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
          // Se va la pareja entera.
          this.emit({ type: 'mazo', who: p });
          return this.finish(1 - this.team(p), TRUCO_POINTS[this.truco.level]);
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
            this.truco.owner = this.team(p);
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
          return this.finish(this.team(pend.caller), TRUCO_POINTS[pend.level - 1]);
        }
        default: throw new Error('Acción desconocida');
      }
    }

    // Puntos del envido querido. Si no se quiere, el que cantó último se lleva lo que ya estaba
    // aceptado (cada canto acepta el anterior) más 1 por el canto rechazado:
    // envido no querido = 1, envido-envido no querido = 2 + 1, envido-envido-real no querido = 2 + 2 + 1.
    envidoChainPoints(chain, accepted, winner) {
      if (accepted) {
        if (chain.includes('falta')) return this.faltaPoints(winner);
        return chain.reduce((s, c) => s + ENVIDO_POINTS[c], 0);
      }
      return chain.slice(0, -1).reduce((s, c) => s + (ENVIDO_POINTS[c] || 0), 0) + 1;
    }

    // Tanto de cada pareja (el mejor de sus jugadores). Si empatan, gana el más cerca de la mano.
    envidoResult() {
      const values = [0, 1].map((t) => Math.max(...this.dealt.map((_, p) => p).filter((p) => this.team(p) === t).map((p) => this.envidoValueOf(p))));
      const best = Math.max(...values);
      let holder = null;
      for (let k = 0; k < this.n && holder === null; k++) {
        const p = (this.mano + k) % this.n;
        if (this.envidoValueOf(p) === best) holder = p;
      }
      return { values, winner: this.team(holder), holder };
    }

    resolveEnvido(accepted) {
      const { chain, caller } = this.pending;
      let winner = this.team(caller);
      let values = null;
      let holder = null;
      if (accepted) ({ values, winner, holder } = this.envidoResult());
      const points = this.envidoChainPoints(chain, accepted, winner);
      this.points[winner] += points;
      this.envido = { done: true, chain, winner, points, values, holder, accepted };
      this.emit({ type: 'envido', winner, points, values, holder, accepted });
    }

    play(p, index) {
      const card = this.cards[p].splice(index, 1)[0];
      this.table[p].push(card);
      this.emit({ type: 'play', who: p, card });
      const i = this.bazas.length;
      if (this.table.every((t) => t.length > i)) return this.resolveBaza(i);
      this.turn = this.next(p);
      return null;
    }

    // Gana la baza la carta más alta. Si empatan dos de la misma pareja, la baza es de esa pareja;
    // si empatan rivales, es parda.
    resolveBaza(i) {
      let best = -1;
      let tops = [];
      for (let k = 0; k < this.n; k++) {
        const p = (this.leader + k) % this.n;
        const r = this.rankOf(this.table[p][i], p);
        if (r > best) { best = r; tops = [p]; } else if (r === best) tops.push(p);
      }
      const teams = new Set(tops.map((p) => this.team(p)));
      let result = teams.size === 1 ? this.team(tops[0]) : 'parda';
      if (result === 'parda' && i === 0 && this.pie !== null) result = this.pie;
      const winnerPlayer = result === 'parda' ? null : tops.find((p) => this.team(p) === result) ?? tops[0];
      this.bazas.push(result);
      this.bazaWinners.push(winnerPlayer);
      this.emit({ type: 'baza', index: i, result, player: winnerPlayer });
      const w = handWinner(this.bazas, this.team(this.mano));
      if (w !== null) return this.finish(w, TRUCO_POINTS[this.truco.level]);
      this.leader = result === 'parda' ? this.mano : winnerPlayer;
      this.turn = this.leader;
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

  // Partida a `target` puntos, para 2 o 4 jugadores. La mano rota en cada ronda.
  class TrucoMatch {
    constructor({ target = 15, rng = Math.random, firstMano = 1, players = 2 } = {}) {
      this.target = target;
      this.rng = rng;
      this.players = players;
      this.scores = [0, 0];
      this.mano = firstMano;
      this.handNumber = 0;
      this.hand = null;
      this.over = false;
      this.winner = null;
    }

    newHand() {
      if (this.over) throw new Error('La partida terminó');
      if (this.hand) this.mano = (this.mano + 1) % this.players;
      this.handNumber++;
      this.hand = new TrucoHand({
        deck: buildDeck(this.rng),
        mano: this.mano,
        players: this.players,
        faltaPoints: () => faltaFor(this.target, this.scores),
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
        // Si las dos parejas llegan en la misma mano, gana la que se llevó más puntos en ella.
        this.winner = this.scores[0] >= this.target && (this.scores[1] < this.target || h.points[0] >= h.points[1]) ? 0 : 1;
      }
    }
  }

  // Frases rápidas para cargar al rival en el juego online (sin chat libre).
  const PHRASES = [
    '¡Te voy a cantar vale cuatro!',
    'Esa no te la creo',
    'Andá a lavar los platos',
    '¡Mirá que tengo!',
    'Jugá, che, que se enfría el mate',
    'Buena mano, buena mano',
    'Me agarraste dormido',
    '¡Qué suerte la tuya!',
    '¡Aura sí!',
    'Uh, me la hiciste',
  ];

  const Truco = {
    SUITS, NUMBERS, TRUCO_NAMES, ENVIDO_NAMES, PHRASES, faltaFor,
    buildDeck, rank, envidoOf, handWinner, TrucoHand, TrucoMatch,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Truco;
  else root.Truco = Truco;
})(typeof window !== 'undefined' ? window : globalThis);
