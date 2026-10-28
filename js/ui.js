// Interfaz: dibuja el estado de Game y conecta los botones.
(function () {
  const { Game, HANDS_PER_CYCLE, SHOP_EVERY, MAX_BONUSES, OUTCOME_TEXT, formatNet } = GameModule;
  const { RARITY, getBonus } = Bonuses;

  const $ = (id) => document.getElementById(id);
  const game = new Game();
  const HIGHSCORE_KEY = 'luckjack.best';

  // Primero se animan las cartas; el resto (dinero, mensajes, tienda) se muestra
  // recién cuando terminan, para no adelantar el resultado.
  let busy = false;
  let queue = Promise.resolve();

  function loadBest() {
    try { return JSON.parse(localStorage.getItem(HIGHSCORE_KEY)) || null; } catch { return null; }
  }

  function saveBest(best) {
    try { localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(best)); } catch { /* sin storage */ }
  }

  function renderIntel() {
    const parts = [];
    if (game.phase === 'playing') {
      if (game.has('contador') && !game.bustPending) parts.push(`🧮 Riesgo de pasarte: <b>${Math.round(game.bustChance() * 100)}%</b>`);
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
      const which = game.hands.length > 1 ? `Mano ${game.handIndex + 1} de ${game.hands.length}. ` : '';
      msg.textContent = game.bustPending
        ? `${which}Te pasaste. ¿Usás tu Segunda Oportunidad?`
        : `${which}Apostaste $${game.bet}. ¿Pedís o te plantás?`;
    } else if (game.phase === 'roundOver' && game.result) {
      const r = game.result;
      const detail = r.hands.length > 1
        ? r.hands.map((h, i) => `M${i + 1} ${OUTCOME_TEXT[h.outcome].split(' ')[0]}`).join(' · ') + ' → '
        : `${OUTCOME_TEXT[r.outcome]} · `;
      msg.textContent = `${detail}${formatNet(r.net)}`;
      msg.classList.add(r.net > 0 ? 'good' : r.net < 0 ? 'bad' : 'neutral');
    }
  }

  function bonusTile(id, extra) {
    const b = getBonus(id);
    const el = document.createElement('div');
    el.className = `bonus ${b.rarity}`;
    el.dataset.name = `${b.name} · ${RARITY[b.rarity].label}`;
    el.dataset.desc = b.desc;
    el.tabIndex = 0;
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
    $('bonus-count').textContent = `${game.bonuses.length}/${MAX_BONUSES}`;
  }

  function renderHud() {
    $('money').textContent = `$${game.money}`;
    $('cycle').textContent = game.cycle;
    $('hand').textContent = `${Math.min(game.handInCycle, HANDS_PER_CYCLE)}/${HANDS_PER_CYCLE}`;
    $('quota').textContent = `$${game.quota}`;
    $('quota').className = game.money >= game.quota ? 'ok' : 'warn';
    const fill = Math.min(100, Math.round((game.money / game.quota) * 100));
    $('quota-fill').style.setProperty('--fill', `${fill}%`);
    $('quota-fill').classList.toggle('full', fill >= 100);
    $('minbet').textContent = `$${game.minBet}`;
    const deck = game.deckInfo;
    const lives = Decks.DECK_SEQUENCE.length;
    $('deck').textContent = `${deck.icon} ${'●'.repeat(game.decksLeft)}${'○'.repeat(lives - game.decksLeft)}`;
    $('deck-stat').className = `stat deck-stat ${deck.id}`;
    const extra = game.upgradeTotal('suerte') ? ` Mejora de Suerte: +${game.upgradeTotal('suerte')}%.` : '';
    $('deck-stat').title = `${deck.name}: ${deck.desc} Te quedan ${game.decksLeft} de ${lives} mazos.${extra}`;
  }

  const DEALER_LINES = {
    betting: ['Hagan sus apuestas.', '¿Cuánto apostamos?', 'Mesa abierta. Suerte.', 'Cuando quiera.'],
    playing: ['¿Carta o se planta?', 'Usted decide.', '¿Otra?'],
    blackjack: '¡Blackjack! Felicitaciones.',
    win: 'Gana usted. Bien jugado.',
    dealerBust: 'Uf... me pasé.',
    charlie: '¡Cinco cartas! Impresionante.',
    push: 'Empate. Nadie pierde.',
    lose: 'La casa gana.',
    bust: 'Se pasó, lo siento.',
    split: ['Bueno, veamos esas manos.', 'Manos divididas, cuentas claras.'],
    bustPending: '¿Quiere otra oportunidad?',
    shop: 'Pase por la tienda, lo espero.',
    deckLost: 'Cambiamos de mazo...',
    gameover: 'La casa siempre gana.',
  };

  function renderDealer() {
    let line = null;
    let mood = null;
    if (game.phase === 'betting') line = pick(DEALER_LINES.betting);
    else if (game.phase === 'playing') line = game.bustPending ? DEALER_LINES.bustPending : pick(DEALER_LINES.playing);
    else if (game.phase === 'roundOver' && game.result) {
      line = DEALER_LINES[game.result.outcome];
      if (Array.isArray(line)) line = pick(line);
      if (game.result.net > 0) mood = 'sad';
      else if (game.result.net < 0) mood = 'happy';
    } else line = DEALER_LINES[game.phase] || null;
    Table.setSpeech(line);
    Table.setMood(mood, game.has('nervioso'));
  }

  // Frase fija por mano, para que no cambie en cada render.
  function pick(lines) {
    return lines[game.handsPlayed % lines.length];
  }

  function renderBetSpot() {
    if (game.phase === 'betting') Table.renderBet(Number($('bet-input').value) || 0);
    else if (game.phase === 'playing' || game.phase === 'roundOver') Table.renderBet(game.bet);
    else Table.renderBet(0);
  }

  function renderControls() {
    $('bet-controls').hidden = busy || game.phase !== 'betting';
    $('play-controls').hidden = busy || game.phase !== 'playing';
    $('next-controls').hidden = busy || game.phase !== 'roundOver';
    if (game.phase === 'betting') {
      const input = $('bet-input');
      input.min = game.minBet;
      input.max = game.money;
      const current = Number(input.value);
      if (!current || current < game.minBet || current > game.money) {
        input.value = Math.min(Math.max(game.lastBet, game.minBet), game.money);
      }
      $('btn-deal').disabled = !game.canBet(Number(input.value));
      renderBetSpot();
    }
    if (game.phase === 'playing') {
      const pending = game.bustPending;
      $('btn-hit').hidden = pending;
      $('btn-double').hidden = pending;
      $('btn-double').disabled = !game.canDouble();
      $('btn-split').hidden = pending || !game.canSplit();
      $('btn-stand').textContent = pending ? 'Aceptar' : 'Plantarse';
      $('btn-discard').hidden = !game.has('segunda');
      $('btn-discard').disabled = !game.canDiscard();
      $('btn-discard').textContent = pending ? '♻️ Descartar y pedir otra' : '♻️ Descartar';
      $('btn-discard').classList.toggle('primary', pending);
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
    $('btn-reroll').hidden = free || shopTab !== 'bonuses';
    $('shop-tabs').hidden = free;
    const tab = free ? 'bonuses' : shopTab;
    $('tab-bonuses').hidden = tab !== 'bonuses';
    $('tab-mejoras').hidden = tab !== 'mejoras';
    document.querySelectorAll('#shop-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    if (tab === 'mejoras') renderUpgradeTree();
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

  // Pestaña de la tienda abierta ('bonuses' o 'mejoras').
  let shopTab = 'bonuses';

  function renderUpgradeTree() {
    const branches = Upgrades.UPGRADES.map((u) => {
      const level = game.upgrades[u.id];
      const branch = document.createElement('div');
      branch.className = 'branch';
      branch.innerHTML = `
        <div class="branch-head">
          <span class="icon">${u.icon}</span>
          <b>${u.name}</b>
          <span class="total">+${game.upgradeTotal(u.id)}%</span>
          <small>${u.desc}</small>
        </div>`;
      const nodes = document.createElement('div');
      nodes.className = 'nodes';
      for (let l = 1; l <= Upgrades.MAX_LEVEL; l++) {
        const node = document.createElement('button');
        const state = l <= level ? 'owned' : l === level + 1 ? 'next' : 'locked';
        node.className = `node ${state}`;
        node.innerHTML = `<span>Nv ${l}</span><b>+${Upgrades.gainAt(u, l)}%</b>` +
          (state === 'owned' ? '<i>✔</i>' : `<i>$${Upgrades.costAt(l - 1)}</i>`);
        node.disabled = state !== 'next' || !game.canUpgrade(u.id);
        if (state === 'next') node.onclick = () => { game.upgrade(u.id); render(); };
        nodes.appendChild(node);
      }
      branch.appendChild(nodes);
      return branch;
    });
    $('upgrade-tree').replaceChildren(...branches);
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
    queue = queue.then(doRender).catch((e) => console.error(e));
    return queue;
  }

  async function doRender() {
    busy = true;
    renderControls();
    // El crupier se calla mientras reparte o levanta las cartas.
    if (game.phase === 'playing' || game.phase === 'roundOver' || game.player.length === 0) Table.setSpeech(null);
    if (game.phase === 'playing' || game.phase === 'roundOver') Table.renderBet(game.bet);
    await Table.sync(game);
    busy = false;
    renderHud();
    renderBonusBar();
    renderBetSpot();
    renderDealer();
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
  $('btn-split').addEventListener('click', () => { game.split(); render(); });
  $('btn-next').addEventListener('click', () => { game.nextHand(); render(); });
  document.querySelectorAll('#shop-tabs .tab').forEach((t) => {
    t.addEventListener('click', () => { shopTab = t.dataset.tab; renderShop(); });
  });
  $('btn-reroll').addEventListener('click', () => { game.reroll(); render(); });
  $('btn-leave').addEventListener('click', () => { shopTab = 'bonuses'; game.leaveShop(); render(); });
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
    if (busy) return;
    if (e.target.tagName === 'INPUT' && e.key !== 'Enter') return;
    const k = e.key.toLowerCase();
    if (game.phase === 'betting' && k === 'enter') $('btn-deal').click();
    else if (game.phase === 'playing') {
      if ((k === 'h' || k === 'p') && game.canHit()) $('btn-hit').click();
      else if (k === 's') $('btn-stand').click();
      else if (k === 'd' && game.canDouble()) $('btn-double').click();
      else if (k === 'r' && game.canDiscard()) $('btn-discard').click();
      else if (k === 'x' && game.canSplit()) $('btn-split').click();
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
