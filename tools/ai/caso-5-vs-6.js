const Truco = require('../../js/truco.js');
const AI = require('../../js/truco-ai.js');
const B = require('../../js/truco-brain.js');
const c = (n, s) => ({ n, s });
function handWith(p0, p1, mano = 0) { const o = []; for (let i = 0; i < 3; i++) { o.push(mano === 0 ? p0[i] : p1[i]); o.push(mano === 0 ? p1[i] : p0[i]); } return new Truco.TrucoHand({ deck: o.reverse(), mano, faltaPoints: () => 15 }); }
const play = (h, p, card) => h.act(p, { type: 'play', index: h.cards[p].findIndex((x) => x.n === card.n && x.s === card.s) });
// Vos mano. 1ra: vos 3 oro vs IA 4 espada -> ganás. 2da: abrís 4 copa, IA 12 oro -> gana la IA. 3ra: abre la IA con el 6.
const h = handWith([c(3, 'oro'), c(4, 'copa'), c(5, 'basto')], [c(4, 'espada'), c(12, 'oro'), c(6, 'copa')], 0);
play(h, 0, c(3, 'oro')); play(h, 1, c(4, 'espada'));
play(h, 0, c(4, 'copa')); play(h, 1, c(12, 'oro'));
console.log('bazas', h.bazas, 'turno', h.turn);
play(h, 1, c(6, 'copa'));
console.log('turno', h.turn, 'acciones', h.actions(0).map((a) => a.type));
h.act(0, { type: 'truco' });
const pw = B.trucoWinProb(h, 1).win;
const res = {}; for (let i = 0; i < 400; i++) { const a = B.decide(h, 1, { ...AI.PERSONAS.familiar, smart: true }).type; res[a] = (res[a] || 0) + 1; }
const res2 = {}; for (let i = 0; i < 400; i++) { const a = AI.decide(h, 1, AI.PERSONAS.familiar).type; res2[a] = (res2[a] || 0) + 1; }
console.log('chance IA', pw.toFixed(3), '| difícil', JSON.stringify(res), '| fácil', JSON.stringify(res2));
