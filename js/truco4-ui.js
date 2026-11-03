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
  let mySenas = []; // señas que le hiciste a tu compañero en esta mano
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
  function showSena(id) {
    const s = Senas.getSena(id);
    $('dealer').dataset.sena = id;
    $('intel').textContent = `🤫 Tu compañero: ${s.icon} ${s.face.toLowerCase()} → ${s.means}`;
    parts().log(`🤫 El Viejo te hizo una seña: ${s.icon} ${s.face.toLowerCase()} (${s.means.toLowerCase()})`);
  }

  async function partnerSenas(hand, t) {
    const ids = Senas.senasFor(hand.dealt[2], hand.envidoValueOf(2));
    for (const id of ids) {
      if (t !== token) return;
      showSena(id);
      await wait(1600);
    }
    delete $('dealer').dataset.sena;
  }

  function senaMenu(onPick) {
    let menu = $('sena-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'sena-menu';
      menu.className = 'phrase-menu sena-menu';
      menu.hidden = true;
      document.body.appendChild(menu);
    }
    menu.replaceChildren(...Senas.SENAS.map((s) => {
      const b = document.createElement('button');
      b.innerHTML = `${s.icon} ${s.face} <small>${s.means}</small>`;
      b.onclick = () => { menu.hidden = true; onPick(s.id); };
      return b;
    }));
    return menu;
  }

  function senaButton() {
    const btn = document.createElement('button');
    btn.className = 'phrase-btn';
    btn.textContent = '🤫 Señas';
    btn.title = 'Hacele una seña a tu compañero (los rivales no la ven)';
    btn.onclick = () => {
      const m = senaMenu((id) => {
        mySenas.push(id);
        const s = Senas.getSena(id);
        TrucoUI.message(`Le hiciste una seña al Viejo: ${s.icon} ${s.face.toLowerCase()}`);
        parts().log(`🤫 Le hiciste una seña al Viejo: ${s.icon} ${s.face.toLowerCase()}`);
        Sound.sfx('chip');
      });
      m.hidden = !m.hidden;
    };
    return btn;
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
        if ($('sena-menu')) $('sena-menu').hidden = true;
        $('tr-mine').querySelectorAll('.card').forEach((c) => { c.classList.remove('playable'); c.onclick = null; });
        resolve(action);
      };
      const acts = hand.actions(0);
      const buttons = [senaButton(), ...acts.filter((a) => a.type !== 'play').map((a) => {
        const btn = document.createElement('button');
        const [label, cls] = a.type === 'truco' ? [parts().trucoLabel(hand), 'btn-orange'] : parts().LABELS[a.type];
        btn.textContent = label;
        if (cls) btn.className = cls;
        btn.onclick = () => choose(a);
        return btn;
      })];
      $('truco-controls').replaceChildren(...buttons);
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
    mySenas = [];
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
        await wait(700);
        const hints = p === 2 ? Senas.hintsFrom(mySenas) : {};
        action = TrucoAI.decide(hand, p, SEATS[p].persona, Math.random, hints);
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
    if ($('sena-menu')) $('sena-menu').hidden = true;
    ['tr-rival', 'tr-mine', 't4-center', 't4-history', 't4-left', 't4-right', 'truco-controls'].forEach((id) => $(id) && $(id).replaceChildren());
  }

  root.Truco4UI = {
    start,
    stop,
    record: () => store.get(RECORD_KEY),
    get active() { return active; },
    get playing() { return active && !!match && !match.over; },
  };
})(window);
