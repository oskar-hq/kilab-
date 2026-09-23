(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = {
    ink: '#1d2126', deep: '#4a525c', grey2: '#8a929c', grey1: '#c9ced4',
    blue: '#5aa9e6', accent: '#8fd0ff', pale: '#d4ecff', tint: '#f1f4f7', paper: '#FFFFFF'
  };

  // 4x4 Bayer matrix for ordered dithering, plus a cheap deterministic hash.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const hash = (x, y) => {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* ---------- Bitmaps (icons, faces, logo) ---------- */
  const BITMAPS = {
    logo: ['##.+', '##++', '.+##', '++##'],
    sad: ['.........', '.#.#.#.#.', '..#...#..', '.#.#.#.#.', '.........', '..#####..', '.#.....#.', '.........'],
    happy: ['.........', '..#...#..', '..#...#..', '.........', '.#.....#.', '..#...#..', '...###...', '.........'],
    werkstatt: ['.....##.....', '....####....', '...######...', '..########..', '.##########.', '############',
      '.#........#.', '.#.++..##.#.', '.#.++..##.#.', '.#.....##.#.', '.#.....##.#.', '############'],
    mikro: ['....####....', '...#++++#...', '...#++++#...', '...#++++#...', '...#++++#...', '...######...',
      '.#.######.#.', '.#..####..#.', '..#......#..', '...######...', '.....##.....', '...######...'],
    aehre: ['.....+......', '....+.+.....', '...+.#.+....', '....+#+.....', '...+.#.+....', '....+#+.....',
      '...+.#.+....', '....+#+.....', '.....#......', '.....#......', '...#####....', '..#######...'],
    blitz: ['.......####.', '......####..', '.....####...', '....####....', '...########.', '..++++####..',
      '.....####...', '....####....', '...###......', '..##........', '.#..........', '............'],
    herz: ['............', '.###....###.', '#####..#####', '############', '#####++#####', '####++++####',
      '.##########.', '..########..', '...######...', '....####....', '.....##.....', '............']
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  function bitmapSVG(rows, gap = 0.1) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('shape-rendering', 'crispEdges');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '#' && ch !== '+') return;
      const r = document.createElementNS(SVGNS, 'rect');
      r.setAttribute('x', x + gap / 2); r.setAttribute('y', y + gap / 2);
      r.setAttribute('width', 1 - gap); r.setAttribute('height', 1 - gap);
      if (ch === '+') r.setAttribute('class', 'acc');
      svg.appendChild(r);
    }));
    return svg;
  }
  document.querySelectorAll('[data-bitmap]').forEach(el => {
    const map = BITMAPS[el.dataset.bitmap];
    if (map) el.appendChild(bitmapSVG(map));
  });

  /* ---------- Share split (each square = 2 %) ---------- */
  document.querySelectorAll('[data-share]').forEach(el => {
    let k = 0;
    el.dataset.share.split(',').map(Number).forEach((n, p) => {
      for (let i = 0; i < n; i++, k++) {
        const c = document.createElement('i');
        c.className = 'k' + p;
        c.style.setProperty('--i', k);
        el.appendChild(c);
      }
    });
  });

  /* ---------- Canvas scenes ---------- */
  const fill = (ctx, color, x, y, s) => { ctx.fillStyle = color; ctx.fillRect(x, y, s, s); };
  const mouse = { x: -1, tx: -1, amp: 0, tamp: 0 };

  const SCENES = {
    // Diagonal ribbon of striped pixels that dissolves into scatter to the right.
    hero: {
      animated: true,
      draw(ctx, w, h, t) {
        const S = 14, s = S - 2, cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const STRIPES = [C.grey1, C.accent, C.blue, C.deep, C.pale, C.accent, C.grey2];
        const flick = Math.floor(t * 2.5);
        for (let c = 0; c < cols; c++) {
          const x = c / cols;
          const mx = mouse.x >= 0 ? (c * S - mouse.x) / 180 : 9;
          const center = rows * (-0.2 + 1.15 * x) + Math.sin(x * 5.5 + t * 0.45) * rows * 0.07
            - mouse.amp * rows * 0.18 * Math.exp(-mx * mx);
          const half = rows * (0.34 - 0.12 * x);
          const fade = smooth(0.42, 1.0, x);           // 0 = dense ribbon, 1 = dissolved
          const drip = x > 0.55 && hash(c, 7) < 0.3 ? rows * (0.15 + hash(c, 9) * 0.45) : 0;
          for (let r = 0; r < rows; r++) {
            const d = (r - center) / half;               // -1..1 inside the ribbon
            const px = c * S, py = r * S;
            const n = hash(c, r + (x > 0.45 ? flick * 131 : 0));
            if (Math.abs(d) <= 1) {
              if (n > 1 - fade * 0.92) continue;
              const v = (d + 1) / 2 * STRIPES.length + (bayer(c, r) - 0.5) * 0.9;
              fill(ctx, STRIPES[Math.max(0, Math.min(STRIPES.length - 1, Math.floor(v)))], px, py, s);
            } else {
              const out = Math.abs(d) - 1;
              let p = 0.45 * Math.exp(-out * 5) * (0.35 + x);
              if (d > 1 && drip && r - (center + half) < drip) p = Math.max(p, 0.55 * (1 - (r - center - half) / drip));
              if (n < p) fill(ctx, n < p * 0.4 ? C.deep : n < p * 0.75 ? C.accent : C.grey2, px, py, s);
            }
          }
        }
      }
    },

    // Scattered pixels on the left resolving into clean waves on the right.
    flow: {
      animated: true,
      draw(ctx, w, h, t) {
        const S = w < 600 ? 7 : 9, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const mid = rows / 2, flick = Math.floor(t * 3);
        const WAVES = [
          { f: 2.2, p: 0.0, c: C.accent }, { f: 1.6, p: 2.1, c: C.blue }, { f: 2.9, p: 4.0, c: C.grey2 }
        ];
        for (let c = 0; c < cols; c++) {
          const x = c / cols;
          const scatter = 1 - smooth(0.28, 0.55, x);
          if (scatter > 0) {
            for (let r = 0; r < rows; r++) {
              const n = hash(c * 3 + flick, r);
              const band = Math.exp(-Math.pow((r - mid) / (rows * 0.42), 2));
              if (n < scatter * 0.32 * band) fill(ctx, n < 0.06 ? C.deep : n < 0.14 ? C.blue : C.grey1, c * S, r * S, s);
            }
          }
          const wv = smooth(0.3, 0.6, x);
          if (wv > 0) {
            const amp = rows * 0.4 * smooth(0.3, 1, x);
            WAVES.forEach((W, k) => {
              if (hash(c, k + 40) > wv) return;
              const y = Math.round(mid + amp * Math.sin((x * W.f * 6.283) + t * (0.6 + k * 0.2) + W.p));
              fill(ctx, W.c, c * S, y * S, s);
              if (k === 0) fill(ctx, C.pale, c * S, (y + 1) * S, s);
            });
          }
        }
      }
    },

    // Noise -> solid blocks -> light blue: the path from idea to company.
    proto: {
      animated: true,
      draw(ctx, w, h, t) {
        const S = w < 600 ? 7 : 9, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const flick = Math.floor(t * 4);
        const SEG = [null, C.deep, C.blue, C.accent];
        for (let c = 0; c < cols; c++) {
          const x = c / cols;
          const top = Math.round(rows * (0.3 - 0.3 * smooth(0.6, 1, x)));
          const bot = Math.round(rows * (x < 0.25 ? 1 : 0.8));
          for (let r = 0; r < rows; r++) {
            const v = x * 4 + (bayer(c, r) - 0.5) * 0.8;
            const seg = Math.max(0, Math.min(3, Math.floor(v)));
            const px = c * S, py = r * S;
            if (seg === 0) {
              const n = hash(c + flick * 977, r);
              if (n < 0.42 - x) fill(ctx, n < 0.18 ? C.ink : C.grey2, px, py, s);
              continue;
            }
            if (r < top || r >= bot) {
              if (r < top && hash(c, r) < 0.08 * seg) fill(ctx, C.pale, px, py, s);
              continue;
            }
            let col = SEG[seg];
            if (seg === 3 && (c + r) % 4 === 0) col = C.pale;
            if (seg === 2 && hash(c, r) < 0.08) col = C.accent;
            fill(ctx, col, px, py, s);
          }
        }
      }
    },

    // Card artwork: dithered gradient backdrop + a big pixel icon.
    art: {
      animated: false,
      draw(ctx, w, h, t, el) {
        const [a, b] = (el.dataset.bg || `${C.tint},${C.accent}`).split(',');
        const S = Math.max(6, Math.floor(w / 26)), s = S - 1;
        const cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const v = r / rows + (bayer(c, r) - 0.5) * 0.5;
          fill(ctx, v < 0.55 ? a : b, c * S, r * S, s);
        }
        const map = BITMAPS[el.dataset.icon];
        if (!map) return;
        const iw = map[0].length, ih = map.length;
        const ox = Math.round((cols - iw) / 2), oy = Math.round((rows - ih) / 2);
        // soft pixel shadow
        map.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch === '#' || ch === '+') fill(ctx, 'rgba(29,33,38,.12)', (ox + x + 1) * S, (oy + y + 1) * S, s);
        }));
        map.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch === '#') fill(ctx, C.ink, (ox + x) * S, (oy + y) * S, s);
          if (ch === '+') fill(ctx, C.paper, (ox + x) * S, (oy + y) * S, s);
        }));
      }
    },

    // Footer equaliser bars rising from the bottom edge.
    bars: {
      animated: true,
      draw(ctx, w, h, t) {
        const S = 7, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const PAL = [C.accent, C.blue, C.grey1, C.deep, C.pale, C.grey2];
        for (let c = 0; c < cols; c++) {
          const wave = (Math.sin(c * 0.21 + t * 1.1) + Math.sin(c * 0.057 - t * 0.6) + 2) / 4;
          const height = Math.round(rows * clamp01(0.1 + wave * 0.9 * (0.35 + hash(c, 1) * 0.65)));
          const col = PAL[Math.floor(hash(c, 2) * PAL.length)];
          for (let r = 0; r < height; r++) fill(ctx, r === height - 1 ? C.accent : col, c * S, (rows - 1 - r) * S, s);
        }
      }
    }
  };

  const scenes = [...document.querySelectorAll('canvas[data-scene]')].map(el => ({
    el, def: SCENES[el.dataset.scene], visible: true, ctx: null, w: 0, h: 0
  })).filter(sc => sc.def);

  function setup(sc) {
    const r = sc.el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    sc.el.width = Math.max(1, Math.round(r.width * dpr));
    sc.el.height = Math.max(1, Math.round(r.height * dpr));
    sc.ctx = sc.el.getContext('2d');
    sc.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc.w = r.width; sc.h = r.height;
  }
  function render(sc, t) {
    sc.ctx.clearRect(0, 0, sc.w, sc.h);
    sc.def.draw(sc.ctx, sc.w, sc.h, t, sc.el);
  }
  function resizeAll() { scenes.forEach(sc => { setup(sc); render(sc, now()); }); }
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;

  const vis = new IntersectionObserver(entries => entries.forEach(e => {
    const sc = scenes.find(s => s.el === e.target);
    if (sc) sc.visible = e.isIntersecting;
  }));
  scenes.forEach(sc => vis.observe(sc.el));

  const hero = document.querySelector('.band-hero');
  if (hero) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      if (mouse.x < 0) mouse.x = e.clientX - r.left;
      mouse.tx = e.clientX - r.left; mouse.tamp = 1;
    });
    hero.addEventListener('pointerleave', () => { mouse.tamp = 0; });
  }

  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(resizeAll, 120); });
  resizeAll();

  if (!reduce) {
    let last = 0;
    const loop = ts => {
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.amp += (mouse.tamp - mouse.amp) * 0.05;
      if (ts - last > 33) { // ~30 fps is plenty for pixel art
        last = ts;
        const t = now();
        scenes.forEach(sc => { if (sc.def.animated && sc.visible) render(sc, t); });
      }
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
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 3) * 70 + 'ms';
    io.observe(el);
  });
})();
