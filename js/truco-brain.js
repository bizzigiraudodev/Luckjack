// Cerebro del truco para el modo difícil (mano a mano). En vez de reglas fijas:
// 1) Envido con probabilidades exactas: recorre todas las manos posibles del rival que encajan con
//    lo que ya se vio (cartas jugadas y el envido que cantó) y calcula la chance de ganar.
// 2) Fuerza de la mano por baza: para cada combinación posible de cartas del rival, juega el resto de
//    las bazas de la mejor forma para los dos (tres bazas, como mucho 36 finales) y promedia.
//    Con eso sabe qué chance tiene de ganar la mano y qué carta conviene tirar en 1ra, 2da y 3ra.
// 3) Decide por valor esperado: canta, quiere, sube o se va según lo que gana o pierde en puntos.
//    Además "lee" al rival: si cantó, las manos fuertes del rival pesan más.
// 4) Perfil del rival (ideas de TrucoAnalytics, del IAAR): mide tu índice de mentira (cantos con cartas
//    malas / cantos) y tu índice de agresión (cantos / manos). Si mentís seguido, te cree menos.
// Los umbrales (PARAMS) se probaron con autojuego: una búsqueda por coordenadas contra una mezcla de
// rivales (la IA de siempre con varias personalidades y el propio cerebro). Los cambios que encontró no
// mejoraban en una prueba más larga (2.500 manos), así que quedaron estos.
(function (root) {
  const Truco = root.Truco || (typeof require !== 'undefined' && require('./truco.js'));
  const { rank, envidoOf, SUITS, NUMBERS } = Truco;

  const ALL = [];
  for (const s of SUITS) for (const n of NUMBERS) ALL.push({ n, s });
  const key = (c) => `${c.n}_${c.s}`;

  // Umbrales (ver el comentario de arriba y test/truco-brain.test.js).
  const PARAMS = {
    trucoCall: 0.62, // chance de ganar la mano para cantar truco
    trucoRaise: 0.78, // ...para subir (retruco / vale cuatro)
    envidoCall: 0.6, // chance de ganar el envido para cantarlo
    realCall: 0.78,
    faltaCall: 0.9,
    readWeight: 1.6, // cuánto le cree a los cantos del rival
    samples: 350, // combinaciones del rival que simula para el truco
  };

  const has = (acts, type) => acts.some((a) => a.type === type);

  // Combinaciones de k cartas de `pool` (todas si son pocas; si no, una muestra al azar).
  function combos(pool, k, limit, rng) {
    const out = [];
    const n = pool.length;
    if (k === 0) return [[]];
    const total = k === 1 ? n : k === 2 ? (n * (n - 1)) / 2 : (n * (n - 1) * (n - 2)) / 6;
    if (total <= limit) {
      if (k === 1) for (let a = 0; a < n; a++) out.push([pool[a]]);
      else if (k === 2) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) out.push([pool[a], pool[b]]);
      else for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) out.push([pool[a], pool[b], pool[c]]);
      return out;
    }
    for (let i = 0; i < limit; i++) {
      const pick = new Set();
      while (pick.size < k) pick.add(Math.floor(rng() * n));
      out.push([...pick].map((j) => pool[j]));
    }
    return out;
  }

  // Lo que sabe el jugador p: sus cartas, las jugadas en la mesa y el envido que cantó el rival.
  function knowledge(hand, p) {
    const q = 1 - p;
    const seen = new Set([...hand.dealt[p], ...hand.table[q]].map(key));
    const pool = ALL.filter((c) => !seen.has(key(c)));
    const known = hand.table[q].slice();
    const missing = 3 - known.length;
    const env = hand.envido.done && hand.envido.accepted && hand.envido.values ? hand.envido.values[q] : null;
    const bonusQ = (hand.envidoBonus && hand.envidoBonus[q]) || 0;
    return { q, pool, known, missing, env, bonusQ };
  }

  // --- Perfil del rival (lo que aprende de vos mano a mano) ---
  const TRUCO_RE = /Truco|Retruco|Vale/;
  const ENVIDO_RE = /envido|Envido/;
  function newProfile() {
    return { hands: 0, truco: { calls: 0, seen: 0, lies: 0 }, envido: { calls: 0, seen: 0, lies: 0 } };
  }
  // Índice de mentira con un previo de 1 mentira cada 4 cantos (para no sacar conclusiones con 2 manos).
  const lieIndex = (k) => (k.lies + 1) / (k.seen + 4);
  const aggressionIndex = (prof) => (prof.truco.calls + prof.envido.calls + 1) / (prof.hands + 4);
  // Cuánto le cree a tus cantos: 1 = normal, menos si mentís seguido, más si sos de cantar solo con buenas.
  const trust = (k) => Math.min(1.6, Math.max(0.15, 1 - 2.4 * (lieIndex(k) - 0.25)));

  // Al final de cada mano mira lo que mostraste: las cartas que tiraste y el envido que dijiste.
  function learn(prof, hand, q) {
    if (!prof) return;
    prof.hands++;
    const calls = hand.events.filter((e) => e.type === 'call' && e.who === q).map((e) => e.text);
    if (calls.some((t) => TRUCO_RE.test(t))) {
      prof.truco.calls++;
      const shown = hand.table[q];
      if (shown.length >= 2) {
        prof.truco.seen++;
        if (Math.max(...shown.map(rank)) < 8) prof.truco.lies++; // ni un 2 ni nada mejor
      }
    }
    if (calls.some((t) => ENVIDO_RE.test(t))) {
      prof.envido.calls++;
      if (hand.envido.accepted && hand.envido.values) {
        prof.envido.seen++;
        if (hand.envido.values[q] < 25) prof.envido.lies++;
      }
    }
  }

  let read = null; // el perfil del rival en la decisión actual

  // Si el rival cantó, sus manos fuertes son más probables (menos si sabe que mentís).
  function readWeights(hand, p, rivalDealt) {
    const q = 1 - p;
    const calls = hand.events.filter((e) => e.type === 'call' && e.who === q).map((e) => e.text);
    if (!calls.length) return 1;
    let w = 1;
    const ranks = rivalDealt.map((c) => rank(c)).sort((a, b) => b - a);
    const tT = read ? trust(read.truco) : 1;
    const tE = read ? trust(read.envido) : 1;
    if (calls.some((t) => TRUCO_RE.test(t))) w *= 1 + tT * PARAMS.readWeight * ((ranks[0] + ranks[1]) / 27 - 0.45);
    if (calls.some((t) => ENVIDO_RE.test(t))) w *= 1 + tE * PARAMS.readWeight * ((envidoOf(rivalDealt) - 22) / 12);
    w = Math.max(0.15, w);
    // Te cantó truco después de ver mi carta en esta baza: casi seguro tiene con qué ganarla.
    // Las manos que no le ganan pesan lo que miente ese rival (1 de cada 4 hasta conocerlo).
    const i = hand.bazas.length;
    const pend = hand.pending;
    if (pend && pend.kind === 'truco' && pend.caller === q && hand.table[p].length > i && hand.table[q].length === i) {
      const mineNow = hand.rankOf(hand.table[p][i], p);
      const left = rivalDealt.slice(hand.table[q].length);
      if (!left.some((card) => hand.rankOf(card, q) > mineNow)) w *= read ? lieIndex(read.truco) : 0.25;
    }
    return w;
  }

  // --- Envido: chance exacta de ganarlo ---
  function envidoWinProb(hand, p, rng = Math.random) {
    const k = knowledge(hand, p);
    const mine = hand.envidoValueOf(p);
    const pIsMano = hand.mano === p; // en el empate gana el más cerca de la mano
    let win = 0;
    let total = 0;
    for (const rest of combos(k.pool, k.missing, 8000, rng)) {
      const rival = [...k.known, ...rest];
      const theirs = envidoOf(rival) + k.bonusQ;
      const w = readWeights(hand, p, rival);
      total += w;
      if (mine > theirs || (mine === theirs && pIsMano)) win += w;
    }
    return total ? win / total : 0.5;
  }

  // --- Truco: chance de ganar la mano jugando lo que queda de la mejor forma ---
  // Estado mínimo de la mano para simular: cartas que quedan, bazas y la baza en curso.
  function outcome(bazas, mano) {
    return Truco.handWinner ? Truco.handWinner(bazas, mano) : null;
  }

  function solve(st, p, rankOf) {
    const w = outcome(st.bazas, st.mano);
    if (w !== null) return w === p ? 1 : 0;
    const me = st.turn === p;
    const cards = me ? st.mine : st.his;
    if (!cards.length) return 0.5;
    let best = me ? -1 : 2;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const next = { ...st, mine: st.mine, his: st.his, bazas: st.bazas };
      if (me) next.mine = cards.filter((_, j) => j !== i);
      else next.his = cards.filter((_, j) => j !== i);
      const cur = { ...st.cur, [st.turn]: card };
      const other = 1 - st.turn;
      if (cur[other]) {
        // Se cierra la baza
        const ra = rankOf(cur[p], p);
        const rb = rankOf(cur[1 - p], 1 - p);
        const res = ra > rb ? p : rb > ra ? 1 - p : 'parda';
        next.bazas = [...st.bazas, res];
        next.cur = {};
        next.turn = res === 'parda' ? st.mano : res;
      } else {
        next.cur = cur;
        next.turn = other;
      }
      const v = solve(next, p, rankOf);
      if (me ? v > best : v < best) best = v;
      if (me && best === 1) break;
      if (!me && best === 0) break;
    }
    return best;
  }

  // Devuelve { win, byCard }: chance de ganar la mano y, si me toca jugar, la chance tirando cada carta.
  function trucoWinProb(hand, p, rng = Math.random) {
    const k = knowledge(hand, p);
    const i = hand.bazas.length;
    const q = k.q;
    const rankOf = (c, who) => hand.rankOf(c, who);
    const mine = hand.cards[p].slice();
    const curCards = {};
    if (hand.table[p].length > i) curCards[p] = hand.table[p][i];
    if (hand.table[q].length > i) curCards[q] = hand.table[q][i];
    const myTurn = hand.turn === p && !hand.pending;
    const byCard = mine.map(() => 0);
    let win = 0;
    let total = 0;
    for (const rest of combos(k.pool, k.missing, PARAMS.samples, rng)) {
      const rivalDealt = [...k.known, ...rest];
      const w = readWeights(hand, p, rivalDealt);
      const his = rest.slice(); // las que le quedan en la mano
      const base = { mine, his, bazas: hand.bazas.slice(), cur: curCards, turn: hand.turn, mano: hand.mano };
      if (hand.pending) base.turn = hand.turn;
      if (myTurn) {
        let bestV = 0;
        mine.forEach((card, j) => {
          const st = { ...base, mine: mine.filter((_, x) => x !== j) };
          const cur = { ...curCards, [p]: card };
          let next;
          if (cur[q]) {
            const ra = rankOf(card, p);
            const rb = rankOf(cur[q], q);
            const res = ra > rb ? p : rb > ra ? q : 'parda';
            next = { ...st, bazas: [...st.bazas, res], cur: {}, turn: res === 'parda' ? hand.mano : res };
          } else {
            next = { ...st, cur, turn: q };
          }
          const v = solve(next, p, rankOf);
          byCard[j] += w * v;
          if (v > bestV) bestV = v;
        });
        win += w * bestV;
      } else {
        win += w * solve(base, p, rankOf);
      }
      total += w;
    }
    return { win: total ? win / total : 0.5, byCard: byCard.map((v) => (total ? v / total : 0)) };
  }

  // Elige la carta: la que más chance da; si empatan, la más baja (se guardan las buenas).
  function chooseCard(hand, p, rng) {
    const { byCard } = trucoWinProb(hand, p, rng);
    let best = 0;
    byCard.forEach((v, j) => {
      const better = v > byCard[best] + 0.01;
      const tieLower = Math.abs(v - byCard[best]) <= 0.01 && rank(hand.cards[p][j]) < rank(hand.cards[p][best]);
      if (better || tieLower) best = j;
    });
    return best;
  }

  const TRUCO_POINTS = [1, 2, 3, 4];

  function decide(hand, p, persona = {}, rng = Math.random) {
    const acts = hand.actions(p);
    if (!acts.length) return null;
    read = persona.read || null;
    const pend = hand.pending;
    // Contra un rival muy agresivo conviene aguantar más (sus cantos valen menos).
    const opp = read ? Math.min(0.15, Math.max(-0.1, (aggressionIndex(read) - 0.35) * 0.4)) : 0;
    const aggro = (persona.aggression ?? 0.5) - 0.5 + opp; // ±0.5
    // Bonuses del jugador: Chamuyo y Mentiroso hacen que el rival quiera menos.
    const tNeed = (persona.trucoNeed || 0) * 0.04;
    const eNeed = (persona.envidoNeed || 0) * 0.04;
    // Sin cartas en la mano no hay farol posible: el rival ya ve todo lo que tengo.
    const bluff = () => hand.cards[p].length > 0 && rng() < (persona.bluff ?? 0.15);

    // --- Respuestas al envido ---
    if (pend && pend.kind === 'envido') {
      const pw = envidoWinProb(hand, p, rng) - eNeed;
      const chain = pend.chain;
      const wantVal = chain.includes('falta') ? hand.faltaPoints(p) : chain.reduce((s, c) => s + (c === 'real' ? 3 : 2), 0);
      const noVal = chain.slice(0, -1).reduce((s, c) => s + (c === 'real' ? 3 : 2), 0) + 1;
      if (pw > PARAMS.faltaCall && has(acts, 'falta') && !chain.includes('falta')) return { type: 'falta' };
      if (pw > PARAMS.realCall && has(acts, 'real')) return { type: 'real' };
      if (pw > PARAMS.envidoCall + 0.12 && has(acts, 'envido')) return { type: 'envido' };
      const evQuiero = pw * wantVal - (1 - pw) * wantVal;
      if (pw < 0.001) return { type: 'noquiero' }; // envido perdido seguro (ya se vio todo)
      // Querer no es mentir: el farol es para cantar o subir, no para aceptar algo que conviene rechazar.
      return { type: evQuiero > -noVal + aggro ? 'quiero' : 'noquiero' };
    }

    // --- Respuestas al truco ---
    if (pend && pend.kind === 'truco') {
      // El envido está primero: si conviene, se canta antes de responder.
      if (has(acts, 'envido')) {
        const pe = envidoWinProb(hand, p, rng);
        if (pe > PARAMS.envidoCall) return { type: pe > PARAMS.realCall ? 'real' : 'envido' };
      }
      const pw = trucoWinProb(hand, p, rng).win - tNeed;
      const lv = pend.level;
      // Con la mano ganada sí o sí: sube o quiere. Con la mano perdida sí o sí: no quiere.
      if (pw + tNeed > 0.999) return { type: has(acts, 'truco') ? 'truco' : 'quiero' };
      if (pw + tNeed < 0.001) return { type: 'noquiero' };
      const evQuiero = pw * TRUCO_POINTS[lv] - (1 - pw) * TRUCO_POINTS[lv];
      if (has(acts, 'truco') && (pw > PARAMS.trucoRaise - aggro * 0.1 || (bluff() && rng() < 0.3))) return { type: 'truco' };
      return { type: evQuiero > -TRUCO_POINTS[lv - 1] + aggro * 0.5 ? 'quiero' : 'noquiero' };
    }

    // --- Mi turno: cantar algo o jugar ---
    if (has(acts, 'envido')) {
      const pe = envidoWinProb(hand, p, rng);
      if (pe > PARAMS.faltaCall + 0.04 && rng() < 0.3 + aggro) return { type: 'falta' };
      if (pe > PARAMS.realCall && rng() < 0.6) return { type: 'real' };
      if (pe > PARAMS.envidoCall) return { type: 'envido' };
      if (pe < 0.25 && bluff() && rng() < 0.4) return { type: 'envido' };
    }
    if (has(acts, 'truco') && hand.aiAskedAt !== hand.truco.level) {
      const pw = trucoWinProb(hand, p, rng).win;
      const need = hand.truco.level === 0 ? PARAMS.trucoCall : PARAMS.trucoRaise;
      if (pw > need - aggro * 0.1 || (pw < 0.35 && bluff() && rng() < 0.35)) {
        hand.aiAskedAt = hand.truco.level;
        return { type: 'truco' };
      }
    }
    return { type: 'play', index: chooseCard(hand, p, rng) };
  }

  const TrucoBrain = { decide, envidoWinProb, trucoWinProb, chooseCard, newProfile, learn, lieIndex, aggressionIndex, PARAMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = TrucoBrain;
  else root.TrucoBrain = TrucoBrain;
})(typeof window !== 'undefined' ? window : globalThis);
