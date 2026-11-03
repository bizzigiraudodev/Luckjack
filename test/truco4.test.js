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
