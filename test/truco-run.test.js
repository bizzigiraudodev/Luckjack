const test = require('node:test');
const assert = require('node:assert');
const Truco = require('../js/truco.js');
const TrucoAI = require('../js/truco-ai.js');
const { TrucoRun } = require('../js/truco-run.js');

const c = (n, s) => ({ n, s });

function run(opts = {}) {
  return new TrucoRun({ startingPick: false, ...opts });
}

// Reemplaza el reparto para que salgan estas cartas.
function rig(r, mine, rival) {
  r.dealCards = () => [mine.slice(), rival.slice()];
}

const STRONG = [c(1, 'espada'), c(1, 'basto'), c(7, 'espada')];
const WEAK = [c(4, 'copa'), c(5, 'oro'), c(6, 'basto')];

function playOut(h) {
  // los dos juegan su primera carta hasta que termina
  while (!h.finished) h.act(h.actor, { type: 'play', index: 0 });
}

test('truco infinito: usa el catálogo del truco y la tienda de bonuses de truco', () => {
  const r = new TrucoRun();
  assert.strictEqual(r.phase, 'shop');
  assert.strictEqual(r.shop.kind, 'start');
  const ids = r.catalog.BONUSES.map((b) => b.id);
  for (const o of r.shop.offers) assert.ok(ids.includes(o.id));
  assert.ok(r.isTruco);
});

test('pago: apuesta × (tus puntos − los del rival)', () => {
  const r = run();
  rig(r, STRONG, WEAK);
  const h = r.deal(10);
  h.act(h.actor, h.actor === 0 ? { type: 'truco' } : { type: 'play', index: 0 });
  if (h.pending) h.act(1, { type: 'quiero' });
  playOut(h);
  r.settleHand();
  assert.strictEqual(r.result.points[0] - r.result.points[1], r.result.points[0]);
  assert.strictEqual(r.money, 100 + 10 * r.result.points[0]);
  assert.strictEqual(r.phase, 'roundOver');
});

test('perder resta y el dinero nunca baja de 0', () => {
  const r = run();
  r.money = 20;
  rig(r, WEAK, STRONG);
  const h = r.deal(20);
  if (h.actor === 1) h.act(1, { type: 'play', index: 0 });
  h.act(0, { type: 'truco' });
  h.act(1, { type: 'quiero' });
  playOut(h);
  r.settleHand();
  assert.strictEqual(r.money, 0);
  r.nextHand();
  assert.strictEqual(r.phase, 'deckLost');
});

test('bonuses: Envido Gordo, Pie, Siete Bravo y Flor', () => {
  let r = run();
  r.bonuses.push('envido_gordo');
  rig(r, [c(7, 'oro'), c(5, 'oro'), c(4, 'copa')], [c(7, 'copa'), c(6, 'copa'), c(4, 'basto')]); // 32 vs 33
  let h = r.deal(10);
  assert.strictEqual(h.envidoValueOf(0), 34);

  r = run();
  r.bonuses.push('pie');
  rig(r, [c(3, 'oro'), c(4, 'copa'), c(4, 'oro')], [c(3, 'copa'), c(5, 'copa'), c(5, 'basto')]);
  h = r.deal(10);
  if (h.actor === 1) { h.act(1, { type: 'play', index: 0 }); h.act(0, { type: 'play', index: 0 }); } else { h.act(0, { type: 'play', index: 0 }); h.act(1, { type: 'play', index: 0 }); }
  assert.strictEqual(h.bazas[0], 0, 'la parda de la primera es tuya');

  r = run();
  r.bonuses.push('siete_bravo');
  rig(r, [c(7, 'copa'), c(4, 'copa'), c(4, 'oro')], [c(3, 'copa'), c(5, 'copa'), c(5, 'basto')]);
  h = r.deal(10);
  assert.ok(h.rankOf(c(7, 'copa'), 0) > h.rankOf(c(3, 'copa'), 1));

  r = run();
  r.bonuses.push('flor');
  rig(r, [c(7, 'copa'), c(4, 'copa'), c(1, 'copa')], WEAK);
  h = r.deal(10);
  assert.deepStrictEqual(h.points, [3, 0]);
  assert.ok(h.envido.done, 'con flor no hay envido');
});

test('bonuses de dinero: Retirada Digna, Porotero y Poncho Protector', () => {
  let r = run();
  r.bonuses.push('retirada');
  rig(r, WEAK, STRONG);
  let h = r.deal(10);
  if (h.actor === 1) h.act(1, { type: 'play', index: 0 });
  h.act(0, { type: 'mazo' });
  r.settleHand();
  assert.strictEqual(r.money, 100, 'irse al mazo no costó nada');

  r = run();
  r.bonuses.push('porotos');
  rig(r, STRONG, WEAK);
  h = r.deal(10);
  playOut(h);
  r.settleHand();
  assert.strictEqual(r.money, 100 + 10 + 3);

  r = run();
  r.bonuses.push('escudo');
  rig(r, WEAK, STRONG);
  h = r.deal(10);
  playOut(h);
  r.settleHand();
  assert.strictEqual(r.money, 100, 'la primera mano perdida del ciclo no cuesta');
  r.nextHand();
  h = r.deal(10);
  playOut(h);
  r.settleHand();
  assert.strictEqual(r.money, 90, 'la segunda sí');
});

test('la suerte del mazo cambia la chance de cartas buenas', () => {
  const goodRate = (deckType, upgrades = 0) => {
    let seed = 9;
    const rng = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const r = run({ rng });
    r.deckType = deckType;
    r.upgrades.suerte = upgrades;
    let good = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) good += r.dealCards()[0].filter((x) => Truco.rank(x) >= 9).length;
    return good / (N * 3);
  };
  const base = goodRate('clasico');
  assert.ok(goodRate('maldito') < base - 0.05, 'el Mazo Maldito da menos cartas buenas');
  assert.ok(goodRate('dorado') > base, 'el Mazo Dorado da más');
});

test('simulación: partidas completas de truco infinito sin romper invariantes', () => {
  let seed = 21;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let maxCycles = 0;
  for (let g = 0; g < 60; g++) {
    const r = new TrucoRun({ rng });
    let steps = 0;
    while (r.phase !== 'gameover' && steps++ < 3000) {
      if (r.phase === 'shop') {
        for (const o of [...r.shop.offers]) if (r.canBuy(o)) r.buy(o.id);
        if (r.phase === 'shop') r.leaveShop();
      } else if (r.phase === 'deckLost') r.continueWithNextDeck();
      else if (r.phase === 'betting') r.deal(r.minBet);
      else if (r.phase === 'playing') {
        const h = r.truco;
        while (!h.finished) h.act(h.actor, TrucoAI.decide(h, h.actor, h.actor === 1 ? r.persona : TrucoAI.PERSONAS.gaucho, rng));
        r.settleHand();
      } else if (r.phase === 'roundOver') r.nextHand();
      assert.ok(r.money >= 0);
      assert.ok(Number.isInteger(r.money * 2));
    }
    maxCycles = Math.max(maxCycles, r.maxCleared);
  }
  assert.ok(maxCycles >= 1, 'alguna partida supera al menos un ciclo');
});
