// Lógica del juego: sin DOM, para poder testearla con Node.
(function (root) {
  const Cards = root.Cards || (typeof require !== 'undefined' && require('./cards.js'));
  const Bonuses = root.Bonuses || (typeof require !== 'undefined' && require('./bonuses.js'));
  const Decks = root.Decks || (typeof require !== 'undefined' && require('./decks.js'));

  const HANDS_PER_CYCLE = 15;
  const SHOP_EVERY = 5;
  const MAX_BONUSES = 5;
  const START_MONEY = 100;
  const RESHUFFLE_AT = 15;

  function roundTo5(n) {
    return Math.round(n / 5) * 5;
  }

  class Game {
    // `startingPick: false` saltea la elección del bonus inicial (útil en tests).
    constructor({ rng = Math.random, startingPick = true } = {}) {
      this.rng = rng;
      this.startingPick = startingPick;
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
      this.phase = 'betting'; // betting | playing | roundOver | shop | deckLost | gameover
      this.deckIndex = 0; // posición en Decks.DECK_SEQUENCE (cuántos mazos perdiste)
      this.deckType = Decks.DECK_SEQUENCE[0];
      this.maxCleared = 0;
      this.deckLostReason = null;
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
      if (this.startingPick) this.openStartingPick();
    }

    // Al empezar la partida elegís 1 bonus gratis entre 3.
    openStartingPick() {
      this.phase = 'shop';
      this.shop = { offers: Bonuses.rollShop([], 3, this.rng), free: true, deckOffer: null };
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

    get deckInfo() {
      return Decks.DECKS[this.deckType];
    }

    get luck() {
      return this.deckInfo.luck;
    }

    // Mazos que te quedan, contando el actual.
    get decksLeft() {
      return Decks.DECK_SEQUENCE.length - this.deckIndex;
    }

    // --- Mazo ---
    newDeck() {
      this.deck = Cards.buildDeck(2, this.has('iman') ? 6 : 0, this.rng);
      this.topFixed = false;
    }

    // Saca una carta. Las del jugador pasan por la suerte del mazo.
    draw(who = 'dealer') {
      if (this.deck.length === 0) this.newDeck();
      if (this.topFixed || who !== 'player') {
        this.topFixed = false;
        return this.deck.pop();
      }
      const i = Decks.pickIndex(this.deck, this.player, this.luck, this.bustLimit, this.rng);
      return this.deck.splice(i, 1)[0];
    }

    // Rayos X: decide la próxima carta (como si fuera para el jugador) y la deja fija arriba.
    peekNext() {
      if (this.deck.length === 0) this.newDeck();
      if (!this.topFixed) {
        const i = Decks.pickIndex(this.deck, this.player, this.luck, this.bustLimit, this.rng);
        this.deck.push(this.deck.splice(i, 1)[0]);
        this.topFixed = true;
      }
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
    // Tiene en cuenta la suerte del mazo: las cartas buenas nunca te pasan.
    bustChance() {
      if (this.deck.length === 0) return 0;
      const busts = (c) => Cards.handValue([...this.player, c], this.bustLimit).total > this.bustLimit;
      if (this.topFixed) return busts(this.deck[this.deck.length - 1]) ? 1 : 0;
      const good = this.deck.filter((c) => Decks.isGoodDraw(this.player, c, this.bustLimit)).length;
      const bad = this.deck.length - good;
      const bustCount = this.deck.filter(busts).length;
      if (this.luck === 1 || good === 0 || bad === 0) return bustCount / this.deck.length;
      const pGood = Math.min(1, (this.luck * good) / this.deck.length);
      return (1 - pGood) * (bustCount / bad);
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
      this.bet = amount;
      this.lastBet = amount;
      this.money -= amount;
      this.doubled = false;
      this.discardUsed = false;
      this.result = null;
      this.player = [];
      this.player.push(this.draw('player'));
      this.dealer = [this.draw()];
      this.player.push(this.draw('player'));
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
      this.player.push(this.draw('player'));
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
      this.player.push(this.draw('player'));
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
      if (this.money < this.minBet) return this.loseDeck('Te quedaste sin dinero para la apuesta mínima.');
      // A mitad de ciclo también hay tienda, pero sin chequear la cuota.
      if (this.handInCycle % SHOP_EVERY === 0) {
        this.addLog('🛒 ¡Tienda de mitad de ciclo!');
        this.openShop(true);
        return this.phase;
      }
      return this.startNextHand();
    }

    startNextHand() {
      this.handInCycle++;
      this.reshuffleIfLow();
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
        return this.loseDeck(`No llegaste a la cuota de $${this.quota} del ciclo ${this.cycle}.`);
      }
      this.maxCleared = Math.max(this.maxCleared, this.cycle);
      this.addLog(`✅ Ciclo ${this.cycle} superado. ¡A la tienda!`);
      this.openShop();
      return this.phase;
    }

    reshuffleIfLow() {
      if (this.deck.length < RESHUFFLE_AT) {
        this.newDeck();
        this.addLog('🔀 Se rebarajó el mazo.');
      }
    }

    // Perder con un mazo te pasa al siguiente (peor); perder con el último es game over.
    loseDeck(reason) {
      const lost = this.deckInfo;
      if (this.deckIndex >= Decks.DECK_SEQUENCE.length - 1) {
        return this.gameOver(`${reason} Perdiste tu último mazo.`);
      }
      this.deckIndex++;
      this.deckType = Decks.DECK_SEQUENCE[this.deckIndex];
      this.deckLostReason = reason;
      this.phase = 'deckLost';
      this.addLog(`🃏 Perdiste el ${lost.name}. Pasás al ${this.deckInfo.name}.`);
      return this.phase;
    }

    // Arranca de nuevo desde el ciclo 1 con $100 y el mazo nuevo. Los bonuses se conservan.
    continueWithNextDeck() {
      if (this.phase !== 'deckLost') throw new Error('No perdiste un mazo');
      this.money = START_MONEY;
      this.cycle = 1;
      this.handInCycle = 1;
      this.streak = 0;
      this.shieldUsed = false;
      this.player = [];
      this.dealer = [];
      this.result = null;
      this.lastBet = this.minBet;
      this.newDeck();
      this.phase = 'betting';
      return this.phase;
    }

    gameOver(reason) {
      this.phase = 'gameover';
      this.gameOverReason = reason;
      this.addLog(`💀 ${reason}`);
      return this.phase;
    }

    // --- Tienda ---
    openShop(midCycle = false) {
      this.phase = 'shop';
      this.shop = { offers: Bonuses.rollShop(this.bonuses, 3, this.rng), rerollCost: 5, midCycle };
      this.rollDeckOffer();
    }

    // Hay un 5% de chances de que la tienda ofrezca un mazo mejor.
    rollDeckOffer() {
      const offer = this.deckType !== 'dorado' && this.rng() < Decks.BETTER_DECK_CHANCE;
      this.shop.deckOffer = offer ? Decks.DECKS.dorado : null;
    }

    deckPrice() {
      return Decks.deckPrice(this.cycle);
    }

    canBuyDeck() {
      return this.phase === 'shop' && !this.shop.free && !!this.shop.deckOffer && this.money >= this.deckPrice();
    }

    buyDeck() {
      if (!this.canBuyDeck()) throw new Error('No podés comprar ese mazo');
      this.money -= this.deckPrice();
      this.deckType = this.shop.deckOffer.id;
      this.shop.deckOffer = null;
      this.addLog(`✨ Compraste el ${this.deckInfo.name}.`);
    }

    priceOf(bonus) {
      if (this.shop && this.shop.free) return 0;
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
      if (this.shop.free) {
        this.addLog(`🎁 Elegiste ${bonus.icon} ${bonus.name} como bonus inicial.`);
        this.leaveShop();
        return;
      }
      this.addLog(`🛒 Compraste ${bonus.icon} ${bonus.name}.`);
    }

    sellValue(bonusId) {
      return Math.floor(Bonuses.priceOf(Bonuses.getBonus(bonusId), this.cycle) / 2);
    }

    sell(bonusId) {
      if (this.phase !== 'shop' || this.shop.free || !this.has(bonusId)) throw new Error('No podés vender eso');
      const value = this.sellValue(bonusId);
      this.money += value;
      this.bonuses = this.bonuses.filter((id) => id !== bonusId);
      this.addLog(`💸 Vendiste ${Bonuses.getBonus(bonusId).name} por $${value}.`);
    }

    reroll() {
      if (this.phase !== 'shop' || this.shop.free || this.money < this.shop.rerollCost) throw new Error('No te alcanza');
      this.money -= this.shop.rerollCost;
      this.shop.offers = Bonuses.rollShop(this.bonuses, 3, this.rng);
      this.rollDeckOffer();
      this.shop.rerollCost += 3;
    }

    leaveShop() {
      if (this.phase !== 'shop') throw new Error('No estás en la tienda');
      const { midCycle, free } = this.shop;
      this.shop = null;
      if (free) {
        this.phase = 'betting';
        return this.phase;
      }
      if (midCycle) {
        if (this.money < this.minBet) return this.loseDeck('Te quedaste sin dinero para la apuesta mínima.');
        return this.startNextHand();
      }
      this.cycle++;
      this.handInCycle = 1;
      this.shieldUsed = false;
      this.newDeck();
      if (this.money < this.minBet) return this.loseDeck('Te quedaste sin dinero para la apuesta mínima.');
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

  const GameModule = { Game, HANDS_PER_CYCLE, SHOP_EVERY, MAX_BONUSES, START_MONEY, OUTCOME_TEXT, formatNet };
  if (typeof module !== 'undefined' && module.exports) module.exports = GameModule;
  else root.GameModule = GameModule;
})(typeof window !== 'undefined' ? window : globalThis);
