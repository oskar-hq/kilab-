(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  const CELL = 14;
  const C = {
    ink: '#0A0A0A', neon: '#d8ff00', gold: '#f6d36d',
    mist: '#b3b9ca', slate: '#6b7385', navy: '#1e2544', line: 'rgba(10,10,10,.10)'
  };

  // 4x4 Bayer matrix for ordered dithering (classic pixel-art shading)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const hash = (x, y) => {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  const setupCanvas = (canvas) => {
    const ctx = canvas.getContext('2d');
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  };

  /* ---------- 5x7 pixel font ---------- */
  const FONT = {
    A:'01110100011000111111100011000110001', B:'11110100011000111110100011000111110',
    C:'01110100011000010000100001000101110', D:'11110100011000110001100011000111110',
    E:'11111100001000011110100001000011111', F:'11111100001000011110100001000010000',
    G:'01110100011000010111100011000101111', H:'10001100011000111111100011000110001',
    I:'01110001000010000100001000010001110', J:'00111000100001000010000101001001100',
    K:'10001100101010011000101001001010001', L:'10000100001000010000100001000011111',
    M:'10001110111010110101100011000110001', N:'10001100011100110101100111000110001',
    O:'01110100011000110001100011000101110', P:'11110100011000111110100001000010000',
    Q:'01110100011000110001101011001001101', R:'11110100011000111110101001001010001',
    S:'01111100001000001110000010000111110', T:'11111001000010000100001000010000100',
    U:'10001100011000110001100011000101110', V:'10001100011000110001100010101000100',
    W:'10001100011000110101101011010101010', X:'10001100010101000100010101000110001',
    Y:'10001100010101000100001000010000100', Z:'11111000010001000100010001000011111',
    0:'01110100011000110001100011000101110', 1:'00100011000010000100001000010001110',
    2:'01110100010000100010001000100011111', 3:'11111000100010000010000011000101110',
    4:'00010001100101010010111110001000010', 5:'11111100001111000001000011000101110',
    6:'00110010001000011110100011000101110', 7:'11111000010001000100010000100001000',
    8:'01110100011000101110100011000101110', 9:'01110100011000101111000010001001100',
    '-':'00000000000000011111000000000000000', '.':'00000000000000000000000000110001100',
    '·':'00000000000000000100000000000000000', ' ':'00000000000000000000000000000000000'
  };
  const SVGNS = 'http://www.w3.org/2000/svg';

  // Render a bitmap (array of strings, '1'/'#' = on, '2'/'+' = accent) to an SVG of rects.
  function bitmapSVG(rows, { gap = 0.12, cls = '' } = {}) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('shape-rendering', 'crispEdges');
    if (cls) svg.setAttribute('class', cls);
    let n = 0;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '0' || ch === '.' || ch === ' ') return;
      const r = document.createElementNS(SVGNS, 'rect');
      r.setAttribute('x', x + gap / 2); r.setAttribute('y', y + gap / 2);
      r.setAttribute('width', 1 - gap); r.setAttribute('height', 1 - gap);
      if (ch === '2' || ch === '+') r.setAttribute('class', 'acc');
      r.style.setProperty('--i', n++);
      svg.appendChild(r);
    }));
    return svg;
  }

  function textRows(text) {
    const chars = [...text.toUpperCase()].map(c => FONT[c] || FONT[' ']);
    const rows = [];
    for (let y = 0; y < 7; y++) rows.push(chars.map(g => g.slice(y * 5, y * 5 + 5)).join('0'));
    return rows;
  }

  document.querySelectorAll('[data-pxtext]').forEach(el => {
    el.appendChild(bitmapSVG(textRows(el.dataset.pxtext), { gap: +(el.dataset.gap || 0.12) }));
  });

  /* ---------- Pixel icons ---------- */
  const ICONS = {
    werkstatt: [
      '.....##.....', '....####....', '...######...', '..########..', '.##########.',
      '############', '.#........#.', '.#.++..##.#.', '.#.++..##.#.', '.#.....##.#.',
      '.#.....##.#.', '############'
    ],
    blitz: [
      '.......####.', '......####..', '.....####...', '....####....', '...########.',
      '..++++####..', '.....####...', '....####....', '...###......', '..##........',
      '.#..........', '............'
    ],
    herz: [
      '............', '.###....###.', '#####..#####', '############', '#####++#####',
      '####++++####', '.##########.', '..########..', '...######...', '....####....',
      '.....##.....', '............'
    ]
  };
  document.querySelectorAll('[data-pxicon]').forEach(el => {
    const map = ICONS[el.dataset.pxicon];
    if (map) el.appendChild(bitmapSVG(map, { gap: 0.1 }));
  });

  /* ---------- Waffle chart (share split) ---------- */
  document.querySelectorAll('[data-waffle]').forEach(el => {
    const parts = el.dataset.waffle.split(',').map(Number); // e.g. 65,25,10
    let k = 0;
    parts.forEach((n, p) => {
      for (let i = 0; i < n; i++, k++) {
        const c = document.createElement('i');
        c.className = 'w' + p;
        c.style.setProperty('--i', k);
        el.appendChild(c);
      }
    });
  });

  /* ---------- Funnel cells ---------- */
  document.querySelectorAll('[data-cells]').forEach(box => {
    const n = +box.dataset.cells, off = +(box.dataset.off || 0), hit = +(box.dataset.hit || 0);
    for (let i = 0; i < n; i++) {
      const cell = document.createElement('i');
      if (i >= n - hit) cell.className = 'hit';
      else if (i >= n - off) cell.className = 'off';
      cell.style.setProperty('--i', i);
      box.appendChild(cell);
    }
  });

  /* ---------- Dithered section edges ---------- */
  const edges = [...document.querySelectorAll('.px-edge')];
  function drawEdges() {
    edges.forEach(el => {
      let cv = el.querySelector('canvas');
      if (!cv) { cv = document.createElement('canvas'); el.appendChild(cv); }
      const { ctx, w, h } = setupCanvas(cv);
      const from = el.dataset.from, to = el.dataset.to;
      const cols = Math.ceil(w / CELL), rows = Math.round(h / CELL);
      ctx.fillStyle = from; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const t = (y + 0.5) / rows;
        const n = bayer(x, y) * 0.6 + hash(x, y) * 0.4;
        if (n < t) { ctx.fillStyle = to; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
        else if (el.dataset.spark && n < t + 0.06 && hash(y, x) > 0.7) {
          ctx.fillStyle = el.dataset.spark; ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        }
      }
    });
  }

  /* ---------- Generative pixel wave (hero) ---------- */
  const canvas = document.getElementById('wave');
  const coord = document.getElementById('coord');
  let wave = null;
  const mouse = { x: -1e4, tx: -1e4, amp: 0, tamp: 0 };
  let waveVisible = true;

  // Colour bands from crest downwards, blended with ordered dithering.
  const BANDS = [C.neon, C.gold, C.mist, C.slate, C.navy];
  const EDGES = [1.4, 3.2, 6.2, 11];

  function heightAt(c, cols, t) {
    const x = c / cols;
    let h = 0.44
      + 0.15 * Math.sin(x * 4.6 + t * 0.5)
      + 0.08 * Math.sin(x * 10.9 - t * 0.8 + 1.3)
      + 0.035 * Math.sin(x * 23.0 + t * 1.5);
    const dx = (c * CELL - mouse.x) / 150;
    return h + 0.24 * mouse.amp * Math.exp(-dx * dx);
  }

  function drawWave(t) {
    if (!wave) return;
    const { ctx, w, h } = wave;
    const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
    const s = CELL - 1;
    ctx.clearRect(0, 0, w, h);
    for (let c = 0; c < cols; c++) {
      const crest = rows - Math.round(heightAt(c, cols, t) * rows);
      for (let r = 0; r < rows; r++) {
        const x = c * CELL, y = r * CELL, d = r - crest;
        if (d < -1) {
          if (d > -6 && hash(c, r + Math.floor(t * 3)) > 0.965) {
            ctx.fillStyle = hash(r, c) > 0.5 ? C.neon : C.gold;
            ctx.fillRect(x, y, s, s);
          } else if (c % 2 === 0 && r % 2 === 0) {
            ctx.fillStyle = C.line; ctx.fillRect(x + 6, y + 6, 2, 2);
          }
          continue;
        }
        if (d < 0) { if (hash(c, r) > 0.55) { ctx.fillStyle = C.neon; ctx.fillRect(x, y, s, s); } continue; }
        // depth from crest, but always sink into navy towards the bottom edge
        const depth = Math.max(d, 13 - (rows - 1 - r) * 2.2);
        const v = depth + (bayer(c, r) - 0.5) * 2.2;
        let i = 0; while (i < EDGES.length && v > EDGES[i]) i++;
        ctx.fillStyle = BANDS[i];
        ctx.fillRect(x, y, s, s);
      }
    }
  }

  function resizeAll() {
    if (canvas) { wave = setupCanvas(canvas); drawWave(0); }
    drawEdges();
    if (trail) trail.resize();
  }

  if (canvas) {
    const host = canvas.parentElement;
    host.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (mouse.x < -1e3) mouse.x = x;
      mouse.tx = x; mouse.tamp = 1;
      if (coord) coord.textContent = `X ${String(Math.floor(x / CELL)).padStart(3, '0')} · Y ${String(Math.floor(y / CELL)).padStart(3, '0')}`;
    });
    host.addEventListener('pointerleave', () => { mouse.tamp = 0; if (coord) coord.textContent = '54°N · 10°E'; });
    new IntersectionObserver(([e]) => { waveVisible = e.isIntersecting; }).observe(canvas);
  }

  /* ---------- Pixel cursor trail ---------- */
  let trail = null;
  if (finePointer && !reduce) {
    const cv = document.createElement('canvas');
    cv.className = 'px-trail';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const cells = new Map();
    let last = null;
    trail = {
      resize() { Object.assign(this, setupCanvas(cv)); },
      add(cx, cy) {
        const gx = Math.floor(cx / CELL), gy = Math.floor(cy / CELL);
        if (last) { // fill the gap between samples so fast moves draw a line
          const steps = Math.max(Math.abs(gx - last[0]), Math.abs(gy - last[1]));
          for (let i = 1; i <= steps; i++) {
            const ix = Math.round(last[0] + (gx - last[0]) * i / steps);
            const iy = Math.round(last[1] + (gy - last[1]) * i / steps);
            cells.set(ix + ',' + iy, performance.now());
          }
        } else cells.set(gx + ',' + gy, performance.now());
        last = [gx, gy];
      },
      draw(now) {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.w, this.h);
        cells.forEach((t0, key) => {
          const age = (now - t0) / 700;
          if (age >= 1) { cells.delete(key); return; }
          const [x, y] = key.split(',').map(Number);
          const inset = Math.floor(age * 6);
          this.ctx.fillStyle = age < 0.35 ? C.neon : C.gold;
          this.ctx.globalAlpha = 1 - age;
          this.ctx.fillRect(x * CELL + inset, y * CELL + inset, CELL - 1 - inset * 2, CELL - 1 - inset * 2);
        });
        this.ctx.globalAlpha = 1;
      }
    };
    addEventListener('pointermove', e => {
      if (e.target.closest && e.target.closest('.wave, input, textarea')) { last = null; return; }
      trail.add(e.clientX, e.clientY);
    }, { passive: true });
    addEventListener('scroll', () => { last = null; }, { passive: true });
  }

  /* ---------- Main loop ---------- */
  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(resizeAll, 120); });
  resizeAll();
  if (document.fonts) document.fonts.ready.then(resizeAll);

  if (!reduce) {
    const t0 = performance.now();
    const loop = now => {
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.amp += (mouse.tamp - mouse.amp) * 0.05;
      if (waveVisible) drawWave((now - t0) / 1000);
      if (trail) trail.draw(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 3) * 70 + 'ms';
    io.observe(el);
  });
})();
