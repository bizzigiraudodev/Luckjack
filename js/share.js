// Compartir el resultado de una partida: una placa (imagen) con el resultado y el link al juego.
// La mejor publicidad la hacen los jugadores. En el celu abre el menú de compartir del sistema
// (WhatsApp, Instagram...); si el navegador no puede compartir, copia el texto al portapapeles.
(function (root) {
  const SITE = 'https://costumbres-arg.vercel.app';
  // UTM para saber cuánta gente llega por resultados compartidos (ver marketing/metricas.md).
  const LINK = `${SITE}/?utm_source=share&utm_medium=resultado&utm_campaign=jugadores`;
  const W = 1080;
  const H = 1350;

  // Texto que acompaña la placa: el resultado, el desafío y el link.
  function message({ title, lines = [], challenge = '¿Llegás más lejos?' }) {
    return [title, ...lines, '', `${challenge} 🗡️`, LINK].join('\n');
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Corta un texto en renglones que entren en `max` píxeles.
  function wrap(ctx, text, max) {
    const out = [];
    let line = '';
    for (const word of String(text).split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > max && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    if (line) out.push(line);
    return out;
  }

  // Dibuja la placa: el paño con el aro dorado, el ícono del mate, el resultado y el link.
  async function card({ title, lines = [], challenge = '¿Llegás más lejos?' }) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    try { await document.fonts.load('64px Tiny5'); } catch { /* sin la fuente, usa la de sistema */ }
    const font = (px) => `${px}px Tiny5, monospace`;

    // Fondo: noche de la pampa y paño verde con tramado.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#120c1c');
    sky.addColorStop(1, '#1d1626');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#245c3e';
    ctx.fillRect(60, 300, W - 120, 820);
    ctx.fillStyle = '#2a6a47';
    for (let y = 300; y < 1120; y += 12) for (let x = 60 + ((y / 12) % 2) * 6; x < W - 60; x += 12) ctx.fillRect(x, y, 6, 6);
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 8;
    ctx.strokeRect(84, 324, W - 168, 772);

    // Nombre del juego.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f3eee3';
    ctx.font = font(78);
    ctx.fillText('COSTUMBRES', W / 2, 130);
    ctx.fillStyle = '#fe5f55';
    ctx.fillText('ARGENTINAS', W / 2, 215);
    ctx.fillStyle = '#ffcd3c';
    ctx.font = font(30);
    ctx.fillText('TRUCO · LEYENDAS · PURGATORIO', W / 2, 265);

    // Ícono (el mate del Viejo con cartas bravas) y el resultado, centrados en el paño.
    const icon = await loadImage('icons/icon-192.png');
    ctx.font = font(62);
    const titleLines = wrap(ctx, title, W - 220).slice(0, 3);
    ctx.font = font(40);
    const statLines = lines.slice(0, 4).flatMap((t) => wrap(ctx, t, W - 240).slice(0, 2));
    const ICON = 260;
    const height = (icon ? ICON + 80 : 0) + titleLines.length * 74 + 20 + statLines.length * 54;
    let y = 324 + Math.max(30, (772 - height) / 2);
    if (icon) { ctx.drawImage(icon, W / 2 - ICON / 2, y, ICON, ICON); y += ICON + 80; }
    ctx.fillStyle = '#ffffff';
    ctx.font = font(62);
    for (const l of titleLines) { ctx.fillText(l, W / 2, y + 50); y += 74; }
    y += 20;
    ctx.fillStyle = '#f5dfa0';
    ctx.font = font(40);
    for (const l of statLines) { ctx.fillText(l, W / 2, y + 36); y += 54; }

    // Desafío y link.
    ctx.fillStyle = '#ffcd3c';
    ctx.font = font(52);
    ctx.fillText(challenge, W / 2, 1200);
    ctx.fillStyle = '#f3eee3';
    ctx.font = font(36);
    ctx.fillText('Jugá gratis: costumbres-arg.vercel.app', W / 2, 1270);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  // Comparte la placa y el texto. Devuelve 'shared', 'copied' o 'failed'.
  async function share(result) {
    const text = message(result);
    try {
      if (navigator.share) {
        const blob = await card(result).catch(() => null);
        const file = blob && typeof File !== 'undefined' ? new File([blob], 'costumbres-argentinas.png', { type: 'image/png' }) : null;
        const data = file && navigator.canShare && navigator.canShare({ files: [file] }) ? { files: [file], text } : { text };
        await navigator.share(data);
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled'; // cerró el menú de compartir
    }
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  root.Share = { share, card, message, LINK };
})(typeof window !== 'undefined' ? window : globalThis);
