// Autojuego: búsqueda por coordenadas de los PARAMS del cerebro contra una mezcla de rivales
// (IA vieja con varias personalidades + el propio cerebro con los params actuales).
const Truco = require('../../js/truco.js');
const AI = require('../../js/truco-ai.js');
const B = require('../../js/truco-brain.js');
const N = Number(process.argv[2] || 500);
const ROUNDS = Number(process.argv[3] || 2);
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const OPP = [
  { ...AI.PERSONAS.gaucho }, { ...AI.PERSONAS.diablo }, { ...AI.PERSONAS.santo }, { ...AI.PERSONAS.silbon },
  'self',
];
function evalParams(cand, base, seed) {
  const rng = mulberry(seed);
  let diff = 0;
  for (let i = 0; i < N; i++) {
    const h = new Truco.TrucoHand({ deck: Truco.buildDeck(rng), mano: i % 2, faltaPoints: () => 5 });
    const seat = (i >> 1) % 2;
    const opp = OPP[i % OPP.length];
    const prof = B.newProfile();
    let k = 0;
    while (!h.finished && k++ < 100) {
      const p = h.actor;
      let a;
      if (p === seat) { Object.assign(B.PARAMS, cand); a = B.decide(h, p, { bluff: 0.15, aggression: 0.5, read: prof }, rng); }
      else if (opp === 'self') { Object.assign(B.PARAMS, base); a = B.decide(h, p, { bluff: 0.15, aggression: 0.5 }, rng); }
      else a = AI.decide(h, p, opp, rng);
      h.act(p, a);
    }
    diff += h.points[seat] - h.points[1 - seat];
  }
  return diff / N;
}
let best = { ...B.PARAMS, samples: 120 };
const STEPS = { trucoCall: 0.05, trucoRaise: 0.05, envidoCall: 0.05, realCall: 0.05, faltaCall: 0.03, readWeight: 0.4 };
let seed = 1;
let bestScore = evalParams(best, best, seed);
console.log('inicio', bestScore.toFixed(3), JSON.stringify(best));
for (let r = 0; r < ROUNDS; r++) {
  for (const k of Object.keys(STEPS)) {
    for (const dir of [1, -1]) {
      const cand = { ...best, [k]: +(best[k] + dir * STEPS[k]).toFixed(3) };
      const sc = evalParams(cand, best, seed);
      const ref = evalParams(best, best, seed);
      if (sc > ref + 0.01) { best = cand; bestScore = sc; console.log('mejor', k, cand[k], sc.toFixed(3), 'vs', ref.toFixed(3)); break; }
    }
  }
  seed++;
  console.log('ronda', r, JSON.stringify(best));
}
