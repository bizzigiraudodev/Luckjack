const test = require('node:test');
const assert = require('node:assert');
const Truco = require('../js/truco.js');
const TrucoAI = require('../js/truco-ai.js');
const { TrucoHand, TrucoMatch } = Truco;

const c = (n, s) => ({ n, s });
const hand4 = (cards, mano = 0) => new TrucoHand({ players: 4, mano, cards });
const filler = [c(4, 'copa'), c(4, 'oro'), c(4, 'basto')];

test('de a 4: reparte 3 cartas a cada uno y juegan en orden desde la mano', () => {
  const m = new TrucoMatch({ players: 4, firstMano: 2 });
  const h = m.newHand();
  assert.strictEqual(h.cards.length, 4);
  for (const cards of h.cards) assert.strictEqual(cards.length, 3);
  assert.strictEqual(h.turn, 2);
  h.act(2, { type: 'play', index: 0 });
  assert.strictEqual(h.turn, 3);
  assert.deepStrictEqual(h.actions(1), [], 'no es su turno');
  m.hand.act(3, { type: 'mazo' });
  m.settle();
  assert.deepStrictEqual(m.scores, [1, 0], 'se fue la pareja 1-3');
  assert.strictEqual(m.newHand().mano, 3, 'la mano rota');
});

test('bazas: gana la carta más alta; empate entre compañeros es de la pareja, entre rivales es parda', () => {
  // 0 y 2 tiran un 3 cada uno (compañeros) y ganan la baza
  let h = hand4([[c(3, 'oro'), ...filler.slice(1)], [c(2, 'oro'), ...filler.slice(1)], [c(3, 'copa'), ...filler.slice(1)], [c(12, 'oro'), ...filler.slice(1)]]);
  for (let p = 0; p < 4; p++) h.act(p, { type: 'play', index: 0 });
  assert.deepStrictEqual(h.bazas, [0]);
  assert.strictEqual(h.turn, 0, 'empieza la siguiente el primero que la ganó');

  // 1 y 2 empatan con un 3 (rivales): parda
  h = hand4([[c(4, 'oro'), ...filler.slice(1)], [c(3, 'oro'), ...filler.slice(1)], [c(3, 'copa'), ...filler.slice(1)], [c(12, 'oro'), ...filler.slice(1)]]);
  for (let p = 0; p < 4; p++) h.act(p, { type: 'play', index: 0 });
  assert.deepStrictEqual(h.bazas, ['parda']);

  // el ancho de espadas del 3 gana la baza para la pareja 1-3, y el 3 empieza la siguiente
  h = hand4([[c(3, 'oro'), ...filler.slice(1)], [c(2, 'oro'), ...filler.slice(1)], [c(3, 'copa'), ...filler.slice(1)], [c(1, 'espada'), ...filler.slice(1)]]);
  for (let p = 0; p < 4; p++) h.act(p, { type: 'play', index: 0 });
  assert.deepStrictEqual(h.bazas, [1]);
  assert.strictEqual(h.turn, 3);
});

test('envido por pareja: vale el mejor tanto; si empatan, gana el más cerca de la mano', () => {
  const cards = [
    [c(7, 'oro'), c(5, 'oro'), c(4, 'copa')], // 32
    [c(6, 'copa'), c(1, 'copa'), c(4, 'basto')], // 27
    [c(1, 'basto'), c(2, 'oro'), c(4, 'espada')], // 4
    [c(7, 'espada'), c(5, 'espada'), c(10, 'oro')], // 32
  ];
  let h = hand4(cards, 1);
  h.act(1, { type: 'envido' });
  assert.ok(h.canRespond(2), 'responde cualquiera de la otra pareja');
  assert.ok(h.canRespond(0));
  assert.ok(!h.canRespond(3), 'el compañero del que cantó no responde');
  h.act(0, { type: 'quiero' });
  assert.deepStrictEqual(h.envido.values, [32, 32]);
  assert.strictEqual(h.envido.holder, 3, 'empate: gana el más cerca de la mano (1 → 2 → 3)');
  assert.strictEqual(h.envido.winner, 1);
  assert.deepStrictEqual(h.points, [0, 2]);

  h = hand4(cards, 0);
  h.act(0, { type: 'envido' });
  h.act(3, { type: 'quiero' });
  assert.strictEqual(h.envido.holder, 0);
  assert.deepStrictEqual(h.points, [2, 0]);
});

test('truco en parejas: puede responder cualquiera de la pareja desafiada y subir la pareja que quiso', () => {
  const h = hand4([filler, filler, filler, filler].map((f) => f.slice()), 0);
  h.act(0, { type: 'truco' });
  assert.strictEqual(h.actor, 1, 'por defecto responde el siguiente');
  h.act(3, { type: 'quiero' }); // responde el compañero del 1
  assert.strictEqual(h.truco.owner, 1);
  h.act(0, { type: 'play', index: 0 });
  assert.ok(h.can(1, { type: 'truco' }), 'la pareja que quiso puede subir a retruco');
  h.act(1, { type: 'truco' });
  assert.ok(h.canRespond(0) && h.canRespond(2));
  h.act(2, { type: 'noquiero' });
  assert.ok(h.finished);
  assert.deepStrictEqual(h.points, [0, 2], 'no quiero al retruco: 2 para la pareja 1-3');
});

test('simulación: partidas de a 4 entre bots terminan sin romper reglas', () => {
  let seed = 13;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const wins = [0, 0];
  for (let g = 0; g < 150; g++) {
    const m = new TrucoMatch({ players: 4, target: 15, rng, firstMano: g % 4 });
    let hands = 0;
    while (!m.over && hands++ < 200) {
      const h = m.newHand();
      let steps = 0;
      while (!h.finished && steps++ < 200) {
        const p = h.actor;
        const a = TrucoAI.decide(h, p, TrucoAI.PERSONAS.gaucho, rng);
        assert.ok(h.can(p, a), `acción inválida ${a && a.type}`);
        h.act(p, a);
      }
      assert.ok(h.finished);
      m.settle();
    }
    assert.ok(m.over);
    wins[m.winner]++;
  }
  assert.ok(wins[0] > 30 && wins[1] > 30, `las dos parejas ganan: ${wins}`);
});

test('señas de un toque: el compañero ve todas tus cartas bravas y si tenés envido', () => {
  const Senas = require('../js/senas.js');
  const s = Senas.showFor([c(1, 'espada'), c(3, 'oro'), c(7, 'oro')], 30);
  assert.deepStrictEqual(s.cards, [c(1, 'espada'), c(7, 'oro'), c(3, 'oro')], 'de la más alta a la más baja');
  assert.deepStrictEqual(s.senas, ['cejas', 'boca_izq', 'labio', 'ceno']);
  assert.strictEqual(s.envido, true);
  const nada = Senas.showFor([c(4, 'copa'), c(5, 'oro'), c(6, 'basto')], 6);
  assert.deepStrictEqual(nada, { cards: [], senas: ['ojos'], envido: false });
});

test('órdenes: el compañero bot canta lo que le pedís si puede, y con "jugá callado" no canta', () => {
  const Senas = require('../js/senas.js');
  const obey = (h, p, orders, action) => TrucoAI.obey(h, p, orders, action, Senas.getOrder);
  // Mano 0: le toca primero al 0, después al 1 y después al compañero (2)
  let h = hand4([filler, filler, [c(7, 'oro'), c(6, 'oro'), c(4, 'basto')], filler], 0);
  h.act(0, { type: 'play', index: 0 });
  h.act(1, { type: 'play', index: 0 });
  let r = obey(h, 2, ['vino'], { type: 'play', index: 0 });
  assert.deepStrictEqual(r, { action: { type: 'envido' }, used: 'vino' });
  assert.ok(h.can(2, r.action));
  r = obey(h, 2, ['segunda'], { type: 'play', index: 0 });
  assert.deepStrictEqual(r.action, { type: 'truco' }, '"cantá 2da" = truco');
  r = obey(h, 2, ['re'], { type: 'play', index: 0 });
  assert.deepStrictEqual(r.action, { type: 'play', index: 0 }, 'no se puede cantar retruco sin truco: juega normal');
  r = obey(h, 2, ['callado'], { type: 'truco' });
  assert.strictEqual(r.action.type, 'play', 'callado: en vez de cantar, juega');

  // Si el rival canta truco, "cantá el re" hace que responda retruco
  h = hand4([filler, filler, filler, filler], 1);
  h.act(1, { type: 'truco' });
  r = obey(h, 2, ['re'], { type: 'quiero' });
  assert.deepStrictEqual(r.action, { type: 'truco' });
  h.act(2, r.action);
  assert.strictEqual(h.pending.level, 2, 'retruco');
});

test('señas múltiples: el compañero bot cuenta todas tus cartas bravas', () => {
  const Senas = require('../js/senas.js');
  const one = Senas.hintsFrom(Senas.showFor([c(1, 'espada'), c(4, 'copa'), c(5, 'oro')], 9).senas);
  const two = Senas.hintsFrom(Senas.showFor([c(1, 'espada'), c(3, 'oro'), c(5, 'oro')], 9).senas);
  assert.strictEqual(one.strong, 1);
  assert.strictEqual(two.strong, 2);
  const h = hand4([filler, filler, filler, filler], 0);
  assert.ok(TrucoAI.power(h, 2, two) > TrucoAI.power(h, 2, one), 'con dos cartas bravas del compañero se anima más');
});
