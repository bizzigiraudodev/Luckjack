# 🍀 Luckjack

Blackjack **roguelike** para el navegador. Ganá dinero mano a mano, superá la cuota de cada ciclo y comprá bonuses aleatorios en la tienda para romper la banca... hasta que la suerte se acabe.

Estética pixel art inspirada en Balatro: fondo en remolino pixelado con efecto CRT, cartas y crupier dibujados píxel a píxel y la fuente [Tiny5](https://github.com/Gissio/font_tiny5) (SIL Open Font License, ver `fonts/OFL-Tiny5.txt`).

## Cómo jugar

Abrí `index.html` en el navegador (no necesita instalar nada). Si preferís un servidor local:

```bash
npm start   # sirve la carpeta con `serve`
```

### Instalar en el celular

Luckjack es una app web instalable (PWA): no hace falta ninguna tienda de apps.

- **Android (Chrome):** abrí https://bizzigiraudodev.github.io/Luckjack/ y tocá **📲 Instalar app** (o menú ⋮ → *Instalar app*).
- **iPhone/iPad (Safari):** abrí el link, tocá **Compartir** ⬆️ → *Agregar a pantalla de inicio*.

Queda con su ícono, se abre a pantalla completa y funciona sin internet.

### Reglas

- Blackjack clásico contra el crupier: acercate a 21 más que él sin pasarte. El crupier se planta en 17.
- Ganar paga **1:1** (apostás $10, cobrás $20) y el blackjack natural paga **3:2** (cobrás $25). Podés **doblar** con tus dos primeras cartas y **dividir** pares del mismo rango (hasta 4 manos; los ases divididos reciben una sola carta y un 21 dividido no cuenta como blackjack).
- Empezás con **$100** y elegís **1 bonus gratis** entre 3 al azar. La partida se divide en **ciclos de 15 manos**.
- Al terminar cada ciclo tenés que tener al menos la **cuota** (`$90 × 1.25^ciclo`, redondeada a $5), si no, perdés.
- Cada **5 manos** aparece la **tienda** (en las manos 5 y 10 sin chequear la cuota, y en la 15 si la superaste): 3 bonuses al azar (ponderados por rareza). Podés comprar, vender a mitad de precio o pagar para cambiar las ofertas. Máximo 5 bonuses.
- Cada ciclo sube la cuota y la apuesta mínima (`$10 + $5` por ciclo). El objetivo: llegar lo más lejos posible. El récord se guarda en el navegador.

### Mejoras (árbol de la tienda)

En la pestaña **Mejoras** de la tienda subís stats permanentes para toda la partida (se conservan aunque pierdas un mazo). Cada rama tiene 10 niveles; el primero cuesta **$5** y cada nivel siguiente **$2.5 más** ($5, $7.5, $10, …, $27.5).

| | Rama | Cada nivel suma | Total al nivel 10 |
|-|------|-----------------|-------------------|
| 🍀 | Suerte | +0.15%, +0.25%, +0.35%, … (chance de cartas buenas) | +6% |
| 💰 | Ganancia | +1%, +1.5%, +2%, … de la ganancia al ganar una mano | +32.5% |
| 🛡️ | Seguro | +1%, +1.5%, +2%, … de la apuesta devuelta al perder | 32.5% |
| 🏷️ | Descuento | +1%, +1.5%, +2%, … menos en el precio de los bonuses | 32.5% |

### Mazos (vidas)

Tenés **3 mazos**. Si perdés con uno (no llegás a la cuota o te quedás sin dinero para la apuesta mínima), pasás al siguiente, que es peor. Volvés al ciclo 1 con $100 y conservás tus bonuses. Perder con el último mazo es **game over**.

| | Mazo | Chance de buena combinación |
|-|------|-----------------------------|
| 🂠 | Mazo Clásico | Normal (es con el que empezás) |
| 🥀 | Mazo Gastado | 15% menos |
| ☠️ | Mazo Maldito | 30% menos |
| ✨ | Mazo Dorado | 5% más · aparece en la tienda con 5% de probabilidad y cuesta $200+ · reemplaza tu mazo actual |

Una carta es "buena" si arma una buena mano: la primera carta es un As o vale 10, y las siguientes dejan tu mano entre 18 y 21 sin pasarte. La chance de recibir una carta buena es la natural del mazo multiplicada por la suerte del mazo (por ejemplo, ×0.85 en el Gastado). Solo afecta a tus cartas, no a las del crupier.

### Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `Enter` | Repartir / siguiente mano |
| `H` o `P` | Pedir carta |
| `S` | Plantarse |
| `D` | Doblar |
| `X` | Dividir par |
| `R` | Descartar (con Segunda Oportunidad) |

## Bonuses

| | Bonus | Rareza | Efecto |
|-|-------|--------|--------|
| 🍀 | Herradura | Común | +$5 extra por cada mano ganada |
| 👑 | Diezmo Real | Común | +$2 por cada figura que recibís |
| 👯 | Gemelos | Común | +$15 si tus dos primeras cartas son del mismo rango |
| 🏦 | Interés Compuesto | Común | 10% de tu dinero al final de cada ciclo (máx. $50) |
| 🧮 | Contador de Cartas | Común | Muestra la probabilidad de pasarte |
| 🕸️ | Red de Seguridad | Común | Si te pasás, recuperás la mitad de la apuesta |
| 👁️ | Ojo del Crupier | Poco común | Ves la carta oculta del crupier |
| 🌟 | Blackjack Dorado | Poco común | El blackjack paga 2:1: cobrás x3 lo apostado en vez de x2.5 |
| 🤝 | Empate a Favor | Poco común | Los empates pagan +50% |
| 🎯 | Veintiuno Exacto | Poco común | Ganar con 21 exacto duplica la ganancia |
| 🔥 | Racha Caliente | Poco común | +20% de ganancia por victoria consecutiva |
| 🎲 | Dados Cargados | Poco común | Si el crupier se pasa, ganancia x1.5 |
| ⏫ | Doble o Nada | Poco común | Ganar doblado paga x1.5 |
| ♻️ | Segunda Oportunidad | Poco común | Descartá la última carta pedida (1 vez por mano). Si te pasaste, recibís otra en su lugar |
| 🩻 | Rayos X | Raro | Ves la próxima carta del mazo |
| 🛡️ | Escudo | Raro | La primera derrota de cada ciclo es empate |
| 🖐️ | Charlie de Cinco | Raro | 5 cartas sin pasarte = victoria automática x2 |
| 🪀 | Límite Elástico | Raro | Te pasás recién con más de 22 (22 vale 21) |
| 🧲 | Imán de Ases | Raro | +6 ases en el mazo |
| 😰 | Crupier Nervioso | Raro | El crupier pide hasta 18 |

Para agregar un bonus nuevo: sumalo al catálogo en `js/bonuses.js` y aplicá su efecto en `js/game.js` usando `this.has('<id>')`.

## Estructura

```
index.html        # página del juego
css/style.css     # estilos de la mesa, cartas y tienda
css/fonts.css     # fuente pixel incrustada
js/cards.js       # mazo y valor de manos
js/bonuses.js     # catálogo de bonuses y sorteo de la tienda
js/decks.js       # mazos y la suerte de cada uno
js/upgrades.js    # árbol de mejoras de la tienda
js/game.js        # lógica del juego (sin DOM, testeable)
js/pixel.js       # sprites pixel art (crupier y palos) generados como SVG
js/bg.js          # fondo animado en remolino
js/table.js       # mesa animada: el crupier reparte desde el sabot
js/ui.js          # render y eventos
js/pwa.js         # instalación como app (service worker y botón Instalar)
sw.js             # service worker: guarda los archivos para jugar offline
manifest.webmanifest, icons/  # nombre, colores e íconos de la app
test/             # tests con node:test
```

## Tests

```bash
npm test
```

> Si agregás un archivo nuevo al juego, sumalo a la lista `ASSETS` de `sw.js` para que también funcione offline.
