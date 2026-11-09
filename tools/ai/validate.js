const Truco = require('../../js/truco.js');
const AI = require('../../js/truco-ai.js');
const B = require('../../js/truco-brain.js');
const N = Number(process.argv[2] || 3000);
const A = JSON.parse(process.argv[3]); const Bp = JSON.parse(process.argv[4]);
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const OPP = [AI.PERSONAS.gaucho, AI.PERSONAS.diablo, AI.PERSONAS.santo, AI.PERSONAS.silbon, { bluff: 0.15, aggression: 0.65 }];
function vsMix(par, seed) { const rng = mulberry(seed); let d = 0;
  for (let i = 0; i < N; i++) { const h = new Truco.TrucoHand({ deck: Truco.buildDeck(rng), mano: i % 2, faltaPoints: () => 5 }); const seat = (i >> 1) % 2; const prof = B.newProfile(); const o = OPP[i % OPP.length]; let k = 0;
    while (!h.finished && k++ < 100) { const p = h.actor; if (p === seat) { Object.assign(B.PARAMS, par); h.act(p, B.decide(h, p, { bluff: 0.15, aggression: 0.5, read: prof }, rng)); } else h.act(p, AI.decide(h, p, o, rng)); }
    d += h.points[seat] - h.points[1 - seat]; } return d / N; }
function head(seed) { const rng = mulberry(seed); let d = 0;
  for (let i = 0; i < N; i++) { const h = new Truco.TrucoHand({ deck: Truco.buildDeck(rng), mano: i % 2, faltaPoints: () => 5 }); const seat = (i >> 1) % 2; let k = 0;
    while (!h.finished && k++ < 100) { const p = h.actor; Object.assign(B.PARAMS, p === seat ? Bp : A); h.act(p, B.decide(h, p, { bluff: 0.15, aggression: 0.5 }, rng)); }
    d += h.points[seat] - h.points[1 - seat]; } return d / N; }
console.log('A vs mezcla', vsMix(A, 7).toFixed(3), '| B vs mezcla', vsMix(Bp, 7).toFixed(3), '| B contra A', head(9).toFixed(3));
