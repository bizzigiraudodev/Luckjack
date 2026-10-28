// Fondo animado estilo Balatro: un remolino de colores dibujado en baja resolución
// y agrandado sin suavizar, para que se vean los píxeles.
(function () {
  const canvas = document.getElementById('bg');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const W = 160;
  let H = 90;
  let img = null;

  // Paleta en bandas (posterizada): de oscuro a claro.
  const PALETTE = [
    [30, 16, 34], [58, 22, 48], [104, 30, 56], [168, 52, 62], [214, 84, 72], [52, 64, 120],
  ].map(([r, g, b]) => (255 << 24) | (b << 16) | (g << 8) | r);

  function resize() {
    H = Math.max(60, Math.round((W * window.innerHeight) / window.innerWidth));
    canvas.width = W;
    canvas.height = H;
    img = ctx.createImageData(W, H);
  }

  function draw(t) {
    const data = new Uint32Array(img.data.buffer);
    const cx = W / 2;
    const cy = H / 2;
    const time = t / 4000;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x - cx) / W;
        const dy = (y - cy) / W;
        const r = Math.sqrt(dx * dx + dy * dy);
        const a = Math.atan2(dy, dx);
        const v = Math.sin(a * 3 + r * 14 - time * 2) + Math.sin(r * 9 - time + a) * 0.6 + Math.sin((x + y) / 23 + time) * 0.3;
        let i = Math.floor((v + 1.9) * 1.4);
        if (i < 0) i = 0;
        if (i >= PALETTE.length) i = PALETTE.length - 1;
        // patrón de puntos (dithering) en los bordes entre bandas
        if ((x + y) % 2 === 0 && ((v + 1.9) * 1.4) % 1 > 0.85 && i < PALETTE.length - 1) i++;
        data[y * W + x] = PALETTE[i];
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let last = 0;
  function loop(t) {
    if (!document.hidden && t - last > 66) { // ~15 fps alcanza para un fondo
      last = t;
      draw(t);
    }
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
})();
