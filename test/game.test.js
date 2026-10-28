const test = require('node:test');
const assert = require('node:assert');
const Cards = require('../js/cards.js');
const Bonuses = require('../js/bonuses.js');
const Decks = require('../js/decks.js');
const { Game } = require('../js/game.js');

const c = (rank, suit = '♠') => ({ rank, suit });

// Prepara el mazo para que salgan las cartas en este orden.
// deal() reparte: jugador, crupier, jugador, crupier.
function stack(game, cards) {
  const filler = Array.from({ length: 30 }, () => c('2', '♣'));
  game.deck = [...filler, ...cards.slice().reverse()];
}

test('valor de manos con ases', () => {
  assert.strictEqual(Cards.handValue([c('A'), c('K')]).total, 21);
  assert.strictEqual(Cards.handValue([c('A'), c('A'), c('9')]).total, 21);
  assert.strictEqual(Cards.handValue([c('A'), c('5'), c('K')]).total, 16);
  assert.ok(Cards.isBlackjack([c('A'), c('Q')]));
  assert.ok(!Cards.isBlackjack([c('7'), c('7'), c('7')]));
});

test('ganar una mano paga 1:1', () => {
  const g = new Game({ startingPick: false });
  stack(g, [c('K'), c('9'), c('Q'), c('8')]);
  g.deal(10);
  const r = g.stand();
  assert.strictEqual(r.outcome, 'win');
  assert.strictEqual(g.money, 110);
});

test('blackjack paga 3:2 y Blackjack Dorado 2:1', () => {
  const g = new Game({ startingPick: false });
  stack(g, [c('A'), c('9'), c('K'), c('8')]);
  g.deal(10);
  assert.strictEqual(g.result.outcome, 'blackjack');
  assert.strictEqual(g.money, 115);

  const g2 = new Game({ startingPick: false });
  g2.bonuses.push('dorado');
  stack(g2, [c('A'), c('9'), c('K'), c('8')]);
  g2.deal(10);
  assert.strictEqual(g2.money, 120);
});

test('pasarse pierde la apuesta, Red de Seguridad devuelve la mitad', () => {
  const g = new Game({ startingPick: false });
  g.bonuses.push('red');
  stack(g, [c('K'), c('9'), c('6'), c('8'), c('Q')]);
  g.deal(10);
  const r = g.hit();
  assert.strictEqual(r.outcome, 'bust');
  assert.strictEqual(g.money, 95);
});

test('Escudo convierte la primera derrota del ciclo en empate', () => {
  const g = new Game({ startingPick: false });
  g.bonuses.push('escudo');
  stack(g, [c('K'), c('K'), c('7'), c('Q')]);
  g.deal(10);
  const r = g.stand();
  assert.strictEqual(r.outcome, 'push');
  assert.strictEqual(g.money, 100);
  assert.ok(g.shieldUsed);
});

test('Límite Elástico: 22 no se pasa y cuenta como 21', () => {
  const g = new Game({ startingPick: false });
  g.bonuses.push('elastico');
  stack(g, [c('K'), c('K'), c('5'), c('9'), c('7')]);
  g.deal(10);
  const r = g.hit(); // 22 → se planta solo
  assert.strictEqual(r.outcome, 'win');
  assert.strictEqual(g.playerScore(), 21);
});

test('doblar duplica la apuesta', () => {
  const g = new Game({ startingPick: false });
  stack(g, [c('5'), c('9'), c('6'), c('8'), c('K')]);
  g.deal(10);
  const r = g.double();
  assert.strictEqual(r.outcome, 'win');
  assert.strictEqual(g.money, 120);
});

test('Charlie de Cinco gana automáticamente x2', () => {
  const g = new Game({ startingPick: false });
  g.bonuses.push('charlie');
  stack(g, [c('2'), c('K'), c('2'), c('9'), c('2'), c('3'), c('2')]);
  g.deal(10);
  g.hit();
  g.hit();
  const r = g.hit();
  assert.strictEqual(r.outcome, 'charlie');
  assert.strictEqual(g.money, 120);
});

test('Segunda Oportunidad descarta la última carta', () => {
  const g = new Game({ startingPick: false });
  g.bonuses.push('segunda');
  stack(g, [c('K'), c('9'), c('5'), c('8'), c('2')]);
  g.deal(10);
  g.hit();
  assert.ok(g.canDiscard());
  g.discard();
  assert.strictEqual(g.player.length, 2);
  assert.ok(!g.canDiscard());
});

test('Segunda Oportunidad: si te pasás, descartás y recibís otra carta', () => {
  const g = new Game({ startingPick: false });
  g.bonuses.push('segunda');
  stack(g, [c('K'), c('9'), c('6'), c('8'), c('Q'), c('3')]);
  g.deal(10);
  g.hit(); // 26: se pasa
  assert.strictEqual(g.phase, 'playing', 'espera la decisión');
  assert.ok(g.bustPending);
  assert.ok(!g.canHit() && !g.canDouble());
  g.discard(); // sale la Q, entra el 3 → 19
  assert.strictEqual(g.playerValue().total, 19);
  assert.ok(!g.canDiscard());
  const r = g.stand();
  assert.strictEqual(r.outcome, 'win');
});

test('Segunda Oportunidad: aceptar haberse pasado pierde la mano', () => {
  const g = new Game({ startingPick: false });
  g.bonuses.push('segunda');
  stack(g, [c('K'), c('9'), c('6'), c('8'), c('Q')]);
  g.deal(10);
  g.hit();
  const r = g.stand();
  assert.strictEqual(r.outcome, 'bust');
  assert.strictEqual(g.money, 90);
});

test('dividir un par juega dos manos con la misma apuesta', () => {
  const g = new Game({ startingPick: false });
  // jugador K, K · crupier 9, 8 · nuevas: 9 (mano 1), 5 (mano 2), 7 (pide mano 2)
  stack(g, [c('K'), c('9'), c('K', '♥'), c('8'), c('9'), c('5'), c('7')]);
  g.deal(10);
  assert.ok(g.canSplit());
  g.split();
  assert.strictEqual(g.hands.length, 2);
  assert.strictEqual(g.bet, 20);
  assert.strictEqual(g.money, 80);
  g.stand(); // mano 1: 19
  assert.strictEqual(g.handIndex, 1);
  g.hit(); // mano 2: 15 + 7 = 22 → se pasa
  const r = g.result;
  assert.strictEqual(r.outcome, 'split');
  assert.deepStrictEqual(r.hands.map((h) => h.outcome), ['win', 'bust']);
  assert.strictEqual(g.money, 100);
});

test('21 en una mano dividida no es blackjack y los ases reciben una carta', () => {
  const g = new Game({ startingPick: false });
  stack(g, [c('A'), c('9'), c('A', '♥'), c('8'), c('K'), c('5')]);
  g.deal(10);
  g.split();
  assert.strictEqual(g.phase, 'roundOver', 'ases divididos se plantan solos');
  assert.deepStrictEqual(g.result.hands.map((h) => h.outcome), ['win', 'lose']);
  assert.strictEqual(g.result.hands[0].payout, 20, '21 dividido paga 1:1');
});

test('no se puede dividir sin par, sin dinero o con 4 manos', () => {
  const g = new Game({ startingPick: false });
  stack(g, [c('K'), c('9'), c('Q'), c('8')]);
  g.deal(10);
  assert.ok(!g.canSplit(), 'K y Q no son par');

  const g2 = new Game({ startingPick: false });
  stack(g2, [c('8'), c('9'), c('8', '♥'), c('7')]);
  g2.deal(100);
  assert.ok(!g2.canSplit(), 'no alcanza el dinero');

  const g3 = new Game({ startingPick: false });
  g3.money = 1000;
  stack(g3, [c('8'), c('9'), c('8', '♥'), c('7'), c('8', '♦'), c('8', '♣'), c('8'), c('8', '♥'), c('2'), c('3')]);
  g3.deal(10);
  g3.split(); // 8+8 | 8+8
  g3.split(); // 8+8 | 8+2 | 8+8 ... vuelve a dividir la primera
  g3.split();
  assert.strictEqual(g3.hands.length, 4);
  assert.ok(!g3.canSplit());
});

test('Blackjack Dorado cobra x3 lo apostado', () => {
  const g = new Game({ startingPick: false });
  g.bonuses.push('dorado');
  stack(g, [c('A'), c('9'), c('Q'), c('8')]);
  g.deal(10);
  assert.strictEqual(g.result.payout, 30);
  assert.strictEqual(g.result.net, 20);
});

// Juega `n` manos con las mismas cartas, pasando por la tienda de mitad de ciclo.
function playHands(g, n, cards) {
  for (let i = 0; i < n; i++) {
    stack(g, cards);
    g.deal(10);
    g.stand();
    g.nextHand();
    if (g.phase === 'shop' && g.shop.midCycle) g.leaveShop();
  }
}

function failCycle(g) {
  playHands(g, 15, [c('K'), c('K'), c('7'), c('7')]); // empata siempre: no llega a la cuota
}

test('no llegar a la cuota hace perder el mazo; perder el 3ro es game over', () => {
  const g = new Game({ startingPick: false });
  g.bonuses.push('herradura');
  failCycle(g);
  assert.strictEqual(g.phase, 'deckLost');
  assert.strictEqual(g.deckType, 'gastado');
  g.continueWithNextDeck();
  assert.strictEqual(g.money, 100);
  assert.strictEqual(g.cycle, 1);
  assert.ok(g.has('herradura'), 'los bonuses se conservan');

  failCycle(g);
  assert.strictEqual(g.deckType, 'maldito');
  g.continueWithNextDeck();

  failCycle(g);
  assert.strictEqual(g.phase, 'gameover');
});

test('quedarse sin dinero para la apuesta mínima hace perder el mazo', () => {
  const g = new Game({ startingPick: false });
  stack(g, [c('K'), c('K'), c('7'), c('8')]);
  g.deal(100);
  g.stand();
  g.nextHand();
  assert.strictEqual(g.phase, 'deckLost');
  assert.strictEqual(g.decksLeft, 2);
});

test('cada mazo cambia la chance de carta buena según su suerte', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const hand = [c('10'), c('2')]; // 12: buenas son 6..9 (y nada más)
  const rate = (luck) => {
    let good = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const deck = Cards.buildDeck(2, 0, rng);
      const card = deck[Decks.pickIndex(deck, hand, luck, 21, rng)];
      if (Decks.isGoodDraw(hand, card)) good++;
    }
    return good / N;
  };
  const base = rate(1);
  for (const id of ['gastado', 'maldito', 'dorado']) {
    const r = rate(Decks.DECKS[id].luck);
    assert.ok(Math.abs(r / base - Decks.DECKS[id].luck) < 0.04, `${id}: ${r} vs ${base}`);
  }
});

test('Rayos X coincide con la carta que efectivamente sale', () => {
  const g = new Game({ startingPick: false });
  g.deckType = 'maldito';
  g.deal(10);
  if (g.phase !== 'playing') return;
  const next = g.peekNext();
  g.hit();
  assert.strictEqual(g.player[2], next);
});

test('mazo dorado en la tienda: aparece ~5% y se puede comprar', () => {
  const g = new Game({ startingPick: false });
  g.money = 1000;
  let seen = 0;
  for (let i = 0; i < 4000; i++) {
    g.phase = 'roundOver';
    g.openShop();
    if (g.shop.deckOffer) seen++;
  }
  assert.ok(seen > 120 && seen < 280, `apareció ${seen} veces`);

  g.shop.deckOffer = Decks.DECKS.dorado;
  g.buyDeck();
  assert.strictEqual(g.deckType, 'dorado');
  assert.strictEqual(g.money, 1000 - Decks.deckPrice(1));
  g.openShop();
  assert.strictEqual(g.shop.deckOffer, null, 'no se ofrece si ya lo tenés');
});

test('la tienda aparece a las 5 manos sin chequear la cuota', () => {
  const g = new Game({ startingPick: false });
  for (let i = 0; i < 5; i++) {
    stack(g, [c('K'), c('K'), c('7'), c('8')]);
    g.deal(10);
    g.stand();
    g.nextHand();
  }
  assert.strictEqual(g.money, 50);
  assert.strictEqual(g.phase, 'shop');
  assert.ok(g.shop.midCycle);
  g.leaveShop();
  assert.strictEqual(g.cycle, 1);
  assert.strictEqual(g.handInCycle, 6);
  assert.strictEqual(g.phase, 'betting');
});

test('superar la cuota a las 15 manos abre la tienda y se puede comprar', () => {
  const g = new Game({ startingPick: false });
  playHands(g, 14, [c('K'), c('9'), c('Q'), c('8')]);
  stack(g, [c('K'), c('9'), c('Q'), c('8')]);
  g.deal(10);
  g.stand();
  g.nextHand();
  assert.strictEqual(g.money, 250);
  assert.strictEqual(g.phase, 'shop');
  assert.ok(!g.shop.midCycle);
  assert.strictEqual(g.shop.offers.length, 3);
  const offer = g.shop.offers[0];
  const price = g.priceOf(offer);
  g.buy(offer.id);
  assert.ok(g.has(offer.id));
  assert.strictEqual(g.money, 250 - price);
  g.sell(offer.id);
  assert.ok(!g.has(offer.id));
  g.leaveShop();
  assert.strictEqual(g.cycle, 2);
  assert.strictEqual(g.handInCycle, 1);
  assert.strictEqual(g.phase, 'betting');
  assert.strictEqual(g.minBet, 15);
});

test('la tienda no ofrece bonuses que ya tenés ni repetidos', () => {
  const owned = Bonuses.BONUSES.slice(0, 15).map((b) => b.id);
  for (let i = 0; i < 50; i++) {
    const offers = Bonuses.rollShop(owned, 3);
    assert.strictEqual(new Set(offers).size, offers.length);
    for (const o of offers) assert.ok(!owned.includes(o.id));
  }
});

test('al empezar se elige 1 bonus gratis entre 3', () => {
  const g = new Game();
  assert.strictEqual(g.phase, 'shop');
  assert.ok(g.shop.free);
  assert.strictEqual(g.shop.offers.length, 3);
  assert.strictEqual(g.shop.deckOffer, null);
  assert.throws(() => g.reroll());
  const pick = g.shop.offers[1];
  assert.strictEqual(g.priceOf(pick), 0);
  g.buy(pick.id);
  assert.deepStrictEqual(g.bonuses, [pick.id]);
  assert.strictEqual(g.money, 100);
  assert.strictEqual(g.phase, 'betting', 'elegir uno cierra la tienda');
  assert.strictEqual(g.handInCycle, 1);

  const skip = new Game();
  skip.leaveShop();
  assert.strictEqual(skip.phase, 'betting');
  assert.deepStrictEqual(skip.bonuses, []);

  g.phase = 'gameover';
  g.reset();
  assert.ok(g.shop.free, 'una partida nueva vuelve a ofrecer el bonus gratis');
});

test('mejoras: Suerte suma 0.15%, 0.25%, 0.35%... y cuesta $5, $7.5, $10...', () => {
  const Upgrades = require('../js/upgrades.js');
  const suerte = Upgrades.getUpgrade('suerte');
  assert.deepStrictEqual([1, 2, 3, 4].map((l) => Upgrades.gainAt(suerte, l)), [0.15, 0.25, 0.35, 0.45]);
  assert.deepStrictEqual([0, 1, 2, 3].map(Upgrades.costAt), [5, 7.5, 10, 12.5]);

  const g = new Game({ startingPick: false });
  g.money = 100;
  g.phase = 'roundOver';
  g.openShop(true);
  g.upgrade('suerte');
  g.upgrade('suerte');
  assert.strictEqual(g.money, 87.5);
  assert.strictEqual(g.upgradeTotal('suerte'), 0.4);
  assert.ok(Math.abs(g.luck - 1.004) < 1e-9);
  assert.strictEqual(g.upgradeCost('suerte'), 10);
});

test('mejoras: no se compran en la elección gratis ni pasando el nivel máximo', () => {
  const g = new Game();
  assert.ok(!g.canUpgrade('suerte'), 'no en el bonus inicial');
  g.leaveShop();
  g.money = 10000;
  g.phase = 'roundOver';
  g.openShop(true);
  for (let i = 0; i < 10; i++) g.upgrade('ganancia');
  assert.ok(!g.canUpgrade('ganancia'));
  assert.strictEqual(g.upgradeTotal('ganancia'), 32.5);
});

test('mejoras: Ganancia, Seguro y Descuento', () => {
  const g = new Game({ startingPick: false });
  g.upgrades.ganancia = 2; // +2.5%
  g.upgrades.seguro = 2; // 2.5%
  stack(g, [c('K'), c('9'), c('Q'), c('8')]);
  g.deal(100);
  g.money = 0;
  g.stand();
  assert.strictEqual(g.result.payout, 202, 'gana 100 + 2.5%');

  const g2 = new Game({ startingPick: false });
  g2.upgrades.seguro = 2;
  stack(g2, [c('K'), c('K'), c('7'), c('8')]);
  g2.deal(100);
  g2.stand();
  assert.strictEqual(g2.result.payout, 2, 'recupera 2.5% de la apuesta (redondeado)');

  const g3 = new Game({ startingPick: false });
  g3.phase = 'roundOver';
  g3.openShop(true);
  const offer = g3.shop.offers[0];
  const full = g3.priceOf(offer);
  g3.upgrades.descuento = 10; // 32.5%
  assert.strictEqual(g3.priceOf(offer), Math.round(full * 0.675));
});

test('simulación: partidas aleatorias no rompen invariantes', () => {
  let seed = 42;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let run = 0; run < 200; run++) {
    const g = new Game({ rng });
    let steps = 0;
    while (g.phase !== 'gameover' && steps++ < 5000) {
      if (g.phase === 'deckLost') g.continueWithNextDeck();
      else if (g.phase === 'betting') g.deal(g.minBet);
      else if (g.phase === 'playing') {
        if (g.canDiscard() && g.playerBusted()) g.discard();
        else if (g.bustPending) g.stand();
        else if (g.canSplit() && g.rng() < 0.5) g.split();
        else if (g.playerValue().total < 17) g.hit();
        else g.stand();
      } else if (g.phase === 'roundOver') g.nextHand();
      else if (g.phase === 'shop') {
        if (g.canBuyDeck()) g.buyDeck();
        if (!g.shop.free) for (const u of ['suerte', 'ganancia', 'seguro', 'descuento']) if (g.canUpgrade(u)) g.upgrade(u);
        for (const o of [...g.shop.offers]) if (g.canBuy(o)) g.buy(o.id);
        if (g.phase === 'shop') g.leaveShop();
      }
      assert.ok(g.money >= 0, 'el dinero nunca es negativo');
      assert.ok(Number.isInteger(g.money * 2), 'el dinero va de $0.50 en $0.50');
    }
  }
});
