// Árbol de mejoras: stats que se compran nivel por nivel en la tienda.
// Cada rama tiene su propio nivel; cada nivel cuesta $2.5 más que el anterior (empieza en $5)
// y suma un poco más que el anterior.
(function (root) {
  const MAX_LEVEL = 10;
  const BASE_COST = 5;
  const COST_STEP = 2.5;

  const UPGRADES = [
    { id: 'suerte', name: 'Suerte', icon: '🍀',
      desc: 'Más chance de recibir cartas buenas.',
      first: 0.15, step: 0.1 },
    { id: 'ganancia', name: 'Ganancia', icon: '💰',
      desc: 'Más ganancia cada vez que ganás una mano.',
      first: 1, step: 0.5 },
    { id: 'seguro', name: 'Seguro', icon: '🛡️',
      desc: 'Recuperás parte de la apuesta cuando perdés una mano.',
      first: 1, step: 0.5 },
    { id: 'descuento', name: 'Descuento', icon: '🏷️',
      desc: 'Los bonuses de la tienda salen más baratos.',
      first: 1, step: 0.5 },
  ];

  function getUpgrade(id) {
    return UPGRADES.find((u) => u.id === id);
  }

  // Cuánto suma el nivel `level` (1 = primera mejora), en %.
  function gainAt(upgrade, level) {
    return round2(upgrade.first + upgrade.step * (level - 1));
  }

  // Total acumulado en % con `level` mejoras compradas.
  function totalAt(upgrade, level) {
    let total = 0;
    for (let l = 1; l <= level; l++) total += gainAt(upgrade, l);
    return round2(total);
  }

  // Costo de comprar el siguiente nivel teniendo `level` niveles.
  function costAt(level) {
    return BASE_COST + COST_STEP * level;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  const Upgrades = { UPGRADES, MAX_LEVEL, getUpgrade, gainAt, totalAt, costAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = Upgrades;
  else root.Upgrades = Upgrades;
})(typeof window !== 'undefined' ? window : globalThis);
