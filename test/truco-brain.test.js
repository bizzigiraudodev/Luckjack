const test = require('node:test');
const assert = require('node:assert');
const Truco = require('../js/truco.js');
const TrucoAI = require('../js/truco-ai.js');
const TrucoBrain = require('../js/truco-brain.js');

const c = (n, s) => ({ n, s });
function handWith(p0, p1, mano = 0) {
  const order = [];
  for (let i = 0; i < 3; i++) {
    order.push(mano === 0 ? p0[i] : p1[i]);
    order.push(mano === 0 ? p1[i] : p0[i]);
  }
  return new Truco.TrucoHand({ deck: order.reverse(), mano, faltaPoints: () => 15 });
}
const play = (h, p, card) => h.act(p, { type: 'play', index: h.cards[p].findIndex((x) => x.n === card.n && x.s === card.s) });
const easy = TrucoAI.PERSONAS.gaucho;
const hard = { ...TrucoAI.PERSONAS.gaucho, smart: true };
const never = () => 0.99; // sin faroles ni azar

// El caso que pasó jugando: la IA abre la 3ra con el ancho de basto, vos le cantás truco y se achicaba
// (la IA vieja solo miraba las cartas que le quedaban en la mano, y ya no le quedaba ninguna).
test('la IA no se achica después de tirar el ancho de basto en la 3ra', () => {
  for (const persona of [easy, hard, TrucoAI.PERSONAS.santo, TrucoAI.PERSONAS.gil]) {
    const h = handWith([c(6, 'copa'), c(4, 'copa'), c(5, 'oro')], [c(4, 'espada'), c(6, 'oro'), c(1, 'basto')], 0);
    play(h, 0, c(6, 'copa'));
    play(h, 1, c(4, 'espada')); // ganás la 1ra
    play(h, 0, c(4, 'copa'));
    play(h, 1, c(6, 'oro')); // la IA la 2da: abre la 3ra
    play(h, 1, c(1, 'basto'));
    assert.strictEqual(h.turn, 0);
    h.act(0, { type: 'truco' });
    assert.strictEqual(h.actor, 1);
    const a = TrucoAI.decide(h, 1, persona, never);
    assert.notStrictEqual(a.type, 'noquiero', `${JSON.stringify(persona)}: con el ancho de basto en la mesa no se achica`);
  }
});

test('la IA no dice "no quiero" con la mano ganada, ni "quiero" con la mano perdida', () => {
  for (const persona of [easy, hard, TrucoAI.PERSONAS.diablo]) {
    // Ganó la 1ra y tiene el ancho de espada para la 3ra: imposible perder.
    const h = handWith([c(5, 'oro'), c(4, 'copa'), c(1, 'basto')], [c(6, 'oro'), c(4, 'espada'), c(1, 'espada')], 0);
    play(h, 0, c(4, 'copa'));
    play(h, 1, c(6, 'oro'));
    play(h, 1, c(4, 'espada'));
    play(h, 0, c(5, 'oro'));
    h.act(0, { type: 'truco' });
    const a = TrucoAI.decide(h, 1, persona, () => 0.5);
    assert.ok(['quiero', 'truco'].includes(a.type), `mano ganada: ${a.type}`);

    // Vos tirás el ancho de espada en la 3ra después de ganar la 1ra: la IA perdió sí o sí.
    const g = handWith([c(6, 'oro'), c(4, 'espada'), c(1, 'espada')], [c(5, 'oro'), c(4, 'copa'), c(1, 'basto')], 1);
    play(g, 1, c(5, 'oro'));
    play(g, 0, c(6, 'oro')); // ganás la 1ra
    play(g, 0, c(4, 'espada'));
    play(g, 1, c(4, 'copa')); // parda en la 2da: gana el que ganó la 1ra (vos)
    if (!g.finished) {
      g.act(g.actor, { type: 'truco' });
      if (g.actor === 1 && g.pending) {
        const b = TrucoAI.decide(g, 1, persona, () => 0.01); // aunque quiera mentir
        assert.strictEqual(b.type, 'noquiero');
      }
    }
  }
});

test('el perfil aprende si mentís al cantar', () => {
  const prof = TrucoBrain.newProfile();
  for (let i = 0; i < 6; i++) {
    const h = handWith([c(4, 'copa'), c(5, 'oro'), c(6, 'basto')], [c(1, 'espada'), c(1, 'basto'), c(7, 'espada')], 0);
    h.act(0, { type: 'truco' });
    h.act(1, { type: 'quiero' });
    while (!h.finished) h.act(h.actor, { type: 'play', index: 0 });
    TrucoBrain.learn(prof, h, 0);
  }
  assert.ok(TrucoBrain.lieIndex(prof.truco) > 0.6, 'cantó truco con cartas malas seis veces');
  assert.strictEqual(prof.hands, 6);
});

test('querer no es mentir: con 20% de chance la IA difícil nunca dice "quiero" (como mucho sube de farol)', () => {
  // Ganó la 1ra, perdió la 2da y le queda un 6; vos cantás truco antes de tirar tu última carta (un 5).
  const h = handWith([c(4, 'copa'), c(3, 'oro'), c(5, 'basto')], [c(12, 'oro'), c(4, 'espada'), c(6, 'copa')], 0);
  play(h, 0, c(4, 'copa'));
  play(h, 1, c(12, 'oro'));
  play(h, 1, c(4, 'espada'));
  play(h, 0, c(3, 'oro'));
  h.act(0, { type: 'truco' });
  for (let i = 0; i < 200; i++) {
    const a = TrucoAI.decide(h, 1, { ...TrucoAI.PERSONAS.familiar, smart: true });
    assert.notStrictEqual(a.type, 'quiero');
  }
});

test('si le cantás truco después de ver su carta, la IA sabe que probablemente le ganás', () => {
  // El caso que pasó jugando: ganaste la 1ra, la IA la 2da; en la 3ra la IA tira un 6 y vos, con un 5, cantás truco.
  const h = handWith([c(3, 'oro'), c(4, 'copa'), c(5, 'basto')], [c(4, 'espada'), c(12, 'oro'), c(6, 'copa')], 0);
  play(h, 0, c(3, 'oro'));
  play(h, 1, c(4, 'espada'));
  play(h, 0, c(4, 'copa'));
  play(h, 1, c(12, 'oro'));
  play(h, 1, c(6, 'copa'));
  h.act(0, { type: 'truco' });
  assert.ok(TrucoBrain.trucoWinProb(h, 1).win < 0.1, 'con su carta a la vista, tu canto dice que le ganás');
  for (const persona of [{ ...TrucoAI.PERSONAS.familiar, smart: true }, TrucoAI.PERSONAS.familiar, TrucoAI.PERSONAS.diablo]) {
    for (let i = 0; i < 100; i++) {
      // Ni quiere ni sube de farol: ya no le quedan cartas, vos ves todo.
      assert.strictEqual(TrucoAI.decide(h, 1, persona).type, 'noquiero');
    }
  }
});
