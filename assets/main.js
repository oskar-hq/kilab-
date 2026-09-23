(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = { paper: '#FFFFFF' };
  // The one and only pixel colour (CSS custom property --px). A pixel is on or off.
  const ON = (getComputedStyle(document.documentElement).getPropertyValue('--px') || '').trim() || '#5aa9e6';

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
    aehre: ['.....#......', '....#.#.....', '...#.#.#....', '....###.....', '...#.#.#....', '....###.....',
      '...#.#.#....', '....###.....', '.....#......', '.....#......', '...#####....', '..#######...'],
    blitz: ['.......####.', '......####..', '.....####...', '....####....', '...########.', '..########..',
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
      if (ch !== '#') return;                      // '+' marks holes: pixel off
      const r = document.createElementNS(SVGNS, 'rect');
      r.setAttribute('x', x + gap / 2); r.setAttribute('y', y + gap / 2);
      r.setAttribute('width', 1 - gap); r.setAttribute('height', 1 - gap);
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
      if (p > 0) { const gap = document.createElement('b'); el.appendChild(gap); } // one empty cell between groups
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
  // Draw one pixel snapped to the device-pixel grid, so edges are never
  // anti-aliased into half-transparent colours (e.g. at 125 % / 150 % zoom).
  const fill = (ctx, color, x, y, s) => {
    const d = ctx.dpr || 1;
    const x0 = Math.round(x * d), y0 = Math.round(y * d);
    if (color) ctx.fillStyle = color;
    ctx.fillRect(x0, y0, Math.round((x + s) * d) - x0, Math.round((y + s) * d) - y0);
  };
  const mouse = { x: -1, y: -1, tx: -1, ty: -1, amp: 0, tamp: 0 };

  const SCENES = {
    // A living pixel organism: a domain-warped noise field grows, splits and
    // re-forms along a diagonal. Scrolling away dissolves it. 1-bit only:
    // each pixel is either on (full colour) or off; depth is shown by density.
    hero: {
      time: true,
      draw(ctx, w, h, t) {
        const S = 7, s = S - 1, cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const scroll = clamp01(scrollY / Math.max(1, h));
        const lift = scroll * rows * 0.6;
        const th = 0.36 + scroll * 0.35;
        // evaluate the noise field on a coarse grid (every G cells), interpolate between
        const G = 2, gc = Math.ceil(cols / G) + 2, gr = Math.ceil(rows / G) + 2;
        const F = new Float32Array(gc * gr);
        for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) {
          const c = i * G, ry = j * G + lift;
          const nx = c / cols, ny = ry / rows;
          const cy = -0.2 + 1.15 * nx + Math.sin(nx * 4 + t * 0.3) * 0.08;
          const d = (ny - cy) / (0.44 - 0.12 * nx);
          const base = (1 - d * d) * (1 - 0.8 * smooth(0.35, 1, nx));
          const q = fbm(c * 0.025, ry * 0.025, t * 0.12);
          const n = fbm(c * 0.042 + q * 2.4, ry * 0.042 - q * 1.8, t * 0.32);
          let f = base * 0.78 + (n - 0.46) * 1.6;
          if (mouse.amp > 0.01) {
            const dx = (c * S - mouse.x) / 150, dy = (j * G * S - mouse.y) / 150;
            f += 0.55 * mouse.amp * Math.exp(-(dx * dx + dy * dy));
          }
          F[j * gc + i] = f;
        }
        const spore = Math.floor(t * 5) * 17;
        ctx.fillStyle = ON;
        for (let r = 0; r < rows; r++) {
          const gy = r / G, j = Math.floor(gy), fy = gy - j;
          for (let c = 0; c < cols; c++) {
            const gx = c / G, i = Math.floor(gx), fx = gx - i;
            const k = j * gc + i;
            const f = (F[k] * (1 - fx) + F[k + 1] * fx) * (1 - fy) + (F[k + gc] * (1 - fx) + F[k + gc + 1] * fx) * fy;
            const level = (f - th) / 0.35;               // <0 outside, >1 solid core
            const on = level > 0
              ? level * 1.4 > bayer(c, r)                // dithered membrane, solid core
              : level > -0.6 && hash(c, r + spore) < 0.012; // spores around the body
            if (on) fill(ctx, null, c * S, r * S, s);
          }
        }
      }
    },

    // Scattered pixels resolve into waves as the section scrolls into view.
    flow: {
      time: true, scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = 5, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const mid = rows / 2, flick = Math.floor(t * 3);
        const a = 0.9 - 0.62 * ease(p);                 // boundary moves right -> left
        const WAVES = [{ f: 2.2, p: 0.0, th: 2 }, { f: 1.6, p: 2.1, th: 1 }, { f: 2.9, p: 4.0, th: 1 }];
        ctx.fillStyle = ON;
        for (let c = 0; c < cols; c++) {
          const x = c / cols;
          const scatter = 1 - smooth(a - 0.12, a + 0.1, x);
          if (scatter > 0) {
            for (let r = 0; r < rows; r++) {
              const n = hash(c * 3 + flick, r);
              const band = Math.exp(-Math.pow((r - mid) / (rows * 0.42), 2));
              if (n < scatter * 0.22 * band) fill(ctx, null, c * S, r * S, s);
            }
          }
          const wv = smooth(a - 0.08, a + 0.22, x);
          if (wv > 0) {
            const amp = rows * 0.4 * smooth(a - 0.1, 1, x);
            WAVES.forEach((W, k) => {
              if (hash(c, k + 40) > wv) return;
              const y = Math.round(mid + amp * Math.sin((x * W.f * 6.283) + t * (0.6 + k * 0.2) + W.p));
              for (let i = 0; i < W.th; i++) fill(ctx, null, c * S, (y + i) * S, s);
            });
          }
        }
      }
    },

    // Noise -> sparse -> dense -> solid: the blocks assemble while scrolling.
    proto: {
      time: true, scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = 5, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const flick = Math.floor(t * 4);
        const DENSITY = [0, 0.3, 0.6, 1];
        const front = ease(p) * 1.15;
        ctx.fillStyle = ON;
        for (let c = 0; c < cols; c++) {
          const x = c / cols;
          const top = Math.round(rows * (0.3 - 0.3 * smooth(0.6, 1, x)));
          const bot = Math.round(rows * (x < 0.25 ? 1 : 0.8));
          const built = smooth(x - 0.08, x + 0.02, front);
          const seg = Math.min(3, Math.floor(x * 4));
          for (let r = 0; r < rows; r++) {
            const px = c * S, py = r * S;
            const n = hash(c + flick * 977, r);
            if (seg === 0) { if (n < 0.34 - x) fill(ctx, null, px, py, s); continue; }
            if (r < top || r >= bot) continue;
            if (hash(c, r) > built) {                    // not built yet: loose pixels at the front
              if (built > 0.02 && n < 0.12) fill(ctx, null, px, py, s);
              continue;
            }
            if (DENSITY[seg] > bayer(c, r)) fill(ctx, null, px, py, s);
          }
        }
      }
    },

    // Card artwork: 1-bit dither backdrop, icon pixels fly into place on scroll.
    art: {
      scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = Math.max(3, Math.floor(w / 60)), s = S - 1;
        const cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const seed = el.dataset.icon.length * 31;
        const dir = el.dataset.dither === 'down' ? -1 : 1;
        const map = BITMAPS[el.dataset.icon] || [];
        const Z = 2;                                     // each icon pixel = Z x Z cells
        const iw = (map[0] || '').length * Z, ih = map.length * Z;
        const ox = Math.round((cols - iw) / 2), oy = Math.round((rows - ih) / 2);
        const bg = ease(p * 1.4);
        ctx.fillStyle = ON;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (c >= ox - 2 && c < ox + iw + 2 && r >= oy - 2 && r < oy + ih + 2) continue; // clear frame round the icon
          if (hash(c + seed, r) > bg) continue;
          const g = dir > 0 ? r / rows : 1 - r / rows;
          if (0.08 + g * 0.5 > bayer(c, r)) fill(ctx, null, c * S, r * S, s);
        }
        map.forEach((row, y) => [...row].forEach((ch, x) => {
          if (ch !== '#') return;
          const k = hash(x + seed, y + 3);
          const q = ease((p - 0.15 - k * 0.35) / 0.5);   // per-pixel staggered arrival
          if (q <= 0) return;
          const sx = (hash(x, y + seed) - 0.5) * cols * 1.4, sy = (hash(y + seed, x) - 0.5) * rows * 1.4 - rows * 0.4;
          const cx = Math.round(ox + x * Z + sx * (1 - q)), cy = Math.round(oy + y * Z + sy * (1 - q));
          for (let a = 0; a < Z; a++) for (let b = 0; b < Z; b++) fill(ctx, null, (cx + a) * S, (cy + b) * S, s);
        }));
      }
    },

    // Footer equaliser bars; they rise as the footer comes into view.
    bars: {
      time: true, scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = 4, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const rise = 0.15 + 0.85 * ease(p);
        ctx.fillStyle = ON;
        for (let c = 0; c < cols; c++) {
          const wave = (Math.sin(c * 0.12 + t * 1.1) + Math.sin(c * 0.031 - t * 0.6) + 2) / 4;
          const height = Math.round(rows * rise * clamp01(0.1 + wave * 0.9 * (0.35 + hash(c, 1) * 0.65)));
          for (let r = 0; r < height; r++) fill(ctx, null, c * S, (rows - 1 - r) * S, s);
        }
      }
    },

    // Paper-coloured cells covering a heading switch off left-to-right; the
    // wipe front is a line of lit pixels.
    mask: {
      scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = 5, cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const q = ease(p) * 1.25;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const v = (c / cols) * 0.7 + hash(c, r) * 0.3;
          if (v > q) fill(ctx, C.paper, c * S, r * S, S);
          else if (v > q - 0.04) fill(ctx, ON, c * S, r * S, S - 1);
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
    sc.ctx.dpr = sc.el.width / Math.max(1, r.width);
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
    sc.ctx.clearRect(0, 0, sc.el.width, sc.el.height);
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
      bar.width = Math.round(barW * dpr); bar.height = Math.round(4 * dpr);
      barCtx = bar.getContext('2d'); barCtx.dpr = dpr;
    }
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? clamp01(scrollY / max) : 0;
    if (!force && Math.abs(p - lastBarP) < 0.0005) return;
    lastBarP = p;
    const S = 4, cols = Math.ceil(barW / S), filled = Math.round(p * cols);
    barCtx.clearRect(0, 0, bar.width, bar.height);
    barCtx.fillStyle = ON;
    for (let c = 0; c < filled; c++) fill(barCtx, null, c * S, 0, S - 1);
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
