// Truco de a 4 (parejas) contra bots: vos y el Viejo contra el Diablo y San Pedro, con señas.
// Asientos: 0 = vos (abajo), 1 = a tu derecha, 2 = tu compañero (arriba), 3 = a tu izquierda.
(function (root) {
  const $ = (id) => document.getElementById(id);
  const { TrucoMatch, TRUCO_NAMES, ENVIDO_NAMES } = Truco;
  const { animate, offset, wait } = Table.anim;
  const RECORD_KEY = 'luckjack.truco4';
  const POS = ['bottom', 'right', 'top', 'left'];

  const SEATS = [
    { name: 'Vos', char: null },
    { name: 'El Diablo', char: 'diablo', persona: TrucoAI.PERSONAS.diablo },
    { name: 'El Viejo', char: 'gaucho', persona: TrucoAI.PERSONAS.gaucho },
    { name: 'San Pedro', char: 'santo', persona: TrucoAI.PERSONAS.santo },
  ];

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin storage */ } },
  };

  let match = null;
  let token = 0;
  let waiter = null;
  let seen = 0;
  let active = false;
  let partnerHints = {}; // lo que sabe tu compañero de tus cartas (por tus señas)
  let orders = []; // órdenes que le diste a tu compañero en esta mano
  let shows = 0; // cuántas veces mostraste tus señas en esta mano
  let lastShow = 0;
  let lastPhrase = 0;
  let currentHand = null;
  const els = new Map(); // carta → elemento (tu mano)
  const backs = [[], [], [], []]; // dorsos de las cartas de los demás

  const parts = () => TrucoUI.parts;
  const teamName = (t) => (t === 0 ? 'nosotros' : 'ellos');

  // --- Armado de la mesa ---
  function buildSeats() {
    for (const p of [1, 3]) {
      const box = $(`t4-${POS[p]}`);
      box.innerHTML = `<div class="t4-avatar">${Pixel.character(SEATS[p].char)}</div>
        <div class="t4-name">${SEATS[p].name}</div><div class="t4-backs"></div><div class="t4-speech" hidden></div>`;
    }
    Table.setDealer(SEATS[2].char); // tu compañero, arriba
  }

  function buildHand() {
    $('t4-center').innerHTML = POS.map((pos) => `<div class="slot" data-pos="${pos}"></div>`).join('');
    $('t4-history').innerHTML = [0, 1, 2].map((i) => `<div class="t4-baza" data-i="${i}"><span class="mark"></span><div class="mini"></div></div>`).join('');
    $('tr-mine').replaceChildren();
    $('tr-rival').replaceChildren();
    for (const p of [1, 3]) $(`t4-${POS[p]}`).querySelector('.t4-backs').replaceChildren();
    $('t4-shown').replaceChildren();
    els.clear();
    backs.forEach((b) => { b.length = 0; });
  }

  function backsBox(p) {
    return p === 2 ? $('tr-rival') : $(`t4-${POS[p]}`).querySelector('.t4-backs');
  }

  function say(p, text) {
    if (p === 0) {
      TrucoUI.message(`Vos: ${text}`);
    } else if (p === 2) {
      Table.setSpeech(text);
    } else {
      const bubble = $(`t4-${POS[p]}`).querySelector('.t4-speech');
      bubble.textContent = text;
      bubble.hidden = false;
      clearTimeout(bubble.timer);
      bubble.timer = setTimeout(() => { bubble.hidden = true; }, 2600);
    }
  }

  function renderHud() {
    const [us, them] = match.scores;
    document.body.dataset.game = 'truco';
    document.body.dataset.table = '4';
    document.body.dataset.mode = 'classic';
    document.body.dataset.boss = 'gaucho';
    $('cycle').parentElement.innerHTML = `TRUCO DE A 4 <b id="cycle">A ${match.target}</b>`;
    $('quota-label').textContent = 'Nosotros – Ellos';
    $('quota').textContent = `${us} – ${them}`;
    $('quota').className = us >= them ? 'ok' : 'warn';
    $('hand-label').textContent = 'Mano';
    $('hand').textContent = match.handNumber;
    $('minbet-label').textContent = 'Es mano';
    $('minbet').textContent = match.hand ? SEATS[match.hand.mano].name : '–';
    $('story-timer').hidden = true;
  }

  async function deal(hand, t) {
    buildHand();
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 4; k++) {
        if (t !== token) return;
        const p = (hand.mano + k) % 4;
        const card = hand.dealt[p][i];
        const el = parts().cardEl(card, p !== 0);
        if (p === 0) {
          els.set(card, el);
          $('tr-mine').appendChild(el);
        } else {
          backs[p].push(el);
          backsBox(p).appendChild(el);
        }
        Sound.sfx('card');
        const { dx, dy } = offset(el, $('shoe'));
        await animate(el, [{ transform: `translate(${dx}px, ${dy}px) scale(0.7)` }, { transform: 'none' }], 200);
      }
    }
  }

  // --- Señas ---

  // Las señas de tu compañero: hace las caras y te quedan sus cartas bravas a la vista.
  function showPartnerCards(name, show) {
    const box = $('t4-shown');
    box.replaceChildren();
    const label = document.createElement('span');
    label.textContent = `🤫 ${name}:`;
    box.append(label, ...show.cards.map((c) => parts().cardEl(c)));
    const extra = document.createElement('span');
    extra.textContent = show.envido ? '😠 tiene envido' : show.cards.length ? '' : '😌 no tiene nada';
    if (extra.textContent) box.appendChild(extra);
  }

  function describeShow(show) {
    const names = show.senas.map((id) => Senas.getSena(id).means.toLowerCase());
    return names.join(', ');
  }

  async function partnerSenas(hand, t) {
    const show = Senas.showFor(hand.dealt[2], hand.envidoValueOf(2));
    showPartnerCards('El Viejo', show);
    parts().log(`🤫 El Viejo te mostró sus señas: ${describeShow(show)}`);
    // Todas las señas a la vez (por ejemplo, cejas + ceño = ancho de espadas y envido).
    $('dealer').dataset.sena = show.senas.join(' ');
    await wait(1800);
    if (t === token) delete $('dealer').dataset.sena;
  }

  // Un toque y tu compañero ve todas tus señas (con anti-spam).
  function senaButton() {
    const btn = document.createElement('button');
    btn.className = 'phrase-btn';
    btn.textContent = '🤫';
    btn.setAttribute('aria-label', 'Señas');
    btn.title = 'Mostrale tus cartas bravas y tu envido a tu compañero (los rivales no ven nada)';
    btn.onclick = () => {
      const hand = currentHand;
      if (!hand || hand.finished) return;
      const now = Date.now();
      if (shows >= Senas.LIMITS.showsPerHand) { TrucoUI.message('Ya le mostraste tus señas varias veces en esta mano.'); return; }
      if (now - lastShow < Senas.LIMITS.showGapMs) { TrucoUI.message('Esperá un toque antes de volver a hacer señas.'); return; }
      shows++;
      lastShow = now;
      const show = Senas.showFor(hand.dealt[0], hand.envidoValueOf(0));
      partnerHints = Senas.hintsFrom(show.senas);
      TrucoUI.message(`Le mostraste tus señas al Viejo: ${describeShow(show)}.`);
      parts().log(`🤫 Le mostraste tus señas al Viejo: ${describeShow(show)}`);
      Sound.sfx('chip');
      setTimeout(() => { if (currentHand === hand) say(2, '¡Visto, compañero!'); }, 500);
    };
    return btn;
  }

  // Frases: órdenes a tu compañero (solo él las escucha) o cargadas a los rivales.
  function phraseMenu() {
    let menu = $('t4-phrase-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 't4-phrase-menu';
      menu.className = 'phrase-menu t4-phrase-menu';
      menu.hidden = true;
      document.body.appendChild(menu);
    }
    const title = (text) => { const h = document.createElement('div'); h.className = 'phrase-title'; h.textContent = text; return h; };
    const item = (text, onPick) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = () => { menu.hidden = true; onPick(); };
      return b;
    };
    menu.replaceChildren(
      title('🤝 Al compañero'),
      ...Senas.ORDERS.map((o) => item(o.text, () => giveOrder(o))),
      title('🔥 A los rivales'),
      ...Truco.PHRASES.map((text) => item(text, () => taunt(text))),
    );
    return menu;
  }

  function phraseAllowed() {
    const now = Date.now();
    if (now - lastPhrase < Senas.LIMITS.phraseGapMs) { TrucoUI.message('Pará un poco, che.'); return false; }
    lastPhrase = now;
    return true;
  }

  function giveOrder(o) {
    if (!currentHand || currentHand.finished || !phraseAllowed()) return;
    if (!orders.includes(o.id)) orders.push(o.id);
    TrucoUI.message(`Le dijiste al Viejo: "${o.text}"`);
    parts().log(`🤝 Al Viejo: ${o.text}`);
    Sound.sfx('click');
    setTimeout(() => say(2, Senas.ACKS[Math.floor(Math.random() * Senas.ACKS.length)]), 500);
  }

  function taunt(text) {
    if (!phraseAllowed()) return;
    TrucoUI.message(`Vos: "${text}"`);
    parts().log(`💬 Vos: ${text}`);
    Sound.sfx('click');
    const rival = Math.random() < 0.5 ? 1 : 3;
    setTimeout(() => {
      if (!active) return;
      const reply = Senas.COMEBACKS[Math.floor(Math.random() * Senas.COMEBACKS.length)];
      say(rival, reply);
      parts().log(`💬 ${SEATS[rival].name}: ${reply}`);
    }, 900);
  }

  function phraseButton() {
    const btn = document.createElement('button');
    btn.className = 'phrase-btn';
    btn.textContent = '💬';
    btn.title = 'Órdenes al compañero y cargadas a los rivales';
    btn.onclick = () => { const m = phraseMenu(); m.hidden = !m.hidden; };
    return btn;
  }

  // Mientras juegan los demás, las señas y las frases siguen a mano.
  function idleControls() {
    $('truco-controls').replaceChildren(senaButton(), phraseButton());
  }

  // --- Turno del jugador ---
  function describe(hand) {
    const pend = hand.pending;
    if (pend && hand.canRespond(0)) {
      const what = pend.kind === 'truco' ? TRUCO_NAMES[pend.level] : pend.chain.map((c) => ENVIDO_NAMES[c]).join(' + ');
      return `${SEATS[pend.caller].name} cantó ${what}. ¿Qué respondés?`;
    }
    if (pend) return 'Esperando la respuesta...';
    return hand.turn === 0 ? 'Te toca. Jugá una carta o cantá.' : `${SEATS[hand.turn].name} está pensando...`;
  }

  function waitHuman(hand) {
    return new Promise((resolve) => {
      waiter = resolve;
      const choose = (action) => {
        if (waiter !== resolve) return;
        waiter = null;
        $('truco-controls').replaceChildren();
        if ($('t4-phrase-menu')) $('t4-phrase-menu').hidden = true;
        $('tr-mine').querySelectorAll('.card').forEach((c) => { c.classList.remove('playable'); c.onclick = null; });
        resolve(action);
      };
      const acts = hand.actions(0);
      const buttons = [senaButton(), phraseButton(), ...acts.filter((a) => a.type !== 'play').map((a) => {
        const btn = document.createElement('button');
        const [label, cls] = a.type === 'truco' ? [parts().trucoLabel(hand), 'btn-orange'] : parts().LABELS[a.type];
        btn.textContent = label;
        if (cls) btn.className = cls;
        btn.onclick = () => choose(a);
        return btn;
      })];
      $('truco-controls').replaceChildren(...buttons);
      $('tr-mine').scrollIntoView({ block: 'nearest' });
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

  // --- Lo que pasa en la mesa ---
  async function animatePlay(e) {
    let from;
    if (e.who === 0) {
      const old = els.get(e.card);
      from = old.getBoundingClientRect();
      old.remove();
    } else {
      const old = backs[e.who].pop();
      from = old ? old.getBoundingClientRect() : $('shoe').getBoundingClientRect();
      if (old) old.remove();
    }
    const el = parts().cardEl(e.card);
    $('t4-center').querySelector(`.slot[data-pos="${POS[e.who]}"]`).replaceChildren(el);
    Sound.sfx('card');
    const { dx, dy } = offset(el, from);
    await animate(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], 300);
  }

  async function bazaDone(hand, e) {
    const center = $('t4-center');
    if (e.player !== null) center.querySelector(`.slot[data-pos="${POS[e.player]}"] .card`)?.classList.add('winner');
    const box = $('t4-history').querySelector(`.t4-baza[data-i="${e.index}"]`);
    const mark = box.querySelector('.mark');
    mark.textContent = e.result === 'parda' ? '=' : e.result === 0 ? '✔' : '✖';
    mark.className = `mark ${e.result === 'parda' ? 'parda' : e.result === 0 ? 'won' : 'lost'}`;
    if (e.player !== null) box.querySelector('.mini').replaceChildren(parts().cardEl(hand.table[e.player][e.index]));
    parts().log(e.result === 'parda' ? `Baza ${e.index + 1}: parda` : `Baza ${e.index + 1} para ${teamName(e.result)} (${SEATS[e.player].name})`);
    await wait(1000);
    if (!hand.finished) center.querySelectorAll('.slot').forEach((s) => s.replaceChildren());
  }

  async function showEvents(hand, t) {
    while (seen < hand.events.length && t === token) {
      const e = hand.events[seen++];
      if (e.type === 'call' || e.type === 'response') {
        Sound.sfx(e.type === 'call' ? 'shop' : 'click');
        say(e.who, e.text);
        parts().log(`${SEATS[e.who].name}: ${e.text}`);
        await wait(e.who === 0 ? 350 : 800);
      } else if (e.type === 'play') {
        await animatePlay(e);
      } else if (e.type === 'baza') {
        await bazaDone(hand, e);
      } else if (e.type === 'envido') {
        const text = e.accepted
          ? `Envido: ${SEATS[e.holder].name} tiene ${e.values[e.winner]} → ${teamName(e.winner)} +${e.points}`
          : `Envido no querido → ${teamName(e.winner)} +${e.points}`;
        if (e.accepted && e.holder !== 0) say(e.holder, `Tengo ${e.values[e.winner]}.`);
        $('intel').textContent = text;
        parts().log(text);
        Sound.sfx(e.winner === 0 ? 'coin' : 'push');
        await wait(1400);
      } else if (e.type === 'mazo') {
        say(e.who, 'Nos vamos al mazo.');
        parts().log(`${SEATS[e.who].name}: nos vamos al mazo.`);
        await wait(600);
      }
    }
  }

  // Al terminar la mano se ven las cartas que le quedaban a cada uno.
  function revealAll(hand) {
    for (const p of [1, 2, 3]) {
      backs[p].forEach((el, i) => {
        const card = hand.cards[p][i];
        if (card) el.replaceWith(parts().cardEl(card));
      });
      backs[p].length = 0;
    }
  }

  function waitButton(label) {
    return new Promise((resolve) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = 'btn-orange big';
      waiter = () => resolve(false);
      btn.onclick = () => { waiter = null; $('truco-controls').replaceChildren(); resolve(true); };
      $('truco-controls').replaceChildren(btn);
    });
  }

  // Quién decide ahora: si cantaron contra nuestra pareja respondés vos (sos el capitán).
  function decider(hand) {
    if (hand.pending) return hand.canRespond(0) ? 0 : hand.actor;
    return hand.turn;
  }

  async function playHand(hand, t) {
    seen = 0;
    currentHand = hand;
    partnerHints = {};
    orders = [];
    shows = 0;
    lastShow = 0;
    Table.setSpeech(null);
    $('intel').textContent = '';
    TrucoUI.message(hand.mano === 0 ? 'Sos mano.' : `Es mano ${SEATS[hand.mano].name}.`);
    await deal(hand, t);
    await partnerSenas(hand, t);
    while (!hand.finished && t === token) {
      TrucoUI.message(describe(hand));
      const p = decider(hand);
      let action;
      if (p === 0) {
        action = await waitHuman(hand);
      } else {
        idleControls();
        await wait(700);
        const hints = p === 2 ? partnerHints : {};
        action = TrucoAI.decide(hand, p, SEATS[p].persona, Math.random, hints);
        if (p === 2) {
          // Tu compañero hace caso a tus órdenes.
          const r = TrucoAI.obey(hand, p, orders, action, Senas.getOrder);
          action = r.action;
          if (r.used) orders = orders.filter((id) => id !== r.used);
        }
      }
      if (t !== token || !action) return false;
      hand.act(p, action);
      await showEvents(hand, t);
    }
    if (t !== token) return false;
    revealAll(hand);
    return true;
  }

  async function loop(t) {
    while (!match.over && t === token) {
      const hand = match.newHand();
      renderHud();
      if (!(await playHand(hand, t))) return;
      match.settle();
      renderHud();
      const [us, them] = hand.points;
      const summary = `Mano para ${teamName(hand.winner)} (+${hand.trucoPoints}) → nosotros +${us}, ellos +${them}`;
      TrucoUI.message(summary);
      $('message').classList.add(us > them ? 'good' : us < them ? 'bad' : 'neutral');
      parts().log(summary);
      Table.setSpeech(us > them ? '¡Aura sí, compañero!' : 'Ya la vamos a dar vuelta.');
      Sound.sfx(us > them ? 'win' : 'lose');
      if (match.over) break;
      if (!(await waitButton('Siguiente mano')) || t !== token) return;
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
    $('gameover-title').textContent = won ? '🏆 ¡Ganaron la partida!' : '💀 Perdieron la partida';
    $('gameover-reason').textContent = `Nosotros ${match.scores[0]} – ${match.scores[1]} Ellos` +
      (won ? '. "¡Qué pareja, compañero!"' : '. "La próxima los bailamos."');
    $('gameover-stats').innerHTML = `Partidas ganadas: <b>${rec.wins}</b> · Perdidas: <b>${rec.losses}</b>`;
    $('gameover-ranks').hidden = true;
    $('btn-gameover-ranks').hidden = true;
    $('gameover').hidden = false;
  }

  function start() {
    stop();
    active = true;
    const t = token;
    match = new TrucoMatch({ players: 4, target: 15, firstMano: Math.floor(Math.random() * 4) });
    $('gameover').hidden = true;
    $('log').replaceChildren();
    buildSeats();
    if (window.setBackgroundTheme) window.setBackgroundTheme('gaucho');
    document.querySelector('.print-big textPath').textContent = 'TRUCO DE A 4';
    document.querySelector('.print-small textPath').textContent = 'VOS Y EL VIEJO CONTRA EL DIABLO Y SAN PEDRO';
    Sound.music('gaucho');
    renderHud();
    loop(t);
  }

  function stop() {
    token++;
    active = false;
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(null);
    }
    match = null;
    delete document.body.dataset.table;
    if ($('dealer')) delete $('dealer').dataset.sena;
    if ($('t4-phrase-menu')) $('t4-phrase-menu').hidden = true;
    currentHand = null;
    ['tr-rival', 'tr-mine', 't4-center', 't4-history', 't4-shown', 't4-left', 't4-right', 'truco-controls'].forEach((id) => $(id) && $(id).replaceChildren());
  }

  root.Truco4UI = {
    start,
    stop,
    record: () => store.get(RECORD_KEY),
    get active() { return active; },
    get playing() { return active && !!match && !match.over; },
  };
})(window);
