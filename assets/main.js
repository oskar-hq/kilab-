(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = { paper: '#FFFFFF' };
  // One grid for the whole page (CSS --g): the background lines and every pixel sit on it.
  const G = 5;
  const snap = v => Math.round(v / G) * G;
  // The one and only pixel colour (CSS custom property --px). A pixel is on or off.
  const css = name => (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim();
  const ON = css('--px') || '#5aa9e6';
  // Hero only: a few flat colour zones (each pixel still one solid colour, never blended).
  const HERO = (css('--hero-colors') || '#9fd4ff,#5aa9e6,#2f5bd3,#1d2126,#8a929c').split(',').map(v => v.trim());
  const SPORE = css('--hero-spore') || '#f6d36d';

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
    pin: ['....####....', '..########..', '.####++####.', '.###++++###.', '.###++++###.', '.####++####.',
      '..########..', '...######...', '....####....', '.....##.....', '............', '.##########.'],
    fenster: ['############', '#.#.#......#', '############', '#..........#', '#.####.###.#', '#.####.....#',
      '#.####.###.#', '#.####.....#', '#..........#', '#.########.#', '#..........#', '############'],
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

  // Mostly the pixel blue, with a few accents; fixed per cell so colours travel with the shape.
  const PALETTE = [[0.62, ON], [0.76, '#2f5bd3'], [0.86, '#9fd4ff'], [0.95, '#1d2126'], [1, '#f6d36d']];
  const pick = (c, r) => { const v = hash(c * 13 + 5, r * 7 + 1); return PALETTE.find(([q]) => v <= q)[1]; };

  // Text -> 1-bit bitmap on the grid: render small, sample the alpha.
  const bitmaps = new Map();
  let fontsReady = !document.fonts;
  if (document.fonts) document.fonts.ready.then(() => { fontsReady = true; bitmaps.clear(); });
  function marqueeBitmap(text) {
    if (bitmaps.has(text)) return bitmaps.get(text);
    const H = 21, cv = document.createElement('canvas'), c2 = cv.getContext('2d', { willReadFrequently: true });
    const font = '600 20px "Inter Tight", ui-sans-serif, system-ui, sans-serif';
    c2.font = font;
    if ('letterSpacing' in c2) c2.letterSpacing = '1px';
    const W = Math.ceil(c2.measureText(text).width) + 4;
    cv.width = W; cv.height = H;
    c2.font = font; if ('letterSpacing' in c2) c2.letterSpacing = '1px'; c2.textBaseline = 'alphabetic'; c2.fillStyle = '#000';
    c2.fillText(text, 1, 16);
    c2.strokeStyle = '#000'; c2.lineWidth = 0.5; c2.strokeText(text, 1, 16);   // a touch bolder
    const data = c2.getImageData(0, 0, W, H).data, on = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) on[i] = data[i * 4 + 3] > 120 ? 1 : 0;
    const bm = { w: W, h: H, on };
    if (fontsReady) bitmaps.set(text, bm);
    return bm;
  }

  const SCENES = {
    // A living pixel organism: a domain-warped noise field grows, splits and
    // re-forms along a diagonal. Scrolling away dissolves it. 1-bit only:
    // each pixel is either on (full colour) or off; depth is shown by density.
    hero: {
      time: true,
      draw(ctx, w, h, t) {
        const S = G, s = S - 1, cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const scroll = clamp01(scrollY / Math.max(1, h));
        const lift = scroll * rows * 0.6;
        const th = 0.36 + scroll * 0.35;
        // evaluate the noise field on a coarse grid (every K cells), interpolate between
        const K = 2, gc = Math.ceil(cols / K) + 2, gr = Math.ceil(rows / K) + 2;
        const F = new Float32Array(gc * gr), Z = new Float32Array(gc * gr);
        for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) {
          const c = i * K, ry = j * K + lift;
          const nx = c / cols, ny = ry / rows;
          const cy = -0.2 + 1.15 * nx + Math.sin(nx * 4 + t * 0.3) * 0.08;
          const d = (ny - cy) / (0.44 - 0.12 * nx);
          const base = (1 - d * d) * (1 - 0.8 * smooth(0.35, 1, nx));
          const q = fbm(c * 0.025, ry * 0.025, t * 0.12);
          const n = fbm(c * 0.042 + q * 2.4, ry * 0.042 - q * 1.8, t * 0.32);
          let f = base * 0.78 + (n - 0.46) * 1.6;
          if (mouse.amp > 0.01) {
            const dx = (c * S - mouse.x) / 150, dy = (j * K * S - mouse.y) / 150;
            f += 0.55 * mouse.amp * Math.exp(-(dx * dx + dy * dy));
          }
          F[j * gc + i] = f;
          // zone coordinate: position across the body, warped by the same noise,
          // drifting slowly so the colour bands travel through the organism
          Z[j * gc + i] = d * 0.55 + (q - 0.5) * 2.2 + Math.sin(t * 0.2 + nx * 2) * 0.25;
        }
        const spore = Math.floor(t * 5) * 17;
        const N = HERO.length;
        for (let r = 0; r < rows; r++) {
          const gy = r / K, j = Math.floor(gy), fy = gy - j;
          for (let c = 0; c < cols; c++) {
            const gx = c / K, i = Math.floor(gx), fx = gx - i;
            const k = j * gc + i;
            const f = (F[k] * (1 - fx) + F[k + 1] * fx) * (1 - fy) + (F[k + gc] * (1 - fx) + F[k + gc + 1] * fx) * fy;
            const level = (f - th) / 0.35;               // <0 outside, >1 solid core
            if (level > 0) {
              if (level * 1.4 <= bayer(c, r)) continue;  // dithered membrane, solid core
              const z = (Z[k] * (1 - fx) + Z[k + 1] * fx) * (1 - fy) + (Z[k + gc] * (1 - fx) + Z[k + gc + 1] * fx) * fy;
              const zone = Math.max(0, Math.min(N - 1, Math.floor((z + 1) / 2 * N)));
              fill(ctx, HERO[zone], c * S, r * S, s);  // hard zone edges, no blending
            } else if (level > -0.6 && hash(c, r + spore) < 0.012) {
              fill(ctx, SPORE, c * S, r * S, s);         // spores around the body
            }
          }
        }
      }
    },

    // Scattered pixels resolve into waves as the section scrolls into view.
    flow: {
      time: true, scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = G, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
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
        const S = G, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
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
        const S = G, s = S - 1;
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

    // Footer marquee: the slogan as big pixel letters, sliding left one grid cell at a time.
    marquee: {
      time: true,
      draw(ctx, w, h, t, el) {
        const bm = marqueeBitmap(el.dataset.text || '');
        if (!bm.w) return;
        const rows = bm.h, cols = Math.ceil(w / G) + 1;
        const off = reduce ? 0 : Math.floor(t * 9);
        const y0 = Math.max(0, Math.floor((h / G - rows) / 2));
        for (let c = 0; c < cols; c++) {
          const bc = (c + off) % bm.w;
          for (let r = 0; r < rows; r++) {
            if (!bm.on[r * bm.w + bc]) continue;
            fill(ctx, pick(bc, r), c * G, (y0 + r) * G, G - 1);
          }
        }
      }
    },

    // Footer rubble: stacks of coloured pixels that rise as the footer comes in; a few flicker.
    rubble: {
      time: true, scroll: true,
      draw(ctx, w, h, t, el, p) {
        const cols = Math.ceil(w / G), rows = Math.floor(h / G);
        const rise = 0.1 + 0.9 * ease(p), flick = Math.floor(t * 2);
        for (let c = 0; c < cols; c++) {
          const n = hash(Math.floor(c / 3), 11);             // clumps of neighbouring columns
          if (n < 0.12) continue;
          const peak = Math.pow(hash(c, 7), 1.7) * (0.3 + n * 0.7);
          const height = Math.round(rows * rise * peak) + (hash(c, 3) < 0.7 ? 1 + (hash(c, 4) * 3 | 0) : 0);
          for (let r = 0; r < height; r++) {
            if (hash(c, r + 50) < 0.12) continue;            // holes in the pile
            fill(ctx, pick(c * 7, r), c * G, (rows - 1 - r) * G, G - 1);
          }
          if (height > 2 && hash(c, 99) > 0.93 && hash(c, flick) > 0.5)   // loose pixel hovering on top
            fill(ctx, pick(c, 3), c * G, (rows - 3 - height) * G, G - 1);
        }
      }
    },

    // Paper-coloured cells covering a heading switch off left-to-right; the
    // wipe front is a line of lit pixels.
    mask: {
      scroll: true,
      draw(ctx, w, h, t, el, p) {
        const S = G, cols = Math.ceil(w / S), rows = Math.ceil(h / S);
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

  // Page position from the offset chain (ignores reveal transforms in flight).
  const pageOffset = el => { let x = 0, y = 0; for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return [x, y]; };
  function setup(sc) {
    // Nudge the canvas so its origin lands on the page grid.
    const [ox, oy] = pageOffset(sc.el);
    const dx = ((ox % G) + G) % G, dy = ((oy % G) + G) % G;
    sc.el.style.transform = dx || dy ? `translate(${-dx}px,${-dy}px)` : '';
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
  let barCtx = null, barW = 0, lastBarP = -1, lastBarY = -1;
  function drawProgress(force) {
    if (!bar) return;
    if (force || !barCtx) {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      barW = innerWidth;
      bar.width = Math.round(barW * dpr); bar.height = Math.round(2 * G * dpr);
      barCtx = bar.getContext('2d'); barCtx.dpr = dpr;
    }
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? clamp01(scrollY / max) : 0;
    const y0 = (G - scrollY % G) % G;                // keep the row on the page grid
    if (!force && Math.abs(p - lastBarP) < 0.0005 && y0 === lastBarY) return;
    lastBarP = p; lastBarY = y0;
    const cols = Math.ceil(barW / G), filled = Math.round(p * cols);
    barCtx.clearRect(0, 0, bar.width, bar.height);
    barCtx.fillStyle = ON;
    for (let c = 0; c < filled; c++) fill(barCtx, null, c * G, y0, G - 1);
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
  // Layout settles after fonts and images: re-align the canvases to the grid then.
  if (document.fonts) document.fonts.ready.then(resizeAll);
  addEventListener('load', resizeAll);
  let bodyH = 0;
  new ResizeObserver(() => {
    if (Math.abs(document.body.offsetHeight - bodyH) < 1) return;
    bodyH = document.body.offsetHeight;
    clearTimeout(resizeT); resizeT = setTimeout(resizeAll, 120);
  }).observe(document.body);

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

  /* ---------- Contact address (set once on <body data-contact>) ---------- */
  const CONTACT = document.body.dataset.contact || 'info@ylvalabs.de';
  const mailto = (subject, body) =>
    `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}${body ? '&body=' + encodeURIComponent(body) : ''}`;
  document.querySelectorAll('[data-mailto]').forEach(a => { a.href = mailto(a.dataset.mailto); });
  document.querySelectorAll('[data-contact-text]').forEach(a => { a.href = `mailto:${CONTACT}`; a.textContent = CONTACT; });

  /* ---------- Website finder: pick wishes, get a pre-written enquiry ---------- */
  const finder = document.getElementById('finder');
  if (finder) {
    const tabs = [...finder.querySelectorAll('[role="tab"]')];
    const sets = [...finder.querySelectorAll('.pains')];
    const other = document.getElementById('finder-other');
    const send = document.getElementById('finder-send');
    const count = document.getElementById('finder-count');
    const pxBox = document.getElementById('finder-px');
    const MAX = 6;
    for (let i = 0; i < MAX; i++) pxBox.appendChild(document.createElement('i'));
    let branche = tabs[0].dataset.branche;

    const update = () => {
      const picked = [...finder.querySelectorAll(`.pains[data-for="${branche}"] input:checked`)].map(i => i.value);
      const free = other.value.trim();
      const n = picked.length + (free ? 1 : 0);
      [...pxBox.children].forEach((px, i) => px.classList.toggle('on', i < n));
      count.textContent = n === 0 ? 'Noch nichts ausgewählt' : n === 1 ? '1 Wunsch ausgewählt' : `${n} Wünsche ausgewählt`;
      const lines = [
        'Hallo Ylva Labs,', '',
        'wir interessieren uns für eine Website und ein kostenloses Erstgespräch.', '',
        `Ausgangslage: ${branche}`, ''
      ];
      if (n) {
        lines.push('Darum geht es uns:');
        picked.forEach(v => lines.push(`- ${v}`));
        if (free) lines.push(`- ${free}`);
        lines.push('');
      }
      lines.push('Betrieb:', 'Bestehende Website (falls vorhanden):', 'Ort:', 'Ansprechpartner:in:', 'Telefon (für Rückruf):', '', 'Viele Grüße');
      send.href = mailto(`Website-Anfrage: ${branche}`, lines.join('\n'));
      send.lastChild.textContent = n ? 'Anfrage mit Auswahl vorbereiten' : 'Anfrage vorbereiten';
    };

    tabs.forEach(tab => tab.addEventListener('click', () => {
      branche = tab.dataset.branche;
      tabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
      sets.forEach(f => { f.hidden = f.dataset.for !== branche; });
      update();
    }));
    finder.addEventListener('change', update);
    other.addEventListener('input', update);
    update();
  }

  /* ---------- Portfolio: load the live site only on wide screens, near the viewport ---------- */
  const frame = document.getElementById('safari-frame');
  if (frame && matchMedia('(min-width:721px)').matches) {
    new IntersectionObserver(([e], obs) => {
      if (!e.isIntersecting) return;
      frame.src = frame.dataset.src;
      obs.disconnect();
    }, { rootMargin: '400px' }).observe(frame);
  }

  /* ---------- Portfolio: centre the Safari window once you start using it ---------- */
  const safari = document.querySelector('.safari');
  let autoScrolling = false;
  if (safari && matchMedia('(min-width:721px)').matches) {
    const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const centre = () => {
      const r = safari.getBoundingClientRect();
      const target = scrollY + r.top - Math.max(0, (innerHeight - r.height) / 2);
      const from = scrollY, dist = target - from;
      if (autoScrolling || Math.abs(dist) < 12) return;
      if (reduce) { scrollTo(0, target); return; }
      autoScrolling = true;
      const dur = Math.min(900, 380 + Math.abs(dist) * 0.9), t0s = performance.now();
      const stop = () => { autoScrolling = false; removeEventListener('wheel', stop); removeEventListener('touchstart', stop); };
      addEventListener('wheel', stop, { passive: true });
      addEventListener('touchstart', stop, { passive: true });
      const stepScroll = ts => {
        if (!autoScrolling) return;
        const k = Math.min(1, (ts - t0s) / dur);
        scrollTo({ top: from + dist * easeInOut(k), behavior: 'instant' });
        if (k < 1) requestAnimationFrame(stepScroll); else stop();
      };
      requestAnimationFrame(stepScroll);
    };
    safari.addEventListener('mouseenter', centre);
    safari.addEventListener('pointerdown', centre);
    safari.addEventListener('focusin', centre);
  }

  /* ---------- Pixel games: on the background layer, behind all content ---------- */
  // Sprites: '#' = main colour, 'w' = white, 'b' = ink, anything else = off.
  const SPRITES = {
    pacOpen: ['....#####....', '..#########..', '.###########.', '.#########...', '#########....', '########.....',
      '#######......', '########.....', '#########....', '.#########...', '.###########.', '..#########..', '....#####....'],
    pacShut: ['....#####....', '..#########..', '.###########.', '.###########.', '#############', '#############',
      '#############', '#############', '#############', '.###########.', '.###########.', '..#########..', '....#####....'],
    ghostA: ['.....####.....', '...########...', '..##########..', '.##ww####ww##.', '.#wwww##wwww#.', '.#wwbb##wwbb#.',
      '##wwbb##wwbb##', '###ww####ww###', '##############', '##############', '##############', '##############',
      '##.###..###.##', '#...##..##...#'],
    ghostB: ['.....####.....', '...########...', '..##########..', '.##ww####ww##.', '.#wwww##wwww#.', '.#wwbb##wwbb#.',
      '##wwbb##wwbb##', '###ww####ww###', '##############', '##############', '##############', '##############',
      '###.##..##.###', '.#..#....#..#.'],
    invA: ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'],
    invB: ['..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########', '.#########.', '..#.....#..', '.#.......#.']
  };
  // 3x5 pixel digits for the score pop-ups.
  const GLYPHS = { '+': ['...', '.#.', '###', '.#.', '...'], 0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['###', '..#', '###', '#..', '###'], 5: ['###', '#..', '###', '..#', '###'] };
  const PAC = '#f6d36d', INK = '#1d2126';
  const GHOSTS = ['#2f5bd3', ON, '#9fd4ff', '#8a929c'];
  const TETRO = [
    [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]]
  ];
  const TCOL = ['#9fd4ff', '#f6d36d', ON, '#2f5bd3', '#1d2126', '#8a929c', '#9fd4ff'];
  const SPRITE_SET = { invader: [['invA', 'invB'], INK, '+200'], ghost: [['ghostA', 'ghostB'], '#2f5bd3', '+200'], pacman: [['pacOpen', 'pacShut'], PAC, '+500'] };

  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  if (!reduce && fine) {
    const makeLayer = cls => {
      const cv = document.createElement('canvas');
      cv.className = cls;
      cv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cv);
      return [cv, cv.getContext('2d')];
    };
    const [play, pctx] = makeLayer('px-play');      // behind everything
    const [top, tctx] = makeLayer('px-cursor');     // the cursor circle, above
    const sizeLayers = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      [[play, pctx], [top, tctx]].forEach(([cv, cx]) => { cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d); cx.dpr = d; });
    };
    sizeLayers();
    addEventListener('resize', sizeLayers);

    // All actors live in page coordinates and are snapped to the page grid.
    let ctx = pctx;
    const px = (c, x, y) => fill(ctx, c, snap(x), snap(y) - scrollY, G - 1);
    const onScreen = y => y > scrollY - 200 && y < scrollY + innerHeight + 200;
    const drawSprite = (rows, color, x, y, flip = false) => {
      const w = rows[0].length;
      rows.forEach((row, j) => [...row].forEach((ch, i) => {
        const c = ch === '#' ? color : ch === 'w' ? '#fff' : ch === 'b' ? INK : null;
        if (c) px(c, x + (flip ? w - 1 - i : i) * G, y + j * G);
      }));
    };
    const drawText = (text, x, y, color) => {
      const w = text.length * 4 * G;
      [...text].forEach((ch, k) => (GLYPHS[ch] || []).forEach((row, j) => [...row].forEach((c, i) => {
        if (c === '#') px(color, x - w / 2 + (k * 4 + i) * G, y + j * G);
      })));
    };

    const actors = [];
    const spawn = (...list) => actors.push(...list);

    // A single falling pixel. Blinks out at the end of its life (never fades: 1-bit).
    function particle(x, y, vx, vy, c, life = 0.9 + Math.random() * 0.6) {
      let t = 0;
      return {
        step(dt) { t += dt; vy += 900 * dt; x += vx * dt; y += vy * dt; return t < life && y < scrollY + innerHeight + 40; },
        draw() { if (life - t > 0.25 || Math.floor(t * 16) % 2) px(c, x, y); }
      };
    }
    const shatter = (rows, color, x, y, power = 1) => rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '#') return;
      const a = Math.random() * Math.PI * 2, v = (120 + Math.random() * 260) * power;
      spawn(particle(x + i * G, y + j * G, Math.cos(a) * v, Math.sin(a) * v - 180, color));
    }));
    function score(x, y, text) {
      let t = 0;
      return { step(dt) { t += dt; y -= 30 * dt; return t < 0.9; }, draw() { drawText(text, x, y, INK); } };
    }

    // Pac-Man eats a line of dots, two ghosts give chase.
    function pacman(x, y, dir) {
      const cy = y - 6 * G, speed = 300, dots = [];
      for (let d = x + dir * 4 * G; d > -G && d < innerWidth + G; d += dir * 5 * G) dots.push(d);
      let p = x - dir * 6 * G, t = 0;
      const ghosts = [0, 1].map(k => ({ x: p - dir * (22 + k * 18) * G, c: GHOSTS[k * 2 + (Math.random() * 2 | 0)] }));
      return {
        step(dt) {
          t += dt; p += dir * speed * dt;
          ghosts.forEach(g => { g.x += dir * speed * 0.93 * dt; });
          const mouth = p + dir * 6 * G;
          while (dots.length && (dir > 0 ? dots[0] <= mouth : dots[0] >= mouth)) dots.shift();
          const lastGhost = ghosts[ghosts.length - 1].x;
          return dir > 0 ? lastGhost < innerWidth + 20 * G : lastGhost > -20 * G;
        },
        draw() {
          if (!onScreen(y)) return;
          dots.forEach(d => px(INK, d, y));
          drawSprite(Math.floor(t * 9) % 2 ? SPRITES.pacShut : SPRITES.pacOpen, PAC, p - 6 * G, cy, dir < 0);
          const gf = Math.floor(t * 6) % 2 ? SPRITES.ghostB : SPRITES.ghostA;
          ghosts.forEach(g => drawSprite(gf, g.c, g.x - 7 * G, cy - G, dir < 0));
        }
      };
    }

    // A tetromino drops in steps, rotates once, lands and crumbles. Blocks are 4x4 grid pixels.
    function tetris(x, y) {
      const C = 4 * G;
      let cells = TETRO[(Math.random() * TETRO.length) | 0].map(c => c.slice());
      const color = TCOL[(Math.random() * TCOL.length) | 0];
      const floor = Math.round(y / C) * C;
      let topY = floor - 7 * C, acc = 0, landed = 0, rotated = false;
      const x0 = Math.round(x / C) * C - C;
      const height = () => Math.max(...cells.map(c => c[1])) + 1;
      return {
        step(dt) {
          if (landed) {
            landed += dt;
            if (landed < 0.45) return true;
            cells.forEach(([i, j]) => {
              for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if ((a + b) % 2 === 0)
                spawn(particle(x0 + i * C + a * G, topY + j * C + b * G, (Math.random() - 0.5) * 240, -Math.random() * 260, color));
            });
            return false;
          }
          acc += dt;
          while (acc > 0.07) {
            acc -= 0.07;
            if (!rotated && topY > floor - 4 * C) { cells = cells.map(([i, j]) => [2 - j, i]); rotated = true; }
            if (topY + height() * C >= floor) { topY = floor - height() * C; landed = 0.0001; break; }
            topY += C / 2;
          }
          return true;
        },
        draw() {
          const flash = landed && Math.floor(landed * 14) % 2;
          cells.forEach(([i, j]) => {
            for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++)
              px(flash || (a === 0 && b === 0) ? '#fff' : color, x0 + i * C + a * G, topY + j * C + b * G);
          });
        }
      };
    }

    // A space invader wiggles, a laser comes up from the bottom and pops it.
    function invader(x, y) {
      const ix = x - 5 * G, iy = y - 4 * G;
      let t = 0, beam = null, hit = false;
      return {
        step(dt) {
          t += dt;
          if (t > 0.8 && !hit) {
            if (beam === null) beam = scrollY + innerHeight;
            beam -= 1800 * dt;
            if (beam <= iy + 8 * G) {
              hit = true;
              shatter(SPRITES.invA, INK, ix, iy);
              spawn(score(x, iy - 6 * G, '+100'));
            }
          }
          return !hit;
        },
        draw() {
          if (beam !== null) for (let yy = beam; yy < beam + 14 * G; yy += G) px(ON, x, yy);
          drawSprite(Math.floor(t * 3) % 2 ? SPRITES.invB : SPRITES.invA, INK, ix + (Math.floor(t * 3) % 2) * G, iy);
        }
      };
    }

    // Pixel firework.
    function burst(x, y) {
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2, v = 220 + (k % 3) * 90;
        spawn(particle(x, y, Math.cos(a) * v, Math.sin(a) * v - 120, HERO[k % HERO.length]));
      }
      return { step: () => false, draw() {} };
    }

    const GAMES = [(x, y) => pacman(x, y, x < innerWidth / 2 ? 1 : -1), tetris, invader, burst];
    let gameIdx = 0;
    const playAt = (x, y) => spawn(GAMES[gameIdx++ % GAMES.length](x, y));

    // Resting sprites next to some section headings; click one and it pops.
    const idle = [...document.querySelectorAll('[data-sprite]')].map(el => {
      const [names, color, pts] = SPRITE_SET[el.dataset.sprite];
      const rows = SPRITES[names[0]];
      el.style.width = rows[0].length * G + 'px';
      el.style.height = rows.length * G + 'px';
      el.parentElement.classList.add('has-sprite');
      return { el, frames: names.map(n => SPRITES[n]), color, pts, gone: 0 };
    });
    const idlePos = sp => { const r = sp.el.getBoundingClientRect(); return [r.left, r.top + scrollY, r]; };

    const hint = document.createElement('div');
    hint.className = 'play-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<i></i>Tipp: Klickt mal ins Leere';
    document.body.appendChild(hint);
    const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
    const played = () => { hint.classList.remove('show'); store('ylva-played', '1'); };
    if (!store('ylva-played')) {
      setTimeout(() => hint.classList.add('show'), 5000);
      setTimeout(() => hint.classList.remove('show'), 17000);
    }

    // Nothing spawns in the hero (pixel organism + headline); keep a margin below it.
    const heroCopy = document.querySelector('.hero-copy');
    const heroEnd = () => heroCopy ? heroCopy.getBoundingClientRect().bottom + scrollY + 150 : 0;

    const SKIP = 'a,button,input,textarea,select,label,summary,iframe,img,p,h1,h2,h3,li,figcaption,small,b,.pill,.btn,.finder-box,.safari';
    document.addEventListener('click', e => {
      if (e.button !== 0 || e.defaultPrevented) return;
      const el = e.target.closest('[data-sprite]');
      const sp = el && idle.find(s => s.el === el);
      if (sp) {
        if (sp.gone) return;
        const [x, y] = idlePos(sp);
        shatter(sp.frames[0], sp.color, x, y, 1.1);
        spawn(score(x + sp.el.offsetWidth / 2, y - 6 * G, sp.pts));
        sp.gone = 6;
        played();
        return;
      }
      if (e.target.closest(SKIP) || String(getSelection()).length) return;
      if (e.clientY + scrollY < heroEnd()) return;
      playAt(e.clientX, e.clientY + scrollY);
      played();
    });

    // Now and then (every 35–65 s) a game starts by itself somewhere on screen,
    // but never in the hero: only in the visible part below it.
    const auto = () => {
      const lo = Math.max(scrollY + innerHeight * 0.3, heroEnd()), hi = scrollY + innerHeight * 0.8;
      if (!document.hidden && actors.length < 40 && hi - lo > 60) {
        const x = innerWidth * (0.12 + Math.random() * 0.76), y = lo + Math.random() * (hi - lo);
        if (Math.random() < 0.3) spawn(pacman(-4 * G, y, 1));
        else playAt(x, y);
      }
      setTimeout(auto, 35000 + Math.random() * 30000);
    };
    setTimeout(auto, 15000);

    // Footer "play" button: a little show on top of the rubble.
    const playBtn = document.getElementById('play');
    if (playBtn) {
      playBtn.hidden = false;
      playBtn.addEventListener('click', () => {
        const r = playBtn.parentElement.getBoundingClientRect(), y = r.top + scrollY;
        spawn(pacman(-4 * G, y + 10 * G, 1));
        for (let k = 0; k < 5; k++) setTimeout(() => spawn(tetris(innerWidth * (0.1 + Math.random() * 0.8), y + 12 * G)), 300 + k * 350);
        setTimeout(() => spawn(invader(innerWidth * (0.25 + Math.random() * 0.5), y - 20 * G)), 1200);
        played();
      });
    }

    /* Cursor circle: a pixel ring that springs after the mouse, stretches with
       speed and fills over links. It is born inside the hero organism. */
    const cur = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, on: false, hot: false, r: 3 };
    const heroBand = document.querySelector('.band-hero');
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      if (!cur.on) {
        const r = heroBand ? heroBand.getBoundingClientRect() : { left: e.clientX, top: e.clientY, width: 0, height: 0 };
        cur.x = r.left + r.width * 0.45; cur.y = r.top + r.height * 0.5;
        if (heroBand && r.bottom < 0) { cur.x = e.clientX; cur.y = e.clientY; }
        cur.on = true;
      }
      cur.tx = e.clientX; cur.ty = e.clientY;
      cur.hot = !!e.target.closest('a,button,label,summary,input,textarea,[data-sprite]');
    }, { passive: true });
    document.addEventListener('mouseleave', () => { cur.on = false; });
    if (safari) {
      // Mouse events stop at the iframe edge; hide the ring over the live site.
      safari.querySelector('.safari-screen').addEventListener('mouseenter', () => { cur.on = false; });
    }
    function drawCursor(dt) {
      if (!cur.on) return;
      const k = Math.min(1, dt * 60);
      cur.vx = (cur.vx + (cur.tx - cur.x) * 0.16 * k) * Math.pow(0.7, k);
      cur.vy = (cur.vy + (cur.ty - cur.y) * 0.16 * k) * Math.pow(0.7, k);
      cur.x += cur.vx * k; cur.y += cur.vy * k;
      cur.r += ((cur.hot ? 4.4 : 3) - cur.r) * 0.2 * k;
      const speed = Math.hypot(cur.vx, cur.vy);
      const st = Math.min(1.9, 1 + speed * 0.035);
      const ang = Math.atan2(cur.vy, cur.vx), ca = Math.cos(ang), sa = Math.sin(ang);
      const a = cur.r * st, b = cur.r / Math.sqrt(st), n = Math.ceil(a + 1);
      const cx = Math.round(cur.x / G), cy = Math.round((cur.y + scrollY) / G);
      ctx = tctx; ctx.fillStyle = ON;
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
        const u = i * ca + j * sa, v = -i * sa + j * ca;
        const d = (u / a) ** 2 + (v / b) ** 2;
        if (d > 1) continue;
        const inner = (u / Math.max(0.1, a - 1.2)) ** 2 + (v / Math.max(0.1, b - 1.2)) ** 2;
        if (!cur.hot && inner < 1) continue;
        px(null, (cx + i) * G, (cy + j) * G);
      }
    }

    let lastT = performance.now();
    const frame = ts => {
      const dt = Math.min(0.05, (ts - lastT) / 1000);
      lastT = ts;
      pctx.clearRect(0, 0, play.width, play.height);
      tctx.clearRect(0, 0, top.width, top.height);
      for (let i = actors.length - 1; i >= 0; i--) if (!actors[i].step(dt)) actors.splice(i, 1);
      ctx = pctx;
      actors.forEach(a => a.draw());
      idle.forEach(sp => {
        if (sp.gone > 0) { sp.gone -= dt; return; }
        const [x, y, r] = idlePos(sp);
        if (r.bottom < -50 || r.top > innerHeight + 50) return;
        drawSprite(sp.frames[Math.floor(ts / 420) % 2], sp.color, x, y);
      });
      drawCursor(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ---------- Sticky CTA on mobile, shown once the hero is out of view ---------- */
  const sticky = document.getElementById('sticky-cta');
  const heroCopy = document.querySelector('.hero-copy');
  const contactSec = document.getElementById('kontakt');
  if (sticky && heroCopy) {
    let pastHero = false, atContact = false;
    const sync = () => {
      const on = pastHero && !atContact;
      sticky.classList.toggle('show', on);
      sticky.setAttribute('aria-hidden', String(!on));
      sticky.querySelector('a').tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(heroCopy);
    if (contactSec) new IntersectionObserver(([e]) => { atContact = e.isIntersecting; sync(); }).observe(contactSec);
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
