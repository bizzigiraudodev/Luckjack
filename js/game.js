// Lógica del juego: sin DOM, para poder testearla con Node.
(function (root) {
  const Cards = root.Cards || (typeof require !== 'undefined' && require('./cards.js'));
  const Bonuses = root.Bonuses || (typeof require !== 'undefined' && require('./bonuses.js'));

  const HANDS_PER_CYCLE = 5;
  const MAX_BONUSES = 5;
  const START_MONEY = 100;
  const RESHUFFLE_AT = 15;

  function roundTo5(n) {
    return Math.round(n / 5) * 5;
  }

  class Game {
    constructor({ rng = Math.random } = {}) {
      this.rng = rng;
      this.reset();
    }

    reset() {
      this.money = START_MONEY;
      this.cycle = 1;
      this.handInCycle = 1;
      this.handsPlayed = 0;
      this.bonuses = [];
      this.streak = 0;
      this.shieldUsed = false;
      this.phase = 'betting'; // betting | playing | roundOver | shop | gameover
      this.player = [];
      this.dealer = [];
      this.bet = 0;
      this.lastBet = this.minBet;
      this.doubled = false;
      this.discardUsed = false;
      this.result = null;
      this.shop = null;
      this.log = [];
      this.newDeck();
    }

    // --- Parámetros que escalan con el ciclo ---
    minBetFor(cycle) {
      return 10 + 5 * (cycle - 1);
    }

    quotaFor(cycle) {
      return roundTo5(START_MONEY * Math.pow(1.25, cycle));
    }

    get minBet() {
      return this.minBetFor(this.cycle);
    }

    get quota() {
      return this.quotaFor(this.cycle);
    }

    get bustLimit() {
      return this.has('elastico') ? 22 : 21;
    }

    has(id) {
      return this.bonuses.includes(id);
    }

    // --- Mazo ---
    newDeck() {
      this.deck = Cards.buildDeck(2, this.has('iman') ? 6 : 0, this.rng);
    }

    draw() {
      if (this.deck.length === 0) this.newDeck();
      return this.deck.pop();
    }

    peekNext() {
      if (this.deck.length === 0) this.newDeck();
      return this.deck[this.deck.length - 1];
    }

    // --- Valores ---
    playerValue() {
      return Cards.handValue(this.player, this.bustLimit);
    }

    // Puntaje efectivo para comparar con el crupier (un 22 elástico vale 21).
    playerScore() {
      const { total } = this.playerValue();
      return total === 22 && this.has('elastico') ? 21 : total;
    }

    dealerValue() {
      return Cards.handValue(this.dealer);
    }

    playerBusted() {
      return this.playerValue().total > this.bustLimit;
    }

    // Probabilidad de pasarse si se pide otra carta (para el Contador de Cartas).
    bustChance() {
      if (this.deck.length === 0) return 0;
      let busts = 0;
      for (const c of this.deck) {
        const v = Cards.handValue([...this.player, c], this.bustLimit).total;
        if (v > this.bustLimit) busts++;
      }
      return busts / this.deck.length;
    }

    addLog(msg) {
      this.log.unshift(msg);
      if (this.log.length > 30) this.log.pop();
    }

    // --- Acciones del jugador ---
    canBet(amount) {
      return this.phase === 'betting' && Number.isInteger(amount) &&
        amount >= this.minBet && amount <= this.money;
    }

    deal(amount) {
      if (!this.canBet(amount)) throw new Error('Apuesta inválida');
      if (this.deck.length < RESHUFFLE_AT) {
        this.newDeck();
        this.addLog('🔀 Se rebarajó el mazo.');
      }
      this.bet = amount;
      this.lastBet = amount;
      this.money -= amount;
      this.doubled = false;
      this.discardUsed = false;
      this.result = null;
      this.player = [this.draw()];
      this.dealer = [this.draw()];
      this.player.push(this.draw());
      this.dealer.push(this.draw());
      this.phase = 'playing';

      const pBJ = Cards.isBlackjack(this.player);
      const dBJ = Cards.isBlackjack(this.dealer);
      if (pBJ || dBJ) return this.resolve();
      if (this.checkCharlie()) return this.result;
      return null;
    }

    canHit() {
      return this.phase === 'playing';
    }

    hit() {
      if (!this.canHit()) throw new Error('No podés pedir ahora');
      this.player.push(this.draw());
      if (this.playerBusted()) return this.resolve();
      if (this.checkCharlie()) return this.result;
      if (this.playerScore() === 21) return this.stand();
      return null;
    }

    stand() {
      if (this.phase !== 'playing') throw new Error('No podés plantarte ahora');
      this.playDealer();
      return this.resolve();
    }

    canDouble() {
      return this.phase === 'playing' && this.player.length === 2 && !this.doubled &&
        this.money >= this.bet;
    }

    double() {
      if (!this.canDouble()) throw new Error('No podés doblar ahora');
      this.money -= this.bet;
      this.bet *= 2;
      this.doubled = true;
      this.player.push(this.draw());
      if (this.playerBusted()) return this.resolve();
      return this.stand();
    }

    canDiscard() {
      return this.phase === 'playing' && this.has('segunda') && !this.discardUsed &&
        this.player.length > 2;
    }

    discard() {
      if (!this.canDiscard()) throw new Error('No podés descartar ahora');
      const card = this.player.pop();
      this.discardUsed = true;
      this.addLog(`♻️ Descartaste ${card.rank}${card.suit}.`);
      return null;
    }

    checkCharlie() {
      if (this.has('charlie') && this.player.length >= 5 && !this.playerBusted()) {
        this.resolve('charlie');
        return true;
      }
      return false;
    }

    playDealer() {
      const standOn = this.has('nervioso') ? 18 : 17;
      while (this.dealerValue().total < standOn) this.dealer.push(this.draw());
    }

    // --- Resolución de la mano ---
    outcome(forced) {
      if (forced) return forced;
      const pBJ = Cards.isBlackjack(this.player);
      const dBJ = Cards.isBlackjack(this.dealer);
      if (pBJ && dBJ) return 'push';
      if (pBJ) return 'blackjack';
      if (dBJ) return 'lose';
      if (this.playerBusted()) return 'bust';
      const d = this.dealerValue().total;
      if (d > 21) return 'dealerBust';
      const p = this.playerScore();
      if (p > d) return 'win';
      if (p < d) return 'lose';
      return 'push';
    }

    resolve(forced) {
      let outcome = this.outcome(forced);
      const bet = this.bet;
      const notes = [];
      let payout = 0; // dinero que vuelve al jugador (incluye la apuesta)

      if ((outcome === 'lose' || outcome === 'bust') && this.has('escudo') && !this.shieldUsed) {
        this.shieldUsed = true;
        notes.push('🛡️ El Escudo convirtió la derrota en empate');
        outcome = 'push';
      }

      const won = ['blackjack', 'win', 'dealerBust', 'charlie'].includes(outcome);

      if (outcome === 'blackjack') {
        const mult = this.has('dorado') ? 2 : 1.5;
        payout = bet + bet * mult;
      } else if (won) {
        let profit = bet;
        if (outcome === 'charlie') { profit *= 2; notes.push('🖐️ Charlie x2'); }
        if (outcome === 'dealerBust' && this.has('dados')) { profit *= 1.5; notes.push('🎲 x1.5'); }
        if (this.has('veintiuno') && this.playerScore() === 21) { profit *= 2; notes.push('🎯 x2'); }
        if (this.doubled && this.has('doble')) { profit *= 1.5; notes.push('⏫ x1.5'); }
        payout = bet + profit;
      } else if (outcome === 'push') {
        payout = bet;
        if (this.has('empate')) { payout += bet / 2; notes.push('🤝 +50%'); }
      } else if (outcome === 'bust' && this.has('red')) {
        payout = bet / 2;
        notes.push('🕸️ recuperás la mitad');
      }

      if (won && this.has('racha') && this.streak > 0) {
        const extra = (payout - bet) * 0.2 * this.streak;
        payout += extra;
        notes.push(`🔥 racha x${this.streak}`);
      }

      // Bonos fijos
      let flat = 0;
      if (won && this.has('herradura')) flat += 5;
      if (this.has('diezmo')) flat += 2 * this.player.filter(Cards.isFace).length;
      if (this.has('gemelos') && this.player[0].rank === this.player[1].rank) {
        flat += 15;
        notes.push('👯 +$15');
      }
      payout = Math.floor(payout) + flat;

      this.streak = won ? this.streak + 1 : (outcome === 'push' ? this.streak : 0);
      this.money += payout;
      this.handsPlayed++;
      this.phase = 'roundOver';
      this.result = { outcome, bet, payout, net: payout - bet, notes };
      this.addLog(`${OUTCOME_TEXT[outcome]} (${formatNet(payout - bet)})${notes.length ? ' · ' + notes.join(' · ') : ''}`);
      return this.result;
    }

    // Avanza a la siguiente mano; al cerrar un ciclo, chequea la cuota y abre la tienda.
    nextHand() {
      if (this.phase !== 'roundOver') throw new Error('La mano no terminó');
      this.player = [];
      this.dealer = [];
      this.bet = 0;

      if (this.handInCycle >= HANDS_PER_CYCLE) return this.endCycle();

      this.handInCycle++;
      if (this.money < this.minBet) return this.gameOver('Te quedaste sin dinero para la apuesta mínima.');
      this.phase = 'betting';
      return this.phase;
    }

    endCycle() {
      if (this.has('interes')) {
        const gain = Math.min(50, Math.floor(this.money * 0.1));
        this.money += gain;
        this.addLog(`🏦 Interés: +$${gain}`);
      }
      if (this.money < this.quota) {
        return this.gameOver(`No llegaste a la cuota de $${this.quota} del ciclo ${this.cycle}.`);
      }
      this.addLog(`✅ Ciclo ${this.cycle} superado. ¡A la tienda!`);
      this.openShop();
      return this.phase;
    }

    gameOver(reason) {
      this.phase = 'gameover';
      this.gameOverReason = reason;
      this.addLog(`💀 ${reason}`);
      return this.phase;
    }

    // --- Tienda ---
    openShop() {
      this.phase = 'shop';
      this.shop = { offers: Bonuses.rollShop(this.bonuses, 3, this.rng), rerollCost: 5 };
    }

    priceOf(bonus) {
      return Bonuses.priceOf(bonus, this.cycle);
    }

    canBuy(bonus) {
      return this.phase === 'shop' && this.shop.offers.includes(bonus) &&
        this.money >= this.priceOf(bonus) && this.bonuses.length < MAX_BONUSES;
    }

    buy(bonusId) {
      const bonus = this.shop && this.shop.offers.find((b) => b.id === bonusId);
      if (!bonus || !this.canBuy(bonus)) throw new Error('No podés comprar eso');
      this.money -= this.priceOf(bonus);
      this.bonuses.push(bonus.id);
      this.shop.offers = this.shop.offers.filter((b) => b !== bonus);
      this.addLog(`🛒 Compraste ${bonus.icon} ${bonus.name}.`);
    }

    sellValue(bonusId) {
      return Math.floor(this.priceOf(Bonuses.getBonus(bonusId)) / 2);
    }

    sell(bonusId) {
      if (this.phase !== 'shop' || !this.has(bonusId)) throw new Error('No podés vender eso');
      const value = this.sellValue(bonusId);
      this.money += value;
      this.bonuses = this.bonuses.filter((id) => id !== bonusId);
      this.addLog(`💸 Vendiste ${Bonuses.getBonus(bonusId).name} por $${value}.`);
    }

    reroll() {
      if (this.phase !== 'shop' || this.money < this.shop.rerollCost) throw new Error('No te alcanza');
      this.money -= this.shop.rerollCost;
      this.shop.offers = Bonuses.rollShop(this.bonuses, 3, this.rng);
      this.shop.rerollCost += 3;
    }

    leaveShop() {
      if (this.phase !== 'shop') throw new Error('No estás en la tienda');
      this.shop = null;
      this.cycle++;
      this.handInCycle = 1;
      this.shieldUsed = false;
      this.newDeck();
      if (this.money < this.minBet) return this.gameOver('Te quedaste sin dinero para la apuesta mínima.');
      this.phase = 'betting';
      this.lastBet = Math.min(Math.max(this.lastBet, this.minBet), this.money);
      return this.phase;
    }
  }

  const OUTCOME_TEXT = {
    blackjack: '🃏 ¡Blackjack!',
    win: '✅ Ganaste',
    dealerBust: '💥 El crupier se pasó',
    charlie: '🖐️ Charlie de Cinco',
    push: '➖ Empate',
    lose: '❌ Perdiste',
    bust: '💥 Te pasaste',
  };

  function formatNet(n) {
    return n >= 0 ? `+$${n}` : `-$${-n}`;
  }

  const GameModule = { Game, HANDS_PER_CYCLE, MAX_BONUSES, START_MONEY, OUTCOME_TEXT, formatNet };
  if (typeof module !== 'undefined' && module.exports) module.exports = GameModule;
  else root.GameModule = GameModule;
})(typeof window !== 'undefined' ? window : globalThis);
