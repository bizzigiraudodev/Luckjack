// El cerebro nuevo contra la IA vieja: puntos promedio por mano (positivo = gana el cerebro).
const Truco = require('../../js/truco.js');
const AI = require('../../js/truco-ai.js');
const N = Number(process.argv[2] || 2000);
const smart = { ...AI.PERSONAS.gaucho, smart: true };
const old = AI.PERSONAS.gaucho;
let diff = 0; let wins = 0; let t0 = Date.now(); let decisions = 0;
for (let i = 0; i < N; i++) {
  const h = new Truco.TrucoHand({ deck: Truco.buildDeck(), mano: i % 2, faltaPoints: () => 5 });
  const brainSeat = (i >> 1) % 2; // el cerebro juega de los dos lados
  let k = 0;
  while (!h.finished && k++ < 100) { const p = h.actor; decisions++; h.act(p, AI.decide(h, p, p === brainSeat ? smart : old)); }
  const d = h.points[brainSeat] - h.points[1 - brainSeat];
  diff += d; if (d > 0) wins++;
}
console.log(`${N} manos | cerebro: +${(diff / N).toFixed(3)} puntos por mano | gana el ${(100 * wins / N).toFixed(1)}% de las manos | ${((Date.now() - t0) / decisions).toFixed(1)} ms por decisión`);
