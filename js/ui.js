// Interfaz: menú, modos de juego, flujo de la historia y render del estado de Game.
(function () {
  const { Game, HANDS_PER_CYCLE, SHOP_EVERY, MAX_BONUSES, QUOTA_BONUS, OUTCOME_TEXT, formatNet } = GameModule;
  const { RARITY, getBonus } = Bonuses;

  const $ = (id) => document.getElementById(id);

  // --- Datos guardados en el navegador ---
  const KEYS = {
    best: 'luckjack.best', // infinito: { cycles, money }
    classic: 'luckjack.bestClassic', // clásico: dinero máximo
    storyDone: 'luckjack.storyDone', // historia terminada → Mazo Dorado
    name: 'luckjack.name',
    seenIntro: 'luckjack.seenIntro',
  };
  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin storage */ } },
  };

  const vars = { name: store.get(KEYS.name) || 'Timbero' };
  const fill = (text) => text.replace(/\{name\}/g, vars.name);

  let game = null;
  // Primero se animan las cartas; el resto (dinero, mensajes, tienda) se muestra
  // recién cuando terminan, para no adelantar el resultado.
  let busy = false;
  let queue = Promise.resolve();
  let inCutscene = false;
  let lastPhase = null;
  let lastResult = null;
  let shopTab = 'bonuses'; // pestaña abierta de la tienda
  let lbBoard = 'story'; // ranking abierto

  // --- Personajes que reparten ---
  const BOSS_INFO = {
    crupier: { title: 'CLÁSICO', goal: 'Récord', music: 'classic',
      print: ['BLACKJACK PAGA 3 A 2', 'EL CRUPIER PIDE HASTA 16 Y SE PLANTA EN 17'] },
    gaucho: { title: 'EL VIEJO TIMBERO', goal: 'Deuda con el Viejo', music: 'gaucho',
      print: ['PURGATORIO DE LOS TIMBEROS', 'LA CASA NO PERDONA, CHAMIGO'] },
    diablo: { title: 'EL DIABLO', goal: 'Tributo al Diablo', music: 'diablo',
      print: ['LA MESA DEL DIABLO', 'EN CADA EMPATE ME LLEVO UN CUARTO'] },
    santo: { title: 'SAN PEDRO', goal: 'Entrada al Edén', music: 'santo',
      print: ['PUERTAS DEL EDÉN', 'ACÁ ARRIBA NADIE SE PONE NERVIOSO'] },
  };

  const DEALER_LINES = {
    crupier: {
      betting: ['Hagan sus apuestas.', '¿Cuánto apostamos?', 'Mesa abierta. Suerte.', 'Cuando quiera.'],
      playing: ['¿Carta o se planta?', 'Usted decide.', '¿Otra?'],
      blackjack: '¡Blackjack! Felicitaciones.', win: 'Gana usted. Bien jugado.', dealerBust: 'Uf... me pasé.',
      charlie: '¡Cinco cartas! Impresionante.', push: 'Empate. Nadie pierde.', lose: 'La casa gana.',
      bust: 'Se pasó, lo siento.', split: ['Bueno, veamos esas manos.', 'Manos divididas, cuentas claras.'],
      bustPending: '¿Quiere otra oportunidad?', shop: 'Pase por la tienda.', deckLost: 'Cambiamos de mazo...',
      gameover: 'La casa siempre gana.',
    },
    gaucho: {
      betting: ['¿Cuánto vas a jugar, {name}?', 'Dale nomás, que el mate se enfría.', 'Hagan juego, chamigos.', 'A ver esa mano, m\'hijo.'],
      playing: ['¿Pedís o te plantás?', 'Pensalo bien, chamigo...', '¿Otra cartita?'],
      blackjack: '¡Aura sí! ¡Blackjack, m\'hijo!', win: 'Bien jugado, {name}.', dealerBust: '¡Ah, la pucha! Me pasé.',
      charlie: '¡Cinco cartas! Ni en mis tiempos.', push: 'Empate. Ni pa\' vos ni pa\' mí.', lose: 'La casa no perdona, chamigo.',
      bust: 'Te pasaste de rosca, m\'hijo.', split: ['Dos manos, dos mates.', 'Eso es tener agallas.'],
      bustPending: '¿Querés otra oportunidad, gaucho?', shop: 'Pasá por la pulpería.', deckLost: 'Se te gastó el mazo...',
      gameover: 'Acá te quedás, m\'hijo.',
    },
    diablo: {
      betting: ['Apostá, {name}... apostá todo.', 'El infierno está lleno de apostadores prudentes.', 'Hagan su apuesta... je, je.'],
      playing: ['¿Te tentás con otra carta?', 'Dale, pedí. ¿Qué podría salir mal?', 'Tic, tac...'],
      blackjack: 'Bah. Suerte de principiante.', win: 'Disfrutalo mientras dure.', dealerBust: '¡Maldición! Literalmente.',
      charlie: '¿Cinco cartas? Eso es trampa... me gusta.', push: 'Empate... por ahora.', lose: 'Mmm, delicioso.',
      bust: '¡Ja! Te quemaste.', split: ['Más manos, más almas.', 'Dividir... qué tentador.'],
      bustPending: '¿Querés hacer un trato?', shop: 'Comprá, comprá...', deckLost: 'Un mazo menos. Ya falta poco.',
      gameover: 'Bienvenido a casa.',
    },
    santo: {
      betting: ['Apostá con fe, {name}.', 'Paz y bien. ¿Cuánto ofrendás?', 'Que la gracia te acompañe.'],
      playing: ['¿Pedís otra, hijo?', 'Escuchá a tu corazón.', 'Sin apuro, hay toda la eternidad.'],
      blackjack: '¡Aleluya! ¡Blackjack!', win: 'Bendita mano.', dealerBust: 'Hasta los santos se pasan.',
      charlie: '¡Un milagro de cinco cartas!', push: 'Empate. Paz entre hermanos.', lose: 'El Señor da y el Señor quita.',
      bust: 'La codicia, hijo... la codicia.', split: ['Compartir es una virtud.', 'Dos manos para el Señor.'],
      bustPending: 'Todos merecen una segunda oportunidad.', shop: 'Elegí con sabiduría.', deckLost: 'Arrepentite y probá de nuevo.',
      gameover: 'Las puertas siguen cerradas.',
    },
  };

  // --- Render ---
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
    if (game.boss === 'santo' && game.has('nervioso')) parts.push('😇 Crupier Nervioso sin efecto');
    $('intel').innerHTML = parts.join(' · ');
  }

  function renderMessage() {
    const msg = $('message');
    msg.className = 'message';
    if (game.phase === 'betting') {
      if (!game.isRoguelike) {
        msg.textContent = `Hacé tu apuesta. Tu récord: $${Math.max(game.bestMoney, store.get(KEYS.classic) || 0)}.`;
        return;
      }
      const left = game.quota - game.money;
      const handsLeft = HANDS_PER_CYCLE - game.handInCycle + 1;
      if (left > 0) {
        msg.textContent = `Te faltan $${left} para la cuota. Quedan ${handsLeft} manos.`;
      } else {
        const warning = game.mode === 'story' ? ' (si pasás ahora, la tienda del final no es gratis)' : '';
        msg.textContent = `¡Cuota cumplida! Seguí jugando (+$${QUOTA_BONUS} por ronda) o pasá de ciclo${warning}.`;
      }
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
    const tiles = game.bonuses.map((id) => bonusTile(id));
    for (let i = game.bonuses.length; i < MAX_BONUSES; i++) {
      const empty = document.createElement('div');
      empty.className = 'bonus empty';
      empty.textContent = 'vacío';
      tiles.push(empty);
    }
    $('bonus-bar').replaceChildren(...tiles);
    $('bonus-count').textContent = `${game.bonuses.length}/${MAX_BONUSES}`;
  }

  function renderHud() {
    const info = BOSS_INFO[game.boss];
    document.body.dataset.mode = game.mode;
    document.body.dataset.boss = game.boss;
    $('money').textContent = `$${game.money}`;
    $('minbet-label').textContent = 'Apuesta mín.';
    $('minbet').textContent = `$${game.minBet}`;

    if (!game.isRoguelike) {
      const best = Math.max(game.bestMoney, store.get(KEYS.classic) || 0);
      $('cycle').parentElement.innerHTML = 'BLACKJACK <b id="cycle">CLÁSICO</b>';
      $('quota-label').textContent = 'Récord';
      $('quota').textContent = `$${best}`;
      $('quota').className = 'ok';
      $('hand-label').textContent = 'Manos';
      $('hand').textContent = game.handsPlayed;
      return;
    }
    $('story-timer').hidden = game.mode !== 'story';
    const title = game.mode === 'story'
      ? `CICLO <b id="cycle">${game.cycle}/3</b><span class="boss-name">${info.title}</span>`
      : `CICLO <b id="cycle">${game.cycle}</b>`;
    $('cycle').parentElement.innerHTML = title;
    $('quota-label').textContent = game.mode === 'story' ? info.goal : 'Llegá a';
    $('quota').textContent = `$${game.quota}`;
    $('quota').className = game.money >= game.quota ? 'ok' : 'warn';
    const pct = Math.min(100, Math.round((game.money / game.quota) * 100));
    $('quota-fill').style.setProperty('--fill', `${pct}%`);
    $('quota-fill').classList.toggle('full', pct >= 100);
    $('hand-label').textContent = 'Mano';
    $('hand').textContent = `${Math.min(game.handInCycle, HANDS_PER_CYCLE)}/${HANDS_PER_CYCLE}`;
    const deck = game.deckInfo;
    const lives = Decks.DECK_SEQUENCE.length;
    $('deck').textContent = `${deck.icon} ${'●'.repeat(game.decksLeft)}${'○'.repeat(lives - game.decksLeft)}`;
    $('deck-stat').className = `stat panel deck-stat roguelike-only ${deck.id}`;
    const extra = game.upgradeTotal('suerte') ? ` Mejora de Suerte: +${game.upgradeTotal('suerte')}%.` : '';
    $('deck-stat').title = `${deck.name}: ${deck.desc} Te quedan ${game.decksLeft} de ${lives} mazos.${extra}`;
  }

  // Personaje, mate, paño, fondo y música según quién reparte.
  function renderTheme() {
    const info = BOSS_INFO[game.boss];
    Table.setDealer(game.boss);
    if (window.setBackgroundTheme) window.setBackgroundTheme(game.boss);
    document.querySelector('.print-big textPath').textContent = info.print[0];
    document.querySelector('.print-small textPath').textContent = info.print[1];
    if (!inCutscene) Sound.music(info.music);
  }

  function renderDealer() {
    const lines = DEALER_LINES[game.boss];
    let line = null;
    let mood = null;
    if (game.phase === 'betting') line = pick(lines.betting);
    else if (game.phase === 'playing') line = game.bustPending ? lines.bustPending : pick(lines.playing);
    else if (game.phase === 'roundOver' && game.result) {
      line = lines[game.result.outcome];
      if (Array.isArray(line)) line = pick(line);
      if (game.result.net > 0) mood = 'sad';
      else if (game.result.net < 0) mood = 'happy';
    } else line = lines[game.phase] || null;
    Table.setSpeech(line && fill(line));
    Table.setMood(mood, game.active('nervioso'));
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
    if (!game) return;
    $('bet-controls').hidden = busy || game.phase !== 'betting';
    $('play-controls').hidden = busy || game.phase !== 'playing';
    $('next-controls').hidden = busy || game.phase !== 'roundOver';
    if (game.phase === 'betting') {
      const input = $('bet-input');
      input.min = game.minBet;
      input.max = Math.floor(game.money);
      const current = Number(input.value);
      if (!current || current < game.minBet || current > game.money) {
        input.value = Math.min(Math.max(game.lastBet, game.minBet), Math.floor(game.money));
      }
      $('btn-deal').disabled = !game.canBet(Number(input.value));
      $('btn-advance').hidden = !game.canAdvance();
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
      $('btn-next').textContent = !game.isRoguelike ? 'Siguiente mano'
        : game.handInCycle >= HANDS_PER_CYCLE ? 'Terminar ciclo'
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
    $('shop').hidden = game.phase !== 'shop';
    if (game.phase !== 'shop') return;
    const { kind, free } = game.shop;
    const start = kind === 'start';
    $('shop-title').textContent = start ? '🎁 Bonus inicial gratis'
      : kind === 'reward' ? `🎁 Recompensa del ciclo ${game.cycle}`
        : game.boss === 'gaucho' ? '🛒 Pulpería' : '🛒 Tienda';
    $('shop-free-sub').hidden = !free;
    $('shop-free-sub').textContent = start ? 'Elegí 1 bonus gratis para arrancar la partida.'
      : game.shop.offers.length ? 'Jugaste el ciclo completo: elegí 1 bonus común de regalo.'
        : 'Ya elegiste tu bonus gratis. En la pestaña Mejoras podés subir tus stats.';
    $('shop-sub').hidden = start;
    $('shop-owned-wrap').hidden = start;
    $('shop-tabs').hidden = !game.shop.allowUpgrades;
    const tab = game.shop.allowUpgrades ? shopTab : 'bonuses';
    $('btn-reroll').hidden = free || tab !== 'bonuses';
    $('tab-bonuses').hidden = tab !== 'bonuses';
    $('tab-mejoras').hidden = tab !== 'mejoras';
    document.querySelectorAll('#shop-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    if (tab === 'mejoras') renderUpgradeTree();
    $('btn-leave').textContent = start ? 'Arrancar sin bonus' : 'Seguir jugando →';
    $('btn-leave').classList.toggle('primary', !start);
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
      el.innerHTML = `
        <div class="icon">${b.icon}</div>
        <div class="name">${b.name}</div>
        <div class="rarity">${RARITY[b.rarity].label}</div>
        <p>${b.desc}</p>`;
      const btn = document.createElement('button');
      btn.textContent = free ? 'Elegir' : `Comprar $${game.priceOf(b)}`;
      btn.disabled = !game.canBuy(b);
      if (game.bonuses.length >= MAX_BONUSES) btn.title = 'No tenés lugar: vendé un bonus primero';
      btn.onclick = () => { game.buy(b.id); Sound.sfx('coin'); render(); };
      el.appendChild(btn);
      return el;
    });
    if (!offers.length) {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = free ? 'Ya elegiste tu bonus gratis.' : 'No quedan ofertas. Podés cambiarlas o seguir jugando.';
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
      btn.onclick = () => { game.buyDeck(); Sound.sfx('coin'); render(); };
      $('shop-deck').appendChild(btn);
    }

    $('slots').textContent = `(${game.bonuses.length}/${MAX_BONUSES})`;
    const owned = game.bonuses.map((id) => {
      const btn = document.createElement('button');
      btn.className = 'sell';
      btn.textContent = `Vender $${game.sellValue(id)}`;
      btn.onclick = () => { game.sell(id); Sound.sfx('coin'); render(); };
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

    if (!free) {
      const reroll = $('btn-reroll');
      reroll.textContent = `🔄 Cambiar ofertas ($${game.shop.rerollCost})`;
      reroll.disabled = game.money < game.shop.rerollCost;
    }
  }

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
        if (state === 'next') node.onclick = () => { game.upgrade(u.id); Sound.sfx('coin'); render(); };
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
    $('decklost-retry').textContent = game.mode === 'story'
      ? `Reintentás el ciclo ${game.cycle} con $${game.cycleStartMoney}. Tus bonuses y mejoras se quedan con vos.`
      : 'Volvés al ciclo 1 con $100. Tus bonuses y mejoras se quedan con vos.';
  }

  function renderGameOver() {
    const el = $('gameover');
    const ended = game.phase === 'gameover' || game.phase === 'victory';
    el.hidden = !ended || inCutscene;
    $('btn-gameover-ranks').hidden = game.mode === 'classic';
    if (!ended) return;
    if (!inCutscene) submitScores();
    if (game.mode === 'classic') {
      const best = store.get(KEYS.classic) || 0;
      const record = game.bestMoney > best;
      if (record) store.set(KEYS.classic, game.bestMoney);
      $('gameover-title').textContent = '💸 Te fundiste';
      $('gameover-reason').textContent = game.gameOverReason;
      $('gameover-stats').innerHTML = `Máximo dinero: <b>$${game.bestMoney}</b> · Manos jugadas: <b>${game.handsPlayed}</b><br>` +
        (record ? '🏆 ¡Nuevo récord!' : `Récord: $${best}`);
      return;
    }
    if (game.mode === 'story') {
      const won = game.phase === 'victory';
      $('gameover-title').textContent = won ? '🌟 ¡Entraste al Edén!' : {
        purgatorio: '🌫️ Te quedaste en el purgatorio', infierno: '🔥 Te fuiste al infierno', casi: '🚪 Tan cerca del Edén',
      }[game.ending] || '💀 Fin de la partida';
      $('gameover-reason').textContent = won
        ? 'Pagaste las tres cuotas. ✨ El Mazo Dorado ya está desbloqueado en el modo Infinito.'
        : game.gameOverReason;
      $('gameover-stats').innerHTML = `Ciclos superados: <b>${game.maxCleared}/3</b> · Manos jugadas: <b>${game.handsPlayed}</b>` +
        (won ? ` · Tiempo: <b>${Leaderboard.formatTime(game.playMs)}</b>` : '');
      return;
    }
    const cleared = game.maxCleared;
    let best = store.get(KEYS.best);
    const isRecord = !best || cleared > best.cycles || (cleared === best.cycles && game.money > best.money);
    if (isRecord && !el.dataset.saved) {
      best = { cycles: cleared, money: game.money };
      store.set(KEYS.best, best);
    }
    el.dataset.saved = '1';
    $('gameover-title').textContent = '💀 Fin de la partida';
    $('gameover-reason').textContent = game.gameOverReason;
    $('gameover-stats').innerHTML =
      `Ciclos superados: <b>${cleared}</b> · Manos jugadas: <b>${game.handsPlayed}</b><br>` +
      (isRecord ? '🏆 ¡Nuevo récord!' : `Récord: ${best.cycles} ciclos`);
  }

  // Sonidos de las transiciones (resultado, tienda, mazo perdido).
  function playTransitionSounds() {
    if (game.phase === 'roundOver' && game.result && game.result !== lastResult) {
      lastResult = game.result;
      const r = game.result;
      const o = r.outcome;
      if (o === 'blackjack') Sound.sfx('blackjack');
      else if (o === 'split') Sound.sfx(r.net > 0 ? 'win' : r.net < 0 ? 'lose' : 'push');
      else if (o === 'push') Sound.sfx('push');
      else if (o === 'lose' || o === 'bust') Sound.sfx('lose');
      else Sound.sfx('win');
    }
    if (game.phase !== lastPhase) {
      if (game.phase === 'shop') Sound.sfx('shop');
      if (game.phase === 'deckLost') Sound.sfx('deckLost');
      lastPhase = game.phase;
    }
  }

  function render() {
    queue = queue.then(doRender).catch((e) => console.error(e));
    return queue;
  }

  async function doRender() {
    if (!game) return;
    busy = true;
    renderControls();
    // El que reparte se calla mientras reparte o levanta las cartas.
    if (game.phase === 'playing' || game.phase === 'roundOver' || game.player.length === 0) Table.setSpeech(null);
    if (game.phase === 'playing' || game.phase === 'roundOver') Table.renderBet(game.bet);
    await Table.sync(game);
    busy = false;
    renderAll();
    playTransitionSounds();
    await storyEvents();
  }

  function renderAll() {
    renderTheme();
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

  // --- Historia: presentaciones de cada jefe y finales ---
  async function cutscene(scenes) {
    inCutscene = true;
    $('gameover').hidden = true;
    await Cutscene.play(scenes, vars);
    store.set(KEYS.name, vars.name);
    inCutscene = false;
  }

  async function storyEvents() {
    if (game.mode !== 'story') return;
    if (game.pendingIntro) {
      const cycle = game.pendingIntro;
      game.pendingIntro = null;
      await cutscene(Story.cycleIntro(cycle, game.quotaFor(cycle)));
      renderAll();
    } else if ((game.phase === 'victory' || (game.phase === 'gameover' && game.ending)) && !game.endingShown) {
      game.endingShown = true;
      if (game.phase === 'victory') {
        store.set(KEYS.storyDone, true);
        Sound.sfx('victory');
        await cutscene(Story.victory());
      } else {
        await cutscene(Story.defeat(game.ending));
      }
      renderAll();
    }
  }

  // --- Rankings ---
  // Manda las marcas de la partida (una sola vez) y muestra en qué puesto quedaste.
  async function submitScores() {
    if (game.submitted) return;
    const subs = [];
    if (game.mode === 'story' && game.phase === 'victory') {
      subs.push(['story', Math.round(game.playMs)]);
    } else if (game.mode === 'infinite' && game.handsPlayed > 0) {
      subs.push(['chips', Math.floor(game.bestMoney)]);
      if (game.maxCleared > 0) subs.push(['cycles', game.maxCleared]);
    }
    game.submitted = true;
    if (!subs.length) return;
    const g = game;
    const box = $('gameover-ranks');
    box.hidden = false;
    box.textContent = 'Guardando en los rankings...';
    const lines = [];
    for (const [board, value] of subs) {
      const res = await Leaderboard.submit(board, { name: vars.name, value, hands: g.handsPlayed });
      const info = Leaderboard.BOARDS[board];
      const where = res.global ? 'global' : 'de este dispositivo';
      lines.push(res.rank && res.rank <= Leaderboard.TOP
        ? `${info.icon} ${Leaderboard.BOARDS[board].format(value)} → <b>puesto #${res.rank}</b> del ranking ${where}`
        : `${info.icon} ${Leaderboard.BOARDS[board].format(value)}${res.improved ? '' : ' (no superó tu mejor marca)'}`);
    }
    if (game === g) box.innerHTML = lines.join('<br>');
  }

  async function showRanks(board = lbBoard) {
    lbBoard = board;
    $('leaderboard').hidden = false;
    $('lb-name').value = vars.name;
    document.querySelectorAll('#lb-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.board === board));
    const info = Leaderboard.BOARDS[board];
    $('lb-title').textContent = `${info.icon} ${info.title}`;
    $('lb-status').textContent = 'Cargando...';
    $('lb-list').replaceChildren();
    const { entries, global } = await Leaderboard.load(board);
    if (board !== lbBoard) return;
    $('lb-status').textContent = global ? '🌐 Ranking global' : '📱 Tus mejores partidas en este dispositivo (el ranking global no está disponible ahora).';
    const me = Leaderboard.playerId();
    const items = entries.map((e, i) => {
      const li = document.createElement('li');
      li.className = e.pid === me ? 'me' : '';
      const pos = document.createElement('span');
      pos.className = 'pos';
      pos.textContent = i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`;
      const name = document.createElement('span');
      name.className = 'who';
      name.textContent = e.name || 'Timbero';
      const val = document.createElement('b');
      val.textContent = info.format(e.value);
      const extra = document.createElement('small');
      extra.textContent = e.hands ? `${e.hands} manos` : '';
      li.append(pos, name, extra, val);
      return li;
    });
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = board === 'story' ? 'Todavía nadie terminó la historia. ¿Serás el primero?' : 'Todavía no hay marcas. ¡Jugá una partida de infinito!';
      items.push(li);
    }
    $('lb-list').replaceChildren(...items);
  }

  // Cronómetro de la historia: cuenta solo mientras jugás (sin cutscenes, menú ni pestaña oculta).
  let lastTick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;
    if (!game || game.mode !== 'story' || inCutscene || document.hidden || !$('menu').hidden) return;
    if (game.phase === 'victory' || game.phase === 'gameover') return;
    game.playMs = (game.playMs || 0) + dt;
    $('story-timer').textContent = `⏱️ ${Leaderboard.formatTime(game.playMs)}`;
  }, 250);

  // --- Menú ---
  function showMenu() {
    TrucoUI.stop();
    delete document.body.dataset.game;
    $('menu').hidden = false;
    document.body.classList.add('in-menu');
    $('gameover').hidden = true;
    Sound.music('pampa');
    const classic = store.get(KEYS.classic);
    const inf = store.get(KEYS.best);
    $('rec-classic').textContent = classic ? `Récord: $${classic}` : 'Blackjack común contra el crupier';
    $('rec-story').textContent = store.get(KEYS.storyDone) ? '✔ Completado · ¿Otra vez?' : 'Tres cuotas, tres jefes';
    $('rec-infinite').textContent = (inf ? `Récord: ${inf.cycles} ciclos` : 'Cuotas sin fin') +
      (store.get(KEYS.storyDone) ? ' · ✨ Mazo Dorado' : '');
    const truco = TrucoUI.record();
    $('rec-truco').textContent = truco ? `Ganadas: ${truco.wins} · Perdidas: ${truco.losses}` : 'Mano a mano contra el Viejo, a 15 puntos';
    if (!$('menu-chars').innerHTML) {
      $('menu-chars').innerHTML = ['diablo', 'gaucho', 'santo'].map((id) => `<div class="menu-char">${Pixel.character(id)}</div>`).join('');
    }
  }

  function startGame(mode) {
    const startDeck = mode === 'infinite' && store.get(KEYS.storyDone) ? 'dorado' : null;
    TrucoUI.stop();
    document.body.dataset.game = 'blackjack';
    game = new Game({ mode, startDeck });
    game.playMs = 0;
    $('story-timer').textContent = '⏱️ 0:00';
    $('gameover-ranks').hidden = true;
    $('menu').hidden = true;
    document.body.classList.remove('in-menu');
    shopTab = 'bonuses';
    lastResult = null;
    lastPhase = null;
    delete $('gameover').dataset.saved;
    $('bet-input').value = '';
    render();
  }

  function startTruco(mode) {
    game = null; // el blackjack queda en pausa
    $('menu').hidden = true;
    document.body.classList.remove('in-menu');
    TrucoUI.start(mode, { vars });
  }

  // --- Eventos ---
  document.querySelectorAll('#modes-blackjack button').forEach((btn) => {
    btn.addEventListener('click', () => startGame(btn.dataset.mode));
  });
  document.querySelectorAll('#modes-truco button[data-truco]').forEach((btn) => {
    btn.addEventListener('click', () => startTruco(btn.dataset.truco));
  });
  // Elegir juego en el menú: Blackjack o Truco.
  document.querySelectorAll('#menu-games .tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#menu-games .tab').forEach((t) => t.classList.toggle('active', t === tab));
      $('modes-blackjack').hidden = tab.dataset.game !== 'blackjack';
      $('modes-truco').hidden = tab.dataset.game !== 'truco';
    });
  });
  $('btn-intro').addEventListener('click', async () => {
    $('menu').hidden = true;
    await cutscene(Story.intro());
    showMenu();
  });
  $('btn-menu-help').addEventListener('click', () => { $('help').hidden = false; });
  $('btn-menu').addEventListener('click', () => {
    if (TrucoUI.active) {
      if (!TrucoUI.playing || window.confirm('¿Abandonar la partida y volver al menú?')) showMenu();
      return;
    }
    if (!game || game.phase === 'gameover' || game.phase === 'victory' ||
      window.confirm('¿Abandonar la partida y volver al menú?')) {
      // Abandonar una partida de infinito igual cuenta para los rankings.
      if (game && game.mode === 'infinite') submitScores();
      showMenu();
    }
  });
  $('btn-ranks').addEventListener('click', () => showRanks());
  $('btn-gameover-ranks').addEventListener('click', () => showRanks(game.mode === 'story' ? 'story' : 'cycles'));
  $('btn-close-ranks').addEventListener('click', () => { $('leaderboard').hidden = true; });
  document.querySelectorAll('#lb-tabs .tab').forEach((t) => t.addEventListener('click', () => showRanks(t.dataset.board)));
  $('lb-name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    vars.name = $('lb-name').value.trim().slice(0, 16) || 'Timbero';
    store.set(KEYS.name, vars.name);
    $('lb-name').value = vars.name;
    Sound.sfx('coin');
  });
  $('btn-to-menu').addEventListener('click', showMenu);

  function renderSoundButtons() {
    const icon = Sound.muted ? '🔇' : '🔊';
    $('btn-sound').textContent = icon;
    $('btn-menu-sound').textContent = icon;
  }
  [$('btn-sound'), $('btn-menu-sound')].forEach((b) => b.addEventListener('click', () => {
    Sound.toggleMute();
    renderSoundButtons();
  }));
  renderSoundButtons();

  // Sonido de clic en todos los botones (las fichas suenan distinto).
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled || btn.closest('#cutscene')) return;
    Sound.sfx(btn.classList.contains('chip') ? 'chip' : 'click');
  });

  document.querySelectorAll('.chip[data-delta]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $('bet-input');
      const v = Number(input.value) + Number(btn.dataset.delta);
      input.value = Math.min(Math.max(v, game.minBet), Math.floor(game.money));
      renderControls();
    });
  });
  $('bet-max').addEventListener('click', () => { $('bet-input').value = Math.floor(game.money); renderControls(); });
  $('bet-input').addEventListener('input', renderControls);
  $('btn-deal').addEventListener('click', () => {
    const amount = Number($('bet-input').value);
    if (game.canBet(amount)) { game.deal(amount); render(); }
  });
  $('btn-advance').addEventListener('click', () => {
    const extra = game.mode === 'story' ? '\nOjo: la tienda del final de ciclo no va a ser gratis.' : '';
    if (game.canAdvance() && window.confirm(`¿Pasar de ciclo ahora?${extra}`)) { game.advanceCycle(); render(); }
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
    if (TrucoUI.active) TrucoUI.start(TrucoUI.mode, { vars });
    else startGame(game.mode);
  });
  $('btn-help').addEventListener('click', () => { $('help').hidden = false; });
  $('btn-close-help').addEventListener('click', () => { $('help').hidden = true; });

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if (!game || busy || inCutscene || !$('menu').hidden) return;
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

  // --- Inicio: la intro la primera vez, después el menú ---
  (async () => {
    if (!store.get(KEYS.seenIntro)) {
      await cutscene(Story.intro());
      store.set(KEYS.seenIntro, true);
    }
    showMenu();
  })();
})();
