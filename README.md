# 🍀 Luckjack

**Jugar online:** https://costumbres-arg.vercel.app

**Para retomar el desarrollo:** ver [HANDOFF.md](HANDOFF.md) (estado, decisiones de diseño, balance y pendientes).

Blackjack **roguelike** para el navegador. Ganá dinero mano a mano, superá la cuota de cada ciclo y comprá bonuses aleatorios en la tienda para romper la banca... hasta que la suerte se acabe.

Estética pixel art inspirada en Balatro: fondo en remolino pixelado con efecto CRT, cartas y crupier dibujados píxel a píxel y la fuente [Tiny5](https://github.com/Gissio/font_tiny5) (SIL Open Font License, ver `fonts/OFL-Tiny5.txt`).

## Historia

Fuiste el mejor timbero de tu época: ganaste fortunas y te retiraste a una casucha en la pampa. Cuando moriste de viejo, terminaste en el **Purgatorio de los Timberos**, a cargo de un gaucho tan viejo que se olvidó de su propio nombre. La primera vez que abrís el juego, una cutscene corta te presenta, te pide tu nombre y cuenta tu retiro a la pampa (nada más). Lo que pasa en la pampa lo cuenta la historia del truco, y la llegada al purgatorio es la misma escena al empezar la historia del blackjack y la del purgatorio del truco (`Story.purgatorioIntro`); después cada juego explica sus reglas.

## Modos

- **🃏 Blackjack clásico:** blackjack común contra el crupier. Sin bonuses, cuotas ni tienda. Jugás hasta fundirte; se guarda tu récord de dinero.
- **📖 Modo historia:** tres ciclos de 15 manos contra tres jefes:
  1. **El Viejo Timbero** (el gaucho): su cuota.
  2. **El Diablo**: pagale o te vas al infierno. En cada empate se queda con el 25% de tu apuesta.
  3. **San Pedro**: la entrada al Casino del Edén. En su mesa el Crupier Nervioso no tiene efecto.

  Si no llegás a una cuota perdés un mazo y reintentás ese ciclo con el dinero con el que lo empezaste. Al final de cada ciclo jugado completo elegís **1 bonus común gratis**; el árbol de mejoras solo aparece en la tienda de fin de ciclo. Hay cutscenes al presentar cada jefe, al ganar y al perder. Pasar la historia desbloquea el **Mazo Dorado** para el modo infinito.
- **♾️ Roguelike infinito:** cuotas cada vez más altas, sin final (con el Viejo Timbero repartiendo).

En los dos modos roguelike, cuando ya cumpliste la cuota y jugaste al menos **5 manos del ciclo** podés **pasar de ciclo**, o seguir jugando y ganar **$5 por cada ronda** que arranque con la cuota cumplida. En la historia, si pasás directo, la tienda del final deja de ser gratis. La mesa tiene **apuesta máxima**: 5 veces la mínima en el blackjack y 3 veces en el truco (no se puede ir all-in).

La música y los efectos se generan en el momento con Web Audio (sin archivos de audio); se pueden silenciar con el botón 🔊.

## Truco

Desde el menú (pestaña **🗡️ Truco**) se juega **truco clásico**: mano a mano contra el Viejo Timbero, sin flor, a 15 puntos. Las cartas son del mazo español en pixel art y se juegan tocándolas.

- Envido (2), Real envido (3) y Falta envido (lo que le falta al que va ganando para llegar a 15; en partidas a 30, para salir de las malas o para ganar: nunca más de 15). El envido está primero. Si no se quiere, el último que cantó se lleva lo ya aceptado + 1: envido-envido no querido = 3, envido-envido-real no querido = 5.
- Truco, Retruco y Vale cuatro; irse al mazo.
- El rival canta, quiere, sube y a veces miente según su personalidad (`js/truco-ai.js`). Desde la 2da baza calcula la chance real de ganar la mano con las cartas que ya se vieron, así que no se achica con la mano ganada (ni quiere una perdida).
- **Mesas:** en la pampa se juega en una mesa de patio de madera gastada; en el purgatorio y el truco clásico, en una mesa de casino. El mazo queda a la derecha del que reparte (el que no es mano).
- Se guardan tus partidas ganadas y perdidas.

### Truco de a 4 (parejas)

Pestaña **🗡️ Truco → 🃏 Truco de a 4**: vos y el Viejo contra el Diablo y San Pedro (bots).

- Gana la baza la carta más alta de las 4: si empatan dos compañeros es de esa pareja; si empatan rivales, es parda.
- Envido por pareja: vale el mejor tanto de cada una (si empatan, gana el más cerca de la mano).
- A un canto responde cualquiera de la pareja desafiada (contra la tuya respondés vos) y sube la pareja que dijo quiero. Irse al mazo se lleva a la pareja entera.
- **Señas** 🤫: con un toque, en cualquier momento de la mano, tu compañero ve todas tus cartas bravas (y si tenés envido o nada); los rivales nunca ven nada. Anti-spam: hasta 3 veces por mano, cada 4 segundos. El Viejo te hace las suyas al repartir (todas a la vez, y te quedan sus cartas a la vista) y el compañero bot tiene en cuenta todas las tuyas.
- **Frases** 💬: órdenes que solo escucha tu compañero (*"Cantá el vino, dale"* = envido, *"Cantá doble"*, *"Cantá real"*, *"Cantá falta"*, *"Cantá 2da"* = truco, *"Cantá el re"*, *"Cantá el vale cuatro"*, *"Vamos a la pesca"* / *"Jugá callado"* = no cantar) y cargadas a los rivales. El compañero bot obedece apenas puede y los rivales bots contestan las cargadas.

| Seña | Significa |
|------|-----------|
| 🤨 Levantar las cejas | Ancho de espadas |
| 😉 Guiñar un ojo | Ancho de bastos |
| 😏 Torcer la boca a la derecha | 7 de espadas |
| 😒 Torcer la boca a la izquierda | 7 de oro |
| 😬 Morder el labio | Un tres |
| 😗 Hacer trompita | Un dos |
| 😠 Fruncir el ceño | Tengo envido |
| 😌 Cerrar los ojos | No tengo nada |

### Jugar con un amigo (online)

Pestaña **🗡️ Truco → 👥 Jugar con un amigo**:

1. Creás una sala (a 15 o a 30 puntos) y te da un código, por ejemplo `MATE-37`, con botones para mandar el link por WhatsApp o copiarlo.
2. Tu amigo abre el link (`.../?sala=MATE-37`), pone su nombre y arranca la partida, cada uno desde su celular.
3. Cada uno ve solo sus cartas; los cantos del otro aparecen en el globo. Hay **frases rápidas** 💬 para cargarlo (sin chat libre) y **revancha** al final.
4. Si se corta internet o se cierra la app, se vuelve a abrir el link (o el menú ofrece "Volver a la sala") y se sigue donde estaba. Las salas vencen a las 2 horas sin actividad.

**De a 4 online:** al crear la sala elegí **"De a 4"**. Compartí el link con hasta 3 amigos; en la sala, quien la creó arma las parejas tocando dos asientos para intercambiarlos (pareja A: asientos 1 y 3, pareja B: 2 y 4) y toca **Empezar**: los asientos vacíos los ocupan bots (el Viejo, el Diablo, San Pedro). Las señas 🤫 y las órdenes 💬 solo las ve tu compañero: el servidor nunca se las manda a los rivales. Si tu compañero es un bot, obedece tus órdenes. Al final, la revancha arranca cuando aceptan todos los humanos.

**Cómo funciona:** la partida vive en el servidor (`api/room.js`, Vercel Function + Upstash Redis). El motor del truco corre ahí, valida cada jugada y a cada jugador le manda solo lo que puede ver, así que nadie puede espiar las cartas del otro. Los celulares consultan cada ~1 segundo si hubo cambios. Necesita la misma base Upstash que los rankings globales (ver más abajo); con el plan gratis alcanza para unas 200 partidas por mes.

### Modos bloqueados

Al principio solo están el **clásico** y la **historia** de cada juego. Pasarte la historia del blackjack desbloquea el roguelike infinito; pasarte la historia del truco (con muerte súbita o con 3 mazos) desbloquea su secuela (la historia del purgatorio), el truco infinito, el truco de a 4 y jugar con un amigo. Si un amigo te manda el link de una sala, podés entrar igual.

### Truco modo historia: cinco noches en la pampa

Pestaña **🗡️ Truco → 📖 Modo historia**. Es la precuela de la historia del blackjack: antes de morir de viejo, el timbero está retirado en su casucha de la pampa y cada noche viene alguien a jugarle un truco **por su vida**. Arrancás con **$200** y cada noche tiene su cuota (**$285, $415, $605, $875 y $1.270**).

| Noche | Rival | Su trampa |
|---|---|---|
| 1 | 💡 **La Luz Mala** | Te muestra una de sus cartas, pero te baja la suerte (−5%) |
| 2 | 🎵 **El Silbón** | Cada 4 manos silba cerca: lo que perdés en esa mano cuesta ×1,5 |
| 3 | 🌿 **El Pombero** | Te esconde una carta en cada mano: la ves recién cuando la tirás (y no sabés tu envido) |
| 4 | 🐕 **El Familiar** | Cada 5 manos se come el 15% de tus fichas |
| 5 | 🕯️ **El Gauchito Gil** | Truco honrado: nunca miente y en su mesa no sirven el Chamuyero ni la Cara de Póker |

Al empezar elegís cómo jugar:
- **💀 Muerte súbita:** perder una noche es perder la vida (cada rival tiene su final). Ganarla desbloquea el **Mazo Dorado** en el truco infinito y el tiempo cuenta para los rankings.
- **🃏 Con 3 mazos:** reintentás la noche con el mazo siguiente. Más fácil, pero sin Mazo Dorado ni rankings.

Y la dificultad (también en el purgatorio):
- **🙂 Fácil:** los rivales de siempre.
- **😈 Difícil:** los rivales usan `js/truco-brain.js`. Calculan la chance exacta de ganar el envido recorriendo todas las manos posibles que encajan con lo que ya se vio, y la chance de ganar la mano jugando las bazas que quedan de la mejor forma para los dos; con eso deciden por valor esperado qué cantar, querer o tirar en cada baza. Además te estudian (ideas de [TrucoAnalytics](https://github.com/IAARhub/TrucoAnalytics)): llevan tu *índice de mentira* (cantos con cartas malas sobre cantos) y tu *índice de agresión*, y si mentís seguido te creen menos. No aceptan de farol (el farol es para cantar o subir) y si les cantás truco después de ver su carta, entienden que probablemente les ganás. Para compensar arrancás con **$400** y las cuotas son un 25% más bajas, pero cada noche hay que ganar por lo menos **6 apuestas mínimas** (la plata que traés no alcanza para pasar sin jugar). Calibrado con simulaciones: con un solo bonus fuerte (Ancho Bravo, Truco Doble o Poncho Protector), un jugador promedio pasa la pampa con 3 mazos un 56–76% de las veces (sin bonus, 27%; con muerte súbita, 21–33%).

El **truco clásico** contra el Viejo también tiene las dos dificultades.

Si sobrevivís, el Gauchito Gil te da su bendición y morís tranquilo de viejo... y la historia sigue en el purgatorio (la secuela). Las reglas de cada rival son provisorias. Los sprites de los cinco son pixel art original de 64×68 (`js/sprites-pampa.js`).

### Historia del purgatorio (la secuela)

Pestaña **🗡️ Truco → 🔥 Historia del purgatorio**, o el botón **🔥 Seguir al purgatorio** al ganar la historia de la pampa (que la desbloquea). El timbero, que sobrevivió a las cinco noches y murió de viejo, despierta en el purgatorio: 3 ciclos con 3 mazos contra **el Viejo** (miente de vez en cuando), **el Diablo** (las bazas pardas son suyas) y **San Pedro** (nunca miente y anula el Chamuyero y la Cara de Póker). Si ganaste la pampa con muerte súbita, arrancás con el **✨ Mazo Dorado** en vez del clásico. No cuenta para los rankings.

### Truco infinito

La misma progresión que el blackjack (ciclos de 15 manos, cuota, tienda cada 5 manos, mazos como vidas, árbol de mejoras, pasar de ciclo), pero cada ronda es una mano de truco:

- Apostás antes de repartir y cobrás o pagás **apuesta × (tus puntos − los del Viejo)**. Un truco querido y ganado con envido (4–0) paga 4 veces lo apostado. El dinero no baja de $0.
- Acá no hay partida a 15 (cada mano se cobra aparte), así que la falta envido vale 5 puntos. Las cuotas crecen más rápido que en el blackjack (**$140, $195, $275...**) porque el truco tiene más varianza; están calibradas con simulaciones.
- La suerte del mazo (y la mejora de Suerte) cambia la chance de recibir cartas buenas (anchos bravos, sietes bravos, treses y doses).

| | Bonus | Rareza | Efecto |
|-|-------|--------|--------|
| 🏳️ | Retirada Digna | Común | Irte al mazo no te cuesta fichas |
| 🗣️ | Chamuyero | Común | El rival se achica más seguido ante tus cantos de truco |
| 🧉 | Mate Cebado | Común | +$5 cada vez que ganás el envido |
| 🦅 | Ojo de Halcón | Común | Ves una de las cartas del rival |
| 🦶 | Pie | Común | Si la primera baza es parda, la ganás vos |
| 😐 | Cara de Póker | Común | El rival te quiere menos los envidos |
| 🔖 | Mazo Marcado | Común | Sabés el envido del rival |
| 🪂 | Falta Segura | Común | Si perdés una falta envido querida, no te cuesta nada |
| 🍖 | Envido Gordo | Poco común | +2 a tu envido |
| 🫘 | Porotero | Poco común | +$3 por cada punto que ganás en la mano |
| 🔥 | Racha Gaucha | Poco común | +20% de ganancia por cada mano ganada seguida |
| 🌼 | Flor | Poco común | Jugás con flor: tres del mismo palo te dan 3 puntos |
| 7️⃣ | Siete Bravo | Poco común | Tus 7 de copa y de basto valen como el 7 de oro |
| 🗡️ | Ancho Bravo | Raro | El ancho de espadas te sale mucho más seguido |
| ✌️ | Truco Doble | Raro | Las manos ganadas con truco querido pagan x1.5 |
| 🛡️ | Poncho Protector | Legendario | Una vez por ciclo, una mano perdida no te cuesta fichas |

Próximamente: modo historia de truco y rankings del truco.

## Rankings

Desde el menú (🏆 Rankings) hay ocho rankings:

- **⏱️ Historia más rápida:** tiempo de juego hasta entrar al Edén (sin contar cutscenes, menú ni pestaña en segundo plano).
- **💰 Más fichas (infinito):** el máximo de dinero alcanzado en una partida.
- **♾️ Más ciclos (infinito):** ciclos superados en una partida.
- **🗡️ Historia del truco más rápida** y **🗡️ Más ciclos (truco infinito):** los mismos rankings, para el truco.
- **⚡ Speedrun BJ** y **⚡ Speedrun truco:** las historias jugadas en modo speedrun.
- **⌛ Tiempo jugado:** el tiempo total de juego de cada jugador, en todos los modos (aparecen todos, no solo los 10 primeros). Cuenta solo con la pestaña a la vista, fuera del menú y de las cutscenes, y si tocaste algo en los últimos 2 minutos; se manda cada 5 minutos y al volver al menú. El servidor no deja que crezca más rápido que el reloj.

### Modo speedrun

En el menú, **⚡ Speedrun: sí** saca todas las animaciones, las esperas y las cutscenes de la historia. El cronómetro se marca con ⚡ y los tiempos van a sus propios rankings, para no competir con las partidas normales. Si cambiás el modo a mitad de una partida, ese tiempo no se manda.

### Anti-bots y anti-trampas

- Mientras jugás, `js/antibot.js` cuenta cómo tocás (cantidad de clics y teclas, ritmo, si el mouse se mueve, si los clics caen siempre en el centro exacto del botón y si el navegador está automatizado). No guarda qué tocaste.
- Esas estadísticas viajan con cada marca y `api/leaderboard.js` descarta las que parecen de un programa: navegador automatizado, jugadas simuladas por código, menos jugadas que manos, clics siempre centrados, jugadas de menos de 120 ms o con ritmo constante, mouse quieto entre clics.
- También rechaza marcas imposibles (una historia necesita al menos 15 manos y 2 segundos por mano, 0,7 en speedrun; no puede haber más ciclos que manos / 5).
- Las marcas guardadas se vuelven a revisar cada vez que se pide un ranking: si alguna no pasa las reglas actuales, se borra sola.
- Hay una **clave de prueba** (solo se guarda su hash en el servidor) para correr tests automáticos: sus marcas no las frena el anti-bot pero van a un ranking de pruebas aparte y nunca aparecen en los públicos. Se configura en el navegador con `localStorage.setItem('luckjack.testKey', JSON.stringify('<clave>'))`.
- Como el juego corre en tu navegador, nada de esto es infalible contra alguien muy decidido; sí frena a los bots comunes.

Las marcas se mandan solas al terminar (o al abandonar una partida de infinito). Cada jugador tiene una sola fila por ranking: su mejor marca. El nombre es el que escribiste en la intro y se puede cambiar desde la pantalla de rankings (con cuenta, es tu usuario).

**Temporada 2:** al cambiar el dominio del juego, cada navegador perdió su id de jugador (vive en el almacenamiento del navegador, que es por dominio) y nadie podía mejorar sus marcas viejas. Los rankings arrancaron de cero en claves nuevas (`lb2:*`). Las de la temporada 1 (`lb:*`) siguen en la base sin usarse: para volver atrás alcanza con cambiar `SEASON_PREFIX` en `api/leaderboard.js`, y para liberar espacio se pueden borrar desde la consola de Upstash.

### Cuentas (opcionales)

En el menú, **👤 Invitado · Entrar o crear cuenta**. Sin cuenta se juega como invitado, como siempre: el progreso queda en ese dispositivo. Con una cuenta (**usuario y contraseña, sin mail ni links**):

- **Crear cuenta:** elegís un usuario (de 3 a 16 letras, números, `.`, `-` o `_`) y, si está libre, una contraseña. La cuenta se queda con tu id de jugador y tu progreso de ese dispositivo, así que tus marcas pasan a ser de la cuenta.
- **Entrar** desde cualquier celu o compu con el mismo usuario y contraseña: te llega el progreso (desbloqueos, Mazo Dorado, récords, tiempo jugado) y tus marcas siguen siendo tuyas. Combinar nunca hace perder nada: los desbloqueos se suman y de cada récord queda el mejor (`js/progress.js`).
- **En los rankings** tu nombre es tu usuario, con un ✔. Un invitado no puede usar el nombre de una cuenta.
- **Seguridad:** la contraseña se guarda con scrypt y sal propia, nunca tal cual. Después de 10 contraseñas mal, ese usuario queda frenado 15 minutos, y cada IP puede hacer 30 pedidos por minuto. Como no hay mail, **la contraseña no se puede recuperar**.
- **API:** `api/account.js` (`register`, `login`, `sync`, `logout`). Las sesiones duran 6 meses desde el último uso.

**Rankings globales (Vercel + Upstash Redis, gratis):** la API está en `api/leaderboard.js`. Para activarla:

1. En el proyecto de Vercel: **Storage → Create Database → Upstash (Redis)**, plan gratis, y conectarla al proyecto.
2. Vercel agrega solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN` (también sirven `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`).
3. Hacer un redeploy.

Mientras no esté configurada (o jugando desde GitHub Pages / sin internet), cada dispositivo guarda sus 10 mejores partidas.

> Como el juego corre en el navegador, alguien que sepa programar podría mandar marcas falsas. La API valida rangos y limita los envíos, pero no es a prueba de tramposos.

## Cómo jugar

Abrí `index.html` en el navegador (no necesita instalar nada). Si preferís un servidor local:

```bash
npm start   # sirve la carpeta con `serve`
```

### Instalar en el celular

Luckjack es una app web instalable (PWA): no hace falta ninguna tienda de apps.

- **Android (Chrome):** abrí https://costumbres-arg.vercel.app y tocá **📲 Instalar app** (o menú ⋮ → *Instalar app*).
- **iPhone/iPad (Safari):** abrí el link, tocá **Compartir** ⬆️ → *Agregar a pantalla de inicio*.

Queda con su ícono, se abre a pantalla completa y funciona sin internet.

### Reglas

- Blackjack clásico contra el crupier: acercate a 21 más que él sin pasarte. El crupier se planta en 17.
- Ganar paga **1:1** (apostás $10, cobrás $20) y el blackjack natural paga **3:2** (cobrás $25). Podés **doblar** con tus dos primeras cartas y **dividir** pares del mismo rango (hasta 4 manos; los ases divididos reciben una sola carta y un 21 dividido no cuenta como blackjack).
- Empezás con **$100** y elegís **1 bonus gratis** entre 3 al azar. La partida se divide en **ciclos de 15 manos**.
- Al terminar cada ciclo tenés que tener al menos la **cuota** (`$99 × 1.25^ciclo`, redondeada a $5: $125, $155, $195...), si no, perdés.
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
| ✨ | Mazo Dorado | 5% más · aparece en la tienda con 5% de probabilidad y cuesta $120+ · reemplaza tu mazo actual |

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
| 👑 | Diezmo Real | Común | +$2 por cada figura que recibís |
| 👯 | Gemelos | Común | +$15 si tus dos primeras cartas son del mismo rango |
| 🏦 | Interés Compuesto | Común | 10% de tu dinero al final de cada ciclo (máx. $50) |
| 🧮 | Contador de Cartas | Común | Muestra la probabilidad de pasarte |
| 🌟 | Blackjack Dorado | Común | El blackjack paga 2:1: cobrás x3 lo apostado en vez de x2.5 |
| ⏫ | Doble o Nada | Común | Ganar doblado paga x1.5 |
| 🖐️ | Charlie de Cinco | Común | 5 cartas sin pasarte = victoria automática x2 |
| 🧲 | Imán de Ases | Común | +6 ases en el mazo |
| 😰 | Crupier Nervioso | Poco común | El crupier pide hasta 18 |
| 🍀 | Herradura | Poco común | +$5 extra por cada mano ganada |
| 👁️ | Ojo del Crupier | Poco común | Ves la carta oculta del crupier |
| 🤝 | Empate a Favor | Poco común | Los empates pagan +50% |
| 🎯 | Veintiuno Exacto | Poco común | Ganar con 21 exacto duplica la ganancia |
| 🔥 | Racha Caliente | Poco común | +20% de ganancia por victoria consecutiva |
| 🕸️ | Red de Seguridad | Raro | Si te pasás, recuperás la mitad de la apuesta |
| 🎲 | Dados Cargados | Raro | Si el crupier se pasa, ganancia x1.5 |
| ♻️ | Segunda Oportunidad | Raro | Descartá la última carta pedida (1 vez por mano). Si te pasaste, recibís otra en su lugar |
| 🪀 | Límite Elástico | Raro | Te pasás recién con más de 22 (22 vale 21) |
| 🩻 | Rayos X | Legendario | Ves la próxima carta del mazo |
| 🛡️ | Escudo | Legendario | La primera derrota de cada ciclo es empate |

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
js/pixel.js       # sprites pixel art (crupier, gaucho, Diablo, San Pedro, palos) generados como SVG
js/bg.js          # fondo animado en remolino
js/table.js       # mesa animada: el crupier reparte desde el sabot
js/audio.js       # música chiptune y efectos de sonido (Web Audio)
js/cutscene.js    # cutscenes: fondos animados, personajes y texto
js/story.js       # guion del modo historia
js/ui.js          # render y eventos
js/pwa.js         # instalación como app (service worker y botón Instalar)
sw.js             # service worker: guarda los archivos para jugar offline
manifest.webmanifest, icons/  # nombre, colores e íconos de la app
js/leaderboard.js # rankings: API global o copia local
api/leaderboard.js  # API de rankings (Vercel Function + Upstash Redis)
api/room.js         # API de salas de truco online
api/_redis.js       # conexión a Upstash compartida por las APIs
js/truco.js       # motor del truco (reglas, cantos, puntaje)
js/truco-ai.js    # rival de truco
js/truco-brain.js # rival del modo difícil (probabilidades, perfil del jugador)
js/truco-bonuses.js # bonuses del truco
js/truco-run.js   # truco infinito (progresión roguelike)
js/truco-ui.js    # mesa de truco
js/truco-online.js # truco online contra un amigo
js/truco4-ui.js   # mesa de truco de a 4 con señas
js/truco4-online.js # truco de a 4 online (salas con bots)
js/senas.js       # señas del truco de a 4
js/sprites-pampa.js # sprites de los rivales de la pampa (64x68)
js/speedrun.js    # modo speedrun (sin animaciones)
js/antibot.js     # estadísticas anti-bot para los rankings
test/             # tests con node:test
```

## Tests

```bash
npm test
```

> Si agregás un archivo nuevo al juego, sumalo a la lista `ASSETS` de `sw.js` para que también funcione offline.
