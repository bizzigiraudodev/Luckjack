// Interfaz del truco: reparte, muestra las bazas y los cantos, y hace jugar al rival.
(function (root) {
  const $ = (id) => document.getElementById(id);
  const { TrucoMatch, TRUCO_NAMES, envidoOf } = Truco;
  const { animate, offset, flyFrom, wait } = Table.anim;
  const RECORD_KEY = 'luckjack.trucoClassic';
  const TARGET = 15;

  const RIVALS = {
    gaucho: {
      id: 'gaucho',
      name: 'el Viejo',
      Name: 'El Viejo',
      persona: TrucoAI.PERSONAS.gaucho,
      winHand: ['¡Aura sí!', 'Esa es mía, chamigo.', 'Gracias por los porotos.', 'Así se juega, m\'hijo.'],
      loseHand: ['Ah, la pucha...', 'Bien jugado, m\'hijo.', 'Tuviste suerte, nomás.', 'Me agarraste dormido.'],
      goodEnvido: 'Son buenas.',
      music: 'gaucho',
    },
    diablo: {
      id: 'diablo',
      name: 'el Diablo',
      Name: 'El Diablo',
      persona: TrucoAI.PERSONAS.diablo,
      winHand: ['Je, je, je...', '¿Te creíste que tenía algo? ¡Tenía!', 'Otro porotito para el infierno.', 'La casa siempre gana.'],
      loseHand: ['¡Maldición!', 'Esa no te la perdono.', 'Grrr... suerte de principiante.', 'Ya vas a ver la próxima.'],
      goodEnvido: 'Ssson buenas...',
      music: 'diablo',
      print: ['TRUCO EN EL INFIERNO', 'LAS PARDAS SON DEL DIABLO'],
    },
    santo: {
      id: 'santo',
      name: 'San Pedro',
      Name: 'San Pedro',
      persona: TrucoAI.PERSONAS.santo,
      winHand: ['La verdad siempre gana.', 'Bendita mano.', 'Te lo dije: tenía.', 'Paz y bien, hijo.'],
      loseHand: ['Bien jugado, hijo.', 'Que Dios te lo premie.', 'Merecido, merecido.', 'Así se juega, sin mentir.'],
      goodEnvido: 'Son buenas, hijo.',
      music: 'santo',
      print: ['TRUCO EN EL CIELO', 'ACÁ NADIE MIENTE'],
    },
  };
  // Historia del truco en la pampa
  const pampa = (id, name, persona, music, print, winHand, loseHand, goodEnvido) => ({
    id, name, Name: name[0].toUpperCase() + name.slice(1), persona: TrucoAI.PERSONAS[persona], music, print, winHand, loseHand, goodEnvido,
  });
  Object.assign(RIVALS, {
    luzmala: pampa('luzmala', 'la Luz Mala', 'luzmala', 'triste', ['LA LUZ MALA', 'TE MUESTRA UNA CARTA · TE BAJA LA SUERTE'],
      ['Ji, ji... seguime.', 'Te encandilé, ¿eh?', 'Mi luz nunca falla.'], ['Ay, me apagaste un poquito.', 'Bien jugado, para ser vivo.'], 'Son buenas... por ahora.'),
    silbon: pampa('silbon', 'el Silbón', 'silbon', 'diablo', ['EL SILBÓN', 'CADA 4 MANOS SILBA CERCA: PERDÉS X1.5'],
      ['Fiuuu...', 'Otro hueso para la bolsa.', '¿Me escuchaste cerca?'], ['Fiu... me desafinaste.', 'Los huesos no mienten... esta vez sí.'], 'Fiuuu... son buenas.'),
    pombero: pampa('pombero', 'el Pombero', 'pombero', 'gaucho', ['EL POMBERO', 'TE ESCONDE UNA CARTA EN CADA MANO'],
      ['Ji, ji, ji...', '¿Buscabas algo?', 'Te la escondí bien, ¿eh?'], ['¡Fiu! Me encontraste.', 'Ya te la voy a hacer.'], 'Ji, ji... son buenas.'),
    familiar: pampa('familiar', 'el Familiar', 'familiar', 'diablo', ['EL FAMILIAR', 'CADA 5 MANOS SE COME EL 15% DE TUS FICHAS'],
      ['Grrr... un peón más.', 'El patrón va a estar contento.', 'Ñam.'], ['¡Grrr! Eso no estaba en el trato.', 'Hmm... duro de roer.'], 'Grrr, son buenas.'),
    gil: pampa('gil', 'el Gauchito Gil', 'gil', 'santo', ['EL GAUCHITO GIL', 'TRUCO HONRADO: ACÁ NO VALEN LAS MENTIRAS'],
      ['Jugada limpia, hermano.', 'La verdad siempre gana.', 'Así se juega.'], ['Bien ganada, hermano.', 'Que Dios te lo pague.'], 'Son buenas, hermano.'),
  });
  let RIVAL = RIVALS.gaucho;

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin storage */ } },
  };

  let match = null;
  let token = 0; // cambia al empezar o abandonar, para cortar el bucle anterior
  let waiter = null;
  let seen = 0; // eventos de la mano ya mostrados
  let currentMode = 'classic';
  let difficulty = 'facil'; // truco clásico: 'facil' o 'dificil' (el Viejo con el cerebro de js/truco-brain.js)
  let classicPersona = null;
  let playerName = 'Vos';
  const els = new Map(); // carta → elemento en la mano

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const nameOf = (p) => (p === 0 ? 'Vos' : RIVAL.Name);

  function cardEl(card, faceDown = false) {
    const el = document.createElement('div');
    el.className = 'card spanish';
    if (faceDown) {
      el.classList.add('back');
      return el;
    }
    el.style.color = Pixel.SPANISH_COLORS[card.s];
    el.title = `${card.n} de ${card.s}`;
    el.innerHTML = `<span class="tl">${card.n}</span><span class="mid">${Pixel.spanishSuit(card.s)}</span><span class="br">${card.n}</span>`;
    return el;
  }

  function log(text) {
    const li = document.createElement('li');
    li.textContent = text;
    $('log').prepend(li);
    while ($('log').children.length > 30) $('log').lastChild.remove();
  }

  // --- Panel lateral y mesa ---
  function renderHud() {
    const body = document.body;
    body.dataset.game = 'truco';
    body.dataset.mode = 'classic';
    body.dataset.boss = RIVAL.id;
    const [me, rival] = match.scores;
    $('cycle').parentElement.innerHTML = `TRUCO <b id="cycle">A ${TARGET}</b>`;
    $('quota-label').textContent = `Vos – ${RIVAL.Name}${classicPersona && !run ? ' 😈' : ''}`;
    $('quota').textContent = `${me} – ${rival}`;
    $('quota').className = me >= rival ? 'ok' : 'warn';
    $('hand-label').textContent = 'Mano';
    $('hand').textContent = match.handNumber;
    $('minbet-label').textContent = 'Es mano';
    $('minbet').textContent = match.hand ? nameOf(match.hand.mano) : '–';
    $('story-timer').hidden = true;
  }

  function buildBoard() {
    $('tr-board').innerHTML = [0, 1, 2].map((i) =>
      `<div class="tr-baza" data-i="${i}"><div class="slot rival"></div><span class="mark"></span><div class="slot me"></div></div>`).join('');
    $('tr-rival').replaceChildren();
    $('tr-mine').replaceChildren();
    els.clear();
  }

  // `hide`: índice de una de tus cartas que queda boca abajo (el Pombero te la esconde).
  async function deal(hand, t, hide) {
    buildBoard();
    // Reparte el que no es mano, y el mazo se pone a su derecha (ver css: .table[data-dealer]).
    $('table').dataset.dealer = hand.mano === 0 ? 'rival' : 'me';
    const order = hand.mano === 0 ? [0, 1] : [1, 0];
    for (let i = 0; i < 3; i++) {
      for (const p of order) {
        if (t !== token) return;
        const card = hand.dealt[p][i];
        const el = cardEl(card, p === 1 || (p === 0 && i === hide));
        els.set(card, el);
        $(p === 0 ? 'tr-mine' : 'tr-rival').appendChild(el);
        Sound.sfx('card');
        await flyFrom(el, $('shoe'));
      }
    }
  }

  function message(text) {
    $('message').className = 'message';
    $('message').textContent = text;
  }

  // Ayudas: tu envido mientras se puede cantar, y lo que vale la mano.
  function renderIntel(hand, opts = {}) {
    const parts = [];
    const envidoOpen = !hand.envido.done && hand.bazas.length === 0 &&
      (hand.truco.level === 0 || (hand.pending && hand.pending.kind === 'envido'));
    // Con el Pombero no sabés una de tus cartas: tampoco tu envido.
    if (envidoOpen) parts.push(opts.hide !== undefined ? 'Tu envido: <b>?</b>' : `Tu envido: <b>${hand.envidoValueOf(0)}</b>`);
    if (envidoOpen && opts.rivalEnvido) parts.push(`🔖 Envido de ${RIVAL.name}: <b>${envidoOf(hand.dealt[1])}</b>`);
    if (hand.truco.level) parts.push(`${TRUCO_NAMES[hand.truco.level]} querido`);
    $('intel').innerHTML = parts.join(' · ');
  }

  function describe(hand) {
    const pend = hand.pending;
    if (pend && pend.caller === 1) {
      const what = pend.kind === 'truco' ? TRUCO_NAMES[pend.level] : pend.chain.map((c) => Truco.ENVIDO_NAMES[c]).join(' + ');
      return `${RIVAL.Name} cantó ${what}. ¿Qué respondés?`;
    }
    if (hand.actor === 0) return 'Te toca. Jugá una carta o cantá.';
    return `${RIVAL.Name} está pensando...`;
  }

  // --- Turno del jugador ---
  const LABELS = {
    quiero: ['¡Quiero!', 'btn-green'],
    noquiero: ['No quiero', 'btn-red'],
    envido: ['¡Envido!', 'btn-blue'],
    real: ['¡Real envido!', 'btn-blue'],
    falta: ['¡Falta envido!', 'btn-purple'],
    mazo: ['Irse al mazo', ''],
  };

  function trucoLabel(hand) {
    const next = hand.pending && hand.pending.kind === 'truco' ? hand.pending.level + 1 : hand.truco.level + 1;
    return `¡${TRUCO_NAMES[next]}!`;
  }

  function waitHuman(hand) {
    return new Promise((resolve) => {
      waiter = resolve;
      const choose = (action) => {
        if (waiter !== resolve) return;
        waiter = null;
        $('truco-controls').replaceChildren();
        $('tr-mine').querySelectorAll('.card').forEach((c) => c.classList.remove('playable'));
        resolve(action);
      };
      const acts = hand.actions(0);
      const buttons = acts.filter((a) => a.type !== 'play').map((a) => {
        const btn = document.createElement('button');
        const [label, cls] = a.type === 'truco' ? [trucoLabel(hand), 'btn-orange'] : LABELS[a.type];
        btn.textContent = label;
        if (cls) btn.className = cls;
        btn.onclick = () => choose(a);
        return btn;
      });
      $('truco-controls').replaceChildren(...buttons);
      $('tr-mine').scrollIntoView({ block: 'nearest' }); // tu mano a la vista, por encima de los botones
      // Las cartas se juegan tocándolas.
      if (acts.some((a) => a.type === 'play')) {
        hand.cards[0].forEach((card) => {
          const el = els.get(card);
          el.classList.add('playable');
          el.onclick = () => {
            const index = hand.cards[0].indexOf(card);
            if (index >= 0) choose({ type: 'play', index });
          };
        });
      }
    });
  }

  // --- Mostrar lo que pasó (cantos, cartas, bazas, envido) ---
  async function animatePlay(hand, e, t) {
    const old = els.get(e.card);
    const from = old ? old.getBoundingClientRect() : $('shoe').getBoundingClientRect();
    if (old) old.remove();
    const i = hand.table[e.who].indexOf(e.card);
    const slot = $('tr-board').querySelector(`.tr-baza[data-i="${i}"] .slot.${e.who === 0 ? 'me' : 'rival'}`);
    const el = cardEl(e.card);
    slot.replaceChildren(el);
    Sound.sfx('card');
    if (t !== token) return;
    const { dx, dy } = offset(el, from);
    await animate(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], 320);
  }

  async function showEvents(hand, t) {
    while (seen < hand.events.length && t === token) {
      const e = hand.events[seen++];
      if (e.type === 'call' || e.type === 'response') {
        Sound.sfx(e.type === 'call' ? 'shop' : 'click');
        if (e.who === 1) Table.setSpeech(e.text);
        else message(`Vos: ${e.text}`);
        log(`${e.who === 0 ? 'Vos' : RIVAL.Name}: ${e.text}`);
        await wait(e.who === 1 ? 800 : 350);
      } else if (e.type === 'play') {
        await animatePlay(hand, e, t);
      } else if (e.type === 'baza') {
        const mark = $('tr-board').querySelector(`.tr-baza[data-i="${e.index}"] .mark`);
        mark.textContent = e.result === 'parda' ? '=' : e.result === 0 ? '✔' : '✖';
        mark.className = `mark ${e.result === 'parda' ? 'parda' : e.result === 0 ? 'won' : 'lost'}`;
        await wait(300);
      } else if (e.type === 'envido') {
        let text;
        if (e.accepted) {
          const [mine, his] = e.values;
          Table.setSpeech(e.winner === 1 ? `Tengo ${his}.` : RIVAL.goodEnvido);
          text = `Envido: vos ${mine}, ${RIVAL.name} ${his} → ${nameOf(e.winner)} +${e.points}`;
        } else {
          text = `Envido no querido → ${nameOf(e.winner)} +${e.points}`;
        }
        $('intel').textContent = text;
        log(text);
        Sound.sfx(e.winner === 0 ? 'coin' : 'push');
        await wait(1400);
      } else if (e.type === 'flor') {
        const text = `🌼 ¡Flor! ${nameOf(e.who)} +${e.points}`;
        message(text);
        log(text);
        Sound.sfx('coin');
        await wait(1200);
      } else if (e.type === 'mazo') {
        if (e.who === 1) Table.setSpeech('Me voy al mazo.');
        log(`${nameOf(e.who)} se fue al mazo.`);
        await wait(500);
      }
    }
  }

  async function flipRival(card) {
    const el = els.get(card);
    if (!el || !el.classList.contains('back')) return;
    await animate(el, [{ transform: 'none' }, { transform: 'rotateY(90deg)' }], 120, { fill: 'forwards' });
    const face = cardEl(card);
    el.replaceWith(face);
    els.set(card, face);
    await animate(face, [{ transform: 'rotateY(90deg)' }, { transform: 'none' }], 120);
  }

  // Al terminar la mano se dan vuelta las cartas que le quedaban al rival.
  async function revealRival(hand) {
    for (const card of hand.cards[1]) await flipRival(card);
  }

  function waitButton(label, cls = 'btn-orange big') {
    return new Promise((resolve) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = cls;
      waiter = () => resolve(false);
      btn.onclick = () => { waiter = null; $('truco-controls').replaceChildren(); resolve(true); };
      $('truco-controls').replaceChildren(btn);
    });
  }

  // --- Una mano: repartir, turnos, cantos y al final dar vuelta las cartas del rival ---
  // `opts.reveal`: índice de una carta del rival que se ve (bonus Ojo de Halcón).
  // `opts.rivalEnvido`: mostrar el envido del rival (bonus Mazo Marcado).
  async function playHand(hand, t, persona, opts = {}) {
    seen = 0;
    Table.setSpeech(null);
    Table.setMood(null, false);
    $('intel').textContent = '';
    message(hand.mano === 0 ? 'Sos mano.' : `${RIVAL.Name} es mano.`);
    await deal(hand, t, opts.hide);
    if (opts.hide !== undefined) log('🌿 El Pombero te escondió una carta: la vas a ver cuando la tires.');
    if (opts.reveal !== undefined) await flipRival(hand.dealt[1][opts.reveal]);
    await showEvents(hand, t); // la flor se anuncia al repartir
    while (!hand.finished && t === token) {
      renderIntel(hand, opts);
      message(describe(hand));
      let action;
      if (hand.actor === 1) {
        await wait(650);
        action = TrucoAI.decide(hand, 1, persona);
      } else {
        action = await waitHuman(hand);
      }
      if (t !== token || !action) return false;
      if (hand.actor === 1 && action.type !== 'play') Table.setSpeech(null);
      hand.act(hand.actor, action);
      await showEvents(hand, t);
    }
    if (t !== token) return false;
    // Difícil: el rival anota cómo jugaste (si mentiste al cantar) para la próxima.
    if (persona && persona.read && window.TrucoBrain) TrucoBrain.learn(persona.read, hand, 0);
    await revealRival(hand);
    return true;
  }

  // --- Bucle de la partida clásica ---
  async function loop(t) {
    while (!match.over && t === token) {
      const hand = match.newHand();
      renderHud();
      if (!(await playHand(hand, t, classicPersona || RIVAL.persona))) return;
      match.settle();
      renderHud();
      const won = hand.winner === 0;
      const total = hand.points;
      const summary = `Mano para ${won ? 'vos' : RIVAL.name} (+${hand.trucoPoints})` +
        (hand.envido.points ? ` · envido para ${hand.envido.winner === 0 ? 'vos' : RIVAL.name} (+${hand.envido.points})` : '') +
        ` → ${total[0] ? `vos +${total[0]}` : ''}${total[0] && total[1] ? ', ' : ''}${total[1] ? `${RIVAL.name} +${total[1]}` : ''}`;
      message(summary);
      $('message').classList.add(total[0] > total[1] ? 'good' : total[0] < total[1] ? 'bad' : 'neutral');
      log(summary);
      Table.setSpeech(won ? pick(RIVAL.loseHand) : pick(RIVAL.winHand));
      Table.setMood(won ? 'sad' : 'happy', false);
      Sound.sfx(total[0] > total[1] ? 'win' : 'lose');
      if (match.over) break;
      const go = await waitButton('Siguiente mano');
      if (!go || t !== token) return;
    }
    if (t === token && match.over) endMatch();
  }

  function endMatch() {
    const won = match.winner === 0;
    const rec = store.get(RECORD_KEY) || { wins: 0, losses: 0 };
    if (won) rec.wins++;
    else rec.losses++;
    store.set(RECORD_KEY, rec);
    Sound.sfx(won ? 'victory' : 'deckLost');
    $('gameover-title').textContent = won ? '🏆 ¡Ganaste la partida!' : '💀 Perdiste la partida';
    $('gameover-reason').textContent = `Vos ${match.scores[0]} – ${match.scores[1]} ${RIVAL.Name}` +
      (won ? `. "Me ganaste bien, ${playerName}."` : '. "Otra vez será, m\'hijo."');
    $('gameover-stats').innerHTML = `Partidas ganadas: <b>${rec.wins}</b> · Perdidas: <b>${rec.losses}</b>`;
    $('gameover-ranks').hidden = true;
    $('btn-gameover-ranks').hidden = true;
    $('gameover').hidden = false;
  }

  // --- Truco infinito: la progresión la maneja ui.js (como en el blackjack); acá se juega cada mano ---
  let run = null;
  let runToken = null;

  function prepareRun(r, ctx = {}) {
    stop();
    run = r;
    runToken = token;
    playerName = (ctx.vars && ctx.vars.name) || 'Vos';
    document.body.dataset.game = 'truco';
    buildBoard();
    shownRival = null;
    syncRun(true);
  }

  // Pone en la mesa al rival del ciclo actual (en la historia cambia con cada jefe).
  let shownRival = null;
  function syncRun(withMusic) {
    if (!run) return;
    RIVAL = RIVALS[run.boss] || RIVALS.gaucho;
    if (shownRival !== RIVAL.id) {
      shownRival = RIVAL.id;
      Table.setDealer(RIVAL.id);
      if (window.setBackgroundTheme) window.setBackgroundTheme(RIVAL.id);
      const story = run.mode === 'story';
      const [big, small] = story && RIVAL.print ? RIVAL.print
        : [story ? 'TRUCO · HISTORIA' : 'TRUCO INFINITO', 'SE COBRA APUESTA × PUNTOS · LA FALTA VALE 5'];
      document.querySelector('.print-big textPath').textContent = big;
      document.querySelector('.print-small textPath').textContent = small;
    }
    if (withMusic) Sound.music(RIVAL.music);
  }

  // Juega la mano que acaba de repartir `run.deal()` y después llama a `onDone` (para que ui.js dibuje).
  let handRunning = false;
  async function playRunHand(onDone) {
    if (handRunning || !run || !run.truco) return;
    handRunning = true;
    const t = runToken;
    const hand = run.truco;
    const opts = {
      reveal: run.revealsRivalCard ? Math.floor(Math.random() * 3) : undefined,
      rivalEnvido: run.has('mazo_marcado'),
      hide: run.hidesCard ? Math.floor(Math.random() * 3) : undefined,
    };
    if (run.whistle) { log('🎵 Se escucha el silbido bien cerca: esta mano, lo que perdés cuesta x1.5.'); Table.setSpeech('Fiuuu...'); }
    if (run.boss === 'familiar' && run.handInCycle % 5 === 0) log('🐕 El Familiar está hambriento: después de esta mano se come el 15% de tus fichas.');
    const done = await playHand(hand, t, run.persona, opts);
    handRunning = false;
    if (!done || t !== token) return;
    const r = run.settleHand();
    const won = r.outcome === 'win';
    message(r.summary);
    $('message').classList.add(r.net > 0 ? 'good' : r.net < 0 ? 'bad' : 'neutral');
    Table.setSpeech(r.outcome === 'push' ? 'Quedamos parejos.' : won ? pick(RIVAL.loseHand) : pick(RIVAL.winHand));
    Table.setMood(won ? 'sad' : r.outcome === 'lose' ? 'happy' : null, false);
    Sound.sfx(r.net > 0 ? 'win' : r.net < 0 ? 'lose' : 'push');
    onDone();
  }

  function start(mode = 'classic', ctx = {}) {
    stop();
    currentMode = mode;
    playerName = (ctx.vars && ctx.vars.name) || 'Vos';
    const t = token;
    RIVAL = RIVALS.gaucho;
    difficulty = ctx.difficulty === 'dificil' ? 'dificil' : 'facil';
    // En difícil el Viejo piensa con probabilidades y te va estudiando a lo largo de la partida.
    classicPersona = difficulty === 'dificil' && window.TrucoBrain
      ? { ...RIVAL.persona, smart: true, read: TrucoBrain.newProfile() } : null;
    match = new TrucoMatch({ target: TARGET, firstMano: Math.random() < 0.5 ? 0 : 1 });
    document.body.dataset.game = 'truco';
    $('gameover').hidden = true;
    $('log').replaceChildren();
    Table.setDealer(RIVAL.id);
    if (window.setBackgroundTheme) window.setBackgroundTheme(RIVAL.id);
    document.querySelector('.print-big textPath').textContent = `TRUCO · A ${TARGET} PUNTOS`;
    document.querySelector('.print-small textPath').textContent = 'SIN FLOR · EL ENVIDO ESTÁ PRIMERO';
    Sound.music('gaucho');
    renderHud();
    loop(t);
  }

  function stop() {
    token++;
    run = null;
    handRunning = false;
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(null);
    }
    match = null;
    ['tr-rival', 'tr-mine', 'tr-board', 'truco-controls'].forEach((id) => $(id).replaceChildren());
    els.clear();
  }

  function record() {
    return store.get(RECORD_KEY);
  }

  root.TrucoUI = {
    start,
    stop,
    record,
    get active() { return document.body.dataset.game === 'truco'; },
    get mode() { return currentMode; },
    get difficulty() { return difficulty; },
    get playing() { return !!match && !match.over; },
    get handRunning() { return handRunning; },
    prepareRun,
    playRunHand,
    syncRun,
    message,
    // Piezas de la mesa que reutiliza el truco online.
    parts: { cardEl, log, LABELS, trucoLabel },
  };
})(window);
