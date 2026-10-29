// Lógica del juego: sin DOM, para poder testearla con Node.
(function (root) {
  const Cards = root.Cards || (typeof require !== 'undefined' && require('./cards.js'));
  const Bonuses = root.Bonuses || (typeof require !== 'undefined' && require('./bonuses.js'));
  const Decks = root.Decks || (typeof require !== 'undefined' && require('./decks.js'));
  const Upgrades = root.Upgrades || (typeof require !== 'undefined' && require('./upgrades.js'));

  const HANDS_PER_CYCLE = 15;
  const SHOP_EVERY = 5;
  const MAX_BONUSES = 5;
  const MAX_HANDS = 4; // se puede volver a dividir hasta tener 4 manos
  const START_MONEY = 100;
  const RESHUFFLE_AT = 15;
  const QUOTA_FACTOR = 0.9; // cuotas 10% más bajas que la curva base

  function roundTo5(n) {
    return Math.round(n / 5) * 5;
  }

  // Modos: 'infinite' (roguelike sin fin), 'story' (3 ciclos contra 3 jefes) y 'classic' (blackjack común).
  const STORY_BOSSES = ['gaucho', 'diablo', 'santo'];
  const CLASSIC_MIN_BET = 10;
  const QUOTA_BONUS = 5; // por cada ronda jugada con la cuota ya cumplida
  const DEVIL_PUSH_CUT = 0.25; // parte de la apuesta que se lleva el Diablo en cada empate

  class Game {
    // `startingPick: false` saltea la elección del bonus inicial (útil en tests).
    // `startDeck` reemplaza al primer mazo (el Mazo Dorado se desbloquea al pasar la historia).
    constructor({ rng = Math.random, startingPick = true, mode = 'infinite', startDeck = null } = {}) {
      this.rng = rng;
      this.mode = mode;
      this.startingPick = startingPick && mode !== 'classic';
      this.startDeck = startDeck;
      this.reset();
    }

    get isRoguelike() {
      return this.mode !== 'classic';
    }

    // Quién reparte: el crupier en el clásico, el gaucho en el infinito y un jefe por ciclo en la historia.
    get boss() {
      if (this.mode === 'classic') return 'crupier';
      if (this.mode === 'story') return STORY_BOSSES[Math.min(this.cycle, STORY_BOSSES.length) - 1];
      return 'gaucho';
    }

    // Un bonus activo: en el ciclo de San Pedro el Crupier Nervioso no tiene efecto.
    active(id) {
      return this.has(id) && !(id === 'nervioso' && this.boss === 'santo');
    }

    reset() {
      this.money = START_MONEY;
      this.cycle = 1;
      this.handInCycle = 1;
      this.handsPlayed = 0;
      this.bonuses = [];
      this.upgrades = Object.fromEntries(Upgrades.UPGRADES.map((u) => [u.id, 0]));
      this.streak = 0;
      this.shieldUsed = false;
      this.phase = 'betting'; // betting | playing | roundOver | shop | deckLost | gameover
      this.deckIndex = 0; // posición en Decks.DECK_SEQUENCE (cuántos mazos perdiste)
      this.deckType = this.startDeck || Decks.DECK_SEQUENCE[0];
      this.maxCleared = 0;
      this.bestMoney = START_MONEY;
      this.cycleStartMoney = START_MONEY;
      this.advancedEarly = false;
      this.quotaBonus = false;
      this.pendingIntro = this.mode === 'story' ? 1 : null; // ciclo cuya presentación falta mostrar
      this.ending = null;
      this.deckLostReason = null;
      this.hands = [];
      this.handIndex = 0;
      this.dealer = [];
      this.lastBet = this.minBet;
      this.discardUsed = false;
      this.bustPending = false;
      this.dealtPair = false;
      this.result = null;
      this.shop = null;
      this.log = [];
      this.newDeck();
      if (this.startingPick) this.openStartingPick();
    }

    // Al empezar la partida elegís 1 bonus gratis entre 3.
    openStartingPick() {
      this.phase = 'shop';
      this.shop = { kind: 'start', offers: Bonuses.rollShop([], 3, this.rng), free: true, deckOffer: null, allowUpgrades: false };
    }

    // --- Parámetros que escalan con el ciclo ---
    minBetFor(cycle) {
      return 10 + 5 * (cycle - 1);
    }

    quotaFor(cycle) {
      return roundTo5(QUOTA_FACTOR * START_MONEY * Math.pow(1.25, cycle));
    }

    get minBet() {
      if (this.mode === 'classic') return CLASSIC_MIN_BET;
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

    // Suerte del mazo más la mejora de Suerte (en puntos porcentuales).
    get luck() {
      return this.deckInfo.luck + this.upgradeTotal('suerte') / 100;
    }

    // --- Mejoras (árbol de la tienda) ---
    upgradeTotal(id) {
      return Upgrades.totalAt(Upgrades.getUpgrade(id), this.upgrades[id]);
    }

    upgradeCost(id) {
      return Upgrades.costAt(this.upgrades[id]);
    }

    canUpgrade(id) {
      return this.phase === 'shop' && this.shop.allowUpgrades && this.upgrades[id] < Upgrades.MAX_LEVEL &&
        this.money >= this.upgradeCost(id);
    }

    upgrade(id) {
      if (!this.canUpgrade(id)) throw new Error('No podés mejorar eso');
      const u = Upgrades.getUpgrade(id);
      this.money -= this.upgradeCost(id);
      this.upgrades[id]++;
      this.addLog(`⬆️ ${u.icon} ${u.name} nivel ${this.upgrades[id]} (+${Upgrades.gainAt(u, this.upgrades[id])}%).`);
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
    draw(who = 'dealer', hand = this.player) {
      if (this.deck.length === 0) this.newDeck();
      if (this.topFixed || who !== 'player') {
        this.topFixed = false;
        return this.deck.pop();
      }
      const i = Decks.pickIndex(this.deck, hand, this.luck, this.bustLimit, this.rng);
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
    scoreOf(cards) {
      const { total } = Cards.handValue(cards, this.bustLimit);
      return total === 22 && this.has('elastico') ? 21 : total;
    }

    bustedCards(cards) {
      return Cards.handValue(cards, this.bustLimit).total > this.bustLimit;
    }

    playerScore() {
      return this.scoreOf(this.player);
    }

    dealerValue() {
      return Cards.handValue(this.dealer);
    }

    playerBusted() {
      return this.bustedCards(this.player);
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

    // --- Manos del jugador ---
    // Cada ronda tiene una o más manos (más de una si dividiste pares).
    get hand() {
      return this.hands[this.handIndex] || null;
    }

    // Cartas de la mano activa.
    get player() {
      return this.hand ? this.hand.cards : [];
    }

    // Apuesta total en la mesa (suma de todas las manos).
    get bet() {
      return this.hands.reduce((s, h) => s + h.bet, 0);
    }

    get doubled() {
      return !!this.hand && this.hand.doubled;
    }

    newHand(cards, bet, fromSplit = false) {
      return { cards, bet, doubled: false, done: false, forced: null, fromSplit };
    }

    // --- Acciones del jugador ---
    canBet(amount) {
      return this.phase === 'betting' && Number.isInteger(amount) &&
        amount >= this.minBet && amount <= this.money;
    }

    deal(amount) {
      if (!this.canBet(amount)) throw new Error('Apuesta inválida');
      // Cada ronda que arranca con la cuota ya cumplida suma $5, ganes o pierdas.
      this.quotaBonus = this.isRoguelike && this.money >= this.quota;
      this.lastBet = amount;
      this.money -= amount;
      this.discardUsed = false;
      this.bustPending = false;
      this.result = null;
      this.hands = [this.newHand([], amount)];
      this.handIndex = 0;
      this.player.push(this.draw('player'));
      this.dealer = [this.draw()];
      this.player.push(this.draw('player'));
      this.dealer.push(this.draw());
      this.dealtPair = this.player[0].rank === this.player[1].rank;
      this.phase = 'playing';

      if (Cards.isBlackjack(this.player) || Cards.isBlackjack(this.dealer)) return this.finishRound();
      return null;
    }

    canAct() {
      return this.phase === 'playing' && !this.bustPending;
    }

    canHit() {
      return this.canAct();
    }

    hit() {
      if (!this.canHit()) throw new Error('No podés pedir ahora');
      this.player.push(this.draw('player'));
      return this.afterDraw();
    }

    // Después de recibir una carta: pasarse, Charlie de Cinco o 21 cierran la mano.
    afterDraw() {
      if (this.playerBusted()) {
        // Con Segunda Oportunidad podés descartar la carta que te pasó y pedir otra.
        if (this.has('segunda') && !this.discardUsed) {
          this.bustPending = true;
          return null;
        }
        return this.finishHand();
      }
      if (this.has('charlie') && this.player.length >= 5) {
        this.hand.forced = 'charlie';
        return this.finishHand();
      }
      if (this.playerScore() === 21) return this.finishHand();
      return null;
    }

    // Plantarse (o aceptar haberse pasado cuando hay Segunda Oportunidad).
    stand() {
      if (this.phase !== 'playing') throw new Error('No podés plantarte ahora');
      this.bustPending = false;
      return this.finishHand();
    }

    canDouble() {
      return this.canAct() && this.player.length === 2 && !this.hand.doubled &&
        this.money >= this.hand.bet;
    }

    double() {
      if (!this.canDouble()) throw new Error('No podés doblar ahora');
      this.money -= this.hand.bet;
      this.hand.bet *= 2;
      this.hand.doubled = true;
      this.player.push(this.draw('player'));
      return this.finishHand();
    }

    canSplit() {
      return this.canAct() && this.player.length === 2 &&
        this.player[0].rank === this.player[1].rank &&
        this.hands.length < MAX_HANDS && this.money >= this.hand.bet;
    }

    // Divide el par en dos manos con la misma apuesta y reparte una carta a cada una.
    split() {
      if (!this.canSplit()) throw new Error('No podés dividir ahora');
      const hand = this.hand;
      this.money -= hand.bet;
      const second = this.newHand([hand.cards.pop()], hand.bet, true);
      hand.fromSplit = true;
      this.hands.splice(this.handIndex + 1, 0, second);
      hand.cards.push(this.draw('player', hand.cards));
      second.cards.push(this.draw('player', second.cards));
      this.addLog(`✂️ Dividiste un par de ${hand.cards[0].rank}.`);
      // Ases divididos: una sola carta para cada uno.
      if (hand.cards[0].rank === 'A') {
        second.done = true;
        return this.finishHand();
      }
      if (this.playerScore() === 21) return this.finishHand();
      return null;
    }

    canDiscard() {
      return this.phase === 'playing' && this.has('segunda') && !this.discardUsed &&
        (this.bustPending || this.player.length > 2);
    }

    // Segunda Oportunidad: descarta la última carta. Si te habías pasado, recibís una nueva.
    discard() {
      if (!this.canDiscard()) throw new Error('No podés descartar ahora');
      const card = this.player.pop();
      this.discardUsed = true;
      this.addLog(`♻️ Descartaste ${card.rank}${card.suit}.`);
      if (!this.bustPending) return null;
      this.bustPending = false;
      this.player.push(this.draw('player'));
      return this.afterDraw();
    }

    // Cierra la mano activa y pasa a la siguiente; si no quedan, juega el crupier.
    finishHand() {
      this.hand.done = true;
      while (this.hand && this.hand.done) this.handIndex++;
      if (this.hand) {
        if (this.playerScore() === 21) return this.finishHand();
        return null;
      }
      this.handIndex = this.hands.length - 1;
      return this.finishRound();
    }

    finishRound() {
      const dealerNeeded = !Cards.isBlackjack(this.dealer) && this.hands.some((h) =>
        !h.forced && !this.bustedCards(h.cards) && !this.isNatural(h));
      if (dealerNeeded) this.playDealer();
      return this.resolve();
    }

    playDealer() {
      const standOn = this.active('nervioso') ? 18 : 17;
      while (this.dealerValue().total < standOn) this.dealer.push(this.draw());
    }

    // --- Resolución de la ronda ---
    isNatural(hand) {
      return !hand.fromSplit && Cards.isBlackjack(hand.cards);
    }

    handOutcome(hand) {
      if (hand.forced) return hand.forced;
      const pBJ = this.isNatural(hand);
      const dBJ = Cards.isBlackjack(this.dealer);
      if (pBJ && dBJ) return 'push';
      if (pBJ) return 'blackjack';
      if (dBJ) return 'lose';
      if (this.bustedCards(hand.cards)) return 'bust';
      const d = this.dealerValue().total;
      if (d > 21) return 'dealerBust';
      const p = this.scoreOf(hand.cards);
      if (p > d) return 'win';
      if (p < d) return 'lose';
      return 'push';
    }

    // Paga una mano. Devuelve { outcome, bet, payout, net, notes }.
    resolveHand(hand) {
      let outcome = this.handOutcome(hand);
      const bet = hand.bet;
      const notes = [];
      let payout = 0; // dinero que vuelve al jugador (incluye la apuesta)

      if ((outcome === 'lose' || outcome === 'bust') && this.has('escudo') && !this.shieldUsed) {
        this.shieldUsed = true;
        notes.push('🛡️ El Escudo convirtió la derrota en empate');
        outcome = 'push';
      }

      const won = ['blackjack', 'win', 'dealerBust', 'charlie'].includes(outcome);

      if (outcome === 'blackjack') {
        // Normal: ganás 1.5 veces lo apostado (x2.5 en total). Dorado: el doble (x3 en total).
        const mult = this.has('dorado') ? 2 : 1.5;
        if (this.has('dorado')) notes.push('🌟 x3');
        payout = bet + bet * mult;
      } else if (won) {
        let profit = bet;
        if (outcome === 'charlie') { profit *= 2; notes.push('🖐️ Charlie x2'); }
        if (outcome === 'dealerBust' && this.has('dados')) { profit *= 1.5; notes.push('🎲 x1.5'); }
        if (this.has('veintiuno') && this.scoreOf(hand.cards) === 21) { profit *= 2; notes.push('🎯 x2'); }
        if (hand.doubled && this.has('doble')) { profit *= 1.5; notes.push('⏫ x1.5'); }
        payout = bet + profit;
      } else if (outcome === 'push') {
        payout = bet;
        if (this.has('empate')) { payout += bet / 2; notes.push('🤝 +50%'); }
        // En cada empate el Diablo se queda con el 25% de lo apostado.
        if (this.boss === 'diablo') {
          payout -= bet * DEVIL_PUSH_CUT;
          notes.push(`😈 El Diablo se quedó con $${Math.ceil(bet * DEVIL_PUSH_CUT)}`);
        }
      } else if (outcome === 'bust' && this.has('red')) {
        payout = bet / 2;
        notes.push('🕸️ recuperás la mitad');
      }
      if ((outcome === 'lose' || outcome === 'bust') && this.upgrades.seguro) {
        payout += bet * this.upgradeTotal('seguro') / 100;
      }

      if (won && this.has('racha') && this.streak > 0) {
        payout += (payout - bet) * 0.2 * this.streak;
        notes.push(`🔥 racha x${this.streak}`);
      }
      if (won && this.upgrades.ganancia) payout += (payout - bet) * this.upgradeTotal('ganancia') / 100;
      if (won && this.has('herradura')) payout += 5;
      this.streak = won ? this.streak + 1 : (outcome === 'push' ? this.streak : 0);

      payout = Math.floor(payout);
      return { outcome, bet, payout, net: payout - bet, notes };
    }

    resolve() {
      const results = this.hands.map((h) => this.resolveHand(h));
      const notes = [];

      // Bonos fijos de la ronda
      let flat = 0;
      if (this.has('diezmo')) {
        flat += 2 * this.hands.reduce((n, h) => n + h.cards.filter(Cards.isFace).length, 0);
      }
      if (this.has('gemelos') && this.dealtPair) {
        flat += 15;
        notes.push('👯 +$15');
      }
      if (this.quotaBonus) {
        flat += QUOTA_BONUS;
        notes.push(`🎯 +$${QUOTA_BONUS} por cuota cumplida`);
      }

      const bet = results.reduce((s, r) => s + r.bet, 0);
      const payout = results.reduce((s, r) => s + r.payout, 0) + flat;
      this.money += payout;
      this.bestMoney = Math.max(this.bestMoney, this.money);
      this.handsPlayed++;
      this.phase = 'roundOver';
      const outcome = results.length === 1 ? results[0].outcome : 'split';
      this.result = { outcome, bet, payout, net: payout - bet, notes: [...results.flatMap((r) => r.notes), ...notes], hands: results };

      if (results.length === 1) {
        const n = this.result.notes;
        this.addLog(`${OUTCOME_TEXT[outcome]} (${formatNet(this.result.net)})${n.length ? ' · ' + n.join(' · ') : ''}`);
      } else {
        const parts = results.map((r, i) => `M${i + 1}: ${OUTCOME_TEXT[r.outcome]}`);
        this.addLog(`✂️ ${parts.join(' | ')} (${formatNet(this.result.net)})${notes.length ? ' · ' + notes.join(' · ') : ''}`);
      }
      return this.result;
    }

    // Avanza a la siguiente mano; al cerrar un ciclo, chequea la cuota y abre la tienda.
    nextHand() {
      if (this.phase !== 'roundOver') throw new Error('La mano no terminó');
      this.hands = [];
      this.handIndex = 0;
      this.dealer = [];

      if (this.mode === 'classic') {
        if (this.money < this.minBet) return this.gameOver('Te fundiste: no te alcanza para la apuesta mínima.');
        return this.startNextHand();
      }
      if (this.handInCycle >= HANDS_PER_CYCLE) return this.endCycle();
      if (this.money < this.minBet) return this.loseDeck('Te quedaste sin dinero para la apuesta mínima.');
      // A mitad de ciclo también hay tienda, pero sin chequear la cuota.
      if (this.handInCycle % SHOP_EVERY === 0) {
        this.addLog('🛒 ¡Tienda de mitad de ciclo!');
        this.openShop('mid');
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

    // Con la cuota cumplida podés pasar de ciclo sin jugar las manos que faltan.
    canAdvance() {
      return this.phase === 'betting' && this.isRoguelike && this.money >= this.quota;
    }

    advanceCycle() {
      if (!this.canAdvance()) throw new Error('Todavía no cumpliste la cuota');
      this.advancedEarly = true;
      this.addLog(`⏩ Pasaste de ciclo en la mano ${this.handInCycle}.`);
      return this.endCycle();
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
      if (this.mode === 'story' && this.cycle >= STORY_BOSSES.length) {
        this.phase = 'victory';
        this.addLog('🌟 ¡Pagaste las tres cuotas! Las puertas del Edén se abren.');
        return this.phase;
      }
      this.addLog(`✅ Ciclo ${this.cycle} superado. ¡A la tienda!`);
      // En la historia, si jugaste el ciclo completo la tienda del final es gratis (solo comunes).
      this.openShop(this.mode === 'story' && !this.advancedEarly ? 'reward' : 'end');
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
        if (this.mode === 'story') this.ending = ['purgatorio', 'infierno', 'casi'][this.cycle - 1];
        return this.gameOver(`${reason} Perdiste tu último mazo.`);
      }
      this.deckIndex++;
      this.deckType = Decks.DECK_SEQUENCE[this.deckIndex];
      this.deckLostReason = reason;
      this.phase = 'deckLost';
      this.addLog(`🃏 Perdiste el ${lost.name}. Pasás al ${this.deckInfo.name}.`);
      return this.phase;
    }

    // Infinito: arranca de nuevo desde el ciclo 1 con $100. Historia: reintenta el mismo ciclo
    // con el dinero que tenías al empezarlo. Los bonuses y mejoras se conservan.
    continueWithNextDeck() {
      if (this.phase !== 'deckLost') throw new Error('No perdiste un mazo');
      if (this.mode === 'story') {
        this.money = this.cycleStartMoney;
      } else {
        this.money = START_MONEY;
        this.cycle = 1;
        this.cycleStartMoney = START_MONEY;
      }
      this.advancedEarly = false;
      this.handInCycle = 1;
      this.streak = 0;
      this.shieldUsed = false;
      this.hands = [];
      this.handIndex = 0;
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
    // Tipos de tienda: 'mid' (manos 5 y 10), 'end' (fin de ciclo, paga) y
    // 'reward' (fin de ciclo en la historia: 1 bonus común gratis entre 3).
    openShop(kind = 'end') {
      this.phase = 'shop';
      if (kind === 'reward') {
        this.shop = {
          kind, midCycle: false, free: true, deckOffer: null, allowUpgrades: true,
          offers: Bonuses.rollShop(this.bonuses, 3, this.rng, ['common']),
        };
        return;
      }
      // En la historia el árbol de mejoras solo aparece al final del ciclo.
      const allowUpgrades = kind === 'end' || this.mode !== 'story';
      this.shop = { kind, midCycle: kind === 'mid', free: false, allowUpgrades, offers: Bonuses.rollShop(this.bonuses, 3, this.rng), rerollCost: 5 };
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
      const base = Bonuses.priceOf(bonus, this.cycle);
      return Math.round(base * (1 - this.upgradeTotal('descuento') / 100));
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
      if (this.shop.kind === 'start') {
        this.addLog(`🎁 Elegiste ${bonus.icon} ${bonus.name} como bonus inicial.`);
        this.leaveShop();
        return;
      }
      if (this.shop.free) {
        // Un solo bonus gratis: las otras ofertas desaparecen.
        this.shop.offers = [];
        this.addLog(`🎁 Elegiste ${bonus.icon} ${bonus.name} gratis.`);
        return;
      }
      this.addLog(`🛒 Compraste ${bonus.icon} ${bonus.name}.`);
    }

    sellValue(bonusId) {
      return Math.floor(Bonuses.priceOf(Bonuses.getBonus(bonusId), this.cycle) / 2);
    }

    sell(bonusId) {
      if (this.phase !== 'shop' || this.shop.kind === 'start' || !this.has(bonusId)) throw new Error('No podés vender eso');
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
      const { midCycle, kind } = this.shop;
      this.shop = null;
      if (kind === 'start') {
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
      this.advancedEarly = false;
      this.cycleStartMoney = this.money;
      if (this.mode === 'story') this.pendingIntro = this.cycle;
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
    split: '✂️ Manos divididas',
    push: '➖ Empate',
    lose: '❌ Perdiste',
    bust: '💥 Te pasaste',
  };

  function formatNet(n) {
    return n >= 0 ? `+$${n}` : `-$${-n}`;
  }

  const GameModule = { Game, STORY_BOSSES, QUOTA_BONUS, HANDS_PER_CYCLE, SHOP_EVERY, MAX_BONUSES, START_MONEY, OUTCOME_TEXT, formatNet };
  if (typeof module !== 'undefined' && module.exports) module.exports = GameModule;
  else root.GameModule = GameModule;
})(typeof window !== 'undefined' ? window : globalThis);
