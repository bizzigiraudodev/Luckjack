const L = require('./lib.js');
const fs = require('fs');
const exp = process.argv[2];
const bj = [null, ...L.Bonuses.BONUSES.map((b) => b.id)];
const tr = [null, ...L.TrucoBonuses.BONUSES.map((b) => b.id)];
const P = {
  speed: { bet: 'speed' },
  pro: { bet: 'pro', upgrades: true },
  smart: { bet: 'smart', upgrades: true },
  smartAdv: { bet: 'smart', upgrades: true, advance: true },
  hacker: { bet: 'smart', upgrades: true, reroll: true },
};
const plans = {
  bjStory: { run: L.runBJ, mode: 'story', bonuses: bj, pols: ['pro'], n: 3000 },
  bjInf: { run: L.runBJ, mode: 'infinite', bonuses: bj, pols: ['pro'], n: 500 },
  trStory: { run: L.runTruco, mode: 'story', bonuses: tr, pols: ['pro'], n: 1500 },
  trInf: { run: L.runTruco, mode: 'infinite', bonuses: tr, pols: ['pro'], n: 400 },
  gold: { run: null },
};
const out = {};
if (exp === 'gold') {
  for (const [name, run] of [['bj', L.runBJ], ['truco', L.runTruco]]) for (const mode of ['story', 'infinite']) for (const pol of ['smart', 'hacker']) {
    const r = []; for (let i = 0; i < 600; i++) r.push(run({ mode, bonus: null, policy: P[pol] }));
    out[`${name}/${mode}/${pol}`] = L.summarize(r);
  }
} else {
  const p = plans[exp];
  for (const b of p.bonuses) for (const pol of p.pols) {
    const r = [];
    for (let i = 0; i < p.n; i++) {
      try { r.push(p.run({ mode: p.mode, bonus: b, policy: P[pol] })); }
      catch (e) { (out.errors = out.errors || []).push(`${b}/${pol}: ${e.message}`); }
    }
    out[`${b || 'ninguno'}/${pol}`] = L.summarize(r);
  }
}
fs.writeFileSync(`${__dirname}/out-${exp}.json`, JSON.stringify(out, null, 1));
console.log('listo', exp);
