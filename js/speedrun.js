// Modo speedrun: sin animaciones, sin esperas y sin cutscenes de la historia.
// Los tiempos de la historia jugada así van a rankings aparte (⚡ Speedrun).
(function (root) {
  const KEY = 'luckjack.speedrun';
  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch { /* sin storage */ }

  function apply() {
    if (typeof document !== 'undefined' && document.body) document.body.classList.toggle('speedrun', on);
  }

  function set(value) {
    on = !!value;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* sin storage */ }
    apply();
  }

  if (typeof document !== 'undefined') {
    if (document.body) apply();
    else document.addEventListener('DOMContentLoaded', apply);
  }

  root.Speedrun = {
    get on() { return on; },
    set,
    toggle() { set(!on); return on; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
