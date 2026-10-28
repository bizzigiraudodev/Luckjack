# 🍀 Luckjack

Blackjack **roguelike** para el navegador. Ganá dinero mano a mano, superá la cuota de cada ciclo y comprá bonuses aleatorios en la tienda para romper la banca... hasta que la suerte se acabe.

## Cómo jugar

Abrí `index.html` en el navegador (no necesita instalar nada). Si preferís un servidor local:

```bash
npm start   # sirve la carpeta con `serve`
```

### Reglas

- Blackjack clásico contra el crupier: acercate a 21 más que él sin pasarte. El crupier se planta en 17.
- Ganar paga **1:1**, el blackjack natural paga **3:2**. Podés **doblar** con tus dos primeras cartas.
- Empezás con **$100** y elegís **1 bonus gratis** entre 3 al azar. La partida se divide en **ciclos de 15 manos**.
- Al terminar cada ciclo tenés que tener al menos la **cuota** (`$100 × 1.25^ciclo`), si no, perdés.
- Cada **5 manos** aparece la **tienda** (en las manos 5 y 10 sin chequear la cuota, y en la 15 si la superaste): 3 bonuses al azar (ponderados por rareza). Podés comprar, vender a mitad de precio o pagar para cambiar las ofertas. Máximo 5 bonuses.
- Cada ciclo sube la cuota y la apuesta mínima (`$10 + $5` por ciclo). El objetivo: llegar lo más lejos posible. El récord se guarda en el navegador.

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
| 🌟 | Blackjack Dorado | Poco común | El blackjack paga 2:1 |
| 🤝 | Empate a Favor | Poco común | Los empates pagan +50% |
| 🎯 | Veintiuno Exacto | Poco común | Ganar con 21 exacto duplica la ganancia |
| 🔥 | Racha Caliente | Poco común | +20% de ganancia por victoria consecutiva |
| 🎲 | Dados Cargados | Poco común | Si el crupier se pasa, ganancia x1.5 |
| ⏫ | Doble o Nada | Poco común | Ganar doblado paga x1.5 |
| ♻️ | Segunda Oportunidad | Poco común | Descartá la última carta pedida (1 vez por mano) |
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
js/cards.js       # mazo y valor de manos
js/bonuses.js     # catálogo de bonuses y sorteo de la tienda
js/decks.js       # mazos y la suerte de cada uno
js/game.js        # lógica del juego (sin DOM, testeable)
js/ui.js          # render y eventos
test/             # tests con node:test
```

## Tests

```bash
npm test
```
