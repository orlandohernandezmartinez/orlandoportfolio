/**
 * preloader.js — shared across all pages
 *
 * Each page must set these data attributes on <html> before this script runs:
 *   data-preloader-word   e.g. "ABOUT", "PROJECTS", "CONTACT", "HOME"
 *
 * sessionStorage key "showPreloader" controls whether the matrix runs on arrival.
 * Language redirects do NOT set this key → no preloader shown.
 * data-preload links DO set it → matrix runs on the destination page.
 */

(function () {
  /* ── Config ─────────────────────────────────────────────────── */
  const RUN_MS    = 700;   // how long matrix plays on arrival
  const FREEZE_MS = 30;     // brief freeze before fade
  const FADE_MS   = 350;    // opacity fade duration (match CSS)

  /* ── Elements ───────────────────────────────────────────────── */
  const preloader = document.getElementById('preloader');
  const matrix    = document.getElementById('matrix');
  if (!preloader || !matrix) return;

  /* ── Word to display ────────────────────────────────────────── */
  let word = (document.documentElement.dataset.preloaderWord || 'OHM').toUpperCase();
  let cols = word.length;

  /* ── State ──────────────────────────────────────────────────── */
  let rows = 0, cellsByCol = [], activeRowByCol = [];
  let tickTimer = null, running = false;
  const rand = n => Math.floor(Math.random() * n);

  /* ── Layout ─────────────────────────────────────────────────── */
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    rows = Math.max(6, Math.floor(vh / (vw < 480 ? 70 : 90)));
    const gap  = Math.max(8, Math.floor(Math.min(vw, vh) * 0.02));
    const cell = Math.max(18, Math.min(
      Math.floor((vw - gap * (cols - 1)) / cols),
      Math.floor((vh - gap * (rows - 1)) / rows)
    ));
    const gapX = cols > 1 ? Math.floor((vw - cell * cols) / (cols - 1)) : 0;
    const gapY = rows > 1 ? Math.floor((vh - cell * rows) / (rows - 1)) : 0;
    matrix.style.gridTemplateColumns = `repeat(${cols}, ${cell}px)`;
    matrix.style.gridTemplateRows    = `repeat(${rows}, ${cell}px)`;
    matrix.style.columnGap = `${gapX}px`;
    matrix.style.rowGap    = `${gapY}px`;
    matrix.style.fontSize  = `${Math.floor(cell * 0.82)}px`;
  }

  function buildGrid() {
    matrix.innerHTML = '';
    cellsByCol     = Array.from({ length: cols }, () => []);
    activeRowByCol = Array(cols).fill(0);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = document.createElement('div');
        el.className   = 'cell';
        el.textContent = word[c];
        matrix.appendChild(el);
        cellsByCol[c].push(el);
      }
    }
    for (let c = 0; c < cols; c++) {
      const s = rand(rows);
      activeRowByCol[c] = s;
      cellsByCol[c][s].classList.add('on');
    }
  }

  function rebuild() { layout(); buildGrid(); }

  /* ── Tick ───────────────────────────────────────────────────── */
  function tick() {
    if (!running) return;
    const k = window.innerWidth < 480 ? 2 : 1;
    for (let i = 0; i < k; i++) {
      const col  = rand(cols);
      const prev = activeRowByCol[col];
      let   next = rand(rows);
      if (rows > 1) while (next === prev) next = rand(rows);
      cellsByCol[col][prev].classList.remove('on');
      cellsByCol[col][next].classList.add('on');
      activeRowByCol[col] = next;
    }
    tickTimer = setTimeout(tick, 55 + Math.random() * 85);
  }

  function stop() {
    running = false;
    if (tickTimer) clearTimeout(tickTimer);
  }

  function start() {
    running = true;
    rebuild();
    tick();
  }

  /* ── Dismiss ────────────────────────────────────────────────── */
  function dismiss() {
    stop();
    setTimeout(() => {
      preloader.classList.add('fade-out');
      setTimeout(() => { preloader.style.display = 'none'; }, FADE_MS);
    }, FREEZE_MS);
  }

  /* ── On page load ───────────────────────────────────────────── */
  // The preloader <div> starts with display:none in CSS.
  // We only show it if the sessionStorage flag is present.
  window.addEventListener('load', () => {
    const flag = sessionStorage.getItem('showPreloader');
    sessionStorage.removeItem('showPreloader');

    if (flag) {
      preloader.style.display = 'flex';
      start();
      setTimeout(dismiss, RUN_MS);
    }
    // else: preloader stays hidden, page content fades in via CSS animation
  }, { once: true });

  window.addEventListener('resize', () => {
    if (!running) return;
    clearTimeout(tickTimer);
    setTimeout(rebuild, 120);
  });

  /* ── Nav click handler ──────────────────────────────────────── */
  // Links with data-preload trigger the matrix on the current page
  // and set the flag so the destination page also shows its matrix.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-preload]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    e.preventDefault();

    // Optionally swap the displayed word (data-word attribute)
    const label = a.getAttribute('data-word');
    if (label) { word = label.toUpperCase(); cols = word.length; }

    // Signal destination to show preloader
    sessionStorage.setItem('showPreloader', '1');

    // Show matrix on current page while navigating
    preloader.style.display = 'flex';
    preloader.classList.remove('fade-out');
    start();

    setTimeout(() => {
      stop();
      setTimeout(() => { window.location.href = href; }, FREEZE_MS);
    }, RUN_MS);
  });
})();


/* ── Noise transition (dark / light mode) ───────────────────── */
// Uses dynamic import so canvas-sketch-util is loaded once and cached.
let _noiseReady = false;

(async function initNoise() {
  try {
    const [{ default: random }, { default: math }] = await Promise.all([
      import('https://cdn.skypack.dev/canvas-sketch-util/random'),
      import('https://cdn.skypack.dev/canvas-sketch-util/math'),
    ]);

    const canvas = document.getElementById('transition-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const COLS = 50, ROWS = 50, FREQ = 0.001, AMP = 0.005, SPEED = 5, FRAMES = 90;
    let busy = false;

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', () => { if (!busy) resize(); });
    resize();

    function maxLW() { return (canvas.height / ROWS) * 2.4; }
    function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2; }

    window._noiseTransition = function (dir, onComplete) {
      if (busy) return;
      busy = true; resize(); canvas.style.display = 'block';
      const bg = dir === 'to-dark' ? '#ffffff' : '#0d0d0d';
      const ln = dir === 'to-dark' ? '#0d0d0d' : '#ffffff';
      const cW = canvas.width / COLS, cH = canvas.height / ROWS;
      let f = 0;

      function draw() {
        const lw = ease(f / FRAMES) * maxLW();
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = ln;
        for (let i = 0; i < COLS * ROWS; i++) {
          const col = i % COLS, row = Math.floor(i / COLS);
          const x = col * cW, y = row * cH;
          const len = Math.sqrt(cW*cW + cH*cH);
          const n   = random.noise3D(x, y, f * SPEED, FREQ);
          const ns  = math.mapRange(n, -1, 1, 0.7, 1.3);
          ctx.save();
          ctx.translate(x + cW/2, y + cH/2);
          ctx.rotate(n * Math.PI * AMP);
          ctx.lineWidth = lw * ns;
          ctx.beginPath(); ctx.moveTo(-len/2, 0); ctx.lineTo(len/2, 0); ctx.stroke();
          ctx.restore();
        }
        f++;
        if (f <= FRAMES) { requestAnimationFrame(draw); }
        else { onComplete(); canvas.style.display = 'none'; busy = false; }
      }
      draw();
    };

    _noiseReady = true;
  } catch (err) {
    console.warn('canvas-sketch-util failed to load:', err);
  }
})();


/* ── Theme toggle ───────────────────────────────────────────── */
window.toggleTheme = function () {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

  function doSwap() {
    if (typeof window._noiseTransition !== 'function') {
      // Fallback if noise module not yet loaded: instant swap
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      window._refadeContent && window._refadeContent();
      return;
    }
    window._noiseTransition(next === 'dark' ? 'to-dark' : 'to-light', () => {
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      window._refadeContent && window._refadeContent();
    });
  }

  // Small debounce in case noise module is still loading
  if (!_noiseReady) { setTimeout(doSwap, 100); } else { doSwap(); }
};

// Apply saved theme immediately (before paint)
(function () {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();
