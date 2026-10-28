// Mesa animada: el crupier saca las cartas del sabot y las reparte una por una.
(function (root) {
  const $ = (id) => document.getElementById(id);
  // Las animaciones del reparto son parte del juego: se muestran aunque el sistema
  // tenga activado "reducir movimiento" (en Windows suele venir así).
  const DEAL_MS = 380;
  const PAUSE_MS = 150;
  const FULL_SHOE = 104;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Cartas que ya están dibujadas en la mesa (mismos objetos que en Game).
  // Cada mano del jugador: { cards, box, handEl, scoreEl, betEl }.
  const shown = { hands: [], dealer: [], holeHidden: false };
  let game = null;

  function cardEl(card, faceDown = false, peek = false) {
    const el = document.createElement('div');
    el.className = 'card';
    if (faceDown && !peek) {
      el.classList.add('back');
      return el;
    }
    if (peek) el.classList.add('peek');
    el.style.color = Pixel.SUIT_COLORS[card.suit];
    const corner = `${card.rank}${Pixel.suit(card.suit)}`;
    el.innerHTML = `<span class="tl">${corner}</span><span class="mid">${Pixel.suit(card.suit)}</span><span class="br">${corner}</span>`;
    return el;
  }

  function createHand() {
    const box = document.createElement('div');
    box.className = 'hand-box';
    box.innerHTML = '<div class="hand"></div><div class="hand-info"><span class="score"></span><span class="hand-bet"></span></div>';
    return {
      cards: [],
      box,
      handEl: box.querySelector('.hand'),
      scoreEl: box.querySelector('.score'),
      betEl: box.querySelector('.hand-bet'),
    };
  }

  function animate(el, keyframes, ms, opts = {}) {
    if (!ms || !el.animate) return Promise.resolve();
    return el.animate(keyframes, { duration: ms, easing: 'cubic-bezier(.2,.7,.3,1)', ...opts }).finished;
  }

  // Desplazamiento desde el centro de `el` hasta el centro de `target`.
  function offset(el, target) {
    const a = el.getBoundingClientRect();
    const b = target.getBoundingClientRect ? target.getBoundingClientRect() : target;
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

  // `target` es 'dealer' o una mano del jugador.
  async function dealCard(target, card) {
    const isDealer = target === 'dealer';
    const faceDown = isDealer && shown.dealer.length === 1;
    const el = cardEl(card, faceDown, faceDown && peekHole());
    const dealer = $('dealer');
    dealer.classList.add('reach');
    await wait(PAUSE_MS);
    dealer.classList.replace('reach', 'toss');
    if (isDealer) {
      $('dealer-hand').appendChild(el);
      shown.dealer.push(card);
    } else {
      target.handEl.appendChild(el);
      target.cards.push(card);
    }
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

  async function discardLast(hand) {
    const el = hand.handEl.lastElementChild;
    if (el) {
      await flyTo(el, $('discard'));
      el.remove();
    }
    hand.cards.pop();
    updateScores();
  }

  // Al dividir, la segunda carta se desliza hasta una mano nueva.
  async function moveSplitCards() {
    const moves = [];
    for (let i = 0; i < game.hands.length; i++) {
      const first = game.hands[i].cards[0];
      if (shown.hands[i] && shown.hands[i].cards[0] === first) continue;
      const from = shown.hands.find((h) => h.cards.includes(first));
      if (!from) return;
      const idx = from.cards.indexOf(first);
      const el = from.handEl.children[idx];
      const before = el.getBoundingClientRect();
      const hand = createHand();
      $('player-hands').insertBefore(hand.box, shown.hands[i] ? shown.hands[i].box : null);
      hand.handEl.appendChild(el);
      from.cards.splice(idx, 1);
      hand.cards.push(first);
      shown.hands.splice(i, 0, hand);
      moves.push([el, before]);
    }
    await Promise.all(moves.map(([el, before]) => {
      const { dx, dy } = offset(el, before);
      return animate(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], DEAL_MS);
    }));
    updateScores();
  }

  async function sweep() {
    const els = [...$('dealer-hand').children, ...shown.hands.flatMap((h) => [...h.handEl.children])];
    await Promise.all(els.map((el, i) => flyTo(el, $('discard'), i * 50)));
    clearHands();
  }

  function clearHands() {
    $('dealer-hand').replaceChildren();
    $('player-hands').replaceChildren();
    shown.hands = [];
    shown.dealer = [];
    shown.holeHidden = false;
    updateScores();
  }

  const isPrefix = (a, b) => a.length <= b.length && a.every((c, i) => c === b[i]);

  // Lleva la mesa al estado del juego animando cada carta nueva en el orden real del reparto.
  async function sync(g) {
    game = g;
    if (!game.hands.length && !game.dealer.length) {
      if (shown.hands.length || shown.dealer.length) await sweep();
      updateShoe();
      return;
    }
    if (!isPrefix(shown.dealer, game.dealer)) clearHands();

    if (!shown.hands.length) {
      // Reparto inicial: jugador, crupier, jugador, crupier (boca abajo).
      const hand = createHand();
      $('player-hands').appendChild(hand.box);
      shown.hands.push(hand);
      const cards = game.hands[0].cards;
      for (let i = 0; i < 2; i++) {
        if (cards[i]) await dealCard(hand, cards[i]);
        if (game.dealer[i]) await dealCard('dealer', game.dealer[i]);
      }
    }

    await moveSplitCards();
    for (let i = 0; i < game.hands.length; i++) {
      const hand = shown.hands[i];
      while (!isPrefix(hand.cards, game.hands[i].cards)) await discardLast(hand);
      for (const card of game.hands[i].cards.slice(hand.cards.length)) await dealCard(hand, card);
    }

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
    markHands();
    updateScores();
    updateShoe();
  }

  // Resalta la mano activa y, al terminar, cuáles ganaron o perdieron.
  function markHands() {
    const multi = game.hands.length > 1;
    shown.hands.forEach((hand, i) => {
      const data = game.hands[i];
      const res = game.phase === 'roundOver' && game.result && game.result.hands ? game.result.hands[i] : null;
      hand.box.classList.toggle('active', multi && game.phase === 'playing' && i === game.handIndex);
      hand.box.classList.toggle('won', multi && !!res && res.net > 0);
      hand.box.classList.toggle('lost', multi && !!res && res.net < 0);
      hand.betEl.textContent = multi || data.doubled ? `$${data.bet}` : '';
    });
  }

  function updateScores() {
    for (const hand of shown.hands) {
      if (!hand.cards.length) {
        hand.scoreEl.textContent = '';
        continue;
      }
      const v = Cards.handValue(hand.cards, game.bustLimit);
      hand.scoreEl.textContent = `${v.total}${v.soft && v.total < game.bustLimit ? ' suave' : ''}`;
    }
    const d = $('dealer-score');
    if (!shown.dealer.length) d.textContent = '';
    else if (shown.holeHidden && !peekHole()) d.textContent = Cards.cardValue(shown.dealer[0]);
    else d.textContent = Cards.handValue(shown.dealer).total;
  }

  // Altura del sabot y del descarte según las cartas que quedan.
  function updateShoe() {
    if (!game) return;
    const left = Math.min(1, game.deck.length / FULL_SHOE);
    $('shoe-cards').style.setProperty('--fill', left.toFixed(3));
    const onTable = shown.dealer.length + shown.hands.reduce((n, h) => n + h.cards.length, 0);
    const used = Math.max(0, FULL_SHOE - game.deck.length - onTable);
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

  $('dealer-sprite').innerHTML = Pixel.dealer();

  root.Table = { sync, setSpeech, setMood, renderBet };
})(window);
