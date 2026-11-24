# Marketing de Costumbres Argentinas

Un equipo de marketing hecho con agentes de Claude Code (`.claude/agents/`) y todo su trabajo en esta carpeta. Los agentes se cargan solos cuando abrís una sesión de Claude Code en el repo.

## El equipo

| Agente | Rol | Pedile cosas como... |
|---|---|---|
| `director-marketing` | Estrategia, timeline, prioridades, planes de campaña | "¿Qué hacemos esta semana?" · "Armá el plan para el Día del Amigo" · "Actualizá la timeline con lo que salió del informe" |
| `guionista` | Guiones de video corto y tráileres | "Escribí un guion sobre el truco de a 4 con señas" · "Dame 3 ganchos para el guion 02" |
| `community-manager` | Posts, captions, calendario semanal, respuestas | "Armá el calendario de la semana del 7 de diciembre" · "¿Qué le contesto a este comentario?" |
| `productor-visual` | Clips, capturas (también automáticas con Playwright), miniaturas y formatos | "Grabá los clips C30 a C32" · "Sacá 5 capturas para el kit de prensa" |
| `analista-growth` | Medición, UTM, informes y experimentos | "Armá el informe de diciembre" · "Pasame los links con UTM para el guion 04" |
| `prensa-y-alianzas` | Creadores, medios, itch.io, Play Store y kit de prensa | "Buscame 10 creadores de truco para contactar" · "Escribí la ficha de itch.io" |

**Cómo llamarlos:** en tu sesión de Claude Code, pedí *"usá el agente guionista para..."* o escribí directo lo que querés y nombrá al agente.

**Autonomía:** con las skills o herramientas que tengas en tu compu, los agentes publican y cargan material solos. Igual piden tu confirmación para tres cosas, porque no tienen vuelta atrás o comprometen tu reputación:
- escribirle a una persona o a un medio;
- postear en comunidades ajenas;
- publicar algo fuera del calendario.

Si el `director-marketing` no puede lanzar a los otros agentes, te deja la lista de pedidos para que se los pases.

## Qué hay

| Archivo | Para qué |
|---|---|
| [brief.md](brief.md) | **Lo primero que lee todo el equipo:** producto, público, tono, pilares y reglas que no se rompen |
| [timeline.md](timeline.md) | Eventos de marketing de diciembre 2026 a noviembre 2027 (las primeras seis semanas, día por día) |
| [guiones/](guiones/) | 7 guiones listos y el banco de clips para grabarlos |
| [posts/primeras-semanas.md](posts/primeras-semanas.md) | Textos listos para X, Instagram, grupos y Reddit, y respuestas tipo |
| [metricas.md](metricas.md) | Qué se mide, cómo activar las analíticas, convención de UTM y links de bio |
| [prensa/kit.md](prensa/kit.md) | Ficha, descripciones, ángulos para notas y plantilla para creadores |

## Flujo semanal sugerido (1–2 horas por semana)

1. **Lunes:** al `director-marketing`, "¿qué hacemos esta semana?".
2. **Lunes:** al `community-manager`, el calendario de la semana con los textos.
3. **Martes:** grabar los clips que falten (a mano o con el `productor-visual`).
4. **Durante la semana:** publicar desde tus cuentas: 3–4 videos y 2 posts.
5. **Primer lunes del mes:** al `analista-growth`, el informe. Después, al `director-marketing`, que ajuste la timeline.

## Lo urgente (fase 0, esta semana)

1. Activar **Web Analytics** en Vercel (hoy está apagado) y sumar el script al juego ([metricas.md](metricas.md)).
2. Crear las cuentas en TikTok, Instagram, YouTube y X con los links de bio con UTM.
3. Grabar el banco de clips.
4. Publicar el primer video el **lunes 30 de noviembre, Día Nacional del Mate** ([guion 07](guiones/07-dia-del-mate.md)).
