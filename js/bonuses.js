// Catálogo de bonuses que se compran en la tienda.
// Los efectos se aplican en game.js consultando `game.has(id)`.
(function (root) {
  const RARITY = {
    common: { label: 'Común', weight: 60, price: 25 },
    uncommon: { label: 'Poco común', weight: 30, price: 45 },
    rare: { label: 'Raro', weight: 10, price: 75 },
  };

  const BONUSES = [
    { id: 'herradura', name: 'Herradura', icon: '🍀', rarity: 'common',
      desc: '+$5 extra cada vez que ganás una mano.' },
    { id: 'diezmo', name: 'Diezmo Real', icon: '👑', rarity: 'common',
      desc: '+$2 por cada figura (J, Q, K) que recibís, ganes o pierdas.' },
    { id: 'gemelos', name: 'Gemelos', icon: '👯', rarity: 'common',
      desc: 'Si tus dos primeras cartas son del mismo rango, cobrás +$15.' },
    { id: 'interes', name: 'Interés Compuesto', icon: '🏦', rarity: 'common',
      desc: 'Al terminar cada ciclo ganás 10% de tu dinero (máx. $50).' },
    { id: 'contador', name: 'Contador de Cartas', icon: '🧮', rarity: 'common',
      desc: 'Muestra la probabilidad de pasarte si pedís otra carta.' },
    { id: 'red', name: 'Red de Seguridad', icon: '🕸️', rarity: 'common',
      desc: 'Si te pasás de 21, recuperás la mitad de tu apuesta.' },
    { id: 'ojo', name: 'Ojo del Crupier', icon: '👁️', rarity: 'uncommon',
      desc: 'Ves la carta oculta del crupier.' },
    { id: 'dorado', name: 'Blackjack Dorado', icon: '🌟', rarity: 'uncommon',
      desc: 'El blackjack paga 2:1 en vez de 3:2.' },
    { id: 'empate', name: 'Empate a Favor', icon: '🤝', rarity: 'uncommon',
      desc: 'Los empates te pagan la mitad de la apuesta como ganancia.' },
    { id: 'veintiuno', name: 'Veintiuno Exacto', icon: '🎯', rarity: 'uncommon',
      desc: 'Ganar con exactamente 21 (sin ser blackjack) duplica la ganancia.' },
    { id: 'racha', name: 'Racha Caliente', icon: '🔥', rarity: 'uncommon',
      desc: '+20% de ganancia por cada victoria consecutiva previa.' },
    { id: 'dados', name: 'Dados Cargados', icon: '🎲', rarity: 'uncommon',
      desc: 'Cuando el crupier se pasa, tu ganancia es x1.5.' },
    { id: 'doble', name: 'Doble o Nada', icon: '⏫', rarity: 'uncommon',
      desc: 'Ganar una mano doblada paga x1.5 la ganancia.' },
    { id: 'segunda', name: 'Segunda Oportunidad', icon: '♻️', rarity: 'uncommon',
      desc: 'Una vez por mano podés descartar la última carta que pediste.' },
    { id: 'rayos', name: 'Rayos X', icon: '🩻', rarity: 'rare',
      desc: 'Ves cuál es la próxima carta del mazo.' },
    { id: 'escudo', name: 'Escudo', icon: '🛡️', rarity: 'rare',
      desc: 'Una vez por ciclo, la primera mano perdida se convierte en empate.' },
    { id: 'charlie', name: 'Charlie de Cinco', icon: '🖐️', rarity: 'rare',
      desc: 'Si juntás 5 cartas sin pasarte, ganás automáticamente x2.' },
    { id: 'elastico', name: 'Límite Elástico', icon: '🪀', rarity: 'rare',
      desc: 'Te pasás recién con más de 22. Un 22 cuenta como 21.' },
    { id: 'iman', name: 'Imán de Ases', icon: '🧲', rarity: 'rare',
      desc: 'Se agregan 6 ases extra al mazo (se aplica al rebarajar).' },
    { id: 'nervioso', name: 'Crupier Nervioso', icon: '😰', rarity: 'rare',
      desc: 'El crupier pide carta hasta llegar a 18 o más.' },
  ];

  function getBonus(id) {
    return BONUSES.find((b) => b.id === id);
  }

  function priceOf(bonus, cycle = 1) {
    // Los precios suben un poco a medida que avanza la partida.
    return Math.round((RARITY[bonus.rarity].price * (1 + 0.1 * (cycle - 1))) / 5) * 5;
  }

  // Elige `count` bonuses distintos que el jugador no tenga, ponderados por rareza.
  function rollShop(ownedIds, count = 3, rng = Math.random) {
    let pool = BONUSES.filter((b) => !ownedIds.includes(b.id));
    const picks = [];
    while (picks.length < count && pool.length > 0) {
      const total = pool.reduce((s, b) => s + RARITY[b.rarity].weight, 0);
      let r = rng() * total;
      let chosen = pool[pool.length - 1];
      for (const b of pool) {
        r -= RARITY[b.rarity].weight;
        if (r < 0) { chosen = b; break; }
      }
      picks.push(chosen);
      pool = pool.filter((b) => b !== chosen);
    }
    return picks;
  }

  const Bonuses = { RARITY, BONUSES, getBonus, priceOf, rollShop };
  if (typeof module !== 'undefined' && module.exports) module.exports = Bonuses;
  else root.Bonuses = Bonuses;
})(typeof window !== 'undefined' ? window : globalThis);
