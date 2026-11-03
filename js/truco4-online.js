// Mesa online de truco de a 4. TrucoOnline maneja la sala (consultas y envíos al servidor);
// este módulo dibuja la vista de 4: posiciones relativas 0 = vos (abajo), 1 = derecha,
// 2 = tu compañero (arriba), 3 = izquierda.
(function (root) {
  const $ = (id) => document.getElementById(id);
  const { TRUCO_NAMES, ENVIDO_NAMES } = Truco;
  const { animate, offset, wait } = Table.anim;
  const POS = ['bottom', 'right', 'top', 'left'];

  let v = null;
  let ctx = null; // { send, inviteLink, lastEvent: {get,set}, lastChat: {get,set} }
  let handId = null;
  let lastSena = 0;
  let controlsSig = null;
  let pickedSeat = null; // para armar parejas en la sala de espera
  const els = new Map();
  const backs = [[], [], [], []];

  const parts = () => TrucoUI.parts;
  const cardKey = (c) => `${c.n}-${c.s}`;
  const byPos = (pos) => v.players.find((p) => p.pos === pos) || {};
  const nameAt = (pos) => (pos === 0 ? 'Vos' : byPos(pos).name || '...');
  const charAt = (pos) => byPos(pos).char || 'timbero';
  const teamName = (t) => (t === 'us' ? 'nosotros' : 'ellos');

  function reset() {
    v = null;
    handId = null;
    lastSena = 0;
    controlsSig = null;
    pickedSeat = null;
  }

  // --- Sala de espera: asientos, parejas y "Empezar" ---
  function renderLobby() {
    const box = $('t4-lobby');
    box.hidden = false;
    const seatsHtml = [0, 1, 2, 3].map((seat) => {
      const p = v.players[seat];
      const pair = seat % 2 === 0 ? 'A' : 'B';
      const label = p.empty ? '— libre (bot) —' : `${p.name}${seat === v.seat ? ' (vos)' : ''}`;
      return `<button class="t4-seat pair-${pair} ${pickedSeat === seat ? 'picked' : ''}" data-seat="${seat}" ${v.host && seat !== 0 ? '' : 'disabled'}>
        <small>Pareja ${pair}</small>${label}</button>`;
    }).join('');
    box.innerHTML = `<p>${v.host ? 'Tocá dos lugares para cambiarlos de pareja. Los lugares libres los ocupan bots.' : 'Esperando que el que creó la sala empiece la partida...'}</p>
      <div class="t4-seats">${seatsHtml}</div>`;
    if (v.host) {
      box.querySelectorAll('.t4-seat').forEach((b) => b.addEventListener('click', () => {
        const seat = Number(b.dataset.seat);
        if (pickedSeat === null) { pickedSeat = seat; renderLobby(); return; }
        const a = pickedSeat;
        pickedSeat = null;
        if (a !== seat) ctx.send('swap', { a, b: seat });
        else renderLobby();
      }));
    }
    TrucoUI.message(`Sala ${v.code}: truco de a 4`);
    $('intel').textContent = `${v.players.filter((p) => !p.empty).length} de 4 jugadores. Pasales el link a tus amigos.`;
    const items = [];
    const code = document.createElement('b');
    code.className = 'room-code';
    code.textContent = v.code;
    items.push(code);
    const link = ctx.inviteLink(v.code);
    const wa = document.createElement('a');
    wa.className = 'btn-link btn-green';
    wa.href = `https://wa.me/?text=${encodeURIComponent(`¡Truco de a 4 en Luckjack! Entrá a la sala ${v.code}: ${link}`)}`;
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.textContent = '📲 WhatsApp';
    items.push(wa);
    if (v.host) {
      const startBtn = document.createElement('button');
      const free = v.players.filter((p) => p.empty).length;
      startBtn.className = 'btn-orange';
      startBtn.textContent = free ? `Empezar (${free} bot${free > 1 ? 's' : ''})` : 'Empezar';
      startBtn.onclick = () => ctx.send('start');
      items.push(startBtn);
    }
    $('truco-controls').replaceChildren(...items);
  }

  // --- Mesa ---
  function buildSeats() {
    for (const pos of [1, 3]) {
      $(`t4-${POS[pos]}`).innerHTML = `<div class="t4-avatar">${Pixel.character(charAt(pos))}</div>
        <div class="t4-name">${nameAt(pos)}${byPos(pos).bot ? ' 🤖' : ''}</div><div class="t4-backs"></div><div class="t4-speech" hidden></div>`;
    }
    Table.setDealer(charAt(2));
    Table.setSpeech(`Soy ${nameAt(2)}, tu compañero.`);
  }

  function backsBox(pos) {
    return pos === 2 ? $('tr-rival') : $(`t4-${POS[pos]}`).querySelector('.t4-backs');
  }

  function say(pos, text) {
    if (pos === 0) TrucoUI.message(`Vos: ${text}`);
    else if (pos === 2) Table.setSpeech(text);
    else {
      const bubble = $(`t4-${POS[pos]}`).querySelector('.t4-speech');
      if (!bubble) return;
      bubble.textContent = text;
      bubble.hidden = false;
      clearTimeout(bubble.timer);
      bubble.timer = setTimeout(() => { bubble.hidden = true; }, 2600);
    }
  }

  // Mano nueva: arma la mesa; si recién se reparte, anima; si entrás a mitad de mano, acomoda.
  async function newHand(h) {
    buildSeats();
    $('t4-center').innerHTML = POS.map((pos) => `<div class="slot" data-pos="${pos}"></div>`).join('');
    $('t4-history').innerHTML = [0, 1, 2].map((i) => `<div class="t4-baza" data-i="${i}"><span class="mark"></span><div class="mini"></div></div>`).join('');
    $('tr-mine').replaceChildren();
    $('tr-rival').replaceChildren();
    els.clear();
    backs.forEach((b) => { b.length = 0; });
    const fresh = h.table.every((t) => t.length === 0);
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 4; k++) {
        const pos = (h.mano + k) % 4;
        if (i >= h.counts[pos]) continue;
        const el = pos === 0 ? parts().cardEl(h.myCards[i]) : parts().cardEl(null, true);
        if (pos === 0) {
          els.set(cardKey(h.myCards[i]), el);
          $('tr-mine').appendChild(el);
        } else {
          backs[pos].push(el);
          backsBox(pos).appendChild(el);
        }
        if (fresh) {
          Sound.sfx('card');
          const { dx, dy } = offset(el, $('shoe'));
          await animate(el, [{ transform: `translate(${dx}px, ${dy}px) scale(0.7)` }, { transform: 'none' }], 160);
        }
      }
    }
    // Entraste a mitad de mano: bazas jugadas y cartas de la baza actual.
    h.bazas.forEach((r, i) => markBaza(h, i, r, h.bazaWinners[i]));
    const cur = h.bazas.length;
    h.table.forEach((cards, pos) => {
      if (cards[cur]) $('t4-center').querySelector(`.slot[data-pos="${POS[pos]}"]`).replaceChildren(parts().cardEl(cards[cur]));
    });
  }

  function markBaza(h, i, result, winnerPos) {
    const box = $('t4-history').querySelector(`.t4-baza[data-i="${i}"]`);
    if (!box) return;
    const mark = box.querySelector('.mark');
    mark.textContent = result === 'parda' ? '=' : result === 'us' ? '✔' : '✖';
    mark.className = `mark ${result === 'parda' ? 'parda' : result === 'us' ? 'won' : 'lost'}`;
    if (winnerPos !== null && winnerPos !== undefined && h.table[winnerPos][i]) {
      box.querySelector('.mini').replaceChildren(parts().cardEl(h.table[winnerPos][i]));
    }
  }

  async function animatePlay(e) {
    let from;
    if (e.who === 0) {
      const old = els.get(cardKey(e.card));
      if (old) { from = old.getBoundingClientRect(); old.remove(); els.delete(cardKey(e.card)); }
    } else {
      const old = backs[e.who].pop();
      if (old) { from = old.getBoundingClientRect(); old.remove(); }
    }
    from = from || $('shoe').getBoundingClientRect();
    const el = parts().cardEl(e.card);
    $('t4-center').querySelector(`.slot[data-pos="${POS[e.who]}"]`).replaceChildren(el);
    Sound.sfx('card');
    const { dx, dy } = offset(el, from);
    await animate(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], 280);
  }

  async function renderEvents(h) {
    for (const e of v.events || []) {
      if (e.id <= ctx.lastEvent.get()) continue;
      ctx.lastEvent.set(e.id);
      const current = e.hand === v.handNumber;
      if (e.type === 'call' || e.type === 'response') {
        Sound.sfx(e.type === 'call' ? 'shop' : 'click');
        if (current) say(e.who, e.text);
        parts().log(`${nameAt(e.who)}: ${e.text}`);
        if (current) await wait(e.who === 0 ? 250 : 650);
      } else if (e.type === 'play') {
        if (current) await animatePlay(e);
      } else if (e.type === 'baza') {
        parts().log(e.result === 'parda' ? `Baza ${e.index + 1}: parda` : `Baza ${e.index + 1} para ${teamName(e.result)} (${nameAt(e.player)})`);
        if (!current) continue;
        const slot = e.player !== null ? $('t4-center').querySelector(`.slot[data-pos="${POS[e.player]}"] .card`) : null;
        if (slot) slot.classList.add('winner');
        markBaza(h, e.index, e.result, e.player);
        await wait(900);
        if (!(h.finished && e.index === h.bazas.length - 1)) $('t4-center').querySelectorAll('.slot').forEach((s) => s.replaceChildren());
      } else if (e.type === 'envido') {
        const text = e.values
          ? `Envido: ${nameAt(e.holder)} tiene ${e.winner === 'us' ? e.values.us : e.values.them} → ${teamName(e.winner)} +${e.points}`
          : `Envido no querido → ${teamName(e.winner)} +${e.points}`;
        if (current && e.values && e.holder !== 0) say(e.holder, `Tengo ${e.winner === 'us' ? e.values.us : e.values.them}.`);
        $('intel').textContent = text;
        parts().log(text);
        Sound.sfx(e.winner === 'us' ? 'coin' : 'push');
        if (current) await wait(1200);
      } else if (e.type === 'mazo') {
        if (current) say(e.who, 'Nos vamos al mazo.');
        parts().log(`${nameAt(e.who)}: nos vamos al mazo.`);
      } else if (e.type === 'end') {
        Sound.sfx(e.winner === 'us' ? 'win' : 'lose');
      }
    }
    for (const c of v.chat || []) {
      if (c.id <= ctx.lastChat.get()) continue;
      ctx.lastChat.set(c.id);
      if (c.from !== 0) say(c.from, `💬 ${c.text}`);
      parts().log(`💬 ${nameAt(c.from)}: ${c.text}`);
    }
  }

  // Señas de tu compañero (los rivales nunca las ven: el servidor ni se las manda).
  async function renderSenas() {
    for (const x of v.senas || []) {
      if (x.id <= lastSena) continue;
      lastSena = x.id;
      const s = Senas.getSena(x.sena);
      if (x.from === 2) {
        $('dealer').dataset.sena = x.sena;
        $('intel').textContent = `🤫 ${nameAt(2)}: ${s.icon} ${s.face.toLowerCase()} → ${s.means}`;
        parts().log(`🤫 ${nameAt(2)} te hizo una seña: ${s.icon} ${s.face.toLowerCase()} (${s.means.toLowerCase()})`);
        await wait(1500);
        delete $('dealer').dataset.sena;
      } else if (x.from === 0) {
        parts().log(`🤫 Le hiciste una seña a ${nameAt(2)}: ${s.icon} ${s.face.toLowerCase()}`);
      }
    }
  }

  function revealAll(h) {
    if (!h.reveal) return;
    for (const pos of [1, 2, 3]) {
      backs[pos].forEach((el, i) => {
        const card = h.reveal[pos][i];
        if (card) el.replaceWith(parts().cardEl(card));
      });
      backs[pos].length = 0;
    }
  }

  function describe(h) {
    if (h.finished) {
      return `Mano para ${teamName(h.winner)} → nosotros +${h.points.us}, ellos +${h.points.them}`;
    }
    const p = h.pending;
    if (p && h.canRespond) {
      const what = p.kind === 'truco' ? TRUCO_NAMES[p.level] : p.chain.map((c) => ENVIDO_NAMES[c]).join(' + ');
      return `${nameAt(p.caller)} cantó ${what}. ¿Qué respondés?`;
    }
    if (p) return 'Esperando la respuesta...';
    return h.turn === 0 ? 'Te toca. Jugá una carta o cantá.' : `${nameAt(h.turn)} está pensando...`;
  }

  function senaButton() {
    const btn = document.createElement('button');
    btn.className = 'phrase-btn';
    btn.textContent = '🤫 Señas';
    btn.onclick = () => {
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
        b.onclick = () => {
          menu.hidden = true;
          TrucoUI.message(`Le hiciste una seña a ${nameAt(2)}: ${s.icon} ${s.face.toLowerCase()}`);
          ctx.send('sena', { sena: s.id });
        };
        return b;
      }));
      menu.hidden = !menu.hidden;
    };
    return btn;
  }

  function renderControls(h) {
    $('tr-mine').querySelectorAll('.card').forEach((c) => { c.classList.remove('playable'); c.onclick = null; });
    const items = [];
    if (v.status === 'playing' && h && !h.finished && !byPos(2).empty) items.push(senaButton());
    items.push(ctx.phraseButton());
    if (!h || v.status === 'over') {
      $('truco-controls').replaceChildren(...items);
      return;
    }
    if (h.finished) {
      const next = document.createElement('button');
      next.className = 'btn-orange big';
      next.textContent = 'Siguiente mano';
      next.onclick = () => ctx.send('next');
      items.push(next);
    } else {
      for (const a of h.actions) {
        if (a.type === 'play') continue;
        const [label, cls] = a.type === 'truco' ? [parts().trucoLabel(h), 'btn-orange'] : parts().LABELS[a.type];
        const b = document.createElement('button');
        b.textContent = label;
        if (cls) b.className = cls;
        b.onclick = () => ctx.send('act', { move: a });
        items.push(b);
      }
      if (h.actions.some((a) => a.type === 'play')) {
        h.myCards.forEach((card, index) => {
          const el = els.get(cardKey(card));
          if (!el) return;
          el.classList.add('playable');
          el.onclick = () => ctx.send('act', { move: { type: 'play', index } });
        });
      }
    }
    $('truco-controls').replaceChildren(...items);
  }

  function renderHud() {
    $('cycle').parentElement.innerHTML = `ONLINE DE A 4 <b id="cycle">A ${v.target}</b>`;
    const us = v.scores ? v.scores.us : 0;
    const them = v.scores ? v.scores.them : 0;
    $('quota-label').textContent = 'Nosotros – Ellos';
    $('quota').textContent = `${us} – ${them}`;
    $('quota').className = us >= them ? 'ok' : 'warn';
    $('hand-label').textContent = 'Mano';
    $('hand').textContent = v.handNumber || '–';
    $('minbet-label').textContent = 'Es mano';
    $('minbet').textContent = v.hand ? nameAt(v.hand.mano) : '–';
    $('story-timer').hidden = true;
  }

  function renderEnd() {
    const won = v.winner === 'us';
    $('gameover-title').textContent = won ? '🏆 ¡Ganaron la partida!' : '💀 Perdieron la partida';
    $('gameover-reason').textContent = `Nosotros ${v.scores.us} – ${v.scores.them} Ellos`;
    $('gameover-stats').textContent = v.rematch.me && v.rematch.waiting.length
      ? `Esperando la revancha de: ${v.rematch.waiting.join(', ')}` : v.rematch.waiting.length < v.players.filter((p) => !p.bot && !p.empty).length
        ? 'Alguien pidió la revancha. ¿Se animan?' : '';
    $('gameover-ranks').hidden = true;
    $('btn-gameover-ranks').hidden = true;
    $('btn-restart').textContent = v.rematch.me ? 'Revancha pedida' : '🔁 Revancha';
    $('btn-restart').disabled = v.rematch.me;
    if ($('gameover').hidden) Sound.sfx(won ? 'victory' : 'deckLost');
    $('gameover').hidden = false;
  }

  async function render(view, context) {
    ctx = context;
    v = view;
    document.body.dataset.table = '4';
    renderHud();
    if (v.status === 'waiting') {
      renderLobby();
      return;
    }
    $('t4-lobby').hidden = true;
    if (v.status !== 'over') $('gameover').hidden = true;
    const h = v.hand;
    if (h) {
      const id = `${v.matchNo}:${v.handNumber}`;
      if (id !== handId) {
        handId = id;
        controlsSig = null;
        await newHand(h);
      }
      await renderSenas();
      await renderEvents(h);
      if (h.finished) revealAll(h);
      TrucoUI.message(describe(h));
      $('message').className = `message ${h.finished ? (h.winner === 'us' ? 'good' : 'bad') : ''}`;
      if (v.left !== null) $('intel').textContent = `⚠️ ${nameAt(v.left)} salió de la sala`;
    }
    const sig = JSON.stringify([v.status, v.matchNo, h && h.actions, h && h.finished, h && h.myCards]);
    if (sig !== controlsSig) {
      controlsSig = sig;
      renderControls(h);
    }
    if (v.status === 'over') renderEnd();
  }

  function stop() {
    reset();
    delete document.body.dataset.table;
    if ($('dealer')) delete $('dealer').dataset.sena;
    if ($('sena-menu')) $('sena-menu').hidden = true;
    if ($('t4-lobby')) $('t4-lobby').hidden = true;
    ['t4-center', 't4-history', 't4-left', 't4-right'].forEach((id) => $(id) && $(id).replaceChildren());
  }

  root.Truco4Online = { render, stop, reset, invalidate: () => { controlsSig = null; } };
})(window);
