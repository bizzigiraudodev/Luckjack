// Truco roguelike: la misma progresión que el blackjack (ciclos, cuotas, tienda, mazos, mejoras),
// pero cada ronda es una mano de truco contra el Viejo.
(function (root) {
  const { Game } = root.GameModule || (typeof require !== 'undefined' && require('./game.js'));
  const Truco = root.Truco || (typeof require !== 'undefined' && require('./truco.js'));
  const TrucoAI = root.TrucoAI || (typeof require !== 'undefined' && require('./truco-ai.js'));
  const TrucoBonuses = root.TrucoBonuses || (typeof require !== 'undefined' && require('./truco-bonuses.js'));

  const FALTA = 5; // acá no hay partida a 15 (cada mano se cobra aparte): la falta envido vale 5 puntos
  const FALTA_SEGURA = 0; // con Falta Segura, la falta que perdés no te cuesta nada

  // Cartas que cuentan como "buenas" para la suerte del mazo: anchos bravos, sietes bravos, treses y doses.
  const isGood = (c) => Truco.rank(c) >= 9;

  // Historia del truco: en su retiro en la pampa, el timbero se juega la vida contra cinco
  // personajes del campo, uno por noche (en el infinito siempre es el Viejo).
  const TRUCO_STORY = ['luzmala', 'lobison', 'futre', 'familiar', 'gil'];
  const RIVAL_NAMES = {
    gaucho: 'el Viejo', luzmala: 'la Luz Mala', lobison: 'el Lobisón', futre: 'el Futre',
    familiar: 'el Familiar', gil: 'el Gauchito Gil',
  };
  // El Gauchito Gil es justo: no miente ni se deja mentir (no valen el Chamuyero ni la Cara de Póker).
  const HONEST_IMMUNE = ['chamuyo', 'mentiroso'];
  const LUZ_MALA_LUCK = 0.05; // la Luz Mala te muestra una carta suya, pero te tira la suerte abajo
  const FULL_MOON_EVERY = 4; // el Lobisón: cada 4 manos hay luna llena y las manos perdidas cuestan x1.5
  const FULL_MOON_MULT = 1.5;
  // En la pampa se arranca con más plata: con muerte súbita, una mala racha no puede ser el final.
  const STORY_START = 200;
  const STORY_QUOTA_GROWTH = 1.15; // $230, $265, $305, $350, $400 (calibrado con simulaciones)
  const FAMILIAR_EVERY = 5; // el Familiar: cada 5 manos se come el 15% de tus fichas
  const FAMILIAR_BITE = 0.15;

  class TrucoRun extends Game {
    // `lives`: en la historia, 'sudden' (muerte súbita: perder una noche es perder la vida) o 'decks'
    // (3 mazos como en el resto de los modos: más fácil, pero sin Mazo Dorado ni rankings).
    constructor(opts = {}) {
      super({ ...opts, catalog: TrucoBonuses });
      this.lives = opts.lives === 'decks' ? 'decks' : 'sudden';
      if (this.mode === 'story') {
        this.money = STORY_START;
        this.cycleStartMoney = STORY_START;
        this.bestMoney = STORY_START;
      }
      this.mano = this.rng() < 0.5 ? 0 : 1;
      this.truco = null;
      this.trucoBet = 0;
    }

    get isTruco() {
      return true;
    }

    // El truco tiene más varianza que el blackjack (se cobra apuesta × puntos), así que las cuotas
    // crecen más rápido: $140, $195, $275... (calibrado con simulaciones contra el rival).
    quotaFor(cycle) {
      if (this.mode === 'story') return Math.round((STORY_START * Math.pow(STORY_QUOTA_GROWTH, cycle)) / 5) * 5;
      return Math.round((100 * Math.pow(1.4, cycle)) / 5) * 5;
    }

    get bet() {
      return this.trucoBet;
    }

    // En el truco se cobra apuesta × puntos, así que la mesa tiene un tope más bajo: 3 veces la mínima.
    get tableMaxFactor() {
      return 3;
    }

    get rivalName() {
      return RIVAL_NAMES[this.boss] || RIVAL_NAMES.gaucho;
    }

    get storyBosses() {
      return TRUCO_STORY;
    }

    // En la pampa se juega la vida: con muerte súbita, perder un ciclo es perderla.
    get suddenDeath() {
      return this.lives === 'sudden';
    }

    // Solo la historia con muerte súbita da el Mazo Dorado y cuenta para los rankings.
    get countsForRecords() {
      return this.mode !== 'story' || this.lives === 'sudden';
    }

    // Con 3 mazos, al perder el último te lleva el rival de esa noche.
    storyEnding() {
      return this.boss;
    }

    get victoryLog() {
      return '🌄 ¡Sobreviviste a las cinco noches! El Gauchito Gil te da su bendición.';
    }

    active(id) {
      return this.has(id) && !(this.boss === 'gil' && HONEST_IMMUNE.includes(id));
    }

    get luck() {
      return super.luck - (this.boss === 'luzmala' ? LUZ_MALA_LUCK : 0);
    }

    // La Luz Mala ilumina una carta del rival (como el bonus Ojo de Halcón).
    get revealsRivalCard() {
      return this.has('ojo') || this.boss === 'luzmala';
    }

    // Luna llena con el Lobisón: la mano en juego es de luna llena (las pérdidas cuestan x1.5).
    get fullMoon() {
      return this.boss === 'lobison' && this.handInCycle % FULL_MOON_EVERY === 0;
    }

    // Personalidad del rival, ajustada por tus bonuses.
    get persona() {
      const base = TrucoAI.PERSONAS[this.boss] || TrucoAI.PERSONAS.gaucho;
      return {
        ...base,
        trucoNeed: this.active('chamuyo') ? 3 : 0,
        envidoNeed: this.active('mentiroso') ? 3 : 0,
      };
    }

    // Reparte con la suerte del mazo: la chance de una carta buena es la natural × la suerte.
    dealCards() {
      const deck = Truco.buildDeck(this.rng);
      const take = (i) => deck.splice(i, 1)[0];
      const mine = [];
      if (this.has('ancho') && this.rng() < 0.4) {
        mine.push(take(deck.findIndex((c) => c.n === 1 && c.s === 'espada')));
      }
      while (mine.length < 3) {
        const good = [];
        const bad = [];
        deck.forEach((c, i) => (isGood(c) ? good : bad).push(i));
        const pGood = Math.min(1, (this.luck * good.length) / deck.length);
        const pool = good.length && (this.rng() < pGood || !bad.length) ? good : bad;
        mine.push(take(pool[Math.floor(this.rng() * pool.length)]));
      }
      const rival = [deck.pop(), deck.pop(), deck.pop()];
      return [mine, rival];
    }

    deal(amount) {
      if (!this.canBet(amount)) throw new Error('Apuesta inválida');
      this.quotaBonus = this.isRoguelike && this.money >= this.quota;
      this.lastBet = amount;
      this.trucoBet = amount;
      this.result = null;
      // El Futre va siempre al galope: es mano en todas las manos.
      this.mano = this.boss === 'futre' ? 1 : 1 - this.mano;
      const sieteBravo = this.has('siete_bravo');
      this.truco = new Truco.TrucoHand({
        mano: this.mano,
        cards: this.dealCards(),
        faltaPoints: (winner) => (winner === 1 && this.has('falta_segura') ? FALTA_SEGURA : FALTA),
        envidoBonus: [this.has('envido_gordo') ? 2 : 0, 0],
        pie: this.has('pie') ? 0 : null,
        rankOf: (c, p) => (p === 0 && sieteBravo && c.n === 7 && (c.s === 'copa' || c.s === 'basto') ? 11 : Truco.rank(c)),
        flor: [this.has('flor'), false],
      });
      this.phase = 'playing';
      return this.truco;
    }

    // Cobra o paga según los puntos de la mano: apuesta × (tus puntos − los del rival).
    settleHand() {
      const h = this.truco;
      if (!h || !h.finished || this.phase !== 'playing') return this.result;
      const [mine, his] = h.points;
      const bet = this.trucoBet;
      const notes = [];
      let net = bet * (mine - his);

      const wentToMazo = h.events.some((e) => e.type === 'mazo' && e.who === 0);
      if (net < 0 && wentToMazo && this.has('retirada')) {
        net = 0;
        notes.push('🏳️ retirada sin costo');
      }
      if (net > 0) {
        if (this.has('doble_truco') && h.truco.level > 0 && h.winner === 0) { net *= 1.5; notes.push('✌️ x1.5'); }
        if (this.has('racha') && this.streak > 0) { net *= 1 + 0.2 * Math.min(this.streak, 5); notes.push(`🔥 racha x${this.streak}`); }
        if (this.upgrades.ganancia) net *= 1 + this.upgradeTotal('ganancia') / 100;
      }
      if (net < 0 && this.fullMoon) {
        net *= FULL_MOON_MULT;
        notes.push('🌕 luna llena: pagás x1.5');
      }
      if (net < 0) {
        if (this.has('escudo') && !this.shieldUsed) {
          this.shieldUsed = true;
          net = 0;
          notes.push('🛡️ el poncho te cubrió');
        } else if (this.upgrades.seguro) {
          net *= 1 - this.upgradeTotal('seguro') / 100;
        }
      }
      let flat = 0;
      if (this.has('porotos') && mine) { flat += 3 * mine; notes.push(`🫘 +$${3 * mine}`); }
      if (this.has('mate') && h.envido.winner === 0 && h.envido.points && !h.envido.flor) { flat += 5; notes.push('🧉 +$5'); }
      if (this.quotaBonus) { flat += 5; notes.push('🎯 +$5 por cuota cumplida'); }

      const before = this.money;
      this.money = Math.max(0, this.money + Math.round(net) + flat);
      // El Familiar se come un pedazo de tus fichas cada 5 manos.
      if (this.boss === 'familiar' && this.handInCycle % FAMILIAR_EVERY === 0 && this.money > 0) {
        const bite = Math.ceil(this.money * FAMILIAR_BITE);
        this.money -= bite;
        notes.push(`🐕 el Familiar se comió $${bite}`);
      }
      const change = this.money - before;
      const outcome = mine > his ? 'win' : mine < his ? 'lose' : 'push';
      this.streak = outcome === 'win' ? this.streak + 1 : outcome === 'lose' ? 0 : this.streak;
      this.bestMoney = Math.max(this.bestMoney, this.money);
      this.handsPlayed++;
      this.phase = 'roundOver';
      const sign = change >= 0 ? `+$${change}` : `-$${-change}`;
      const summary = `Puntos: vos ${mine} – ${his} ${this.rivalName} · ${sign}${notes.length ? ` (${notes.join(', ')})` : ''}`;
      this.result = { outcome, bet, net: change, points: [mine, his], notes, summary, hands: [{ outcome }] };
      this.addLog(`${outcome === 'win' ? '✅' : outcome === 'lose' ? '❌' : '➖'} ${summary}`);
      return this.result;
    }

    nextHand() {
      this.truco = null;
      this.trucoBet = 0;
      return super.nextHand();
    }
  }

  const TrucoRunModule = { TrucoRun, FALTA, FALTA_SEGURA, RIVAL_NAMES, TRUCO_STORY, HONEST_IMMUNE, STORY_START };
  if (typeof module !== 'undefined' && module.exports) module.exports = TrucoRunModule;
  else root.TrucoRunModule = TrucoRunModule;
})(typeof window !== 'undefined' ? window : globalThis);
