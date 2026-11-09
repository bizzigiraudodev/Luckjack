// Simulador de estrés: juega partidas completas con el motor real (sin tocar el código del juego).
const R = require('path').join(__dirname, '../../js') + '/';
const { Game } = require(R + 'game.js');
const Cards = require(R + 'cards.js');
const Bonuses = require(R + 'bonuses.js');
const Decks = require(R + 'decks.js');
const TrucoAI = require(R + 'truco-ai.js');
const { TrucoRun } = require(R + 'truco-run.js');
const TrucoBonuses = require(R + 'truco-bonuses.js');

// ---------- Blackjack: estrategia básica + aprovechar la información de los bonuses ----------
const up = (g) => Cards.cardValue(g.dealer[0]); // 2..11

function basic(g) {
  const cards = g.player;
  const lim = g.bustLimit;
  const shift = lim - 21; // con Límite Elástico se puede apurar un punto más
  const { total, soft } = Cards.handValue(cards, lim);
  const d = up(g);
  const two = cards.length === 2;
  // Pares
  if (two && cards[0].rank === cards[1].rank && g.canSplit()) {
    const v = Cards.cardValue(cards[0]);
    const split = v === 11 || v === 8 || (v === 9 && ![7, 10, 11].includes(d)) ||
      ([2, 3, 7].includes(v) && d <= 7) || (v === 6 && d <= 6) || (v === 4 && (d === 5 || d === 6));
    if (split) return 'split';
  }
  if (soft) {
    if (total >= 19 + shift) return 'stand';
    if (total === 18 + shift) {
      if (two && d >= 3 && d <= 6 && g.canDouble()) return 'double';
      return d >= 9 ? 'hit' : 'stand';
    }
    if (two && d >= 4 && d <= 6 && total >= 15 && g.canDouble()) return 'double';
    return 'hit';
  }
  if (two && g.canDouble()) {
    if (total === 11 && d <= 10) return 'double';
    if (total === 10 && d <= 9) return 'double';
    if (total === 9 && d >= 3 && d <= 6) return 'double';
  }
  if (total >= 17 + shift) return 'stand';
  if (total >= 13 + shift) return d <= 6 ? 'stand' : 'hit';
  if (total === 12 + shift) return d >= 4 && d <= 6 ? 'stand' : 'hit';
  return 'hit';
}

function bjDecide(g) {
  if (g.bustPending) return g.canDiscard() ? 'discard' : 'stand';
  const lim = g.bustLimit;
  const cur = g.playerScore();
  // Rayos X: sabés la próxima carta.
  if (g.has('rayos')) {
    const next = g.peekNext();
    const after = g.scoreOf([...g.player, next]);
    const busts = Cards.handValue([...g.player, next], lim).total > lim;
    if (g.player.length === 2 && g.player[0].rank === g.player[1].rank && basic(g) === 'split') return 'split';
    if (!busts && g.player.length === 2 && g.canDouble() && after >= 19 && cur <= 11) return 'double';
    if (!busts && (after > cur || (g.has('charlie') && g.player.length === 4))) return 'hit';
    return 'stand';
  }
  // Ojo del Crupier: ves la carta tapada.
  if (g.has('ojo')) {
    const dv = Cards.handValue(g.dealer).total;
    if (dv >= 17) return cur > dv ? 'stand' : (cur === 21 ? 'stand' : 'hit');
    if (dv >= 12) return cur >= 12 ? (g.player.length === 2 && cur <= 11 && g.canDouble() ? 'double' : 'stand') : 'hit';
  }
  // Charlie: con 4 cartas pedí si no es muy arriesgado.
  if (g.has('charlie') && g.player.length === 4 && g.bustChance() < 0.55) return 'hit';
  // Segunda Oportunidad: podés arriesgar un poco más (si te pasás, descartás).
  if (g.has('segunda') && !g.discardUsed && cur <= 16) return 'hit';
  return basic(g);
}

function playBJHand(g) {
  let guard = 0;
  while (g.phase === 'playing' && guard++ < 50) {
    const a = bjDecide(g);
    if (a === 'split' && g.canSplit()) g.split();
    else if (a === 'double' && g.canDouble()) g.double();
    else if (a === 'discard') g.discard();
    else if (a === 'hit' && g.canHit()) g.hit();
    else g.stand();
  }
}

// ---------- Políticas de apuesta ----------
// speed: all-in hasta la cuota, después pasa de ciclo (speedrun).
// smart: apuesta para alcanzar la cuota con las manos que quedan; cumplida, farmea con la mínima.
// min: siempre la apuesta mínima.
function betAmount(g, policy) {
  const money = Math.min(Math.floor(g.money), g.maxBet);
  const min = g.minBet;
  if (money < min) return null;
  if (policy === 'speed') return money;
  if (policy === 'pro') return g.money >= g.quota ? min : money; // máximo hasta la cuota, después la mínima
  if (policy === 'min') return min;
  const need = g.quota - g.money;
  if (need <= 0) return min;
  const left = Math.max(1, 15 - g.handInCycle + 1);
  const want = Math.ceil(need / Math.max(1, left / 2.5));
  return Math.max(min, Math.min(money, want));
}

// ---------- Tienda: mejoras y Mazo Dorado (nunca bonuses: 1 solo bonus por partida) ----------
function shopPolicy(g, policy, stats) {
  if (g.shop.kind === 'start') { g.leaveShop(); return; }
  // Mazo Dorado: si aparece y alcanza, se compra.
  const offer = () => g.shop.deckOffer;
  if (offer()) {
    stats.goldOffered++;
    if (g.canBuyDeck()) { g.buyDeck(); stats.goldBought = stats.goldBought || []; stats.goldBought.push({ cycle: g.cycle, kind: g.shop.kind }); }
  }
  // Hacker: rerolls para buscar el mazo dorado mientras sobre plata.
  if (policy.reroll && g.deckType !== 'dorado') {
    let tries = 0;
    while (!g.shop.free && g.spendable() - g.shop.rerollCost >= g.deckPrice() && tries++ < 60) {
      g.reroll();
      if (g.shop.deckOffer) {
        stats.goldOffered++;
        if (g.canBuyDeck()) { g.buyDeck(); (stats.goldBought = stats.goldBought || []).push({ cycle: g.cycle, kind: g.shop.kind, reroll: true }); break; }
      }
    }
  }
  if (policy.upgrades && g.shop.allowUpgrades) {
    const keep = g.shop.midCycle ? g.quota * 1.05 : g.quotaFor(g.cycle + 1) * 0.55; // a mitad de ciclo no se toca la plata de la cuota
    const order = policy.upgradeOrder || ['ganancia', 'seguro', 'suerte'];
    let bought = true;
    while (bought) {
      bought = false;
      for (const id of order) {
        if (g.canUpgrade(id) && g.money - g.upgradeCost(id) >= keep) { g.upgrade(id); bought = true; }
      }
    }
  }
  g.leaveShop();
}

// ---------- Una partida de blackjack ----------
function runBJ({ mode, bonus, policy, maxCycles = 40 }) {
  const g = new Game({ mode, startingPick: false });
  if (bonus) { g.bonuses.push(bonus); g.newDeck(); }
  const stats = { goldOffered: 0, goldBought: null, money: [] };
  let steps = 0;
  while (!['gameover', 'victory'].includes(g.phase) && steps++ < 200000) {
    if (g.cycle > maxCycles) break;
    if (g.phase === 'betting') {
      if ((policy.bet === 'speed' || policy.bet === 'pro') && g.canAdvance()) { g.advanceCycle(); continue; }
      if (policy.bet === 'smart' && g.canAdvance() && g.mode === 'story' && policy.advance) { g.advanceCycle(); continue; }
      const b = betAmount(g, policy.bet);
      if (b === null) { throw new Error('trabado: dinero ' + g.money + ' < mínima ' + g.minBet + ' ciclo ' + g.cycle); }
      g.deal(b);
      if (g.phase === 'playing') playBJHand(g);
    } else if (g.phase === 'roundOver') g.nextHand();
    else if (g.phase === 'shop') shopPolicy(g, policy, stats);
    else if (g.phase === 'deckLost') g.continueWithNextDeck();
    else throw new Error('fase rara ' + g.phase);
    if (!Number.isFinite(g.money) || g.money < 0) throw new Error('dinero inválido ' + g.money);
  }
  return { won: g.phase === 'victory', cycles: g.maxCleared, hands: g.handsPlayed, ending: g.ending, decksLost: g.deckIndex,
    best: g.bestMoney, fractional: g.money % 1 !== 0, ...stats };
}

// ---------- Truco ----------
const PLAYER = { bluff: 0.15, aggression: 0.65 };
function runTruco({ mode, bonus, policy, maxCycles = 40 }) {
  const g = new TrucoRun({ mode, startingPick: false, lives: process.env.LIVES || 'sudden', difficulty: process.env.DIFF || 'facil', story: process.env.STORY || 'pampa' });
  if (bonus) g.bonuses.push(bonus);
  const stats = { goldOffered: 0, goldBought: null };
  let steps = 0;
  while (!['gameover', 'victory'].includes(g.phase) && steps++ < 100000) {
    if (g.cycle > maxCycles) break;
    if (g.phase === 'betting') {
      if ((policy.bet === 'speed' || policy.bet === 'pro') && g.canAdvance()) { g.advanceCycle(); continue; }
      if (policy.bet === 'smart' && g.canAdvance() && g.mode === 'story' && policy.advance) { g.advanceCycle(); continue; }
      const b = betAmount(g, policy.bet);
      if (b === null) throw new Error('truco trabado: dinero ' + g.money + ' ciclo ' + g.cycle);
      const h = g.deal(b);
      let k = 0;
      while (!h.finished && k++ < 200) h.act(h.actor, TrucoAI.decide(h, h.actor, h.actor === 1 ? g.persona : PLAYER));
      g.learnFrom(h);
      const before = g.money;
      g.settleHand();
      // ¿Alcanzó una sola mano para pasar la cuota? (ganancia de la mano >= lo que faltaba al empezar el ciclo)
      if (stats.cyc !== g.cycle) { stats.cyc = g.cycle; stats.cycStart = before; stats.cycMax = 0; stats.counted = false; }
      stats.cycMax = Math.max(stats.cycMax, g.money - before);
      if (!stats.counted && g.money >= g.quota) { stats.counted = true; stats.reach = (stats.reach || 0) + 1; if (stats.cycMax >= g.quota - stats.cycStart) stats.oneHand = (stats.oneHand || 0) + 1; }
    } else if (g.phase === 'roundOver') g.nextHand();
    else if (g.phase === 'shop') shopPolicy(g, policy, stats);
    else if (g.phase === 'deckLost') g.continueWithNextDeck();
    if (!Number.isFinite(g.money) || g.money < 0) throw new Error('dinero inválido ' + g.money);
  }
  return { won: g.phase === 'victory', cycles: g.maxCleared, hands: g.handsPlayed, ending: g.ending, decksLost: g.deckIndex,
    best: g.bestMoney, fractional: g.money % 1 !== 0, ...stats };
}

function summarize(results) {
  const n = results.length;
  const cyc = results.map((r) => r.cycles).sort((a, b) => a - b);
  const wins = results.filter((r) => r.won);
  const hands = wins.map((r) => r.hands).sort((a, b) => a - b);
  const gold = results.filter((r) => r.goldBought);
  const goldCycles = {};
  for (const r of gold) for (const b of r.goldBought) goldCycles[b.cycle] = (goldCycles[b.cycle] || 0) + 1;
  return {
    n,
    winRate: +(100 * wins.length / n).toFixed(1),
    medianHandsToWin: hands.length ? hands[Math.floor(hands.length / 2)] : null,
    minHandsToWin: hands.length ? hands[0] : null,
    meanCycles: +(cyc.reduce((s, x) => s + x, 0) / n).toFixed(2),
    medianCycles: cyc[Math.floor(n / 2)],
    p90Cycles: cyc[Math.floor(n * 0.9)],
    maxCycles: cyc[n - 1],
    goldRuns: gold.length,
    goldCycles,
    goldOffered: results.reduce((s, r) => s + r.goldOffered, 0),
    fractional: results.filter((r) => r.fractional).length,
  };
}

module.exports = { TrucoRun, runBJ, runTruco, summarize, Bonuses, TrucoBonuses, Decks, playBJHand };
