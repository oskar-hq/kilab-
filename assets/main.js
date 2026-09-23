(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = {
    ink: '#1d2126', deep: '#4a525c', grey2: '#8a929c', grey1: '#c9ced4',
    blue: '#5aa9e6', accent: '#8fd0ff', pale: '#d4ecff', tint: '#f1f4f7', paper: '#FFFFFF'
  };

  /* ---------- Math helpers ---------- */
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
  const ease = t => 1 - Math.pow(1 - clamp01(t), 3);

  // 3D value noise (x, y, time) and a 3-octave fBm on top of it.
  const h3 = (i, j, k) => hash(i + k * 7919, j - k * 104729);
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const lerp = (a, b, t) => a + (b - a) * t;
    const plane = k => lerp(
      lerp(h3(xi, yi, k), h3(xi + 1, yi, k), u),
      lerp(h3(xi, yi + 1, k), h3(xi + 1, yi + 1, k), u), v);
    return lerp(plane(zi), plane(zi + 1), w);
  }
  const fbm = (x, y, z) => (vnoise(x, y, z) * 0.57 + vnoise(x * 2.03, y * 2.03, z * 1.3) * 0.29 + vnoise(x * 4.1, y * 4.1, z * 1.7) * 0.14);

  // How far an element has travelled into the viewport: 0 = just below, 1 = settled.
  const progressOf = (el, start = 1, span = 0.6) => {
    const r = el.getBoundingClientRect(), vh = innerHeight;
    return clamp01((vh * start - r.top) / (vh * span));
  };

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

  /* ---------- Pixel masks over headings (scroll-linked wipe) ---------- */
  document.querySelectorAll('.px-mask').forEach(el => {
    const cv = document.createElement('canvas');
    cv.className = 'mask';
    cv.dataset.scene = 'mask';
    cv.setAttribute('aria-hidden', 'true');
    el.appendChild(cv);
  });

  /* ---------- Canvas scenes ---------- */
  const fill = (ctx, color, x, y, s) => { ctx.fillStyle = color; ctx.fillRect(x, y, s, s); };
  const mouse = { x: -1, y: -1, tx: -1, ty: -1, amp: 0, tamp: 0 };

  const SCENES = {
    // A living pixel organism: a domain-warped noise field grows, splits and
    // re-forms along a diagonal. Scrolling away dissolves it.
    hero: {
      time: true,
      draw(ctx, w, h, t, el) {
        const S = 14, cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const scroll = clamp01(scrollY / Math.max(1, h));
        const lift = scroll * rows * 0.6;
        const BLUE = [C.pale, C.accent, C.blue, C.deep];
        const GREY = [C.grey1, C.grey2, C.deep, C.ink];
        const th = 0.36 + scroll * 0.35;
        for (let c = 0; c < cols; c++) {
          const nx = c / cols;
          const cy = -0.2 + 1.15 * nx + Math.sin(nx * 4 + t * 0.3) * 0.08;
          const width = 0.44 - 0.12 * nx;
          const rightFade = 1 - 0.8 * smooth(0.35, 1, nx);
          for (let r = 0; r < rows; r++) {
            const ry = r + lift;
            const ny = ry / rows;
            const d = (ny - cy) / width;
            const base = (1 - d * d) * rightFade;
            const q = fbm(c * 0.05, ry * 0.05, t * 0.12);
            const n = fbm(c * 0.085 + q * 2.4, ry * 0.085 - q * 1.8, t * 0.32);
            let F = base * 0.78 + (n - 0.46) * 1.6;
            if (mouse.amp > 0.01) {
              const dx = (c * S - mouse.x) / 150, dy = (r * S - mouse.y) / 150;
              F += 0.55 * mouse.amp * Math.exp(-(dx * dx + dy * dy));
            }
            const px = c * S, py = r * S;
            if (F < th) {
              // spores drifting around the body
              if (F > th - 0.22 && hash(c, r + Math.floor(t * 5) * 17) < 0.018 + nx * 0.02) {
                fill(ctx, hash(r, c) > 0.5 ? C.accent : C.grey1, px + 4, py + 4, S - 8);
              }
              continue;
            }
            const level = (F - th) / 0.55;
            const pal = vnoise(c * 0.045, ry * 0.045, t * 0.08 + 9) > 0.68 ? GREY : BLUE;
            const idx = Math.min(3, Math.max(0, Math.floor(level * 4 + (bayer(c, r) - 0.5) * 0.9)));
            // cells near the membrane are smaller, the core is solid
            const size = Math.max(3, Math.round((S - 2) * Math.min(1, 0.35 + level * 2.2)));
            const off = Math.floor((S - 2 - size) / 2);
            fill(ctx, pal[idx], px + off, py + off, size);
          }
        }
      }
    },

    // Scattered pixels resolve into waves as the section scrolls into view.
    flow: {
      time: true, scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = w < 600 ? 7 : 9, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const mid = rows / 2, flick = Math.floor(t * 3);
        const a = 0.9 - 0.62 * ease(p);                 // boundary moves right -> left
        const WAVES = [
          { f: 2.2, p: 0.0, c: C.accent }, { f: 1.6, p: 2.1, c: C.blue }, { f: 2.9, p: 4.0, c: C.grey2 }
        ];
        for (let c = 0; c < cols; c++) {
          const x = c / cols;
          const scatter = 1 - smooth(a - 0.12, a + 0.1, x);
          if (scatter > 0) {
            for (let r = 0; r < rows; r++) {
              const jitter = Math.round((hash(c, r + flick) - 0.5) * 2);
              const n = hash(c * 3 + flick, r);
              const band = Math.exp(-Math.pow((r - mid) / (rows * 0.42), 2));
              if (n < scatter * 0.3 * band) fill(ctx, n < 0.06 ? C.deep : n < 0.14 ? C.blue : C.grey1, c * S, (r + jitter) * S, s);
            }
          }
          const wv = smooth(a - 0.08, a + 0.22, x);
          if (wv > 0) {
            const amp = rows * 0.4 * smooth(a - 0.1, 1, x);
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

    // Noise -> solid blocks -> light blue; the blocks assemble while scrolling.
    proto: {
      time: true, scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = w < 600 ? 7 : 9, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const flick = Math.floor(t * 4);
        const SEG = [null, C.deep, C.blue, C.accent];
        const front = ease(p) * 1.15;
        for (let c = 0; c < cols; c++) {
          const x = c / cols;
          const top = Math.round(rows * (0.3 - 0.3 * smooth(0.6, 1, x)));
          const bot = Math.round(rows * (x < 0.25 ? 1 : 0.8));
          const built = smooth(x - 0.08, x + 0.02, front);
          for (let r = 0; r < rows; r++) {
            const v = x * 4 + (bayer(c, r) - 0.5) * 0.8;
            const seg = Math.max(0, Math.min(3, Math.floor(v)));
            const px = c * S, py = r * S;
            const n = hash(c + flick * 977, r);
            if (seg === 0) {
              if (n < 0.42 - x) fill(ctx, n < 0.18 ? C.ink : C.grey2, px, py, s);
              continue;
            }
            if (r < top || r >= bot) {
              if (r < top && hash(c, r) < 0.08 * seg * built) fill(ctx, C.pale, px, py, s);
              continue;
            }
            if (hash(c, r) > built) {
              // not built yet: a few loose pixels hovering at the building front
              if (built > 0.02 && n < 0.25) fill(ctx, C.grey1, px, py, s);
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

    // Card artwork: backdrop dithers in, icon pixels fly into place on scroll.
    art: {
      scroll: true,
      draw(ctx, w, h, t, el, p) {
        const [a, b] = (el.dataset.bg || `${C.tint},${C.accent}`).split(',');
        const S = Math.max(6, Math.floor(w / 26)), s = S - 1;
        const cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const seed = el.dataset.icon.length * 31;
        const bg = ease(p * 1.4);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (hash(c + seed, r) > bg) continue;
          const v = r / rows + (bayer(c, r) - 0.5) * 0.5;
          fill(ctx, v < 0.55 ? a : b, c * S, r * S, s);
        }
        const map = BITMAPS[el.dataset.icon];
        if (!map) return;
        const iw = map[0].length, ih = map.length;
        const ox = (cols - iw) / 2, oy = (rows - ih) / 2;
        map.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch !== '#' && ch !== '+') return;
          const k = hash(x + seed, y + 3);
          const q = ease((p - 0.15 - k * 0.35) / 0.5);  // per-pixel staggered arrival
          if (q <= 0) return;
          const sx = (hash(x, y + seed) - 0.5) * cols * 1.4, sy = (hash(y + seed, x) - 0.5) * rows * 1.4 - rows * 0.4;
          const cx = Math.round(ox + x + sx * (1 - q)), cy = Math.round(oy + y + sy * (1 - q));
          if (q > 0.98) fill(ctx, 'rgba(29,33,38,.12)', (cx + 1) * S, (cy + 1) * S, s);
          fill(ctx, ch === '#' ? C.ink : (q > 0.98 ? C.paper : C.accent), cx * S, cy * S, s);
        }));
      }
    },

    // Footer equaliser bars; they rise as the footer comes into view.
    bars: {
      time: true, scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = 7, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const PAL = [C.accent, C.blue, C.grey1, C.deep, C.pale, C.grey2];
        const rise = 0.15 + 0.85 * ease(p);
        for (let c = 0; c < cols; c++) {
          const wave = (Math.sin(c * 0.21 + t * 1.1) + Math.sin(c * 0.057 - t * 0.6) + 2) / 4;
          const height = Math.round(rows * rise * clamp01(0.1 + wave * 0.9 * (0.35 + hash(c, 1) * 0.65)));
          const col = PAL[Math.floor(hash(c, 2) * PAL.length)];
          for (let r = 0; r < height; r++) fill(ctx, r === height - 1 ? C.accent : col, c * S, (rows - 1 - r) * S, s);
        }
      }
    },

    // White pixels covering a heading dissolve left-to-right, with a blue front.
    mask: {
      scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = 8, cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const q = ease(p) * 1.25;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const v = (c / cols) * 0.7 + hash(c, r) * 0.3;
          if (v > q) fill(ctx, C.paper, c * S, r * S, S);
          else if (v > q - 0.05) fill(ctx, C.accent, c * S + 1, r * S + 1, S - 2);
        }
      },
      progress: el => progressOf(el.parentElement, 1.05, 0.3)
    }
  };

  const scenes = [...document.querySelectorAll('canvas[data-scene]')].map(el => ({
    el, def: SCENES[el.dataset.scene], visible: true, ctx: null, w: 0, h: 0, lastP: -1
  })).filter(sc => sc.def);

  function setup(sc) {
    const r = sc.el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    sc.el.width = Math.max(1, Math.round(r.width * dpr));
    sc.el.height = Math.max(1, Math.round(r.height * dpr));
    sc.ctx = sc.el.getContext('2d');
    sc.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc.w = r.width; sc.h = r.height;
    sc.lastP = -1;
  }
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  const sceneProgress = sc => reduce ? 1 : (sc.def.progress ? sc.def.progress(sc.el) : progressOf(sc.el, 1, 0.7));

  function render(sc, t, force) {
    const p = sc.def.scroll ? sceneProgress(sc) : 1;
    if (!force && !sc.def.time && Math.abs(p - sc.lastP) < 0.002) return;
    sc.lastP = p;
    sc.ctx.clearRect(0, 0, sc.w, sc.h);
    sc.def.draw(sc.ctx, sc.w, sc.h, t, sc.el, p);
  }
  function resizeAll() { scenes.forEach(sc => { setup(sc); render(sc, now(), true); }); drawProgress(true); }

  const vis = new IntersectionObserver(entries => entries.forEach(e => {
    const sc = scenes.find(s => s.el === e.target);
    if (sc) sc.visible = e.isIntersecting;
  }), { rootMargin: '100px 0px' });
  scenes.forEach(sc => vis.observe(sc.el));

  /* ---------- Pixel scroll progress bar ---------- */
  const bar = document.querySelector('.px-progress');
  let barCtx = null, barW = 0, lastBarP = -1;
  function drawProgress(force) {
    if (!bar) return;
    if (force || !barCtx) {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      barW = innerWidth;
      bar.width = Math.round(barW * dpr); bar.height = Math.round(6 * dpr);
      barCtx = bar.getContext('2d'); barCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? clamp01(scrollY / max) : 0;
    if (!force && Math.abs(p - lastBarP) < 0.0005) return;
    lastBarP = p;
    const S = 6, cols = Math.ceil(barW / S), filled = Math.round(p * cols);
    barCtx.clearRect(0, 0, barW, 6);
    for (let c = 0; c < filled; c++) {
      const tail = filled - c;
      if (tail > 24 && hash(c, 5) < 0.5) fill(barCtx, C.pale, c * S, 0, S - 1);
      else fill(barCtx, tail <= 2 ? C.deep : tail <= 10 ? C.blue : C.accent, c * S, 0, S - 1);
    }
  }

  /* ---------- Input ---------- */
  const hero = document.querySelector('.band-hero');
  if (hero) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (mouse.x < 0) { mouse.x = x; mouse.y = y; }
      mouse.tx = x; mouse.ty = y; mouse.tamp = 1;
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
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      mouse.amp += (mouse.tamp - mouse.amp) * 0.05;
      if (ts - last > 33) { // ~30 fps is plenty for pixel art
        last = ts;
        const t = now();
        scenes.forEach(sc => { if (sc.visible) render(sc, t, false); });
        drawProgress(false);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else {
    addEventListener('scroll', () => drawProgress(false), { passive: true });
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
