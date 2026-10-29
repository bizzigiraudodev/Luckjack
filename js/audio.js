// Música chiptune y efectos de sonido generados con Web Audio (sin archivos de audio).
(function (root) {
  const MUTE_KEY = 'luckjack.muted';
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* sin storage */ }

  let wanted = null; // tema que debería sonar
  let playing = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;

  // --- Notas ---
  const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(name) {
    const m = /^([A-G][#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    const midi = NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  // "E4 . G4 B4" → ['E4', null, 'G4', 'B4']
  const seq = (str) => str.trim().split(/\s+/).map((t) => (t === '.' ? null : t));

  // --- Temas: 32 pasos (4 compases de corcheas) que se repiten ---
  const TRACKS = {
    // Folclore tranquilo para la pampa y el menú.
    pampa: {
      bpm: 84, leadType: 'triangle', bassType: 'triangle', leadVol: 0.16,
      lead: seq('G4 . B4 . D5 . B4 . A4 . C5 . E5 . D5 . G4 . B4 . D5 . E5 D5 C5 . B4 . A4 . G4 . . .'),
      bass: seq('G2 . . D3 . . G2 . C3 . . G3 . . C3 . G2 . . D3 . . G2 . D3 . . A2 . . D3 .'),
      drums: '',
    },
    // Milonga para el gaucho: bajo en 3-3-2.
    gaucho: {
      bpm: 104, leadType: 'square', bassType: 'triangle', leadVol: 0.09,
      lead: seq('E5 . D5 E5 . B4 . . G4 . A4 B4 . E4 . . F#4 . A4 C5 . B4 A4 . G4 . F#4 E4 . . . .'),
      bass: seq('E2 . . B2 . . E3 . E2 . . B2 . . E3 . B1 . . F#2 . . B2 . E2 . . B2 . . E3 .'),
      drums: 'k..h..s.k..h..s.k..h..s.k..h..s.',
    },
    // Tango oscuro para el Diablo.
    diablo: {
      bpm: 112, leadType: 'sawtooth', bassType: 'square', leadVol: 0.06,
      lead: seq('D5 . . C#5 D5 . F5 . E5 . . D5 C#5 . A4 . Bb4 . . A4 Bb4 . D5 . C#5 . E5 . A4 . . .'),
      bass: seq('D2 . D2 . D2 . D2 . A1 . A1 . A1 . A1 . Bb1 . Bb1 . Bb1 . Bb1 . A1 . A1 . C#2 . A1 .'),
      drums: 'k.s.k.s.k.s.k.sskks.k.s.k.s.k.ss',
    },
    // Celestial para San Pedro.
    santo: {
      bpm: 76, leadType: 'sine', bassType: 'triangle', leadVol: 0.16,
      lead: seq('C5 E5 G5 C6 . G5 E5 . A4 C5 E5 A5 . E5 C5 . F4 A4 C5 F5 . C5 A4 . G4 B4 D5 G5 . D5 B4 .'),
      bass: seq('C3 . . . G2 . . . A2 . . . E2 . . . F2 . . . C3 . . . G2 . . . G2 . . .'),
      drums: '',
    },
    // Lounge con bajo caminando para el blackjack clásico.
    classic: {
      bpm: 120, leadType: 'triangle', bassType: 'triangle', leadVol: 0.12,
      lead: seq('A4 . C5 . E5 . D5 C5 . . A4 . G4 . . . F4 . A4 . C5 . Bb4 A4 . . G4 . F4 . . .'),
      bass: seq('F2 . A2 . C3 . A2 . D2 . F2 . A2 . F2 . Bb1 . D2 . F2 . D2 . C2 . E2 . G2 . E2 .'),
      drums: '..h...h...h...h...h...h...h...h.',
    },
    // Final feliz en el Edén.
    eden: {
      bpm: 120, leadType: 'square', bassType: 'triangle', leadVol: 0.09,
      lead: seq('C5 . C5 E5 G5 . E5 G5 C6 . . . G5 . . . A5 . G5 . F5 . E5 . D5 . E5 . C5 . . .'),
      bass: seq('C3 . G2 . C3 . G2 . C3 . G2 . E2 . G2 . F2 . C3 . F2 . C3 . G2 . D3 . C3 . G2 .'),
      drums: 'k...s...k...s...k...s...k.k.s.s.',
    },
    // Triste para los finales malos.
    triste: {
      bpm: 66, leadType: 'triangle', bassType: 'triangle', leadVol: 0.14,
      lead: seq('A4 . . C5 B4 . . . G4 . . A4 E4 . . . F4 . . E4 D4 . . . E4 . . . . . . .'),
      bass: seq('A2 . . . . . . . E2 . . . . . . . D2 . . . . . . . E2 . . . . . . .'),
      drums: '',
    },
  };

  // --- Motor ---
  function init() {
    if (ctx) return;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(master);
  }

  // Los navegadores solo dejan sonar audio después de un toque o una tecla.
  function unlock() {
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (wanted && playing !== wanted) startTrack(wanted);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => root.addEventListener(ev, unlock, { passive: true }));

  function tone(f, start, dur, type, vol, bus) {
    if (!f) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    osc.connect(g).connect(bus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  let noiseBuffer = null;
  function noise(start, dur, vol, bus, highpass = 1000) {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    src.connect(filter).connect(g).connect(bus);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  function kick(t) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g).connect(musicBus);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  function scheduleStep(track, t) {
    const i = step % 32;
    const eighth = 60 / track.bpm / 2;
    tone(freq(track.lead[i] || ''), t, eighth * 1.8, track.leadType, track.leadVol, musicBus);
    tone(freq(track.bass[i] || ''), t, eighth * 2.5, track.bassType, 0.2, musicBus);
    const d = track.drums[i];
    if (d === 'k') kick(t);
    else if (d === 's') noise(t, 0.12, 0.12, musicBus, 1500);
    else if (d === 'h') noise(t, 0.04, 0.05, musicBus, 6000);
  }

  function startTrack(name) {
    stopTrack();
    const track = TRACKS[name];
    if (!track || !ctx) return;
    playing = name;
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    timer = setInterval(() => {
      const eighth = 60 / track.bpm / 2;
      while (nextTime < ctx.currentTime + 0.25) {
        scheduleStep(track, nextTime);
        nextTime += eighth;
        step++;
      }
    }, 40);
  }

  function stopTrack() {
    clearInterval(timer);
    timer = null;
    playing = null;
  }

  // Cambia de tema (no hace nada si ya está sonando ese).
  function music(name) {
    wanted = name;
    if (!ctx || ctx.state !== 'running') return;
    if (playing !== name) startTrack(name);
  }

  // --- Efectos ---
  const SFX = {
    card: (t) => noise(t, 0.05, 0.25, sfxBus, 2500),
    flip: (t) => { noise(t, 0.04, 0.2, sfxBus, 3000); tone(freq('E6'), t + 0.03, 0.05, 'square', 0.04, sfxBus); },
    chip: (t) => { tone(freq('E6'), t, 0.04, 'square', 0.06, sfxBus); tone(freq('B6'), t + 0.035, 0.05, 'square', 0.05, sfxBus); },
    click: (t) => tone(freq('A5'), t, 0.03, 'square', 0.05, sfxBus),
    type: (t) => tone(freq('C6') * (0.97 + Math.random() * 0.06), t, 0.02, 'square', 0.025, sfxBus),
    coin: (t) => { tone(freq('B5'), t, 0.06, 'square', 0.07, sfxBus); tone(freq('E6'), t + 0.06, 0.18, 'square', 0.07, sfxBus); },
    win: (t) => ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(freq(n), t + i * 0.07, 0.15, 'square', 0.07, sfxBus)),
    blackjack: (t) => ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(freq(n), t + i * 0.06, 0.2, 'square', 0.07, sfxBus)),
    lose: (t) => ['G4', 'Eb4', 'C4'].forEach((n, i) => tone(freq(n), t + i * 0.11, 0.2, 'sawtooth', 0.05, sfxBus)),
    push: (t) => { tone(freq('G4'), t, 0.12, 'triangle', 0.1, sfxBus); tone(freq('G4'), t + 0.14, 0.12, 'triangle', 0.1, sfxBus); },
    shop: (t) => ['G5', 'C6', 'E6'].forEach((n, i) => tone(freq(n), t + i * 0.05, 0.12, 'triangle', 0.1, sfxBus)),
    deckLost: (t) => ['C4', 'B3', 'Bb3', 'A3'].forEach((n, i) => tone(freq(n), t + i * 0.18, 0.3, 'sawtooth', 0.05, sfxBus)),
    victory: (t) => ['C5', 'C5', 'C5', 'G5', 'E5', 'C6'].forEach((n, i) => tone(freq(n), t + i * 0.12, 0.25, 'square', 0.08, sfxBus)),
    whoosh: (t) => noise(t, 0.35, 0.12, sfxBus, 400),
  };

  function sfx(name) {
    if (!ctx || ctx.state !== 'running' || muted || !SFX[name]) return;
    SFX[name](ctx.currentTime + 0.005);
  }

  function setMuted(value) {
    muted = value;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* sin storage */ }
    if (master) master.gain.value = muted ? 0 : 0.6;
  }

  root.Sound = {
    music,
    sfx,
    get muted() { return muted; },
    toggleMute() { setMuted(!muted); return muted; },
    TRACKS,
  };
})(window);
