# Banco de clips

Material crudo para todos los videos. Lo arma el agente `productor-visual`. Conviene grabar todo en una sesión y guardarlo con estos nombres, así cada guion sabe qué usar.

## Cómo grabar

- **Desde el celu (lo más fácil):** la grabación de pantalla del sistema, con el juego instalado como app (sin la barra del navegador). Vertical, a 1080×1920 si se puede. Sonido del juego activado.
- **Desde la compu:** Chrome con las DevTools en modo dispositivo (390×844) y grabar esa zona. Para el tráiler 16:9, ventana a 1920×1080.
- **Automático:** el `productor-visual` puede grabar escenas con Playwright (`recordVideo`) contra el juego local (`npm start`). Sirve para planos limpios y repetibles (menús, tienda, rankings), no tanto para jugadas con suspenso.
- **Ajustes antes de grabar:**
  - Nombre del jugador: uno genérico, como "Timbero" o el usuario de la cuenta oficial. Nunca datos personales.
  - Para tener todos los modos desbloqueados, crear una cuenta de marketing que ya haya pasado las historias.
  - Modo speedrun apagado (si no, no hay animaciones ni cutscenes).

## Lista

| Clip | Qué se ve | Lo usan |
|---|---|---|
| C01 | La intro: la casucha en la pampa, el timbero retirado | 02, 06 |
| C02 | Cutscene de la Luz Mala (noche 1) | 02, 03 |
| C03 | Cutscene del Silbón (noche 2) | 02, 03 |
| C04 | Cutscene del Pombero (noche 3) | 02, 03 |
| C05 | Cutscene del Familiar (noche 4) | 02, 03 |
| C06 | Cutscene del Gauchito Gil (noche 5) | 02, 03 |
| C07 | Derrota en muerte súbita (el final de un rival) | 02, 05 |
| C08 | Victoria contra el Gauchito Gil | 02, 06 |
| C10 | Cantar truco con cartas malas | 01 |
| C11 | La IA difícil respondiendo "No quiero" o "¡Retruco!" a un farol | 01, 06 |
| C12 | La IA cantando con buenas cartas | 01 |
| C13 | Menú de dificultad con "😈 Difícil" | 01 |
| C15 | Noche del Pombero: reparto con una carta boca abajo y "Tu envido: ?" | 03 |
| C16 | Tirar la carta escondida (ideal: una carta alta) | 03 |
| C20 | "👥 Jugar con un amigo" → crear la sala | 04, 06 |
| C21 | El link de la sala en un chat (captura armada, sin contactos reales) | 04 |
| C22 | Dos celus jugando la misma mano online | 04, 06 |
| C23 | Truco de a 4: una seña y una frase ("¡Cantá el vino, dale!") | 04, 06 |
| C30 | Pantalla de rankings (temporada 2) | 05 |
| C31 | Crear una cuenta y ver el ✔ en el ranking | 05 |
| C32 | Cronómetro de la historia corriendo | 05 |
| C35 | Tienda: elegir un bonus (Ancho Bravo) y pasar de ciclo | 06 |
| C36 | El purgatorio: el Diablo y San Pedro | 06 |
| C40 | El Viejo repartiendo con el mate en la mesa | 07 |
| C41 | El bonus 🧉 Mate Cebado en la tienda | 07 |

Los números que faltan quedan libres para clips nuevos.
