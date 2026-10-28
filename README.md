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
- Empezás con **$100**. La partida se divide en **ciclos de 5 manos**.
- Al terminar cada ciclo tenés que tener al menos la **cuota** (`$100 × 1.25^ciclo`), si no, perdés.
- Si la superás, aparece la **tienda**: 3 bonuses al azar (ponderados por rareza). Podés comprar, vender a mitad de precio o pagar para cambiar las ofertas. Máximo 5 bonuses.
- Cada ciclo sube la cuota y la apuesta mínima (`$10 + $5` por ciclo). El objetivo: llegar lo más lejos posible. El récord se guarda en el navegador.

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
js/game.js        # lógica del juego (sin DOM, testeable)
js/ui.js          # render y eventos
test/             # tests con node:test
```

## Tests

```bash
npm test
```
