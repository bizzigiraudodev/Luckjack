# Cuenta de Instagram: guía y kit visual

Todo lo necesario para abrir la cuenta y dejarla con la estética del juego. Las imágenes están en `img/` y se regeneran con `node tools/marketing/ig-kit.js`. Usan el arte real del juego: los fondos de las cutscenes, los sprites y la fuente Tiny5.

> **Lo que no se puede automatizar** (investigado el 24 de noviembre de 2026):
> - **Crear la cuenta:** los términos de Instagram prohíben crear cuentas de forma automatizada, y además hay que verificar con un mail o un teléfono tuyos. Lo hacés vos desde el celu (2 minutos).
> - **Foto, nombre, bio, link y destacadas:** la API de Instagram solo permite **leer** esos datos, no cambiarlos. Se cargan a mano, una sola vez, con lo que está acá.
> - **Publicar sí se puede por API** (sección 6), y con eso los agentes publican solos.

---

## 1. Crear la cuenta (desde el celu)

1. Instalá Instagram y tocá **Crear cuenta nueva**. Usá un mail del proyecto, no el personal, si podés.
2. **Usuario,** en este orden de preferencia (Instagram te dice si está libre):
   1. `costumbresarg`
   2. `costumbres.arg`
   3. `costumbresargentinas.juego`
   4. `jugacostumbres`
3. **Pasala a profesional:** Configuración → *Tipo de cuenta y herramientas* → *Cambiar a cuenta profesional*.
   - Categoría: **Videojuego** (o *Aplicación* si no aparece).
   - Elegí **Empresa** (no Creador): la publicación por API funciona seguro con cuentas Empresa.
4. No hace falta conectar una página de Facebook.

## 2. Perfil

| Campo | Qué poner |
|---|---|
| **Foto** | `img/perfil.png` (el mate del Viejo con cartas bravas; ya tiene margen para el recorte circular) |
| **Nombre** (aparece en las búsquedas, por eso lleva "Truco") | `Costumbres Argentinas · Truco` |
| **Categoría** | Videojuego (mostrarla en el perfil: sí) |
| **Bio** (135 de 150 caracteres) | ver abajo |
| **Link** | `https://costumbres-arg.vercel.app/?utm_source=instagram&utm_medium=bio&utm_campaign=t2-lanzamiento` |

**Bio:**
```
🗡️ Truco gratis en el navegador
🌙 Cinco noches, cinco leyendas, tu vida en juego
😈 IA que te lee · 👥 Jugá con amigos por link
👇 Jugá ya
```

## 3. Identidad visual

- **Colores (los del juego):**

  | Color | Código |
  |---|---|
  | Dorado | `#ffcd3c` |
  | Rojo | `#fe5f55` |
  | Paño verde | `#2f8a5b` |
  | Noche | `#120c1c` |
  | Crema | `#f3eee3` |
  | Bronce del aro de la mesa | `#c9a24a` |

- **Fuente:** Tiny5 (pixel, licencia OFL: está en `fonts/`). Títulos en mayúscula, con sombra dura.
- **Arte:** siempre pixel art del juego, nada de fotos de stock ni ilustraciones de otro estilo.
- **Firma:** toda publicación lleva abajo la franja "COSTUMBRES ARGENTINAS · TRUCO GRATIS", así la grilla se reconoce aunque la vean de a una.
- **Formato:** publicaciones en 4:5 (1080×1350), que es lo que más pantalla ocupa en el feed. Historias y reels en 9:16.

## 4. Destacadas (historias fijas en el perfil)

Para crearlas, subí una historia con la portada, entrá a la historia → *Destacar* → nombre. Después, *Editar destacada* → *Editar portada*.

| Portada | Nombre | Qué historias guardar |
|---|---|---|
| `img/destacada-jugar.png` | Jugar | Cómo entrar al juego y cómo instalarlo como app (Android e iPhone) |
| `img/destacada-leyendas.png` | Leyendas | Los cinco rivales, uno por historia |
| `img/destacada-dificil.png` | Difícil | Jugadas contra la IA difícil |
| `img/destacada-amigos.png` | Amigos | Cómo crear una sala y mandar el link; truco de a 4 online |
| `img/destacada-rankings.png` | Rankings | Capturas del ranking, el Salón de la Fama y el torneo de verano |
| `img/destacada-novedades.png` | Novedades | Lo que se agrega al juego (modo 5 de copas, cuentas...) |

## 5. Grilla de lanzamiento (las primeras 11 publicaciones)

El perfil muestra lo último arriba a la izquierda. Publicadas en este orden, las 9 de arriba quedan así: [`img/grilla-vista-previa.png`](img/grilla-vista-previa.png).

| # | Imagen | Cuándo (ver la timeline) | Caption |
|---|---|---|---|
| 01 | `post-01-dia-del-mate.png` | Lun 30/11 (Día del Mate) | Feliz Día del Mate 🧉 El Viejo Timbero no reparte sin el suyo. ¿Un truquito? Gratis y sin descargar, link en la bio. #diadelmate #mate #truco |
| 02 | `post-02-te-jugas-la-vida.png` | Mar 1/12 | Un timbero retirado en la pampa. Cinco noches. Cinco visitas. Y cada una te juega un truco por tu vida 🌙 Gratis, link en la bio. #truco #trucoargentino #leyendas |
| 03 | `post-03-podio-vacio.png` | Mar 1/12 | Arrancó la temporada 2 👀 Los primeros 10 en pasar las cinco noches en muerte súbita entran al Salón de la Fama. ¿Quién es el primero? #truco #ranking #speedrun |
| 04 | `post-04-ia-dificil.png` | Jue 3/12 | En difícil el Viejo calcula probabilidades y lleva la cuenta de cuántas veces mentís. Si mentís seguido, no te cree más 😈 Y no hace trampa: nunca ve tus cartas. #truco #ia |
| 05 | `post-05-noche-1-luzmala.png` | Lun 7/12 | Noche 1: la Luz Mala 🔦 Te muestra una de sus cartas... pero te tira la suerte abajo. ¿Preferís ver su carta o tener suerte? #luzmala #leyendas #truco |
| 06 | `post-06-noche-2-silbon.png` | Mié 9/12 | Noche 2: el Silbón 🎶 Si lo escuchás lejos, está cerca. Cada 4 manos silba y lo que perdés cuesta x1,5. #silbon #leyendas #truco |
| 07 | `post-07-noche-3-pombero.png` | Jue 10/12 | Noche 3: el Pombero 🌿 Te esconde una carta en cada mano y ni tu envido sabés. ¿Cantás o no cantás? #pombero #leyendas #truco |
| 08 | `post-08-noche-4-familiar.png` | Vie 11/12 | Noche 4: el Familiar 🐕 El perro negro de los ingenios. Cada 5 manos se come el 15% de tus fichas (de mentira, eh). #familiar #leyendas #truco |
| 09 | `post-09-noche-5-gil.png` | Sáb 12/12 | Noche 5: el Gauchito Gil 🕯️ El único que juega derecho: no miente y no te deja mentir. ¿Le ganás sin chamuyo? #gauchitogil #truco |
| 10 | `post-10-con-amigos.png` | Lun 14/12 | ¿No hay mazo en la casa de la tía? Creá una sala, mandá el link y jueguen cada uno desde su celu 🗡️ Mano a mano o de a 4, con señas que solo ve tu compañero. #truco #fiestas |
| 11 | `post-11-cinco-de-copas.png` | Mar 15/12, o antes (sáb 5/12, por Se Pica) si el debate está caliente; en ese caso cambia un poco el orden de la grilla | ¿Y si el 5 de copas le ganara a todo? 🏆 En el truco clásico ya podés jugar con esa regla. ¿Te animás? #truco #5decopas |

- **Entre medio van los reels de los guiones** (`marketing/guiones/`). Para cada reel, elegí como portada un fotograma con el título en grande, así no rompe la grilla.
- **Texto alternativo** (Configuración avanzada → *Escribir texto alternativo*): describí la imagen. Por ejemplo, *"Pixel art del Pombero, una criatura oscura con sombrero de paja, en el monte de noche. Texto: Noche 3 de 5, el Pombero"*. Ayuda a la accesibilidad y a que Instagram entienda de qué trata la publicación.
- **Sin plata real:** si una caption habla de fichas o apuestas, aclarar que son del juego (ver las reglas del brief).

## 6. Publicar por API (para los agentes de tu compu)

Con una cuenta **Empresa**, Meta permite publicar imágenes, carruseles y reels por API ("Instagram API with Instagram Login", sin página de Facebook). Antes de configurarlo, **revisá la documentación de Meta**: los nombres de los permisos y los límites cambian seguido.

1. **Crear la app:** en [developers.facebook.com](https://developers.facebook.com), *Crear app* → producto **Instagram** → *Configuración de la API con inicio de sesión de Instagram*.
2. **Conectar la cuenta:** sumá la cuenta del juego (como tester mientras la app está en desarrollo) y generá un **token de acceso** con los permisos `instagram_business_basic` e `instagram_business_content_publish`.
3. **Guardar el token como secreto, nunca en el repo.** Por ejemplo, en una variable de entorno de tu compu.
4. **Publicar** es un flujo de dos pasos:
   1. Se crea un "contenedor" con la URL **pública** de la imagen y la caption: `POST /{ig-user-id}/media`, con `image_url` y `caption`.
   2. Se publica: `POST /{ig-user-id}/media_publish`, con el `creation_id` del paso anterior.

   Los reels y los carruseles siguen el mismo esquema, con otros parámetros.
5. **URL pública de las imágenes:** Vercel publica todo el repo. Por ejemplo, la primera queda en `https://costumbres-arg.vercel.app/marketing/instagram/img/post-01-dia-del-mate.png`.
   - Ojo: eso significa que los archivos de `marketing/` también son públicos. No hay nada secreto ahí, pero no pongas tokens ni datos privados en esa carpeta.
6. **Límite:** las fuentes citan 100 publicaciones por día por API (un carrusel cuenta como una). Para este proyecto sobra.

El `community-manager` publica lo que esté en el calendario de la semana. Igual pide confirmación para publicar algo que no esté en el calendario (ver `.claude/agents/community-manager.md`).

## Fuentes

- Términos de Instagram sobre la creación automatizada de cuentas: [Centro de ayuda de Instagram](https://help.instagram.com/581066165581870) y [Meta sobre automatización](https://about.fb.com/news/2020/06/automation-software-lawsuits/)
- Campos de perfil de solo lectura: [referencia de IG User](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/)
- Publicación por API: [referencia de la API de Instagram (abril 2026)](https://gist.github.com/jameschapman2c/65eff9f54a2d350b17a6ce5127b9fe42), [guía de reels por API](https://postproxy.dev/blog/instagram-reels-api-publishing-guide/) y [límites de publicación](https://reeluploader.com/blog/instagram-api-publishing-limits)
