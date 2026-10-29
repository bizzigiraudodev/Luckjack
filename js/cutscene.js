// Cutscenes: fondos pixel art animados, personajes que hablan y texto que aparece letra por letra.
(function (root) {
  const $ = (id) => document.getElementById(id);
  const W = 192;
  const H = 108;

  // --- Utilidades de dibujo (en píxeles del lienzo de 192x108) ---
  function rect(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function bands(ctx, colors, y0, y1) {
    const h = (y1 - y0) / colors.length;
    colors.forEach((c, i) => rect(ctx, 0, y0 + i * h, W, Math.ceil(h) + 1, c));
  }

  function circle(ctx, cx, cy, r, c) {
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(r * r - y * y));
      rect(ctx, cx - w, cy + y, w * 2 + 1, 1, c);
    }
  }

  // Números pseudoaleatorios fijos para que estrellas y cartas no salten entre cuadros.
  function seeded(seed) {
    return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  }
  const STARS = (() => { const r = seeded(7); return Array.from({ length: 50 }, () => [r() * W, r() * 60, r() * 6]); })();
  const FLOATERS = (() => { const r = seeded(11); return Array.from({ length: 14 }, () => [r() * W, r() * H, 3 + r() * 6, r() * 6]); })();

  function cloud(ctx, x, y, s, c) {
    circle(ctx, x, y, 5 * s, c);
    circle(ctx, x + 6 * s, y - 2 * s, 6 * s, c);
    circle(ctx, x + 13 * s, y, 5 * s, c);
    rect(ctx, x - 2 * s, y, 18 * s, 4 * s, c);
  }

  function rancho(ctx, x, y, lit) {
    rect(ctx, x - 1, y - 1, 36, 22, '#3a2a1e');
    rect(ctx, x, y, 34, 20, '#e2d1a8');
    for (let i = 0; i < 9; i++) rect(ctx, x - 4 + i, y - 2 - i, 42 - i * 2, 1, i % 2 ? '#9a7642' : '#7a5a30');
    rect(ctx, x + 6, y + 8, 7, 12, '#3a2a1e');
    rect(ctx, x + 21, y + 7, 7, 6, lit ? '#ffd36b' : '#2a2a3a');
  }

  function ombu(ctx, x, y, dark) {
    rect(ctx, x, y, 6, 18, dark ? '#0c120a' : '#4a3324');
    circle(ctx, x + 3, y - 4, 11, dark ? '#0f170c' : '#3e5a2a');
    circle(ctx, x - 6, y, 7, dark ? '#0f170c' : '#4f6f33');
    circle(ctx, x + 12, y, 7, dark ? '#0f170c' : '#4f6f33');
  }

  const BACKGROUNDS = {
    casino(ctx, t) {
      bands(ctx, ['#1c0d2e', '#24123a', '#2c1646'], 0, 70);
      // cartel de neón con los cuatro palos
      const on = Math.floor(t * 3) % 2;
      rect(ctx, 56, 8, 80, 26, '#140a20');
      for (let i = 0; i < 20; i++) {
        rect(ctx, 56 + i * 4, 8, 2, 2, (i + on) % 2 ? '#ffd84a' : '#5a4a20');
        rect(ctx, 56 + i * 4, 32, 2, 2, (i + on + 1) % 2 ? '#ffd84a' : '#5a4a20');
      }
      ['♠', '♥', '♦', '♣'].forEach((s, i) => {
        const color = ['#5fd4ff', '#ff5f8f', '#ff9a3c', '#6dff9a'][i];
        const map = SUIT_MAPS[s];
        map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') rect(ctx, 64 + i * 18 + x * 2, 12 + y * 2, 2, 2, color); }));
      });
      // tragamonedas
      for (let i = 0; i < 4; i++) {
        const x = 12 + i * 48;
        rect(ctx, x, 40, 22, 32, '#8a8f9e');
        rect(ctx, x + 2, 42, 18, 4, '#c8323c');
        rect(ctx, x + 3, 48, 16, 9, '#101018');
        for (let j = 0; j < 3; j++) rect(ctx, x + 4 + j * 5, 50, 4, 5, ['#ffd84a', '#ff5f8f', '#5fd4ff'][(j + i + Math.floor(t * 4)) % 3]);
        rect(ctx, x + 23, 46, 2, 10, '#c9ccd6');
        circle(ctx, x + 24, 45, 2, '#e0262f');
      }
      for (let y = 70; y < H; y += 8) for (let x = 0; x < W; x += 8) rect(ctx, x, y, 8, 8, ((x + y) / 8) % 2 ? '#5a1830' : '#3a0f20');
    },

    pampa(ctx, t) {
      bands(ctx, ['#f9d47a', '#f6b660', '#f0955a', '#d9735a', '#b65a62'], 0, 72);
      circle(ctx, 150, 68, 13, '#ffe7a3');
      cloud(ctx, ((t * 4) % (W + 60)) - 40, 18, 1, '#ffe3b8');
      cloud(ctx, ((t * 2.5 + 110) % (W + 60)) - 40, 34, 0.8, '#ffd0a0');
      bands(ctx, ['#7c8a3e', '#6b7834', '#5a652c', '#4a5424'], 72, H);
      for (let x = 4; x < W; x += 14) rect(ctx, x, 70, 2, 7, '#5a4630');
      rect(ctx, 0, 72, W, 1, '#5a4630');
      rancho(ctx, 26, 54, true);
      ombu(ctx, 128, 56, false);
      // fogón con humo
      const f = Math.floor(t * 8) % 3;
      rect(ctx, 74, 76, 8, 2, '#3a2a1e');
      rect(ctx, 76, 72 - f, 4, 4 + f, '#ff9a1f');
      rect(ctx, 77, 73 - f, 2, 2, '#ffe08a');
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.6 + i / 4) % 1;
        rect(ctx, 77 + Math.sin(k * 6 + i) * 3, 70 - k * 40, 3, 3, `rgba(240,230,220,${0.6 - k * 0.6})`);
      }
    },

    noche(ctx, t) {
      bands(ctx, ['#0b0d24', '#11163a', '#18204e', '#202a5e'], 0, 72);
      for (const [x, y, p] of STARS) if (Math.sin(t * 2 + p) > -0.6) rect(ctx, x, y, 1, 1, '#f2f0d8');
      circle(ctx, 40, 20, 7, '#f2f0d8');
      circle(ctx, 43, 18, 6, '#11163a');
      bands(ctx, ['#26301f', '#1f2819', '#182014'], 72, H);
      // la luz de la ventana titila y se apaga
      rancho(ctx, 26, 54, t < 2.2 && Math.floor(t * 6) % 7 !== 0);
      ombu(ctx, 128, 56, true);
    },

    purgatorio(ctx, t) {
      bands(ctx, ['#2f2b44', '#3a3550', '#45405e', '#514b6c', '#5d577a'], 0, 84);
      for (let i = 0; i < 5; i++) {
        const y = 14 + i * 14 + Math.sin(t * 0.7 + i) * 3;
        rect(ctx, 0, y, W, 3, 'rgba(160,150,200,0.18)');
      }
      for (const [x, y, sp, ph] of FLOATERS) {
        const yy = (((y - t * sp) % H) + H) % H;
        const xx = x + Math.sin(t + ph) * 4;
        rect(ctx, xx, yy, 6, 8, '#e8e4f0');
        rect(ctx, xx + 2, yy + 3, 2, 2, ph > 3 ? '#c8323c' : '#2b3a67');
      }
      rect(ctx, 0, 84, W, H - 84, '#24202f');
      rect(ctx, 40, 78, 112, 6, '#2f8a5b');
      rect(ctx, 40, 84, 112, 3, '#5e3219');
    },

    infierno(ctx, t) {
      bands(ctx, ['#1a0305', '#2a0608', '#4a0a0e', '#6e1012', '#8e1a14'], 0, 86);
      for (let x = 0; x < W; x += 3) {
        const h = 14 + Math.sin(x * 0.45 + t * 7) * 6 + Math.sin(x * 0.13 - t * 3) * 6;
        rect(ctx, x, 86 - h, 3, h, '#ff3b1f');
        rect(ctx, x, 86 - h * 0.65, 3, h * 0.65, '#ff9a1f');
        rect(ctx, x, 86 - h * 0.3, 3, h * 0.3, '#ffd84a');
      }
      for (const [x, y, sp] of FLOATERS) rect(ctx, x, ((y - t * sp * 3) % H + H) % H, 1, 1, '#ffd84a');
      bands(ctx, ['#ff6a1a', '#e0501a', '#b83a14'], 86, H);
    },

    cielo(ctx, t) {
      bands(ctx, ['#7cc8ff', '#8fd3ff', '#a6dcff', '#bfe6ff', '#d8f0ff'], 0, H);
      for (let i = 0; i < 4; i++) {
        const x = 20 + i * 45 + Math.sin(t * 0.5 + i) * 4;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 30, H); ctx.lineTo(x + 18, H);
        ctx.fill();
      }
      // portón dorado
      rect(ctx, 68, 26, 10, 60, '#b08a2e');
      rect(ctx, 114, 26, 10, 60, '#b08a2e');
      rect(ctx, 69, 27, 8, 58, '#f2d27a');
      rect(ctx, 115, 27, 8, 58, '#f2d27a');
      for (let x = 80; x < 113; x += 4) rect(ctx, x, 34, 2, 52, '#e8c25a');
      for (let i = 0; i < 12; i++) rect(ctx, 70 + i * 4.3, 26 - Math.sin((i / 11) * Math.PI) * 10, 5, 3, '#f2d27a');
      for (let i = 0; i < 6; i++) cloud(ctx, ((i * 40 + t * 3) % (W + 40)) - 20, 92 + (i % 2) * 4, 1.2, '#ffffff');
      rect(ctx, 0, 98, W, 10, '#ffffff');
    },

    eden(ctx, t) {
      bands(ctx, ['#ffe9a8', '#ffd97a', '#ffc65a', '#f7b34a'], 0, H);
      for (const [x, y, , p] of STARS) if (Math.sin(t * 3 + p) > 0.5) rect(ctx, x, y, 2, 2, '#fffbe8');
      // casino del Edén
      rect(ctx, 56, 34, 80, 52, '#b08a2e');
      rect(ctx, 58, 36, 76, 50, '#fbf3df');
      for (let i = 0; i < 16; i++) rect(ctx, 54 + i, 34 - i, 84 - i * 2, 1, '#f2d27a');
      for (let x = 62; x < 132; x += 14) rect(ctx, x, 46, 4, 40, '#e8d8b0');
      rect(ctx, 86, 62, 20, 24, Math.floor(t * 2) % 2 ? '#ffd36b' : '#ffe9a8');
      const neon = Math.floor(t * 3) % 2 ? '#ff5fa0' : '#5fd4ff';
      rect(ctx, 78, 38, 36, 6, neon);
      // manzano
      rect(ctx, 24, 60, 5, 26, '#6b4428');
      circle(ctx, 26, 54, 12, '#3e8a3a');
      for (const [ax, ay] of [[20, 50], [30, 56], [24, 60], [33, 48]]) rect(ctx, ax, ay, 3, 3, '#e0262f');
      for (let i = 0; i < 6; i++) cloud(ctx, ((i * 40 + t * 3) % (W + 40)) - 20, 92 + (i % 2) * 4, 1.2, '#fffdf4');
      rect(ctx, 0, 98, W, 10, '#fffdf4');
    },
  };

  // Mapas de los palos (7x7) para el cartel del casino.
  const SUIT_MAPS = {
    '♠': ['...#...', '..###..', '.#####.', '#######', '#######', '...#...', '..###..'],
    '♥': ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
    '♦': ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
    '♣': ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..'],
  };

  // --- Reproductor ---
  const SPEAKERS = {
    narrador: { name: '', cls: 'narrador' },
    gaucho: { name: 'El Viejo Timbero', cls: 'gaucho' },
    diablo: { name: 'El Diablo', cls: 'diablo' },
    santo: { name: 'San Pedro', cls: 'santo' },
    timbero: { name: '{name}', cls: 'timbero' },
  };

  let ctx = null;
  let raf = null;
  let bg = null;
  let bgStart = 0;
  let skipped = false;
  let advance = null;

  function loop(ts) {
    if (bg && BACKGROUNDS[bg]) BACKGROUNDS[bg](ctx, (ts - bgStart) / 1000);
    raf = requestAnimationFrame(loop);
  }

  function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Espera un toque/tecla del jugador (o que se toque "Saltar").
  function waitAdvance() {
    if (skipped) return Promise.resolve();
    return new Promise((r) => { advance = r; });
  }

  async function typeText(el, text) {
    el.textContent = '';
    let done = false;
    const finish = () => { done = true; };
    advance = finish;
    for (let i = 0; i < text.length && !done && !skipped; i++) {
      el.textContent = text.slice(0, i + 1);
      if (i % 2 === 0 && text[i] !== ' ') Sound.sfx('type');
      await wait(28);
    }
    el.textContent = text;
    advance = null;
  }

  function setChars(chars, speaker) {
    const wrap = $('cs-chars');
    const keep = new Set(chars.map((c) => c.id));
    [...wrap.children].forEach((el) => { if (!keep.has(el.dataset.id)) el.remove(); });
    for (const c of chars) {
      let el = wrap.querySelector(`[data-id="${c.id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'cs-char enter';
        el.dataset.id = c.id;
        el.innerHTML = Pixel.character(c.id);
        wrap.appendChild(el);
      }
      el.dataset.pos = c.pos || 'center';
    }
    [...wrap.children].forEach((el) => el.classList.toggle('talking', el.dataset.id === speaker));
  }

  function askName(vars) {
    const form = $('cs-input');
    const input = $('cs-name');
    form.hidden = false;
    input.value = vars.name && vars.name !== 'Timbero' ? vars.name : '';
    setTimeout(() => input.focus(), 50);
    return new Promise((resolve) => {
      const done = () => {
        form.hidden = true;
        vars.name = input.value.trim().slice(0, 16) || 'Timbero';
        form.onsubmit = null;
        resolve();
      };
      form.onsubmit = (e) => { e.preventDefault(); done(); };
      if (skipped) done();
      advance = () => { if (skipped) done(); };
    });
  }

  async function play(scenes, vars = {}) {
    const overlay = $('cutscene');
    const canvas = $('cs-bg');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
    skipped = false;
    overlay.hidden = false;
    $('cs-chars').replaceChildren();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);

    for (const scene of scenes) {
      if (skipped) break;
      if (scene.bg !== bg) {
        overlay.classList.add('fade');
        Sound.sfx('whoosh');
        await wait(350);
        bg = scene.bg;
        bgStart = performance.now();
        $('cs-chars').replaceChildren();
        overlay.classList.remove('fade');
      }
      if (scene.music) Sound.music(scene.music);
      for (const line of scene.lines) {
        if (skipped) break;
        const sp = SPEAKERS[line.who] || SPEAKERS.narrador;
        setChars(scene.chars || [], line.who);
        $('cs-speaker').textContent = fill(sp.name, vars);
        $('cs-speaker').className = `cs-speaker ${sp.cls}`;
        $('cs-speaker').hidden = !sp.name;
        $('cs-box').className = `cs-box ${sp.cls}`;
        $('cs-next').hidden = true;
        await typeText($('cs-text'), fill(line.text, vars));
        if (line.input === 'name') {
          await askName(vars);
          continue;
        }
        $('cs-next').hidden = false;
        await waitAdvance();
        Sound.sfx('click');
      }
    }
    if (skipped && vars.name === undefined) vars.name = 'Timbero';
    overlay.classList.add('fade');
    await wait(300);
    overlay.hidden = true;
    overlay.classList.remove('fade');
    cancelAnimationFrame(raf);
    bg = null;
    return vars;
  }

  function next() {
    if (advance) {
      const a = advance;
      advance = null;
      a();
    }
  }

  // Avanzar con toque o tecla; "Saltar" termina la cutscene.
  $('cutscene').addEventListener('click', (e) => {
    if (e.target.closest('#cs-skip') || e.target.closest('#cs-input')) return;
    next();
  });
  document.addEventListener('keydown', (e) => {
    if ($('cutscene').hidden || e.target.tagName === 'INPUT') return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      next();
    }
  });
  $('cs-skip').addEventListener('click', () => {
    skipped = true;
    next();
  });

  root.Cutscene = { play, BACKGROUNDS };
})(window);
