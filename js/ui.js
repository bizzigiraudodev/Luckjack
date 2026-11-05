// Interfaz: menú, modos de juego, flujo de la historia y render del estado de Game.
(function () {
  const { Game, HANDS_PER_CYCLE, SHOP_EVERY, MIN_HANDS_TO_ADVANCE, MAX_BONUSES, QUOTA_BONUS, OUTCOME_TEXT, formatNet } = GameModule;
  const { RARITY } = Bonuses;
  // Catálogo de bonuses del juego actual (blackjack o truco).
  const getBonus = (id) => (game ? game.catalog : Bonuses).getBonus(id);

  const $ = (id) => document.getElementById(id);

  // --- Datos guardados en el navegador ---
  const KEYS = {
    best: 'luckjack.best', // infinito: { cycles, money }
    classic: 'luckjack.bestClassic', // clásico: dinero máximo
    storyDone: 'luckjack.storyDone', // historia terminada → Mazo Dorado
    name: 'luckjack.name',
    seenIntro: 'luckjack.seenIntro',
    trucoBest: 'luckjack.trucoBest', // truco infinito: { cycles, money }
    trucoStoryDone: 'luckjack.trucoStoryDone',
    trucoStoryBeaten: 'luckjack.trucoStoryBeaten', // historia del truco ganada en cualquier modo → desbloquea el resto
    playMs: 'luckjack.playMs', // tiempo total de juego (todos los modos)
    playSent: 'luckjack.playSent', // lo último que se mandó al ranking // historia del truco terminada → Mazo Dorado en el truco infinito
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
    // Historia del truco en la pampa
    luzmala: { title: 'LA LUZ MALA', goal: 'Para que te deje en paz', music: 'triste', print: ['LA LUZ MALA', ''] },
    silbon: { title: 'EL SILBÓN', goal: 'Para que siga de largo', music: 'diablo', print: ['EL SILBÓN', ''] },
    futre: { title: 'EL FUTRE', goal: 'Para que no te atropelle', music: 'gaucho', print: ['EL FUTRE', ''] },
    familiar: { title: 'EL FAMILIAR', goal: 'Para que no te devore', music: 'diablo', print: ['EL FAMILIAR', ''] },
    gil: { title: 'EL GAUCHITO GIL', goal: 'Para ganarte el descanso', music: 'santo', print: ['EL GAUCHITO GIL', ''] },
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
        msg.textContent = game.canAdvance()
          ? `¡Cuota cumplida! Seguí jugando (+$${QUOTA_BONUS} por ronda) o pasá de ciclo${warning}.`
          : `¡Cuota cumplida! Sumás $${QUOTA_BONUS} por ronda. Desde la mano ${MIN_HANDS_TO_ADVANCE + 1} podés pasar de ciclo.`;
      }
    } else if (game.phase === 'playing') {
      const which = game.hands.length > 1 ? `Mano ${game.handIndex + 1} de ${game.hands.length}. ` : '';
      msg.textContent = game.bustPending
        ? `${which}Te pasaste. ¿Usás tu Segunda Oportunidad?`
        : `${which}Apostaste $${game.bet}. ¿Pedís o te plantás?`;
    } else if (game.phase === 'roundOver' && game.result && game.isTruco) {
      msg.textContent = game.result.summary;
      msg.classList.add(game.result.net > 0 ? 'good' : game.result.net < 0 ? 'bad' : 'neutral');
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
    $('minbet-label').textContent = game.isRoguelike ? 'Apuesta' : 'Apuesta mín.';
    $('minbet').textContent = game.isRoguelike ? `$${game.minBet}–$${game.tableMax}` : `$${game.minBet}`;

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
      ? `${game.isTruco ? 'NOCHE' : 'CICLO'} <b id="cycle">${game.cycle}/${game.storyBosses.length}</b><span class="boss-name">${info.title}</span>`
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
    $('deck').textContent = game.mode === 'story' && game.suddenDeath
      ? '💀 Muerte súbita'
      : `${deck.icon} ${'●'.repeat(game.decksLeft)}${'○'.repeat(lives - game.decksLeft)}`;
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
      input.max = game.maxBet;
      const current = Number(input.value);
      if (!current || current < game.minBet || current > game.maxBet) {
        input.value = Math.min(Math.max(game.lastBet, game.minBet), game.maxBet);
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
    $('shop-reserve').hidden = start || !game.shopReserve();
    $('shop-reserve').textContent = `🔒 Se guardan $${game.shopReserve()} para la apuesta mínima: podés gastar $${game.spendable()}.`;

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
      reroll.disabled = game.spendable() < game.shop.rerollCost;
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
    if (game.mode === 'story' && game.isTruco) {
      const won = game.phase === 'victory';
      const counts = game.countsForRecords;
      $('gameover-title').textContent = won ? '🌄 ¡Sobreviviste a las cinco noches!' : {
        luzmala: '💡 Te llevó la Luz Mala', silbon: '🎵 Te alcanzó el Silbón', futre: '🐎 Te atropelló el Futre',
        familiar: '🐕 Te devoró el Familiar', gil: '🕯️ Te llegó la hora',
      }[game.ending] || '💀 Fin de la partida';
      $('gameover-reason').textContent = !won ? game.gameOverReason : counts
        ? 'El Gauchito Gil te dio su bendición. ✨ El Mazo Dorado ya está desbloqueado en el truco infinito.'
        : 'El Gauchito Gil te dio su bendición. Jugaste con 3 mazos: no hay Mazo Dorado ni rankings (probá con muerte súbita).';
      $('gameover-stats').innerHTML = `Noches superadas: <b>${game.maxCleared}/${game.storyBosses.length}</b> · Manos jugadas: <b>${game.handsPlayed}</b>` +
        (won ? ` · Tiempo: <b>${Leaderboard.formatTime(game.playMs)}</b>` : '') +
        `<br>${game.suddenDeath ? '💀 Muerte súbita' : '🃏 Con 3 mazos (no cuenta para rankings)'}`;
      $('btn-gameover-ranks').hidden = !counts;
      return;
    }
    if (game.mode === 'story') {
      const won = game.phase === 'victory';
      $('gameover-title').textContent = won ? '🌟 ¡Entraste al Edén!' : {
        purgatorio: '🌫️ Te quedaste en el purgatorio', infierno: '🔥 Te fuiste al infierno', casi: '🚪 Tan cerca del Edén',
      }[game.ending] || '💀 Fin de la partida';
      $('gameover-reason').textContent = !won ? game.gameOverReason : game.isTruco
        ? 'Les ganaste al Viejo, al Diablo y a San Pedro. ✨ El Mazo Dorado ya está desbloqueado en el truco infinito.'
        : 'Pagaste las tres cuotas. ✨ El Mazo Dorado ya está desbloqueado en el modo Infinito.';
      $('gameover-stats').innerHTML = `Ciclos superados: <b>${game.maxCleared}/3</b> · Manos jugadas: <b>${game.handsPlayed}</b>` +
        (won ? ` · Tiempo: <b>${Leaderboard.formatTime(game.playMs)}</b>` : '');
      return;
    }
    const cleared = game.maxCleared;
    const bestKey = game.isTruco ? KEYS.trucoBest : KEYS.best;
    let best = store.get(bestKey);
    const isRecord = !best || cleared > best.cycles || (cleared === best.cycles && game.money > best.money);
    if (isRecord && !el.dataset.saved) {
      best = { cycles: cleared, money: game.money };
      store.set(bestKey, best);
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
    if (game.isTruco) return renderTruco();
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

  // Truco infinito: ui.js dibuja la progresión y la mesa de truco juega cada mano.
  function renderTruco() {
    busy = false;
    renderHud();
    renderBonusBar();
    if (game.phase !== 'playing') renderMessage();
    renderControls();
    renderLog();
    renderShop();
    renderDeckLost();
    renderGameOver();
    playTransitionSounds();
    TrucoUI.syncRun(!inCutscene);
    if (game.phase === 'playing' && !TrucoUI.handRunning) TrucoUI.playRunHand(render);
    storyEvents();
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
  // `force`: la intro (pide el nombre) se muestra aunque estés en modo speedrun.
  async function cutscene(scenes, force = false) {
    if (Speedrun.on && !force) return;
    inCutscene = true;
    $('gameover').hidden = true;
    await Cutscene.play(scenes, vars);
    store.set(KEYS.name, vars.name);
    inCutscene = false;
  }

  async function storyEvents() {
    if (!game || game.mode !== 'story' || inCutscene) return;
    const g = game;
    const script = g.isTruco ? Story.truco : Story;
    const redraw = () => { if (game === g) (g.isTruco ? renderTruco() : renderAll()); };
    if (g.pendingIntro) {
      const cycle = g.pendingIntro;
      g.pendingIntro = null;
      await cutscene(script.cycleIntro(cycle, g.quotaFor(cycle)));
      redraw();
    } else if ((g.phase === 'victory' || (g.phase === 'gameover' && g.ending)) && !g.endingShown) {
      g.endingShown = true;
      if (g.phase === 'victory') {
        const golden = g.countsForRecords !== false;
        if (golden) store.set(g.isTruco ? KEYS.trucoStoryDone : KEYS.storyDone, true);
        if (g.isTruco) store.set(KEYS.trucoStoryBeaten, true); // con 3 mazos también desbloquea los otros modos
        Sound.sfx('victory');
        await cutscene(script.victory(golden));
      } else {
        await cutscene(script.defeat(g.ending));
      }
      redraw();
    }
  }

  // --- Rankings ---
  // Manda las marcas de la partida (una sola vez) y muestra en qué puesto quedaste.
  async function submitScores() {
    if (game.submitted) return;
    const subs = [];
    if (game.countsForRecords === false) { game.submitted = true; return; } // historia con 3 mazos: no cuenta
    if (game.mode === 'story' && game.phase === 'victory') {
      // En modo speedrun (sin animaciones) los tiempos van a rankings aparte.
      const board = game.speedrun ? (game.isTruco ? 'speedTrucoStory' : 'speedStory') : (game.isTruco ? 'trucoStory' : 'story');
      if (game.speedrun === Speedrun.on) subs.push([board, Math.round(game.playMs)]);
    } else if (game.mode === 'infinite' && game.handsPlayed > 0 && game.isTruco) {
      if (game.maxCleared > 0) subs.push(['trucoCycles', game.maxCleared]);
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
      if (res.rejected) { lines.push(`🤖 ${res.rejected}`); continue; }
      if (res.test) { lines.push(`🧪 ${info.icon} ${info.format(value)} → ranking de pruebas, puesto #${res.rank}`); continue; }
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
      li.className = e.me || e.pid === me ? 'me' : '';
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
      li.textContent = board === 'playtime' ? 'Todavía nadie sumó tiempo de juego.' : Leaderboard.BOARDS[board].order === 'asc'
        ? 'Todavía nadie terminó la historia. ¿Serás el primero?' : 'Todavía no hay marcas. ¡Jugá una partida de infinito!';
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
    $('story-timer').textContent = `${game.speedrun ? '⚡' : '⏱️'} ${Leaderboard.formatTime(game.playMs)}`;
  }, 250);

  // --- Tiempo total de juego: cuenta mientras jugás (pestaña visible, sin menú ni cutscenes y
  // tocando algo al menos cada 2 minutos) y se manda al ranking cada 5 minutos y al volver al menú.
  let lastInput = Date.now();
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, (e) => { if (e.isTrusted) lastInput = Date.now(); }, true));
  setInterval(() => {
    if (!$('menu').hidden || inCutscene || document.hidden || Date.now() - lastInput > 120000) return;
    const total = (store.get(KEYS.playMs) || 0) + 1000;
    store.set(KEYS.playMs, total);
    if (total - (store.get(KEYS.playSent) || 0) >= 5 * 60000) submitPlaytime();
  }, 1000);

  function submitPlaytime() {
    const total = store.get(KEYS.playMs) || 0;
    if (total < 60000 || total === store.get(KEYS.playSent)) return;
    store.set(KEYS.playSent, total);
    Leaderboard.submit('playtime', { name: vars.name, value: total, hands: 0 });
  }

  // --- Menú ---
  function showMenu() {
    submitPlaytime();
    Truco4UI.stop();
    TrucoUI.stop();
    TrucoOnline.stop();
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
    const tInf = store.get(KEYS.trucoBest);
    $('rec-truco-infinite').textContent = tInf ? `Récord: ${tInf.cycles} ciclos` : 'Cuotas sin fin, bonuses de truco';
    $('rec-truco-story').textContent = store.get(KEYS.trucoStoryDone) ? '✔ Completado · ¿Otra vez?' : 'Cinco noches en la pampa, jugándote la vida';
    const t4 = Truco4UI.record();
    $('rec-truco4').textContent = t4 ? `Ganadas: ${t4.wins} · Perdidas: ${t4.losses}` : 'Vos y el Viejo contra el Diablo y San Pedro';
    $('rec-truco').textContent = truco ? `Ganadas: ${truco.wins} · Perdidas: ${truco.losses}` : 'Mano a mano contra el Viejo, a 15 puntos';
    renderLocks();
    if (!$('menu-chars').innerHTML) {
      $('menu-chars').innerHTML = ['diablo', 'gaucho', 'santo'].map((id) => `<div class="menu-char">${Pixel.character(id)}</div>`).join('');
    }
  }

  // --- Modos bloqueados: hay que pasarse la historia de cada juego (el clásico siempre está) ---
  const unlocked = {
    blackjack: () => !!store.get(KEYS.storyDone),
    truco: () => !!(store.get(KEYS.trucoStoryBeaten) || store.get(KEYS.trucoStoryDone)),
  };
  const LOCKS = [
    ['#modes-blackjack [data-mode="infinite"]', 'blackjack', 'Pasate la historia del blackjack para desbloquearlo'],
    ['#modes-truco [data-truco="infinite"]', 'truco', 'Pasate la historia del truco para desbloquearlo'],
    ['#btn-truco4', 'truco', 'Pasate la historia del truco para desbloquearlo'],
    ['#btn-online', 'truco', 'Pasate la historia del truco para desbloquearlo'],
  ];
  function renderLocks() {
    for (const [sel, gameId, msg] of LOCKS) {
      const btn = document.querySelector(sel);
      const locked = !unlocked[gameId]();
      btn.classList.toggle('locked', locked);
      if (locked) btn.dataset.lock = `🔒 ${msg}`;
      else delete btn.dataset.lock;
    }
    $('menu-note').hidden = true;
  }
  // Tocar un modo bloqueado avisa en vez de arrancarlo (se frena antes de los otros clics).
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('#menu button.locked');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    $('menu-note').textContent = btn.dataset.lock;
    $('menu-note').hidden = false;
    Sound.sfx('push');
  }, true);

  function startGame(mode) {
    const startDeck = mode === 'infinite' && store.get(KEYS.storyDone) ? 'dorado' : null;
    TrucoUI.stop();
    document.body.dataset.game = 'blackjack';
    game = new Game({ mode, startDeck });
    game.playMs = 0;
    game.speedrun = Speedrun.on;
    AntiBot.reset();
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

  // Historia del truco: muerte súbita (cuenta para rankings y da el Mazo Dorado) o 3 mazos (más fácil).
  function chooseLives() {
    return new Promise((resolve) => {
      let box = $('lives-pick');
      if (!box) {
        box = document.createElement('div');
        box.id = 'lives-pick';
        box.className = 'overlay';
        box.innerHTML = `<div class="modal lives-modal">
          <h2>🌙 Cinco noches en la pampa</h2>
          <p class="sub">Cada noche viene alguien a jugarte un truco por tu vida. ¿Cómo jugás?</p>
          <button class="btn-red big" data-lives="sudden">💀 Muerte súbita<small>Perder una noche es perder la vida. Da el Mazo Dorado y cuenta para los rankings.</small></button>
          <button class="btn-blue big" data-lives="decks">🃏 Con 3 mazos<small>Más fácil: reintentás la noche. Sin Mazo Dorado ni rankings.</small></button>
          <button data-lives="">Volver</button>
        </div>`;
        document.body.appendChild(box);
      }
      box.hidden = false;
      box.querySelectorAll('button').forEach((b) => {
        b.onclick = () => { box.hidden = true; resolve(b.dataset.lives || null); };
      });
    });
  }

  function startTruco(mode, lives) {
    $('menu').hidden = true;
    document.body.classList.remove('in-menu');
    if (mode === 'classic') {
      game = null; // el blackjack queda en pausa
      TrucoUI.start(mode, { vars });
      return;
    }
    // Truco infinito e historia: la misma progresión que el blackjack, con su propia partida.
    const golden = store.get(KEYS.storyDone) || store.get(KEYS.trucoStoryDone);
    const startDeck = mode === 'infinite' && golden ? 'dorado' : null;
    game = new TrucoRunModule.TrucoRun({ mode, startDeck, lives });
    game.playMs = 0;
    game.speedrun = Speedrun.on;
    AntiBot.reset();
    $('story-timer').textContent = '⏱️ 0:00';
    TrucoUI.prepareRun(game, { vars });
    shopTab = 'bonuses';
    lastResult = null;
    lastPhase = null;
    delete $('gameover').dataset.saved;
    $('gameover-ranks').hidden = true;
    $('bet-input').value = '';
    render();
  }

  // --- Eventos ---
  document.querySelectorAll('#modes-blackjack button').forEach((btn) => {
    btn.addEventListener('click', () => startGame(btn.dataset.mode));
  });
  document.querySelectorAll('#modes-truco button[data-truco]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.truco !== 'story') return startTruco(btn.dataset.truco);
      const lives = await chooseLives();
      if (lives) startTruco('story', lives);
    });
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
    await cutscene(Story.intro(), true);
    showMenu();
  });
  $('btn-menu-help').addEventListener('click', () => { $('help').hidden = false; });
  $('btn-menu').addEventListener('click', () => {
    if (Truco4UI.active) {
      if (!Truco4UI.playing || window.confirm('¿Abandonar la partida y volver al menú?')) showMenu();
      return;
    }
    if (TrucoOnline.active) {
      if (window.confirm('¿Salir de la sala? Tu amigo se va a quedar esperando.')) {
        TrucoOnline.leave();
        showMenu();
      }
      return;
    }
    if (TrucoUI.active && !game) {
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
  $('btn-speedrun').addEventListener('click', () => { Speedrun.toggle(); renderSpeedrunButton(); });
  function renderSpeedrunButton() {
    $('btn-speedrun').textContent = Speedrun.on ? '⚡ Speedrun: sí' : '⚡ Speedrun: no';
    $('btn-speedrun').classList.toggle('btn-orange', Speedrun.on);
  }
  renderSpeedrunButton();
  $('btn-gameover-ranks').addEventListener('click', () => showRanks(game.speedrun && game.mode === 'story'
    ? (game.isTruco ? 'speedTrucoStory' : 'speedStory')
    : game.isTruco
    ? (game.mode === 'story' ? 'trucoStory' : 'trucoCycles')
    : (game.mode === 'story' ? 'story' : 'cycles')));
  $('btn-close-ranks').addEventListener('click', () => { $('leaderboard').hidden = true; });
  document.querySelectorAll('#lb-tabs .tab').forEach((t) => t.addEventListener('click', () => showRanks(t.dataset.board)));
  $('lb-name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    vars.name = $('lb-name').value.trim().slice(0, 16) || 'Timbero';
    store.set(KEYS.name, vars.name);
    $('lb-name').value = vars.name;
    Sound.sfx('coin');
  });
  $('btn-to-menu').addEventListener('click', () => {
    if (TrucoOnline.active) TrucoOnline.leave();
    showMenu();
  });

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
      input.value = Math.min(Math.max(v, game.minBet), game.maxBet);
      renderControls();
    });
  });
  $('bet-max').addEventListener('click', () => { $('bet-input').value = game.maxBet; renderControls(); });
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
    if (Truco4UI.active) Truco4UI.start();
    else if (TrucoOnline.active) TrucoOnline.rematch();
    else if (game && game.isTruco) startTruco(game.mode, game.lives);
    else if (TrucoUI.active) TrucoUI.start(TrucoUI.mode, { vars });
    else startGame(game.mode);
  });
  $('btn-help').addEventListener('click', () => { $('help').hidden = false; });
  $('btn-close-help').addEventListener('click', () => { $('help').hidden = true; });

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if (!game || busy || inCutscene || !$('menu').hidden) return;
    if (game.isTruco && game.phase === 'playing') return; // las manos de truco se juegan con el mouse/toque
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

  // --- Truco online ---
  TrucoOnline.init({
    getName: () => vars.name,
    setName: (name) => { vars.name = name; store.set(KEYS.name, name); },
    onEnter: () => { game = null; },
  });
  $('btn-online').addEventListener('click', () => TrucoOnline.openLobby());
  $('btn-truco4').addEventListener('click', () => {
    game = null;
    TrucoUI.stop();
    TrucoOnline.stop();
    $('menu').hidden = true;
    document.body.classList.remove('in-menu');
    Truco4UI.start();
  });

  // --- Inicio: la intro la primera vez, después el menú ---
  (async () => {
    // Si entraste con un link de invitación (?sala=MATE-37), vas directo a la sala.
    const invite = TrucoOnline.codeFromUrl();
    if (!store.get(KEYS.seenIntro) && !invite) {
      await cutscene(Story.intro(), true);
      store.set(KEYS.seenIntro, true);
    }
    showMenu();
    if (invite) {
      document.querySelector('#menu-games [data-game="truco"]').click();
      TrucoOnline.openLobby(invite);
    }
  })();
})();
