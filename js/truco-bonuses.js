// Bonuses del truco. Usan la misma tienda y rarezas que los del blackjack.
(function (root) {
  const Bonuses = root.Bonuses || (typeof require !== 'undefined' && require('./bonuses.js'));

  const TRUCO_BONUSES = [
    { id: 'ancho', name: 'Ancho Bravo', icon: '🗡️', rarity: 'common',
      desc: 'El ancho de espadas te sale mucho más seguido.' },
    { id: 'envido_gordo', name: 'Envido Gordo', icon: '🍖', rarity: 'common',
      desc: '+2 a tu envido.' },
    { id: 'porotos', name: 'Porotero', icon: '🫘', rarity: 'common',
      desc: '+$3 por cada punto que ganás en la mano.' },
    { id: 'retirada', name: 'Retirada Digna', icon: '🏳️', rarity: 'common',
      desc: 'Irte al mazo no te cuesta fichas.' },
    { id: 'chamuyo', name: 'Chamuyero', icon: '🗣️', rarity: 'common',
      desc: 'El rival se achica más seguido ante tus cantos de truco.' },
    { id: 'mate', name: 'Mate Cebado', icon: '🧉', rarity: 'common',
      desc: '+$5 cada vez que ganás el envido.' },
    { id: 'ojo', name: 'Ojo de Halcón', icon: '🦅', rarity: 'uncommon',
      desc: 'Ves una de las cartas del rival.' },
    { id: 'pie', name: 'Pie', icon: '🦶', rarity: 'uncommon',
      desc: 'Si la primera baza es parda, la ganás vos.' },
    { id: 'mentiroso', name: 'Cara de Póker', icon: '😐', rarity: 'uncommon',
      desc: 'El rival te quiere menos los envidos.' },
    { id: 'doble_truco', name: 'Truco Doble', icon: '✌️', rarity: 'uncommon',
      desc: 'Las manos ganadas con truco querido pagan x1.5.' },
    { id: 'racha', name: 'Racha Gaucha', icon: '🔥', rarity: 'uncommon',
      desc: '+20% de ganancia por cada mano ganada seguida.' },
    { id: 'mazo_marcado', name: 'Mazo Marcado', icon: '🔖', rarity: 'uncommon',
      desc: 'Sabés el envido del rival.' },
    { id: 'flor', name: 'Flor', icon: '🌼', rarity: 'rare',
      desc: 'Jugás con flor: tres cartas del mismo palo te dan 3 puntos (el rival no).' },
    { id: 'siete_bravo', name: 'Siete Bravo', icon: '7️⃣', rarity: 'rare',
      desc: 'Tus 7 de copa y de basto valen como el 7 de oro.' },
    { id: 'escudo', name: 'Poncho Protector', icon: '🛡️', rarity: 'rare',
      desc: 'Una vez por ciclo, una mano perdida no te cuesta fichas.' },
    { id: 'falta_tuya', name: 'Falta Generosa', icon: '💥', rarity: 'rare',
      desc: 'La falta envido vale 8 puntos en vez de 5.' },
  ];

  const TrucoBonuses = Bonuses.makeCatalog(TRUCO_BONUSES);
  if (typeof module !== 'undefined' && module.exports) module.exports = TrucoBonuses;
  else root.TrucoBonuses = TrucoBonuses;
})(typeof window !== 'undefined' ? window : globalThis);
