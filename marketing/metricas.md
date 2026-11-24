# Métricas y seguimiento

Las mantiene el agente `analista-growth`.

## Estado actual (24 de noviembre de 2026)

- **Web Analytics de Vercel:** el script ya está en el juego, pero **falta activarlo en el panel** (proyecto `luckjack`). Hasta entonces no hay datos de visitas, países, dispositivos ni de dónde llega la gente.
- **Contadores propios:** `GET https://costumbres-arg.vercel.app/api/stats?weeks=8` devuelve las **salas online creadas** (de 2 y de 4) y las **cuentas nuevas**, por semana y en total. Empezaron a contar el 24 de noviembre de 2026.
- **Datos propios que sí hay** (en la base Upstash, vía las APIs del juego):
  - **Rankings de la temporada 2** (`lb2:*`): cuánta gente terminó una historia o mandó tiempo jugado (el ranking `playtime` muestra hasta 200).
  - **Cuentas creadas** (`acct:*`).

## Paso 1: activar la medición (fase 0 de la timeline)

1. En Vercel: proyecto **luckjack** → pestaña **Analytics** → **Enable**. El plan gratis alcanza para empezar.
2. ✅ El script ya está en `index.html` (`/_vercel/insights/script.js`, sin cookies). Hasta que se activa da 404, sin consecuencias.
3. Comprobar en el panel que aparecen visitas.

**Ojo:** según el plan de Vercel, algunas cosas (eventos personalizados, desglose por UTM) pueden no estar en el gratis. Revisar en el panel qué hay disponible. Si falta algo, la alternativa es contar eventos con un endpoint propio en `api/` (🎮 *requiere desarrollo*).

## UTM: todo link lleva su etiqueta

Formato: `https://costumbres-arg.vercel.app/?utm_source=<red>&utm_medium=<tipo>&utm_campaign=<campaña>&utm_content=<pieza>`

| Campo | Valores |
|---|---|
| `utm_source` | `tiktok`, `instagram`, `youtube`, `x`, `reddit`, `facebook`, `whatsapp`, `itchio`, `prensa` |
| `utm_medium` | `bio` (link de la bio), `post`, `story`, `comentario`, `dm`, `nota` |
| `utm_campaign` | `t2-lanzamiento`, `leyendas-dic`, `fiestas`, `verano-speedrun`, `carnaval`, `playstore`, `dia-padre`, `dia-amigo`, `tradicion` |
| `utm_content` | El número del guion (`g01`, `g04`...) o del post |

**Links de bio listos:**
- TikTok: `https://costumbres-arg.vercel.app/?utm_source=tiktok&utm_medium=bio&utm_campaign=t2-lanzamiento`
- Instagram: `https://costumbres-arg.vercel.app/?utm_source=instagram&utm_medium=bio&utm_campaign=t2-lanzamiento`
- YouTube: `https://costumbres-arg.vercel.app/?utm_source=youtube&utm_medium=bio&utm_campaign=t2-lanzamiento`
- X: `https://costumbres-arg.vercel.app/?utm_source=x&utm_medium=bio&utm_campaign=t2-lanzamiento`

Los parámetros UTM no rompen nada del juego: el único parámetro que el juego lee es `?sala=`.

## KPIs

| Métrica | De dónde sale | Para qué |
|---|---|---|
| **Visitas por red** | Web Analytics (UTM o referrer) | Saber qué red trae gente |
| **Visitas por video** | `utm_content` | Saber qué guion funciona |
| **Retención de los videos** (% que lo mira entero) y **guardados/compartidos** | El panel de cada red | El gancho funciona si más del 50% pasa los 3 segundos |
| **Cuentas creadas por semana** | `/api/stats` (`accounts`) | El jugador que se queda |
| **Jugadores con tiempo jugado** | Ranking `playtime` | Gente activa (aproximado) |
| **Historias terminadas** | Rankings `trucoStory` y `story` | Profundidad del juego |
| **Salas online creadas** | `/api/stats` (`rooms2` y `rooms4`) | Mide el pilar "con amigos" y la viralidad |
| **Llegadas por resultados compartidos** | Web Analytics con `utm_source=share` | Mide el botón 📤 Compartir |

## Informe mensual

En `marketing/informes/AAAA-MM.md`, con esta estructura:
1. Números del mes contra el mes anterior.
2. Los 3 videos que mejor funcionaron y por qué (gancho, tema, día).
3. Qué no funcionó.
4. Tres decisiones para el mes siguiente (que el `director-marketing` pasa a la timeline).

Los números del panel de cada red los tiene que pasar el usuario, porque las cuentas son suyas (o exportarlos a un CSV en `marketing/informes/datos/`).
