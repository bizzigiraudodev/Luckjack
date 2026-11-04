// Truco online contra un amigo: sala con código, la partida vive en el servidor (api/room.js)
// y este módulo consulta cada ~1 segundo y dibuja lo que cambió.
(function (root) {
  const $ = (id) => document.getElementById(id);
  const { PHRASES } = Truco;
  const { animate, offset, flyFrom } = Table.anim;
  const API = 'api/room';
  const SESSION_KEY = 'luckjack.online';

  let active = false;
  let session = null; // { code, token, seat }
  let v = null; // última vista del servidor
  let lastEvent = 0;
  let lastChat = 0;
  let timer = null;
  let queue = Promise.resolve();
  let sending = false;
  let shown = { id: null, me: [], opp: [], reveal: false };
  let controlsSig = null; // para no redibujar los botones si no cambió nada (y no perder un toque)
  const myEls = new Map(); // "n-palo" → elemento de la carta en tu mano
  let oppEls = [];
  let ctx = { getName: () => 'Vos', setName() {}, onEnter() {}, onExit() {} };

  const parts = () => TrucoUI.parts;
  const cardKey = (c) => `${c.n}-${c.s}`;
  const oppName = () => (v && v.names && v.names.opp) || 'tu amigo';

  // --- Servidor ---
  async function api(method, body, query = '') {
    const res = await fetch(`${API}${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function saveSession() {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* sin storage */ }
  }
  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* sin storage */ }
  }

  function inviteLink(code) {
    return `${location.origin}${location.pathname}?sala=${encodeURIComponent(code)}`;
  }

  // --- Sala de espera (antes de entrar) ---
  function lobbyStatus(text, bad = false) {
    $('online-status').textContent = text;
    $('online-status').className = `sub ${bad ? 'bad-text' : ''}`;
  }

  function openLobby(code = '') {
    $('online').hidden = false;
    $('online-name').value = ctx.getName();
    $('online-code').value = code;
    const saved = loadSession();
    $('btn-online-back').hidden = !saved;
    if (saved) $('btn-online-back').textContent = `↩️ Volver a la sala ${saved.code}`;
    if (!location.protocol.startsWith('http')) lobbyStatus('El juego online funciona desde la página publicada (Vercel), no abriendo el archivo.', true);
    else lobbyStatus(code ? `Te invitaron a la sala ${code}. Poné tu nombre y tocá Unirme.` : 'Creá una sala y pasale el link a tu amigo, o unite con su código.');
  }

  function lobbyName() {
    const name = $('online-name').value.trim().slice(0, 16) || 'Timbero';
    ctx.setName(name);
    return name;
  }

  async function createRoom() {
    const target = Number(document.querySelector('#online .target-pick:not(.size-pick) .active').dataset.target);
    const players = Number(document.querySelector('#online .size-pick .active').dataset.players);
    lobbyStatus('Creando sala...');
    try {
      const r = await api('POST', { action: 'create', name: lobbyName(), target, players });
      session = { code: r.code, token: r.token, seat: r.seat };
      saveSession();
      enter(r.view);
    } catch (e) {
      lobbyStatus(e.message, true);
    }
  }

  async function joinRoom(code, token) {
    if (!code) return lobbyStatus('Escribí el código de la sala.', true);
    lobbyStatus('Entrando...');
    const saved = loadSession();
    const t = token || (saved && saved.code === code.toUpperCase() ? saved.token : undefined);
    try {
      const r = await api('POST', { action: 'join', code, name: lobbyName(), token: t });
      session = { code: r.code, token: r.token, seat: r.seat };
      saveSession();
      enter(r.view);
    } catch (e) {
      lobbyStatus(e.message, true);
      if (e.status === 404 && saved && saved.code === code.toUpperCase()) clearSession();
    }
  }

  // --- En la sala ---
  function enter(view) {
    ctx.onEnter();
    TrucoUI.stop();
    $('online').hidden = true;
    $('menu').hidden = true;
    $('gameover').hidden = true;
    document.body.classList.remove('in-menu');
    document.body.dataset.game = 'truco';
    document.body.dataset.mode = 'classic';
    document.body.dataset.boss = 'gaucho';
    Table.setDealer('timbero'); // tu amigo aparece como el timbero
    if (window.setBackgroundTheme) window.setBackgroundTheme('crupier');
    Truco4Online.reset();
    if (view.size === 4) document.body.dataset.table = '4';
    else delete document.body.dataset.table;
    document.querySelector('.print-big textPath').textContent = view.size === 4 ? 'TRUCO DE A 4 ONLINE' : 'TRUCO ONLINE';
    document.querySelector('.print-small textPath').textContent = `SALA ${view.code} · A ${view.target} PUNTOS`;
    Sound.music('gaucho');
    $('log').replaceChildren();
    active = true;
    v = null;
    controlsSig = null;
    shown = { id: null, me: [], opp: [], reveal: false };
    // Al volver a entrar no se repiten los cantos viejos.
    lastEvent = view.lastEvent || 0;
    lastChat = view.chat && view.chat.length ? view.chat[view.chat.length - 1].id : 0;
    update(view);
    schedule();
  }

  function update(view) {
    queue = queue.then(() => render(view)).catch((e) => console.error(e));
    return queue;
  }

  function schedule() {
    clearTimeout(timer);
    if (!active) return;
    let delay = 1000;
    if (!v || v.status === 'waiting') delay = 1500;
    else if (v.status === 'over') delay = 2000;
    else if (v.hand && (v.size === 4 ? v.hand.turn === 0 && !v.hand.pending : v.hand.actor === 'me')) delay = 2500; // espera tu jugada
    if (document.hidden) delay = 5000;
    timer = setTimeout(poll, delay);
  }

  async function poll() {
    if (!active || !session) return;
    try {
      const q = `?code=${encodeURIComponent(session.code)}&token=${session.token}&ver=${v ? v.ver : -1}&since=${lastEvent}`;
      const view = await api('GET', null, q);
      if (!view.same) await update(view);
    } catch (e) {
      if (e.status === 404 || e.status === 403) {
        parts().log('La sala ya no existe.');
        TrucoUI.message('La sala venció o ya no existe. Volvé al menú para crear otra.');
        clearSession();
        active = false;
        return;
      }
    }
    schedule();
  }

  async function send(action, extra = {}) {
    if (sending || !session) return;
    sending = true;
    $('truco-controls').querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const view = await api('POST', { action, code: session.code, token: session.token, since: lastEvent, ...extra });
      await update(view);
    } catch (e) {
      // De a 4, si los dos compañeros responden a la vez, el servidor acepta al primero.
      TrucoUI.message(e.status === 400 && v && v.size === 4 ? 'Esa ya no vale: seguro respondió tu compañero.' : e.message);
      controlsSig = null;
      Truco4Online.invalidate();
      // La jugada ya no valía porque la mesa cambió: se pide el estado actual enseguida
      // (si no, se seguía mostrando la vista vieja y se podía quedar trabado).
      try {
        const q = `?code=${encodeURIComponent(session.code)}&token=${session.token}&ver=-1&since=${lastEvent}`;
        await update(await api('GET', null, q));
      } catch {
        if (v) await update({ ...v, events: [], chat: [] }); // vuelve a habilitar los controles
      }
    } finally {
      sending = false;
      // Si la barra no se rehízo (por ejemplo, después de una seña o una frase), se reactiva igual.
      $('truco-controls').querySelectorAll('button').forEach((b) => { b.disabled = false; });
      schedule();
    }
  }

  // --- Dibujo ---
  function renderHud() {
    const me = v.scores ? v.scores.me : 0;
    const opp = v.scores ? v.scores.opp : 0;
    $('cycle').parentElement.innerHTML = `ONLINE <b id="cycle">A ${v.target}</b>`;
    $('quota-label').textContent = `Vos – ${oppName()}`;
    $('quota').textContent = `${me} – ${opp}`;
    $('quota').className = me >= opp ? 'ok' : 'warn';
    $('hand-label').textContent = 'Mano';
    $('hand').textContent = v.handNumber || '–';
    $('minbet-label').textContent = 'Es mano';
    $('minbet').textContent = v.hand ? (v.hand.mano === 'me' ? 'Vos' : oppName()) : '–';
    $('story-timer').hidden = true;
  }

  function showWaiting() {
    const link = inviteLink(v.code);
    TrucoUI.message(`Sala ${v.code}: esperando a tu amigo...`);
    $('intel').textContent = 'Pasale el link o el código. La partida arranca sola cuando entre.';
    const box = $('truco-controls');
    const code = document.createElement('b');
    code.className = 'room-code';
    code.textContent = v.code;
    const wa = document.createElement('a');
    wa.className = 'btn-link btn-green';
    wa.href = `https://wa.me/?text=${encodeURIComponent(`¡Te desafío a un truco en Luckjack! Entrá a la sala ${v.code}: ${link}`)}`;
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.textContent = '📲 WhatsApp';
    const copy = document.createElement('button');
    copy.textContent = '🔗 Copiar link';
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(link); copy.textContent = '✔ Copiado'; } catch { prompt('Copiá el link:', link); }
    };
    const items = [code, wa, copy];
    if (navigator.share) {
      const share = document.createElement('button');
      share.textContent = 'Compartir';
      share.onclick = () => navigator.share({ title: 'Luckjack', text: `Truco en la sala ${v.code}`, url: link }).catch(() => {});
      items.push(share);
    }
    box.replaceChildren(...items);
  }

  function buildBoard() {
    $('tr-board').innerHTML = [0, 1, 2].map((i) =>
      `<div class="tr-baza" data-i="${i}"><div class="slot rival"></div><span class="mark"></span><div class="slot me"></div></div>`).join('');
    $('tr-rival').replaceChildren();
    $('tr-mine').replaceChildren();
    myEls.clear();
    oppEls = [];
  }

  function slot(side, i) {
    return $('tr-board').querySelector(`.tr-baza[data-i="${i}"] .slot.${side === 'me' ? 'me' : 'rival'}`);
  }

  // Mano nueva: reparte (o, si entrás a mitad de mano, acomoda todo sin animar).
  async function dealNew(h, id) {
    buildBoard();
    shown = { id, me: h.table.me.slice(), opp: h.table.opp.slice(), reveal: false };
    for (const side of ['me', 'opp']) h.table[side].forEach((c, i) => slot(side, i).replaceChildren(parts().cardEl(c)));
    const fresh = !h.table.me.length && !h.table.opp.length;
    const order = h.mano === 'me' ? ['me', 'opp'] : ['opp', 'me'];
    const counts = { me: h.myCards.length, opp: h.oppCount };
    for (let i = 0; i < 3; i++) {
      for (const side of order) {
        if (i >= counts[side]) continue;
        const el = side === 'me' ? parts().cardEl(h.myCards[i]) : parts().cardEl(null, true);
        if (side === 'me') {
          myEls.set(cardKey(h.myCards[i]), el);
          $('tr-mine').appendChild(el);
        } else {
          oppEls.push(el);
          $('tr-rival').appendChild(el);
        }
        if (fresh) {
          Sound.sfx('card');
          await flyFrom(el, $('shoe'));
        }
      }
    }
  }

  async function animatePlay(side, card, i) {
    let old = null;
    if (side === 'me') {
      old = myEls.get(cardKey(card));
      myEls.delete(cardKey(card));
    } else {
      old = oppEls.pop();
    }
    const from = old ? old.getBoundingClientRect() : $('shoe').getBoundingClientRect();
    if (old) old.remove();
    const el = parts().cardEl(card);
    slot(side, i).replaceChildren(el);
    Sound.sfx('card');
    const { dx, dy } = offset(el, from);
    await animate(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], 320);
  }

  async function revealOpp(cards) {
    for (let i = 0; i < cards.length && i < oppEls.length; i++) {
      const back = oppEls[i];
      await animate(back, [{ transform: 'none' }, { transform: 'rotateY(90deg)' }], 120, { fill: 'forwards' });
      const face = parts().cardEl(cards[i]);
      back.replaceWith(face);
      oppEls[i] = face;
      await animate(face, [{ transform: 'rotateY(90deg)' }, { transform: 'none' }], 120);
    }
  }

  async function renderHand() {
    const h = v.hand;
    const id = `${v.matchNo}:${v.handNumber}`;
    if (id !== shown.id) await dealNew(h, id);
    for (const side of ['me', 'opp']) {
      const list = h.table[side];
      for (let i = shown[side].length; i < list.length; i++) {
        await animatePlay(side, list[i], i);
        shown[side].push(list[i]);
      }
    }
    h.bazas.forEach((r, i) => {
      const mark = $('tr-board').querySelector(`.tr-baza[data-i="${i}"] .mark`);
      mark.textContent = r === 'parda' ? '=' : r === 'me' ? '✔' : '✖';
      mark.className = `mark ${r === 'parda' ? 'parda' : r === 'me' ? 'won' : 'lost'}`;
    });
    if (h.finished && h.oppReveal && !shown.reveal) {
      shown.reveal = true;
      await revealOpp(h.oppReveal);
    }
  }

  // Cantos, respuestas, envido y frases que llegaron desde la última vez.
  function renderEvents() {
    for (const e of v.events || []) {
      if (e.id <= lastEvent) continue;
      lastEvent = e.id;
      const who = e.who === 'me' ? 'Vos' : oppName();
      if (e.type === 'call' || e.type === 'response') {
        Sound.sfx(e.type === 'call' ? 'shop' : 'click');
        if (e.who === 'opp') Table.setSpeech(e.text);
        parts().log(`${who}: ${e.text}`);
      } else if (e.type === 'envido') {
        const text = e.values
          ? `Envido: vos ${e.values.me}, ${oppName()} ${e.values.opp} → ${e.winner === 'me' ? 'vos' : oppName()} +${e.points}`
          : `Envido no querido → ${e.winner === 'me' ? 'vos' : oppName()} +${e.points}`;
        $('intel').textContent = text;
        parts().log(text);
        Sound.sfx(e.winner === 'me' ? 'coin' : 'push');
      } else if (e.type === 'mazo') {
        if (e.who === 'opp') Table.setSpeech('Me voy al mazo.');
        parts().log(`${who} se fue al mazo.`);
      } else if (e.type === 'end') {
        Sound.sfx(e.winner === 'me' ? 'win' : 'lose');
      }
    }
    for (const c of v.chat || []) {
      if (c.id <= lastChat) continue;
      lastChat = c.id;
      if (c.from === 'opp') {
        Table.setSpeech(`💬 ${c.text}`);
        Sound.sfx('chip');
      }
      parts().log(`💬 ${c.from === 'me' ? 'Vos' : oppName()}: ${c.text}`);
    }
  }

  function describe(h) {
    if (h.finished) {
      const pts = h.points;
      return `Mano para ${h.winner === 'me' ? 'vos' : oppName()} → vos +${pts.me}, ${oppName()} +${pts.opp}`;
    }
    const p = h.pending;
    if (p && p.caller === 'opp') {
      const what = p.kind === 'truco' ? Truco.TRUCO_NAMES[p.level] : p.chain.map((c) => Truco.ENVIDO_NAMES[c]).join(' + ');
      return `${oppName()} cantó ${what}. ¿Qué respondés?`;
    }
    return h.actor === 'me' ? 'Te toca. Jugá una carta o cantá.' : `Esperando a ${oppName()}...`;
  }

  // Menú de frases rápidas: flota sobre la pantalla (afuera de la barra de controles, que se desliza).
  function phraseMenu() {
    let menu = $('phrase-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'phrase-menu';
      menu.className = 'phrase-menu';
      menu.hidden = true;
      PHRASES.forEach((text, i) => {
        const b = document.createElement('button');
        b.textContent = text;
        b.onclick = () => { menu.hidden = true; send('say', { phrase: i }); };
        menu.appendChild(b);
      });
      document.body.appendChild(menu);
    }
    return menu;
  }

  function phraseButton() {
    const btn = document.createElement('button');
    btn.className = 'phrase-btn';
    btn.textContent = '💬';
    btn.title = 'Frases rápidas';
    btn.onclick = () => { const m = phraseMenu(); m.hidden = !m.hidden; };
    return btn;
  }

  function renderControls() {
    const box = $('truco-controls');
    $('tr-mine').querySelectorAll('.card').forEach((c) => { c.classList.remove('playable'); c.onclick = null; });
    const h = v.hand;
    const items = [phraseButton()];
    if (v.status === 'over' || !h) {
      box.replaceChildren(...items);
      return;
    }
    if (h.finished) {
      const next = document.createElement('button');
      next.className = 'btn-orange big';
      next.textContent = 'Siguiente mano';
      next.onclick = () => send('next');
      items.push(next);
    } else if (h.actor === 'me') {
      for (const a of h.actions) {
        if (a.type === 'play') continue;
        const [label, cls] = a.type === 'truco' ? [parts().trucoLabel(h), 'btn-orange'] : parts().LABELS[a.type];
        const b = document.createElement('button');
        b.textContent = label;
        if (cls) b.className = cls;
        b.onclick = () => send('act', { move: a });
        items.push(b);
      }
      if (h.actions.some((a) => a.type === 'play')) {
        h.myCards.forEach((card, index) => {
          const el = myEls.get(cardKey(card));
          if (!el) return;
          el.classList.add('playable');
          el.onclick = () => send('act', { move: { type: 'play', index } });
        });
      }
    }
    box.replaceChildren(...items);
  }

  function renderIntel() {
    const h = v.hand;
    const parts2 = [];
    if (h && !h.finished && !h.envido.done && h.bazas.length === 0 &&
      (h.truco.level === 0 || (h.pending && h.pending.kind === 'envido'))) parts2.push(`Tu envido: <b>${h.myEnvido}</b>`);
    if (h && h.truco.level && !h.finished) parts2.push(`${Truco.TRUCO_NAMES[h.truco.level]} querido`);
    if (v.left === 'opp') parts2.push(`⚠️ ${oppName()} salió de la sala`);
    else if (!v.oppOnline) parts2.push(`⚠️ ${oppName()} parece desconectado`);
    if (parts2.length) $('intel').innerHTML = parts2.join(' · ');
  }

  function renderEnd() {
    const won = v.winner === 'me';
    $('gameover-title').textContent = won ? `🏆 ¡Le ganaste a ${oppName()}!` : `💀 ${oppName()} te ganó`;
    $('gameover-reason').textContent = `Vos ${v.scores.me} – ${v.scores.opp} ${oppName()}`;
    $('gameover-stats').textContent = v.rematch.me && !v.rematch.opp ? `Esperando que ${oppName()} acepte la revancha...`
      : v.rematch.opp ? `${oppName()} quiere la revancha. ¿Te animás?` : '';
    $('gameover-ranks').hidden = true;
    $('btn-gameover-ranks').hidden = true;
    $('btn-restart').textContent = v.rematch.me ? 'Revancha pedida' : '🔁 Revancha';
    $('btn-restart').disabled = v.rematch.me;
    if ($('gameover').hidden) Sound.sfx(won ? 'victory' : 'deckLost');
    $('gameover').hidden = false;
  }

  // Lo que necesita la mesa de 4 de esta sala.
  const ctx4 = {
    send: (action, extra) => send(action, extra),
    inviteLink,
    phraseButton: () => phraseButton(),
    lastEvent: { get: () => lastEvent, set: (x) => { lastEvent = x; } },
    lastChat: { get: () => lastChat, set: (x) => { lastChat = x; } },
  };

  async function render(view) {
    if (!active || !view || view.same) return;
    v = view;
    if (v.size === 4) {
      await Truco4Online.render(v, ctx4);
      return;
    }
    renderHud();
    if (v.status === 'waiting') {
      showWaiting();
      return;
    }
    if (v.status !== 'over') {
      $('gameover').hidden = true;
      $('btn-restart').disabled = false;
    }
    renderEvents();
    if (v.hand) await renderHand();
    if (!active) return;
    if (v.hand) {
      TrucoUI.message(describe(v.hand));
      $('message').className = `message ${v.hand.finished ? (v.hand.winner === 'me' ? 'good' : 'bad') : ''}`;
    }
    renderIntel();
    const sig = JSON.stringify([v.status, v.matchNo, v.hand && v.hand.actions, v.hand && v.hand.finished, v.hand && v.hand.myCards]);
    if (sig !== controlsSig) {
      controlsSig = sig;
      renderControls();
    }
    if (v.status === 'over') renderEnd();
  }

  // --- Salir ---
  function stop() {
    active = false;
    clearTimeout(timer);
    Truco4Online.stop();
    session = null;
    v = null;
    ['tr-rival', 'tr-mine', 'tr-board', 'truco-controls'].forEach((id) => $(id).replaceChildren());
    if ($('phrase-menu')) $('phrase-menu').hidden = true;
    $('btn-restart').textContent = 'Jugar de nuevo';
    $('btn-restart').disabled = false;
  }

  function leave() {
    if (session) api('POST', { action: 'leave', code: session.code, token: session.token }).catch(() => {});
    clearSession();
    stop();
  }

  function rematch() {
    send('rematch');
  }

  // --- Eventos del formulario ---
  function init(context) {
    ctx = { ...ctx, ...context };
    // Cada selector (tamaño de la sala, puntos) marca solo sus propios botones.
    document.querySelectorAll('#online .target-pick').forEach((group) => {
      group.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        group.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      }));
    });
    $('btn-create-room').addEventListener('click', createRoom);
    $('btn-join-room').addEventListener('click', () => joinRoom($('online-code').value.trim()));
    $('online-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('online-code').value.trim()); });
    $('btn-online-back').addEventListener('click', () => {
      const saved = loadSession();
      if (saved) joinRoom(saved.code, saved.token);
    });
    $('btn-close-online').addEventListener('click', () => { $('online').hidden = true; });
    document.addEventListener('visibilitychange', () => { if (active && !document.hidden) schedule(); });
  }

  // Código de sala que vino en el link (?sala=MATE-37).
  function codeFromUrl() {
    const code = new URLSearchParams(location.search).get('sala');
    if (code) history.replaceState(null, '', location.pathname);
    return code;
  }

  root.TrucoOnline = {
    init, openLobby, leave, stop, rematch, codeFromUrl,
    get active() { return active; },
  };
})(window);
