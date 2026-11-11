# Handoff: estado del proyecto Luckjack

Este documento sirve para retomar el trabajo en una sesión nueva (por ejemplo, en tu PC con plugins) sin el historial de la conversación anterior. Resume qué hay, cómo está armado, qué se decidió y por qué, y qué quedó pendiente. Para el detalle de reglas y modos, mirá el [README](README.md); acá está lo que no entra ahí.

Última actualización: 9 de noviembre de 2026 (commit `008efe8` en `main`).

---

## 1. Qué es y dónde vive

- **Juego:** Luckjack, un juego web en pixel art con dos juegos dentro: **blackjack** y **truco argentino**. Tiene modos roguelike (ciclos, cuotas, tienda, bonuses), historias con cutscenes, rankings globales, truco de a 4 con bots y truco online entre amigos.
- **Repo:** `bizzigiraudodev/Luckjack` (GitHub).
- **Producción:** https://luckjack-game.vercel.app (Vercel publica solo lo que llega a `main`).
- **Stack:** JavaScript vanilla, sin build ni dependencias. Los módulos son UMD: en el navegador quedan como globales (`window.Truco`, `window.TrucoAI`...) y en Node se cargan con `require`. El backend son Vercel Functions (`api/`) más Upstash Redis.
- **PWA:** `sw.js` cachea todos los archivos. La versión actual del caché es `luckjack-v30`.

## 2. Cómo trabajar

### Correr y probar

```bash
npm test          # node:test, 99 tests (test/*.test.js)
npm start         # servidor estático (npx serve .)
```

También se puede abrir `index.html` directo desde el disco: la fuente está incrustada para eso.

### Publicar

El flujo que veníamos usando:

1. Se trabaja en la rama `ccr-4ee177ff-0azyio` (la rama de las sesiones en la nube; podés usar otra).
2. Se hace push de esa rama.
3. Se hace push del mismo commit a `main` (`git push origin HEAD:main`), solo si `main` es ancestro (fast-forward). Vercel publica `main`.

**Reglas que hay que respetar al cambiar archivos:**

- Si agregás un archivo JS nuevo, sumalo en tres lugares:
  - `index.html`: el orden de los `<script>` importa (por ejemplo, `truco-brain.js` va antes que `truco-ai.js`).
  - La lista de `sw.js`.
  - Los tests, si corresponde.
- Cada vez que publicás cambios de front, subí la versión del caché en `sw.js` (`luckjack-vNN`). Si no, los jugadores siguen viendo la versión vieja. Avisá que hay que recargar dos veces.
- Los commits terminaban con las líneas de atribución (`Co-Authored-By: ...`). En tu sesión local usá lo que te indique tu configuración.

### Convenciones

- **Idioma:** todo en español rioplatense (textos, comentarios, commits, tests). Voseo: "jugá", "cantá", "te toca".
- **Comentarios:** explican el porqué y las reglas de juego. Los nombres de variables siguen en inglés.
- **Ediciones grandes:** se hacían con scripts Python chicos de reemplazo exacto (`assert s.count(a) == 1`) para no romper nada.
- **Navegador:** se probaba con Playwright (Chromium) en varios tamaños: 1348×607 (la notebook del usuario), 1366×768, 1280×720, 1920×1080 y 390×844 (celular).

## 3. Mapa del código

```
index.html            # todo el markup (menú, mesa, tienda, modales, ayuda) + orden de scripts
css/style.css         # estilos; al final están los de las mesas de truco y el mazo español
css/fonts.css         # fuente Tiny5 incrustada (OFL, ver fonts/)
sw.js                 # service worker (caché luckjack-vNN)
api/leaderboard.js    # rankings globales + anti-bot + PURGE
api/room.js           # salas de truco online (el motor corre en el servidor)
api/_redis.js         # cliente REST de Upstash (env KV_REST_API_URL/TOKEN o UPSTASH_REDIS_REST_URL/TOKEN)

js/game.js            # Game: progresión roguelike del blackjack (ciclos, cuotas, tienda, mazos, mejoras)
js/cards.js, decks.js, bonuses.js, upgrades.js   # blackjack: cartas, mazos, bonuses, árbol de mejoras
js/truco.js           # motor del truco: TrucoHand (cantos, bazas, envido, puntos), TrucoMatch (a 15)
js/truco-ai.js        # IA "fácil" (heurística por personalidad) + PERSONAS + desvío al cerebro
js/truco-brain.js     # IA "difícil": probabilidades exactas, minimax por baza, perfil del jugador
js/truco-run.js       # TrucoRun extends Game: truco infinito e historias (pampa y purgatorio)
js/truco-bonuses.js   # bonuses del truco
js/truco-ui.js        # UI del truco mano a mano (clásico, infinito, historias)
js/truco4-ui.js, truco4-online.js, senas.js       # truco de a 4: bots, señas y frases
js/truco-online.js    # cliente de salas online
js/story.js           # guiones de todas las cutscenes
js/cutscene.js        # reproductor de cutscenes + fondos pintados en canvas (casino, pampa, monte...)
js/pixel.js           # sprites en mapas de caracteres -> SVG
js/sprites-pampa.js   # sprites 64x68 de los 5 rivales de la pampa (GENERADO, ver tools/sprites)
js/bg.js              # fondo animado por jefe
js/table.js           # mesa: el que reparte, burbujas de diálogo, mate
js/ui.js              # orquestación: menú, bloqueos, modales, tienda, rankings, historia, inicio
js/leaderboard.js, antibot.js, speedrun.js, audio.js, pwa.js

test/                 # node:test (game, truco, truco4, truco-run, truco-brain, leaderboard, room)
tools/                # herramientas fuera del juego (ver sección 8)
```

## 4. Estado de los modos

### Menú y bloqueos (`LOCKS` en `js/ui.js`)

- **Siempre disponibles:** el clásico y la historia de cada juego.
- **Al ganar la historia del blackjack:** se desbloquea el blackjack infinito.
- **Al ganar la historia de la pampa:** se desbloquea la historia del purgatorio (la secuela).
- **Al ganar cualquier historia del truco:** se desbloquean el truco infinito, el truco de a 4 y jugar con un amigo. Los links de invitación a salas funcionan igual aunque no lo tengas desbloqueado.
- **En pantallas bajas** (ancho ≥ 721 y alto ≤ 820), los modos se muestran en dos columnas para que el menú entre completo.

### Blackjack

- **Clásico:** contra el crupier, sin bonuses.
- **Historia:** 3 ciclos contra el Viejo, el Diablo y San Pedro (`STORY_BOSSES` en `game.js`).
- **Infinito:** con el Mazo Dorado si ganaste la historia.
- **Parámetros** (`js/game.js`):

  | Parámetro | Valor |
  |---|---|
  | Manos por ciclo | 15 |
  | Tienda | cada 5 manos |
  | Bonuses máximos | 5 |
  | Plata inicial | $100 |
  | Cuota | `0.99 × 100 × 1.25^ciclo` (≈ $125, $155, $195...) |
  | Apuesta mínima | `10 + 5 × (ciclo − 1)` |
  | Mesa | hasta 5× la mínima |
  | Pasar de ciclo | se puede después de 5 manos con la cuota cumplida |

### Truco

- **Clásico contra el Viejo:** a 15 puntos, sin flor. Elegís **fácil o difícil** al entrar; en difícil el panel muestra "El Viejo 😈".
- **Infinito:** cuotas `100 × 1.4^ciclo`; la mesa topea en 3× la mínima.
- **Historia de la pampa** (`TRUCO_STORY` en `truco-run.js`): 5 noches, una por rival.

  | Noche | Rival | Regla |
  |---|---|---|
  | 1 | Luz Mala | Te muestra una carta suya, pero te baja la suerte un 5% |
  | 2 | Silbón | Cada 4 manos, las manos perdidas cuestan ×1,5 |
  | 3 | Pombero | Te esconde una de tus cartas boca abajo en cada mano; tu envido se muestra como "?" |
  | 4 | Familiar | Cada 5 manos se come el 15% de tus fichas |
  | 5 | Gauchito Gil | No miente y anula el Chamuyero y la Cara de Póker |

  - Al entrar elegís **muerte súbita** (da el Mazo Dorado y cuenta para los rankings) o **3 mazos** (sin Mazo Dorado ni rankings), y la **dificultad**.
  - En fácil arrancás con **$200** y las cuotas son **$285, $415, $605, $875 y $1.270** (`198 × 1.45^ciclo`).
- **Historia del purgatorio:** la secuela, contra el Viejo, el Diablo y San Pedro.
  - Siempre con 3 mazos y no cuenta para los rankings.
  - Arranca con el Mazo Dorado si ganaste la pampa en muerte súbita.
  - Cuando ganás la pampa, aparece el botón "🔥 Seguir al purgatorio".
- **De a 4:** vos y el Viejo contra el Diablo y San Pedro. Tiene señas de un toque y frases que el compañero bot obedece.
- **Online:** salas con link (`?sala=MATE-37`). El motor corre en el servidor y a cada jugador le manda solo lo que puede ver.

### Mesas del truco (CSS al final de `style.css`)

- **Forma:** rectangulares (el blackjack mantiene la media luna).
- **Pampa:** con los jefes `luzmala`, `silbon`, `pombero`, `familiar` y `gil` (selector `body[data-boss=...]`), la mesa es de tablones de madera gastada con marcas de vaso. No muestra fichas ni descarte, y la leyenda queda como quemada en la madera.
- **Resto (clásico, purgatorio, infinito):** mesa de casino con baranda de cuero capitoné y filete dorado. El color del paño sigue al jefe.
- **El mazo:** va a la derecha del que reparte, que es el que no es mano.
  - `truco-ui.js` pone `table.dataset.dealer` en `'rival'` (el mazo arriba a tu izquierda) o `'me'` (abajo a tu derecha; en el celular, a la altura de tus bazas).
  - **Pendiente:** en el truco de a 4 y en el online el mazo no cambia de lugar.
- **Dorso:** es una imagen PNG de 22×34 en base64 (`--spanish-back`), generada con `tools/card-back.py`. Se usa en el mazo, que se ve como varias cartas apiladas, y en todas las cartas españolas boca abajo.

## 5. Cutscenes (`js/story.js`)

- **`intro()`:** se muestra la primera vez que abrís el juego (`luckjack.seenIntro`) y con "🎬 Ver intro". Presenta al timbero, **pide el nombre en la primera escena** y termina con el retiro a la pampa. No cuenta nada más.
- **`truco.cycleIntro(1)`:** arranca en la casucha, sin repetir la intro, y sigue con la Luz Mala. Cada rival tiene su propio final de derrota. La victoria termina con "esa ya es otra historia...".
- **`purgatorioIntro()`:** es compartida. La usan el **ciclo 1 de la historia del blackjack** y el **ciclo 1 del purgatorio del truco**.
  - Contenido: muere de viejo, despierta en el purgatorio y el Viejo le explica las tres cuotas.
  - Después cada juego agrega sus reglas ("se pagan al blackjack" o "al truco").
- **Líneas `input: 'name'` con `ifNoName: true`:** solo aparecen si todavía no hay nombre, por ejemplo si entraste por un link de sala sin ver la intro.
- **Saltear una cutscene:** si falta el nombre, se saltea todo menos la escena que lo pide.
- **Speedrun:** saltea las cutscenes, salvo las forzadas como la intro.

## 6. La IA del truco

### Fácil (`js/truco-ai.js`, función `classic`)

- **Personalidad:** heurística por `PERSONAS`, con `bluff` (cuánto miente) y `aggression` (cuánto arriesga).
- **Desde la 2da baza (mano a mano):** usa `TrucoBrain.trucoWinProb`, la chance real de ganar la mano con lo que se vio.
  - Con la mano ganada sí o sí, canta o quiere. Con la mano perdida, no quiere.
  - Para el resto usa el umbral `0.5 − (aggression − 0.5) × 0.2`, más el Chamuyero.
- **`power()` cuenta la carta propia que va ganando la baza en la mesa.** Bug arreglado: tiraba el ancho de basto en la 3ra y después decía "no quiero", porque solo miraba las cartas que le quedaban en la mano.
- **Farol (bluff):**
  - En la 2da y 3ra baza ya no se usa para querer.
  - **Todavía se usa para querer en la 1ra baza** (`classic`, líneas del `need`), y eso hace más fácil a la IA fácil. Es una decisión consciente, pero se puede revisar.
  - Nunca hay farol si la IA ya no tiene cartas en la mano: el rival ve todo.

### Difícil (`js/truco-brain.js`)

Se activa con `persona.smart = true` y solo en mano a mano (`hand.n === 2`). El de a 4 sigue con la fácil.

1. **Envido** (`envidoWinProb`): recorre todas las combinaciones posibles de cartas del rival (hasta 8000) que encajan con lo visto (sus cartas jugadas, el envido que cantó, el bonus del rival). En el empate gana el que es mano.
2. **Truco** (`trucoWinProb`): para cada combinación posible del rival (enumera todas o toma 350 al azar) resuelve las bazas que faltan con minimax a información perfecta (PIMC). De ahí sale la chance de ganar la mano y la mejor carta para tirar (`chooseCard`; si empatan, tira la más baja).
3. **Decisiones** (`decide`): por valor esperado, con los umbrales de `PARAMS`:

   | Parámetro | Valor | Para qué |
   |---|---|---|
   | `trucoCall` | 0.62 | Cantar truco |
   | `trucoRaise` | 0.78 | Subir (retruco, vale cuatro) |
   | `envidoCall` | 0.6 | Cantar envido |
   | `realCall` | 0.78 | Cantar real envido |
   | `faltaCall` | 0.9 | Cantar falta envido |
   | `readWeight` | 1.6 | Cuánto le cree a tus cantos |
   | `samples` | 350 | Combinaciones del rival que simula |

4. **Lectura de cantos** (`readWeights`):
   - Si cantaste, tus manos fuertes pesan más en las simulaciones.
   - Si **le cantás truco después de ver su carta** en esta baza, las cartas tuyas que no le ganan pesan solo tu índice de mentira (empieza en 0.25). Esto arregló un caso real: la IA quería con un 6 en la mesa y el jugador tenía un 5.
5. **Perfil del jugador** (`newProfile`, `learn`, `lieIndex`, `aggressionIndex`), con ideas del readme de [TrucoAnalytics](https://github.com/IAARhub/TrucoAnalytics):
   - **Índice de mentira:** cantos con cartas malas sobre cantos. Usa un previo de 1 mentira cada 4 cantos (`(lies + 1) / (seen + 4)`).
   - **Índice de agresión:** cantos sobre manos jugadas.
   - Aprende solo de lo que se ve: las cartas que tiraste y el envido que dijiste. Nunca mira tu mano.
   - Lo guarda `TrucoRun.read`, o la partida clásica. Se actualiza al final de cada mano (`truco-ui.js`, `playHand`).
6. **Querer no es mentir:** en difícil nunca acepta de farol. El farol queda solo para cantar o subir.

**Garantía: la IA no ve tus cartas.** Solo lee `hand.dealt[p]` y `hand.cards[p]` (las suyas) y `hand.table[q]` (las que tiraste). Lo comprobamos con grep cuando el usuario preguntó.

**Autojuego:** `tools/ai/tune.js` hizo una búsqueda por coordenadas de los `PARAMS` contra una mezcla de rivales. Los valores que encontró no mejoraban en una prueba de 2.500 manos (`tools/ai/validate.js`), así que se dejaron los originales.

**Referencias externas, solo como inspiración:** libPyTruco (Ymil) y TrucoAnalytics (IAARhub) **no tienen licencia**, así que no se copió código de ninguno. Con libPyTruco se verificó que nuestra jerarquía de cartas y el envido dan igual en las 9.880 manos posibles.

## 7. Dificultad y balance

### Historia del truco en difícil (`truco-run.js`)

- **Rivales:** usan el cerebro (`persona.smart`) y te estudian (`persona.read`).
- **Plata inicial:** $400 (`HARD_START`).
- **Curva de cuotas:** 25% más baja que la del fácil (`HARD_CURVE = 0.75`).
- **Ganancia mínima por noche:** hay que ganar al menos **6 apuestas mínimas** (`HARD_NIGHT_GAIN`). La cuota es `max(curva, plata al empezar la noche + 6 × mínima)`. Por eso la primera cuota que ves es **$460** ($400 + $60). Para la cuota del ciclo siguiente se usa la plata actual.
- **Estáticos para simular:** `TrucoRun.nightGain`, `TrucoRun.hardCurve` y `TrucoRun.hardStart` permiten probar otros valores sin tocar el código.
- **Rankings:** no distinguen dificultad. Las partidas en fácil y en difícil van al mismo ranking. Es un posible pendiente.

### Resultados de las simulaciones

El "jugador promedio" simulado es la IA fácil con `{ bluff: 0.15, aggression: 0.65 }`. Apuesta el máximo hasta llegar a la cuota y después pasa de ciclo, y compra mejoras.

| Historia de la pampa | Sin bonus | Ancho Bravo | Truco Doble | Poncho Protector |
|---|---|---|---|---|
| Fácil, 3 mazos | 44% | 79% | 76% | 66% |
| Fácil, muerte súbita | 13% | 39% | 38% | 30% |
| **Difícil, 3 mazos** (valores actuales) | 27% | 76% | 59% | 56% |
| **Difícil, muerte súbita** (valores actuales) | 12% | 33% | 23% | 21% |

En el purgatorio fácil con 3 mazos: 52% sin bonus, y entre 69% y 85% con un bonus fuerte.

**Qué aprendimos de calibrar el difícil:**

- Bajar solo las cuotas casi no cambia nada: con un 40% menos, la chance sube apenas. El jugador pierde plata mano a mano contra la IA y termina sin llegar a la apuesta mínima. Lo que más mueve es la **plata inicial**.
- Bajar la mesa a 2× la mínima lo hacía imposible (OP en 15–40%).
- La métrica "1 mano" que imprime `hard.js` (qué porcentaje de las cuotas se cubrió con la mano más grande del ciclo) siempre sale alta: el Truco Doble y las faltas envido dan manos enormes. No es un buen indicador.
- Arreglar la IA (que ya no quiera de farol) endureció mucho el difícil. Si se vuelve a tocar la IA, **hay que recalibrar**.

### Rebalanceo de bonuses: PENDIENTE de confirmar por el usuario

Simulación con un solo bonus y la política "pro":

- **Blackjack** (historia, base 36%):
  - **Rotos:** Rayos X (68%) y Escudo (68%). En el infinito rinden ×3,5 y ×3,2.
  - **Buenos:** Límite Elástico, Segunda Oportunidad, Red de Seguridad y Dados Cargados suman entre 9 y 16 puntos.
  - **Inútiles:** Contador, Blackjack Dorado, Imán, Diezmo, Crupier Nervioso y Doble o Nada.
- **Truco** (pampa con 3 mazos, base 45%):
  - **Rotos:** Ancho Bravo (80%), Truco Doble (78%) y Poncho Protector (70%).
  - **Buenos:** Siete Bravo, Racha, Flor, Envido Gordo y Porotero suman entre 10 y 15 puntos.
  - **Inútiles:** Cara de Póker, Mazo Marcado, Ojo de Halcón, Pie, Retirada Digna y Falta Segura.

**Cambios propuestos (no aplicados):**
- Rayos X: una vez por mano.
- Escudo: devuelve la mitad.
- Ancho Bravo: 40% → 20%.
- Truco Doble: ×1,5 → ×1,25.
- Poncho Protector: cubre la mitad.

También faltaría mejorar los bonuses inútiles. Si se aplica algo de esto, hay que **recalibrar el difícil**, porque los porcentajes de arriba asumen los bonuses actuales.

## 8. Herramientas (`tools/`)

```bash
# Calibración de la historia del truco: % de partidas ganadas por bonus
cd tools/sim
LIVES=decks DIFF=dificil node hard.js 250                         # ninguno, ancho, doble_truco, escudo
LIVES=sudden DIFF=dificil node hard.js 250 ninguno,ancho,racha    # bonuses a elección (ids de js/truco-bonuses.js)
STORY=purgatorio LIVES=decks DIFF=facil node hard.js 300
START=400 CURVE=0.75 GAIN=6 LIVES=decks DIFF=dificil node hard.js 150   # probar otros valores del difícil

# Rebalanceo de todos los bonuses (escribe tools/sim/out-<exp>.json)
node run3.js bjStory | bjInf | trStory | trInf | gold

# IA del truco
cd tools/ai
node duel.js 2000                 # cerebro contra la IA fácil: puntos por mano
node validate.js 2500 '<paramsA>' '<paramsB>'   # comparar dos juegos de PARAMS (JSON)
node tune.js 600 2                # búsqueda por coordenadas de PARAMS (lenta)
node caso-5-vs-6.js               # la jugada del 6 en la mesa contra tu 5: debe dar "noquiero" siempre

# Arte
python3 tools/sprites/draw.py && python3 tools/sprites/integrate.py   # rivales 64x68 -> js/sprites-pampa.js
python3 tools/card-back.py        # dorso del mazo (imprime el tamaño; b64.txt queda en tools/)
```

- **Tiempos de referencia:** `hard.js` tarda unos 30–60 segundos cada 100 partidas en difícil (cada decisión del cerebro lleva 1–2 ms). En fácil, 1.200 partidas tardan alrededor de un segundo.
- **Paralelizar:** conviene lanzar varias configuraciones a la vez en segundo plano.
- **Requisitos:** los scripts de Python necesitan Pillow (`pip install pillow`). Las salidas de las herramientas están en `.gitignore`.

## 9. Backend y rankings

- **Rankings** (`api/leaderboard.js`):

  | Ranking | Qué mide |
  |---|---|
  | `story` | historia del blackjack más rápida |
  | `trucoStory` | historia del truco más rápida (solo la pampa en muerte súbita) |
  | `chips` | más fichas |
  | `cycles` | más ciclos en el blackjack infinito |
  | `trucoCycles` | más ciclos en el truco infinito |
  | `speedStory`, `speedTrucoStory` | las historias en modo speedrun (sin animaciones) |
  | `playtime` | tiempo total de juego (top 200) |

  Cada dispositivo tiene un id aleatorio (`pid`) y guarda una sola fila por ranking, con su mejor marca.
- **Anti-bot:**
  - `js/antibot.js` junta estadísticas de cómo jugaste: clics, ritmo, si los clics caen siempre en el centro exacto, si el mouse se mueve entre clics y si el navegador es automatizado.
  - `botReason()`, en el servidor, rechaza las marcas que parecen de un programa.
  - También hay controles de plausibilidad: mínimo de manos por historia, al menos 2 segundos por mano (menos en speedrun) y un límite de 10 envíos por minuto por IP.
- **Clave de prueba:** el servidor guarda **solo su hash** (`TEST_KEY_SHA256`). La clave la tiene el usuario y no se escribe en el repo ni en ningún lado. Las marcas que la traen saltean el anti-bot, pero van a un ranking de pruebas aparte.
- **`PURGE`:** lista de marcas que se borran a mano. Ahí está la marca "Dev" del 4 de noviembre en `trucoStory`, que era de la historia vieja. "DevPC" es el usuario jugando la historia nueva desde la compu, y se conserva.
- **Salas online** (`api/room.js`): usan la misma base de Upstash. Los celulares consultan cada ~1 segundo si hubo cambios.
- **Variables de entorno en Vercel:** `KV_REST_API_URL` y `KV_REST_API_TOKEN`, o `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.

### Temporada 2 de los rankings (11 de noviembre de 2026)

El dominio de Vercel cambió y, como el id de jugador (`luckjack.playerId`) vive en el `localStorage` (que es por dominio), nadie podía mejorar sus marcas viejas. Se reiniciaron **todos** los rankings sin tocar la base: ahora se leen y escriben en `lb2:*` (`SEASON_PREFIX` en `api/leaderboard.js`). Las claves de la temporada 1 (`lb:*`) siguen en Upstash sin usarse: se puede volver atrás cambiando la constante, o borrarlas desde la consola.

### Cuentas (`api/account.js`, `api/_accounts.js`, `js/account.js`, `js/progress.js`)

- **Qué es:** usuario y contraseña, sin mail. Es opcional: sin cuenta se juega como invitado.
- **En la base:**
  - `acct:<usuario en minúsculas>` = `{ username, salt, hash, pid, created, progress }`. La contraseña se guarda con scrypt y sal propia.
  - `sess:<token>` = usuario. Vence a los 6 meses sin usarse.
  - `afail:<usuario>` cuenta las contraseñas mal (10 → frenado 15 minutos).
  - `arl:<ip>` es el límite de 30 pedidos por minuto por IP.
- **Al crear la cuenta:** se queda con el `pid` del dispositivo (las marcas de la temporada 2 pasan a la cuenta) y con su progreso.
- **Al entrar:** el dispositivo adopta el `pid` de la cuenta (`Leaderboard.playerId()` lo devuelve) y su progreso combinado.
- **Progreso:** `js/progress.js` define qué viaja con la cuenta (los desbloqueos, `best`, `trucoBest`, `bestClassic`, `playMs`, `trucoClassic`, `truco4`) y cómo se combina sin perder nada. Se sincroniza al volver al menú, como mucho cada 30 segundos.
- **Rankings con cuenta:** el envío lleva el `token`. El servidor usa el `pid` y el usuario de la cuenta, y marca la fila con `acct: true` (en la UI se ve un ✔). Sin token, un nombre que es usuario de una cuenta se rechaza con 403.
- **Limitaciones:**
  - Si entrás a una cuenta en un dispositivo donde ya jugaste como invitado, las marcas de ese invitado quedan como filas aparte.
  - El usuario no se puede cambiar.
  - La contraseña no se puede recuperar.
- **Pendiente posible:** cambiar la contraseña estando adentro, y una forma de borrar la cuenta.

## 10. Datos guardados en el navegador (`localStorage`)

| Clave | Para qué |
|---|---|
| `luckjack.name` | nombre del jugador ("Timbero" = sin nombre) |
| `luckjack.seenIntro` | ya vio la intro |
| `luckjack.storyDone` | ganó la historia del blackjack → Mazo Dorado y blackjack infinito |
| `luckjack.trucoPampaBeaten` | ganó la pampa → desbloquea el purgatorio |
| `luckjack.trucoStoryBeaten` | ganó alguna historia del truco → desbloquea el resto de los modos de truco |
| `luckjack.trucoStoryDone` | ganó la pampa en muerte súbita → Mazo Dorado en el truco |
| `luckjack.trucoDifficulty` | última dificultad elegida |
| `luckjack.best`, `luckjack.trucoBest`, `luckjack.bestClassic` | récords locales |
| `luckjack.playMs`, `luckjack.playSent` | tiempo total de juego y lo último que se mandó al ranking |
| `luckjack.account` | sesión de la cuenta: `{ username, token, pid }` (sin cuenta, no existe) |
| `luckjack.playerId` | id de jugador del invitado en este dispositivo |

Para probar con todo desbloqueado, setear en `true` estas claves: `seenIntro`, `trucoPampaBeaten`, `trucoStoryBeaten` y `trucoStoryDone`.

## 11. Pendientes e ideas

1. **Bonuses:** confirmar el rebalanceo propuesto (sección 7). Después hay que recalibrar el difícil.
2. **Perfil de jugador:** el usuario preguntó si es difícil. Se le ofrecieron tres opciones y falta que elija:
   - **(a) Estadísticas locales:** manos jugadas, % de manos ganadas, envidos ganados, mejor racha, historias pasadas por dificultad, tiempo de juego.
   - **(b) "Cómo te ve la IA":** los índices de mentira y agresión con una etiqueta tipo "Conservador", "Pescador" o "Temerario", como los perfiles de TrucoAnalytics.
   - **(c) Perfil online:** necesita cuentas o un código de recuperación.

   Las opciones (a) y (b) juntas son rápidas: una pantalla "👤 Perfil" en el menú. Para (b) habría que guardar el perfil de la IA entre partidas (hoy se reinicia en cada una).
3. **Mazo a la derecha del que reparte** en el truco de a 4 y en el online.
4. **Rankings por dificultad:** hoy fácil y difícil comparten ranking.
5. **Opinión ya dada sobre separar el blackjack:** no separarlo todavía. Mantener un solo repo y un solo deploy, y poner el truco como cara del juego (que el menú arranque en Truco, logo y fondo de pampa). Si algún día el blackjack tiene su propio público, se separa con otro dominio usando el mismo código.
6. **Ideas sueltas que se mencionaron:**
   - Dificultad también en la historia del blackjack.
   - Que la IA fácil deje de querer de farol en la 1ra baza.
   - Guardar el perfil de la IA entre partidas.

## 12. Historial reciente (lo último primero)

| Commit | Qué hizo |
|---|---|
| `008efe8` | Intro corta con el nombre en la primera escena; llegada al purgatorio compartida entre BJ y truco |
| `3342e03` | La IA no acepta de farol; lee tu canto después de ver su carta; truco clásico con fácil y difícil; difícil más accesible ($400, curva 0.75, 6 mínimas) |
| `35e6dfd` | `truco-brain.js` (modo difícil); arreglo del ancho de basto en la 3ra; selector de dificultad; mesas de patio y de casino; mazo español; menú en dos columnas en pantallas bajas |
| `083d4d7` | El Pombero reemplaza al Futre; cuotas de la pampa un 10% más altas |
| `c7a9d7f`, `e4f5f10` | El purgatorio (la historia original del truco) vuelve como secuela de la pampa |
| `8bcebec` | Purga del ranking de la historia vieja del truco |
| `54c5ca1` | Modos bloqueados hasta pasarse la historia de cada juego |

Para lo anterior, `git log`.
