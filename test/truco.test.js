const test = require('node:test');
const assert = require('node:assert');
const Truco = require('../js/truco.js');
const TrucoAI = require('../js/truco-ai.js');
const { rank, envidoOf, handWinner, TrucoHand, TrucoMatch } = Truco;

const c = (n, s) => ({ n, s });

// Arma una mano con cartas fijas. `p0` y `p1` son las cartas de cada jugador.
function handWith(p0, p1, mano = 0, faltaPoints = () => 15) {
  // TrucoHand reparte de a una alternando desde la mano, sacando del final del mazo.
  const order = [];
  for (let i = 0; i < 3; i++) {
    order.push(mano === 0 ? p0[i] : p1[i]);
    order.push(mano === 0 ? p1[i] : p0[i]);
  }
  return new TrucoHand({ deck: order.reverse(), mano, faltaPoints });
}

test('jerarquía de cartas', () => {
  const order = [c(1, 'espada'), c(1, 'basto'), c(7, 'espada'), c(7, 'oro'), c(3, 'copa'), c(2, 'oro'), c(1, 'copa'),
    c(12, 'basto'), c(11, 'oro'), c(10, 'copa'), c(7, 'copa'), c(6, 'oro'), c(5, 'basto'), c(4, 'espada')];
  for (let i = 1; i < order.length; i++) assert.ok(rank(order[i - 1]) > rank(order[i]), `${order[i - 1].n} de ${order[i - 1].s}`);
  assert.strictEqual(rank(c(1, 'oro')), rank(c(1, 'copa')));
  assert.strictEqual(Truco.buildDeck().length, 40);
});

test('envido', () => {
  assert.strictEqual(envidoOf([c(7, 'oro'), c(6, 'oro'), c(1, 'espada')]), 33);
  assert.strictEqual(envidoOf([c(12, 'copa'), c(10, 'copa'), c(5, 'basto')]), 20);
  assert.strictEqual(envidoOf([c(4, 'oro'), c(11, 'oro'), c(7, 'espada')]), 24);
  assert.strictEqual(envidoOf([c(4, 'oro'), c(5, 'copa'), c(7, 'espada')]), 7);
  assert.strictEqual(envidoOf([c(10, 'oro'), c(11, 'copa'), c(12, 'espada')]), 0);
  assert.strictEqual(envidoOf([c(7, 'oro'), c(5, 'oro'), c(6, 'oro')]), 33, 'con tres del mismo palo cuentan las dos mejores');
});

test('bazas con pardas', () => {
  assert.strictEqual(handWinner([0, 0], 1), 0);
  assert.strictEqual(handWinner([0, 1], 1), null);
  assert.strictEqual(handWinner([0, 1, 1], 0), 1);
  assert.strictEqual(handWinner(['parda', 1], 0), 1, 'parda la primera: gana la segunda');
  assert.strictEqual(handWinner([0, 'parda'], 1), 0, 'parda la segunda: gana el de la primera');
  assert.strictEqual(handWinner([0, 1, 'parda'], 1), 0, 'parda la tercera: gana el de la primera');
  assert.strictEqual(handWinner(['parda', 'parda', 1], 0), 1);
  assert.strictEqual(handWinner(['parda', 'parda', 'parda'], 1), 1, 'todo pardo: gana la mano');
});

test('mano jugada sin cantos: el que gana dos bazas se lleva 1 punto', () => {
  const h = handWith([c(1, 'espada'), c(3, 'oro'), c(4, 'copa')], [c(2, 'oro'), c(5, 'copa'), c(6, 'basto')], 0);
  h.act(0, { type: 'play', index: 0 }); // ancho de espadas
  h.act(1, { type: 'play', index: 0 }); // 2
  assert.strictEqual(h.turn, 0, 'el que gana la baza empieza la siguiente');
  h.act(0, { type: 'play', index: 0 }); // 3
  h.act(1, { type: 'play', index: 0 }); // 5
  assert.ok(h.finished);
  assert.deepStrictEqual(h.points, [1, 0]);
});

test('truco: quiero, retruco y no quiero', () => {
  const h = handWith([c(1, 'espada'), c(3, 'oro'), c(4, 'copa')], [c(2, 'oro'), c(5, 'copa'), c(6, 'basto')], 0);
  h.act(0, { type: 'truco' });
  assert.strictEqual(h.actor, 1);
  h.act(1, { type: 'truco' }); // retruco (implica quiero)
  assert.strictEqual(h.truco.level, 1);
  assert.strictEqual(h.actor, 0);
  h.act(0, { type: 'noquiero' });
  assert.ok(h.finished);
  assert.deepStrictEqual(h.points, [0, 2], 'no quiero al retruco: 2 puntos');

  const h2 = handWith([c(1, 'espada'), c(3, 'oro'), c(4, 'copa')], [c(2, 'oro'), c(5, 'copa'), c(6, 'basto')], 0);
  h2.act(0, { type: 'truco' });
  h2.act(1, { type: 'quiero' });
  assert.ok(!h2.can(1, { type: 'truco' }), 'no le toca jugar');
  h2.act(0, { type: 'play', index: 0 });
  assert.ok(h2.can(1, { type: 'truco' }), 'el que quiso puede subir a retruco');
  assert.ok(!h2.can(0, { type: 'truco' }) || h2.actor !== 0);
  h2.act(1, { type: 'play', index: 0 });
  h2.act(0, { type: 'play', index: 0 });
  h2.act(1, { type: 'play', index: 0 });
  assert.deepStrictEqual(h2.points, [2, 0], 'truco querido y ganado: 2 puntos');
});

test('envido: puntos queridos, no queridos y falta envido', () => {
  const p0 = [c(7, 'oro'), c(6, 'oro'), c(4, 'copa')]; // 33
  const p1 = [c(5, 'copa'), c(4, 'basto'), c(2, 'basto')]; // 26
  let h = handWith(p0, p1, 0);
  h.act(0, { type: 'envido' });
  h.act(1, { type: 'quiero' });
  assert.deepStrictEqual(h.points, [2, 0]);
  assert.deepStrictEqual(h.envido.values, [33, 26]);
  assert.ok(!h.can(0, { type: 'envido' }), 'el envido se canta una sola vez');

  h = handWith(p0, p1, 0);
  h.act(0, { type: 'envido' });
  h.act(1, { type: 'envido' });
  h.act(0, { type: 'real' });
  h.act(1, { type: 'noquiero' });
  assert.deepStrictEqual(h.points, [4, 0], 'envido-envido-real no querido: 4');

  h = handWith(p0, p1, 0);
  h.act(0, { type: 'real' });
  h.act(1, { type: 'noquiero' });
  assert.deepStrictEqual(h.points, [1, 0], 'real envido no querido: 1');

  h = handWith(p0, p1, 0, () => 9);
  h.act(0, { type: 'envido' });
  h.act(1, { type: 'falta' });
  h.act(0, { type: 'quiero' });
  assert.deepStrictEqual(h.points, [9, 0], 'falta envido: lo que le falta al que va ganando');
});

test('envido empatado: gana la mano', () => {
  const h = handWith([c(7, 'oro'), c(6, 'oro'), c(4, 'copa')], [c(7, 'copa'), c(6, 'copa'), c(4, 'oro')], 1);
  h.act(1, { type: 'envido' });
  h.act(0, { type: 'quiero' });
  assert.strictEqual(h.envido.winner, 1);
});

test('el envido está primero: se puede responder un truco con envido', () => {
  const h = handWith([c(7, 'oro'), c(6, 'oro'), c(4, 'copa')], [c(1, 'espada'), c(5, 'copa'), c(4, 'basto')], 1);
  h.act(1, { type: 'truco' });
  assert.ok(h.can(0, { type: 'envido' }));
  h.act(0, { type: 'envido' });
  h.act(1, { type: 'quiero' });
  assert.deepStrictEqual(h.points, [2, 0]);
  assert.strictEqual(h.pending.kind, 'truco', 'después hay que responder el truco');
  assert.strictEqual(h.actor, 0);
  h.act(0, { type: 'noquiero' });
  assert.deepStrictEqual(h.points, [2, 1]);
});

test('irse al mazo', () => {
  const h = handWith([c(4, 'oro'), c(5, 'oro'), c(4, 'copa')], [c(1, 'espada'), c(5, 'copa'), c(4, 'basto')], 0);
  h.act(0, { type: 'truco' });
  h.act(1, { type: 'quiero' });
  h.act(0, { type: 'mazo' });
  assert.deepStrictEqual(h.points, [0, 2], 'con el truco querido el rival se lleva 2');
});

test('partida a 15 con la mano alternada', () => {
  const m = new TrucoMatch({ target: 15, firstMano: 1 });
  const h1 = m.newHand();
  assert.strictEqual(h1.mano, 1);
  h1.act(1, { type: 'mazo' });
  m.settle();
  assert.deepStrictEqual(m.scores, [1, 0]);
  const h2 = m.newHand();
  assert.strictEqual(h2.mano, 0);
});

test('simulación: el rival contra sí mismo juega partidas completas sin romper reglas', () => {
  let seed = 5;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let wins = [0, 0];
  for (let g = 0; g < 200; g++) {
    const m = new TrucoMatch({ target: 15, rng });
    let hands = 0;
    while (!m.over && hands++ < 200) {
      const h = m.newHand();
      let steps = 0;
      while (!h.finished && steps++ < 100) {
        const p = h.actor;
        const action = TrucoAI.decide(h, p, TrucoAI.PERSONAS[p ? 'gaucho' : 'diablo'], rng);
        assert.ok(h.can(p, action), `acción inválida ${action.type}`);
        h.act(p, action);
      }
      assert.ok(h.finished, 'la mano termina');
      assert.ok(h.points[0] + h.points[1] >= 1);
      m.settle();
    }
    assert.ok(m.over, 'la partida termina');
    wins[m.winner]++;
  }
  assert.ok(wins[0] > 20 && wins[1] > 20, `las dos personalidades ganan alguna: ${wins}`);
});
