// Interfaz: dibuja el estado de Game y conecta los botones.
(function () {
  const { Game, HANDS_PER_CYCLE, SHOP_EVERY, MAX_BONUSES, OUTCOME_TEXT, formatNet } = GameModule;
  const { RARITY, getBonus } = Bonuses;

  const $ = (id) => document.getElementById(id);
  const game = new Game();
  const HIGHSCORE_KEY = 'luckjack.best';

  function loadBest() {
    try { return JSON.parse(localStorage.getItem(HIGHSCORE_KEY)) || null; } catch { return null; }
  }

  function saveBest(best) {
    try { localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(best)); } catch { /* sin storage */ }
  }

  // --- Render de cartas ---
  function cardEl(card, hidden = false, peek = false) {
    const el = document.createElement('div');
    el.className = 'card';
    if (hidden && !peek) {
      el.classList.add('back');
      return el;
    }
    if (Cards.isRed(card)) el.classList.add('red');
    if (peek) el.classList.add('peek');
    el.innerHTML = `<span class="tl">${card.rank}<br>${card.suit}</span><span class="mid">${card.suit}</span><span class="br">${card.rank}<br>${card.suit}</span>`;
    return el;
  }

  function renderHands() {
    const playing = game.phase === 'playing';
    const dealerHand = $('dealer-hand');
    const playerHand = $('player-hand');
    dealerHand.replaceChildren(...game.dealer.map((c, i) =>
      cardEl(c, playing && i === 1, playing && i === 1 && game.has('ojo'))));
    playerHand.replaceChildren(...game.player.map((c) => cardEl(c)));

    if (game.player.length) {
      const pv = game.playerValue();
      $('player-score').textContent = `${pv.total}${pv.soft && pv.total < game.bustLimit ? ' (suave)' : ''}`;
    } else {
      $('player-score').textContent = '';
    }
    if (game.dealer.length) {
      $('dealer-score').textContent = playing && !game.has('ojo')
        ? Cards.cardValue(game.dealer[0])
        : game.dealerValue().total;
    } else {
      $('dealer-score').textContent = '';
    }
  }

  function renderIntel() {
    const parts = [];
    if (game.phase === 'playing') {
      if (game.has('contador')) parts.push(`🧮 Riesgo de pasarte: <b>${Math.round(game.bustChance() * 100)}%</b>`);
      if (game.has('rayos')) {
        const n = game.peekNext();
        parts.push(`🩻 Próxima carta: <b class="${Cards.isRed(n) ? 'red' : ''}">${n.rank}${n.suit}</b>`);
      }
    }
    if (game.phase === 'betting' && game.has('rayos')) {
      const n = game.peekNext();
      parts.push(`🩻 Próxima carta: <b class="${Cards.isRed(n) ? 'red' : ''}">${n.rank}${n.suit}</b>`);
    }
    if (game.has('escudo')) parts.push(game.shieldUsed ? '🛡️ Escudo usado' : '🛡️ Escudo listo');
    if (game.has('racha') && game.streak > 0) parts.push(`🔥 Racha: ${game.streak}`);
    $('intel').innerHTML = parts.join(' · ');
  }

  function renderMessage() {
    const msg = $('message');
    msg.className = 'message';
    if (game.phase === 'betting') {
      const left = game.quota - game.money;
      msg.textContent = left > 0
        ? `Te faltan $${left} para la cuota. Quedan ${HANDS_PER_CYCLE - game.handInCycle + 1} manos.`
        : '¡Ya superaste la cuota de este ciclo! Seguí sumando para la tienda.';
    } else if (game.phase === 'playing') {
      msg.textContent = `Apostaste $${game.bet}. ¿Pedís o te plantás?`;
    } else if (game.phase === 'roundOver' && game.result) {
      const r = game.result;
      msg.textContent = `${OUTCOME_TEXT[r.outcome]} · ${formatNet(r.net)}`;
      msg.classList.add(r.net > 0 ? 'good' : r.net < 0 ? 'bad' : 'neutral');
    }
  }

  function bonusTile(id, extra) {
    const b = getBonus(id);
    const el = document.createElement('div');
    el.className = `bonus ${b.rarity}`;
    el.title = `${b.name}: ${b.desc}`;
    el.innerHTML = `<span class="icon">${b.icon}</span><span class="name">${b.name}</span>`;
    if (extra) el.appendChild(extra);
    return el;
  }

  function renderBonusBar() {
    const bar = $('bonus-bar');
    const tiles = game.bonuses.map((id) => bonusTile(id));
    for (let i = game.bonuses.length; i < MAX_BONUSES; i++) {
      const empty = document.createElement('div');
      empty.className = 'bonus empty';
      empty.textContent = 'vacío';
      tiles.push(empty);
    }
    bar.replaceChildren(...tiles);
  }

  function renderHud() {
    $('money').textContent = `$${game.money}`;
    $('cycle').textContent = game.cycle;
    $('hand').textContent = `${Math.min(game.handInCycle, HANDS_PER_CYCLE)}/${HANDS_PER_CYCLE}`;
    $('quota').textContent = `$${game.quota}`;
    $('quota').className = game.money >= game.quota ? 'ok' : 'warn';
    $('minbet').textContent = `$${game.minBet}`;
    const deck = game.deckInfo;
    const lives = Decks.DECK_SEQUENCE.length;
    $('deck').textContent = `${deck.icon} ${'●'.repeat(game.decksLeft)}${'○'.repeat(lives - game.decksLeft)}`;
    $('deck-stat').className = `stat deck-stat ${deck.id}`;
    $('deck-stat').title = `${deck.name}: ${deck.desc} Te quedan ${game.decksLeft} de ${lives} mazos.`;
  }

  function renderControls() {
    $('bet-controls').hidden = game.phase !== 'betting';
    $('play-controls').hidden = game.phase !== 'playing';
    $('next-controls').hidden = game.phase !== 'roundOver';
    if (game.phase === 'betting') {
      const input = $('bet-input');
      input.min = game.minBet;
      input.max = game.money;
      const current = Number(input.value);
      if (!current || current < game.minBet || current > game.money) {
        input.value = Math.min(Math.max(game.lastBet, game.minBet), game.money);
      }
      $('btn-deal').disabled = !game.canBet(Number(input.value));
    }
    if (game.phase === 'playing') {
      $('btn-double').disabled = !game.canDouble();
      $('btn-discard').hidden = !game.has('segunda');
      $('btn-discard').disabled = !game.canDiscard();
    }
    if (game.phase === 'roundOver') {
      $('btn-next').textContent = game.handInCycle >= HANDS_PER_CYCLE ? 'Terminar ciclo'
        : game.handInCycle % SHOP_EVERY === 0 ? 'Ir a la tienda' : 'Siguiente mano';
    }
  }

  function renderLog() {
    $('log').replaceChildren(...game.log.map((line) => {
      const li = document.createElement('li');
      li.textContent = line;
      return li;
    }));
  }

  function renderShop() {
    const shop = $('shop');
    shop.hidden = game.phase !== 'shop';
    if (game.phase !== 'shop') return;
    const free = !!game.shop.free;
    $('shop-title').textContent = free ? '🎁 Bonus inicial gratis' : '🛒 Tienda';
    $('shop-free-sub').hidden = !free;
    $('shop-sub').hidden = free;
    $('shop-owned-wrap').hidden = free;
    $('btn-reroll').hidden = free;
    $('btn-leave').textContent = free ? 'Arrancar sin bonus' : 'Seguir jugando →';
    $('btn-leave').classList.toggle('primary', !free);
    $('shop-money').textContent = `$${game.money}`;
    // A mitad de ciclo se muestra la cuota actual; al final, la del próximo ciclo.
    const nextCycle = game.shop.midCycle ? game.cycle : game.cycle + 1;
    $('shop-quota-label').textContent = game.shop.midCycle
      ? `Cuota (quedan ${HANDS_PER_CYCLE - game.handInCycle} manos)` : 'Próxima cuota';
    $('shop-quota').textContent = `$${game.quotaFor(nextCycle)}`;
    $('shop-minbet').textContent = `$${game.minBetFor(nextCycle)}`;

    const offers = game.shop.offers.map((b) => {
      const el = document.createElement('div');
      el.className = `offer ${b.rarity}`;
      const price = game.priceOf(b);
      el.innerHTML = `
        <div class="icon">${b.icon}</div>
        <div class="name">${b.name}</div>
        <div class="rarity">${RARITY[b.rarity].label}</div>
        <p>${b.desc}</p>`;
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = free ? 'Elegir' : `Comprar $${price}`;
      btn.disabled = !game.canBuy(b);
      if (game.bonuses.length >= MAX_BONUSES) btn.title = 'No tenés lugar: vendé un bonus primero';
      btn.onclick = () => { game.buy(b.id); render(); };
      el.appendChild(btn);
      return el;
    });
    if (!offers.length) {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = 'No quedan ofertas. Podés cambiarlas o seguir jugando.';
      offers.push(p);
    }
    $('shop-offers').replaceChildren(...offers);

    const deckOffer = game.shop.deckOffer;
    $('shop-deck').hidden = !deckOffer;
    if (deckOffer) {
      $('shop-deck').innerHTML = `
        <div class="icon">${deckOffer.icon}</div>
        <div class="info"><div class="name">¡${deckOffer.name}! <span class="rarity">Oferta especial</span></div>
        <p>${deckOffer.desc}</p></div>`;
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = `Comprar $${game.deckPrice()}`;
      btn.disabled = !game.canBuyDeck();
      btn.onclick = () => { game.buyDeck(); render(); };
      $('shop-deck').appendChild(btn);
    }

    $('slots').textContent = `(${game.bonuses.length}/${MAX_BONUSES})`;
    const owned = game.bonuses.map((id) => {
      const btn = document.createElement('button');
      btn.className = 'sell';
      btn.textContent = `Vender $${game.sellValue(id)}`;
      btn.onclick = () => { game.sell(id); render(); };
      const tile = bonusTile(id, btn);
      const desc = document.createElement('p');
      desc.textContent = getBonus(id).desc;
      tile.insertBefore(desc, btn);
      return tile;
    });
    if (!owned.length) {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = 'Todavía no tenés bonuses.';
      owned.push(p);
    }
    $('shop-owned').replaceChildren(...owned);

    const reroll = $('btn-reroll');
    reroll.textContent = `🔄 Cambiar ofertas ($${game.shop.rerollCost})`;
    reroll.disabled = game.money < game.shop.rerollCost;
  }

  function renderDeckLost() {
    $('decklost').hidden = game.phase !== 'deckLost';
    if (game.phase !== 'deckLost') return;
    const d = game.deckInfo;
    $('decklost-reason').textContent = game.deckLostReason;
    $('decklost-next').innerHTML = `Ahora jugás con el <b>${d.icon} ${d.name}</b>: ${d.desc} ` +
      (game.decksLeft === 1 ? '<b>Es tu último mazo.</b>' : `Te quedan ${game.decksLeft} mazos.`);
  }

  function renderGameOver() {
    const el = $('gameover');
    el.hidden = game.phase !== 'gameover';
    if (game.phase !== 'gameover') return;
    const cleared = game.maxCleared;
    let best = loadBest();
    const isRecord = !best || cleared > best.cycles || (cleared === best.cycles && game.money > best.money);
    if (isRecord && !el.dataset.saved) {
      best = { cycles: cleared, money: game.money };
      saveBest(best);
    }
    el.dataset.saved = '1';
    $('gameover-reason').textContent = game.gameOverReason;
    $('gameover-stats').innerHTML =
      `Ciclos superados: <b>${cleared}</b> · Manos jugadas: <b>${game.handsPlayed}</b><br>` +
      (isRecord ? '🏆 ¡Nuevo récord!' : `Récord: ${best.cycles} ciclos`);
  }

  function render() {
    renderHud();
    renderBonusBar();
    renderHands();
    renderIntel();
    renderMessage();
    renderControls();
    renderLog();
    renderShop();
    renderDeckLost();
    renderGameOver();
  }

  // --- Eventos ---
  document.querySelectorAll('.chip[data-delta]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $('bet-input');
      const v = Number(input.value) + Number(btn.dataset.delta);
      input.value = Math.min(Math.max(v, game.minBet), game.money);
      renderControls();
    });
  });
  $('bet-max').addEventListener('click', () => { $('bet-input').value = game.money; renderControls(); });
  $('bet-input').addEventListener('input', renderControls);
  $('btn-deal').addEventListener('click', () => {
    const amount = Number($('bet-input').value);
    if (game.canBet(amount)) { game.deal(amount); render(); }
  });
  $('btn-hit').addEventListener('click', () => { game.hit(); render(); });
  $('btn-stand').addEventListener('click', () => { game.stand(); render(); });
  $('btn-double').addEventListener('click', () => { game.double(); render(); });
  $('btn-discard').addEventListener('click', () => { game.discard(); render(); });
  $('btn-next').addEventListener('click', () => { game.nextHand(); render(); });
  $('btn-reroll').addEventListener('click', () => { game.reroll(); render(); });
  $('btn-leave').addEventListener('click', () => { game.leaveShop(); render(); });
  $('btn-continue').addEventListener('click', () => {
    game.continueWithNextDeck();
    $('bet-input').value = '';
    render();
  });
  $('btn-restart').addEventListener('click', () => {
    game.reset();
    delete $('gameover').dataset.saved;
    $('bet-input').value = '';
    render();
  });
  $('btn-help').addEventListener('click', () => { $('help').hidden = false; });
  $('btn-close-help').addEventListener('click', () => { $('help').hidden = true; });

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.key !== 'Enter') return;
    const k = e.key.toLowerCase();
    if (game.phase === 'betting' && k === 'enter') $('btn-deal').click();
    else if (game.phase === 'playing') {
      if (k === 'h' || k === 'p') $('btn-hit').click();
      else if (k === 's') $('btn-stand').click();
      else if (k === 'd' && game.canDouble()) $('btn-double').click();
      else if (k === 'r' && game.canDiscard()) $('btn-discard').click();
    } else if (game.phase === 'roundOver' && (k === 'enter' || k === ' ')) {
      e.preventDefault();
      $('btn-next').click();
    }
  });

  try {
    if (!localStorage.getItem('luckjack.seenHelp')) {
      $('help').hidden = false;
      localStorage.setItem('luckjack.seenHelp', '1');
    }
  } catch { $('help').hidden = false; }
  render();
})();
