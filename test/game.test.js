const test = require('node:test');
const assert = require('node:assert');
const Cards = require('../js/cards.js');
const Bonuses = require('../js/bonuses.js');
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
  const g = new Game();
  stack(g, [c('K'), c('9'), c('Q'), c('8')]);
  g.deal(10);
  const r = g.stand();
  assert.strictEqual(r.outcome, 'win');
  assert.strictEqual(g.money, 110);
});

test('blackjack paga 3:2 y Blackjack Dorado 2:1', () => {
  const g = new Game();
  stack(g, [c('A'), c('9'), c('K'), c('8')]);
  g.deal(10);
  assert.strictEqual(g.result.outcome, 'blackjack');
  assert.strictEqual(g.money, 115);

  const g2 = new Game();
  g2.bonuses.push('dorado');
  stack(g2, [c('A'), c('9'), c('K'), c('8')]);
  g2.deal(10);
  assert.strictEqual(g2.money, 120);
});

test('pasarse pierde la apuesta, Red de Seguridad devuelve la mitad', () => {
  const g = new Game();
  g.bonuses.push('red');
  stack(g, [c('K'), c('9'), c('6'), c('8'), c('Q')]);
  g.deal(10);
  const r = g.hit();
  assert.strictEqual(r.outcome, 'bust');
  assert.strictEqual(g.money, 95);
});

test('Escudo convierte la primera derrota del ciclo en empate', () => {
  const g = new Game();
  g.bonuses.push('escudo');
  stack(g, [c('K'), c('K'), c('7'), c('Q')]);
  g.deal(10);
  const r = g.stand();
  assert.strictEqual(r.outcome, 'push');
  assert.strictEqual(g.money, 100);
  assert.ok(g.shieldUsed);
});

test('Límite Elástico: 22 no se pasa y cuenta como 21', () => {
  const g = new Game();
  g.bonuses.push('elastico');
  stack(g, [c('K'), c('K'), c('5'), c('9'), c('7')]);
  g.deal(10);
  const r = g.hit(); // 22 → se planta solo
  assert.strictEqual(r.outcome, 'win');
  assert.strictEqual(g.playerScore(), 21);
});

test('doblar duplica la apuesta', () => {
  const g = new Game();
  stack(g, [c('5'), c('9'), c('6'), c('8'), c('K')]);
  g.deal(10);
  const r = g.double();
  assert.strictEqual(r.outcome, 'win');
  assert.strictEqual(g.money, 120);
});

test('Charlie de Cinco gana automáticamente x2', () => {
  const g = new Game();
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
  const g = new Game();
  g.bonuses.push('segunda');
  stack(g, [c('K'), c('9'), c('5'), c('8'), c('2')]);
  g.deal(10);
  g.hit();
  assert.ok(g.canDiscard());
  g.discard();
  assert.strictEqual(g.player.length, 2);
  assert.ok(!g.canDiscard());
});

test('el ciclo termina a las 5 manos: cuota no alcanzada → game over', () => {
  const g = new Game();
  for (let i = 0; i < 5; i++) {
    stack(g, [c('K'), c('K'), c('7'), c('8')]); // pierde 17 vs 18
    g.deal(10);
    g.stand();
    g.nextHand();
  }
  assert.strictEqual(g.phase, 'gameover');
});

test('superar la cuota abre la tienda y se puede comprar', () => {
  const g = new Game();
  for (let i = 0; i < 5; i++) {
    stack(g, [c('K'), c('9'), c('Q'), c('8')]);
    g.deal(10);
    g.stand();
    g.nextHand();
  }
  assert.strictEqual(g.money, 150);
  assert.strictEqual(g.phase, 'shop');
  assert.strictEqual(g.shop.offers.length, 3);
  const offer = g.shop.offers[0];
  const price = g.priceOf(offer);
  g.buy(offer.id);
  assert.ok(g.has(offer.id));
  assert.strictEqual(g.money, 150 - price);
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

test('simulación: partidas aleatorias no rompen invariantes', () => {
  let seed = 42;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let run = 0; run < 200; run++) {
    const g = new Game({ rng });
    let steps = 0;
    while (g.phase !== 'gameover' && steps++ < 2000) {
      if (g.phase === 'betting') g.deal(g.minBet);
      else if (g.phase === 'playing') {
        if (g.canDiscard() && g.playerBusted()) g.discard();
        else if (g.playerValue().total < 17) g.hit();
        else g.stand();
      } else if (g.phase === 'roundOver') g.nextHand();
      else if (g.phase === 'shop') {
        for (const o of [...g.shop.offers]) if (g.canBuy(o)) g.buy(o.id);
        g.leaveShop();
      }
      assert.ok(g.money >= 0, 'el dinero nunca es negativo');
      assert.ok(Number.isInteger(g.money), 'el dinero es entero');
    }
  }
});
