// Mesa animada: el crupier saca las cartas del sabot y las reparte una por una.
(function (root) {
  const $ = (id) => document.getElementById(id);
  const reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEAL_MS = reduceMotion ? 0 : 380;
  const PAUSE_MS = reduceMotion ? 0 : 150;
  const FULL_SHOE = 104;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Cartas que ya están dibujadas en la mesa (mismos objetos que en Game).
  const shown = { player: [], dealer: [], holeHidden: false };
  let game = null;

  function cardEl(card, faceDown = false, peek = false) {
    const el = document.createElement('div');
    el.className = 'card';
    if (faceDown && !peek) {
      el.classList.add('back');
      return el;
    }
    if (Cards.isRed(card)) el.classList.add('red');
    if (peek) el.classList.add('peek');
    el.innerHTML = `<span class="tl">${card.rank}<br>${card.suit}</span><span class="mid">${card.suit}</span><span class="br">${card.rank}<br>${card.suit}</span>`;
    return el;
  }

  function animate(el, keyframes, ms, opts = {}) {
    if (!ms || !el.animate) return Promise.resolve();
    return el.animate(keyframes, { duration: ms, easing: 'cubic-bezier(.2,.7,.3,1)', ...opts }).finished;
  }

  // Desplazamiento desde el centro de `el` hasta el centro de `target`.
  function offset(el, target) {
    const a = el.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    return { dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height / 2 - (a.top + a.height / 2) };
  }

  function flyFrom(el, source) {
    const { dx, dy } = offset(el, source);
    return animate(el, [
      { transform: `translate(${dx}px, ${dy}px) rotate(-80deg) scale(0.7)` },
      { transform: 'none' },
    ], DEAL_MS, { fill: 'backwards' });
  }

  function flyTo(el, target, delay = 0) {
    const { dx, dy } = offset(el, target);
    return animate(el, [
      { transform: 'none', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(90deg) scale(0.6)`, opacity: 0.2 },
    ], DEAL_MS, { fill: 'forwards', delay });
  }

  function peekHole() {
    return game.has('ojo');
  }

  async function dealCard(who, card) {
    const faceDown = who === 'dealer' && shown.dealer.length === 1;
    const el = cardEl(card, faceDown, faceDown && peekHole());
    const dealer = $('dealer');
    dealer.classList.add('reach');
    await wait(PAUSE_MS);
    dealer.classList.replace('reach', 'toss');
    $(`${who}-hand`).appendChild(el);
    shown[who].push(card);
    if (faceDown) shown.holeHidden = true;
    updateShoe();
    await flyFrom(el, $('shoe'));
    dealer.classList.remove('toss');
    updateScores();
  }

  async function revealHole() {
    const el = $('dealer-hand').children[1];
    const face = cardEl(shown.dealer[1]);
    if (el) {
      await animate(el, [{ transform: 'none' }, { transform: 'rotateY(90deg)' }], DEAL_MS / 2, { fill: 'forwards' });
      el.replaceWith(face);
      await animate(face, [{ transform: 'rotateY(90deg)' }, { transform: 'none' }], DEAL_MS / 2);
    }
    shown.holeHidden = false;
    updateScores();
  }

  async function discardLastPlayerCard() {
    const el = $('player-hand').lastElementChild;
    if (el) {
      await flyTo(el, $('discard'));
      el.remove();
    }
    shown.player.pop();
    updateScores();
  }

  async function sweep() {
    const els = [...$('dealer-hand').children, ...$('player-hand').children];
    await Promise.all(els.map((el, i) => flyTo(el, $('discard'), i * 50)));
    clearHands();
  }

  function clearHands() {
    $('dealer-hand').replaceChildren();
    $('player-hand').replaceChildren();
    shown.player = [];
    shown.dealer = [];
    shown.holeHidden = false;
    updateScores();
  }

  const isPrefix = (a, b) => a.length <= b.length && a.every((c, i) => c === b[i]);

  // Lleva la mesa al estado del juego animando cada carta nueva en el orden real del reparto.
  async function sync(g) {
    game = g;
    if (!game.player.length && !game.dealer.length) {
      if (shown.player.length || shown.dealer.length) await sweep();
      updateShoe();
      return;
    }
    if (!isPrefix(shown.dealer, game.dealer)) clearHands();
    while (!isPrefix(shown.player, game.player)) await discardLastPlayerCard();

    if (!shown.player.length && !shown.dealer.length) {
      // Reparto inicial: jugador, crupier, jugador, crupier (boca abajo).
      for (let i = 0; i < 2; i++) {
        if (game.player[i]) await dealCard('player', game.player[i]);
        if (game.dealer[i]) await dealCard('dealer', game.dealer[i]);
      }
    }
    for (const card of game.player.slice(shown.player.length)) await dealCard('player', card);

    if (game.phase !== 'playing' && shown.holeHidden) {
      await wait(PAUSE_MS);
      await revealHole();
    }
    for (const card of game.dealer.slice(shown.dealer.length)) {
      await wait(PAUSE_MS * 2);
      await dealCard('dealer', card);
    }
    if (shown.holeHidden) {
      // El bonus Ojo del Crupier puede comprarse/venderse entre manos: refresca la carta oculta.
      const el = $('dealer-hand').children[1];
      if (el) el.replaceWith(cardEl(shown.dealer[1], true, peekHole()));
    }
    updateScores();
    updateShoe();
  }

  function updateScores() {
    const p = $('player-score');
    const d = $('dealer-score');
    if (shown.player.length) {
      const v = Cards.handValue(shown.player, game.bustLimit);
      p.textContent = `${v.total}${v.soft && v.total < game.bustLimit ? ' suave' : ''}`;
    } else {
      p.textContent = '';
    }
    if (!shown.dealer.length) d.textContent = '';
    else if (shown.holeHidden && !peekHole()) d.textContent = Cards.cardValue(shown.dealer[0]);
    else d.textContent = Cards.handValue(shown.dealer).total;
  }

  // Altura del sabot y del descarte según las cartas que quedan.
  function updateShoe() {
    if (!game) return;
    const left = Math.min(1, game.deck.length / FULL_SHOE);
    $('shoe-cards').style.setProperty('--fill', left.toFixed(3));
    const used = Math.max(0, FULL_SHOE - game.deck.length - shown.player.length - shown.dealer.length);
    $('discard-pile').style.setProperty('--fill', Math.min(1, used / FULL_SHOE).toFixed(3));
  }

  // --- Crupier ---
  function setSpeech(text) {
    const el = $('speech');
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    if (el.textContent === text && !el.hidden) return;
    el.textContent = text;
    el.hidden = false;
    // reinicia la animación del globo
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  function setMood(mood, nervous) {
    const d = $('dealer');
    d.classList.toggle('happy', mood === 'happy');
    d.classList.toggle('sad', mood === 'sad');
    d.classList.toggle('nervous', !!nervous);
  }

  // --- Fichas de la apuesta ---
  const CHIPS = [
    { value: 100, cls: 'c-black' },
    { value: 25, cls: 'c-green' },
    { value: 10, cls: 'c-blue' },
    { value: 5, cls: 'c-red' },
    { value: 1, cls: 'c-white' },
  ];

  function renderBet(amount) {
    const discs = [];
    let rest = amount || 0;
    for (const chip of CHIPS) {
      while (rest >= chip.value && discs.length < 12) {
        discs.push(chip.cls);
        rest -= chip.value;
      }
    }
    $('bet-chips').replaceChildren(...discs.reverse().map((cls, i) => {
      const el = document.createElement('div');
      el.className = `chip-disc ${cls}`;
      el.style.bottom = `${i * 4}px`;
      return el;
    }));
    $('bet-amount').textContent = amount ? `$${amount}` : '';
  }

  root.Table = { sync, setSpeech, setMood, renderBet };
})(window);
