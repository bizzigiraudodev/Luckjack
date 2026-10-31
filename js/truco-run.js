// Truco roguelike: la misma progresión que el blackjack (ciclos, cuotas, tienda, mazos, mejoras),
// pero cada ronda es una mano de truco contra el Viejo.
(function (root) {
  const { Game } = root.GameModule || (typeof require !== 'undefined' && require('./game.js'));
  const Truco = root.Truco || (typeof require !== 'undefined' && require('./truco.js'));
  const TrucoAI = root.TrucoAI || (typeof require !== 'undefined' && require('./truco-ai.js'));
  const TrucoBonuses = root.TrucoBonuses || (typeof require !== 'undefined' && require('./truco-bonuses.js'));

  const FALTA = 5; // en el roguelike no hay partida a 15: la falta envido vale 5 puntos
  const FALTA_GENEROSA = 8;

  // Cartas que cuentan como "buenas" para la suerte del mazo: anchos bravos, sietes bravos, treses y doses.
  const isGood = (c) => Truco.rank(c) >= 9;

  class TrucoRun extends Game {
    constructor(opts = {}) {
      super({ ...opts, catalog: TrucoBonuses });
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
      return Math.round((100 * Math.pow(1.4, cycle)) / 5) * 5;
    }

    get bet() {
      return this.trucoBet;
    }

    // Personalidad del rival, ajustada por tus bonuses.
    get persona() {
      const base = TrucoAI.PERSONAS[this.boss] || TrucoAI.PERSONAS.gaucho;
      return {
        ...base,
        trucoNeed: this.has('chamuyo') ? 3 : 0,
        envidoNeed: this.has('mentiroso') ? 3 : 0,
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
      this.mano = 1 - this.mano;
      const sieteBravo = this.has('siete_bravo');
      this.truco = new Truco.TrucoHand({
        mano: this.mano,
        cards: this.dealCards(),
        faltaPoints: () => (this.has('falta_tuya') ? FALTA_GENEROSA : FALTA),
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
        if (this.has('racha') && this.streak > 0) { net *= 1 + 0.2 * this.streak; notes.push(`🔥 racha x${this.streak}`); }
        if (this.upgrades.ganancia) net *= 1 + this.upgradeTotal('ganancia') / 100;
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
      const change = this.money - before;
      const outcome = mine > his ? 'win' : mine < his ? 'lose' : 'push';
      this.streak = outcome === 'win' ? this.streak + 1 : outcome === 'lose' ? 0 : this.streak;
      this.bestMoney = Math.max(this.bestMoney, this.money);
      this.handsPlayed++;
      this.phase = 'roundOver';
      const sign = change >= 0 ? `+$${change}` : `-$${-change}`;
      const summary = `Puntos: vos ${mine} – ${his} el Viejo · ${sign}`;
      this.result = { outcome, bet, net: change, points: [mine, his], notes, summary, hands: [{ outcome }] };
      this.addLog(`${outcome === 'win' ? '✅' : outcome === 'lose' ? '❌' : '➖'} ${summary}${notes.length ? ' · ' + notes.join(' · ') : ''}`);
      return this.result;
    }

    nextHand() {
      this.truco = null;
      this.trucoBet = 0;
      return super.nextHand();
    }
  }

  const TrucoRunModule = { TrucoRun, FALTA, FALTA_GENEROSA };
  if (typeof module !== 'undefined' && module.exports) module.exports = TrucoRunModule;
  else root.TrucoRunModule = TrucoRunModule;
})(typeof window !== 'undefined' ? window : globalThis);
