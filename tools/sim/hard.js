// Calibración del modo difícil: % de partidas ganadas sin bonus y con cada bonus OP solo.
const L = require('./lib.js');
if (process.env.GAIN) L.TrucoRun.nightGain = Number(process.env.GAIN);
if (process.env.CURVE) L.TrucoRun.hardCurve = Number(process.env.CURVE);
if (process.env.START) L.TrucoRun.hardStart = Number(process.env.START);
const N = Number(process.argv[2] || 200);
const bonuses = (process.argv[3] || 'ninguno,ancho,doble_truco,escudo').split(',');
const out = {};
for (const b of bonuses) {
  const r = [];
  for (let i = 0; i < N; i++) r.push(L.runTruco({ mode: 'story', bonus: b === 'ninguno' ? null : b, policy: { bet: 'pro', upgrades: true } }));
  const won = r.filter((x) => x.won).length / N;
  const cyc = r.reduce((s, x) => s + x.cycles, 0) / N;
  const reach = r.reduce((s, x) => s + (x.reach || 0), 0);
  const one = r.reduce((s, x) => s + (x.oneHand || 0), 0);
  out[b] = `${(won * 100).toFixed(0)}% (ciclos ${cyc.toFixed(2)}, 1 mano ${(100 * one / Math.max(1, reach)).toFixed(0)}%)`;
}
console.log(`DIFF=${process.env.DIFF || "facil"} LIVES=${process.env.LIVES || "sudden"} STORY=${process.env.STORY || "pampa"} START=${process.env.START || "-"} CURVE=${process.env.CURVE || "-"} GAIN=${process.env.GAIN || "-"}`, JSON.stringify(out));
