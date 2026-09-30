/* Ylva Labs – page behaviour.
   Motion principle: static by default, reactive when relevant. Nothing loops on
   its own: canvases redraw only on scroll, on hover, or during a short one-shot
   animation when they first come into view. */
(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width:720px)').matches;          // phones: even fewer pixel animations
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;

  // One grid for all pixel art: every pixel is G css px and sits on the page grid.
  const G = 5;
  const snap = v => Math.round(v / G) * G;
  const css = name => (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim();
  const ON = css('--px') || '#5aa9e6';                                // the one pixel colour: on or off
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

  /* ---------- Bitmaps: icons, section marks, pixel digits ---------- */
  // '#' = pixel on; '.' and '+' = off.
  const BITMAPS = {
    fenster: ['############', '#.#.#......#', '############', '#..........#', '#.####.###.#', '#.####.....#',
      '#.####.###.#', '#.####.....#', '#..........#', '#.########.#', '#..........#', '############'],
    zahnrad: ['....####....', '.##.####.##.', '.##########.', '..########..', '####....####', '####....####',
      '####....####', '####....####', '..########..', '.##########.', '.##.####.##.', '....####....'],
    funke: ['............', '.........#..', '....#...###.', '....#....#..', '...###......', '..#####.....',
      '#########...', '..#####.....', '...###......', '....#.......', '....#.......', '............'],
    lupe: ['...####.....', '.##....##...', '.#......#...', '#........#..', '#........#..', '#........#..',
      '#........#..', '.#......#...', '.##....###..', '...####.###.', '.........###', '..........##'],
    stapel: ['............', '....####....', '....####....', '............', '..########..', '..########..',
      '............', '############', '############', '............', '............', '............'],
    liste: ['............', '###.########', '#.#.........', '###.########', '............', '###.########',
      '#.#.........', '###.########', '............', '###.#######.', '#.#.........', '###.#######.'],
    stufen: ['.........###', '.........###', '.........###', '......######', '......######', '......######',
      '...#########', '...#########', '...#########', '############', '############', '############'],
    frage: ['...######...', '..########..', '.###....###.', '.##......##.', '.........##.', '........###.',
      '......###...', '.....###....', '.....##.....', '............', '.....##.....', '.....##.....'],
    brief: ['............', '############', '##........##', '#.#......#.#', '#..#....#..#', '#...#..#...#',
      '#....##....#', '#..........#', '#..........#', '############', '............', '............']
  };
  const DIGITS = { 0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
    3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'] };
  const digitRows = text => DIGITS[0].map((_, r) => [...text].map(d => DIGITS[d][r]).join('.'));

  const SVGNS = 'http://www.w3.org/2000/svg';
  // Each pixel gets a random delay (--d) so a mark can "pop" in once (see .px-pop in CSS).
  function bitmapSVG(rows, gap = 0.12) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('shape-rendering', 'crispEdges');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '#') return;
      const r = document.createElementNS(SVGNS, 'rect');
      r.setAttribute('x', x + gap / 2); r.setAttribute('y', y + gap / 2);
      r.setAttribute('width', 1 - gap); r.setAttribute('height', 1 - gap);
      r.style.setProperty('--d', Math.round(hash(x * 7 + 3, y * 13 + w) * 420) + 'ms');
      svg.appendChild(r);
    }));
    return svg;
  }
  // Whole css pixels per bitmap pixel (data-px, default 3) keep the art crisp.
  const mount = (el, rows) => {
    el.appendChild(bitmapSVG(rows));
    el.style.width = rows[0].length * (+el.dataset.px || 3) + 'px';
  };
  document.querySelectorAll('[data-bitmap]').forEach(el => { if (BITMAPS[el.dataset.bitmap]) mount(el, BITMAPS[el.dataset.bitmap]); });
  document.querySelectorAll('[data-digits]').forEach(el => mount(el, digitRows(el.dataset.digits)));

  /* ---------- Canvas scene engine ---------- */
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


  /* Scene options:
       intro: s   plays once from page load for s seconds (the hero)
       once:  s   plays once for s seconds when it first comes into view
       scroll     redraws while the page scrolls (scroll-linked, never on its own)
     draw(ctx, w, h, t, el, p): t = the scene's own clock (only advances while it
     animates), p = progress of its one-shot animation, 0..1. */
  const SCENES = {
    // The pixel organism: grows in once (Level 3 moment), then rests. It stirs
    // under the mouse and dissolves as it scrolls out of view.
    hero: {
      intro: 2.4, scroll: true, hover: true,
      draw(ctx, w, h, t, el, p) {
        const S = G, s = S - 1, cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const scroll = clamp01((80 - el.getBoundingClientRect().top) / Math.max(1, h));   // dissolves as it leaves the top
        const lift = scroll * rows * 0.6;
        const th = 0.36 + scroll * 0.35 + (1 - ease(p)) * 0.8;   // intro: the body grows in, then rests
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

    // Scattered pixels resolve into waves once, as the section comes into view.
    flow: {
      once: 1.6,
      draw(ctx, w, h, t, el, p) {
        const S = G, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const mid = rows / 2, flick = 0;
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

    // Card artwork: dither backdrop, icon pixels fly into place once; replays on hover.
    art: {
      once: 0.9, replay: true,
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

    // Footer marquee: the slogan in big pixel letters; it slides only while you scroll.
    marquee: {
      scroll: true,
      draw(ctx, w, h, t, el) {
        const bm = marqueeBitmap(el.dataset.text || '');
        if (!bm.w) return;
        const rows = bm.h, cols = Math.ceil(w / G) + 1;
        const off = reduce ? 0 : Math.floor(scrollY / 4);
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

    // Footer rubble: stacks of coloured pixels that rise once as the footer comes in.
    rubble: {
      once: 1.2,
      draw(ctx, w, h, t, el, p) {
        const cols = Math.ceil(w / G), rows = Math.floor(h / G);
        const rise = 0.1 + 0.9 * ease(p);
        for (let c = 0; c < cols; c++) {
          const n = hash(Math.floor(c / 3), 11);             // clumps of neighbouring columns
          if (n < 0.12) continue;
          const peak = Math.pow(hash(c, 7), 1.7) * (0.3 + n * 0.7);
          const height = Math.round(rows * rise * peak) + (hash(c, 3) < 0.7 ? 1 + (hash(c, 4) * 3 | 0) : 0);
          for (let r = 0; r < height; r++) {
            if (hash(c, r + 50) < 0.12) continue;            // holes in the pile
            fill(ctx, pick(c * 7, r), c * G, (rows - 1 - r) * G, G - 1);
          }
        }
      }
    }
  };

  const nowS = () => performance.now() / 1000;
  const scenes = [...document.querySelectorAll('canvas[data-scene]')].map(el => ({
    el, def: SCENES[el.dataset.scene], ctx: null, w: 0, h: 0, visible: false,
    clock: 0, start: null, until: 0
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
  }
  // Progress of the one-shot animation (1 = finished / static).
  const oneShot = sc => {
    const dur = sc.def.intro || sc.def.once;
    if (!dur || reduce || (small && !sc.def.intro)) return 1;
    if (sc.start === null) return 0;
    return clamp01((nowS() - sc.start) / dur);
  };
  function render(sc) {
    if (!sc.ctx) return;
    sc.ctx.clearRect(0, 0, sc.el.width, sc.el.height);
    sc.def.draw(sc.ctx, sc.w, sc.h, sc.clock, sc.el, oneShot(sc));
  }

  // Frames are requested only when something changes; the loop stops itself.
  let queued = false, scrolled = false, lastFrame = 0;
  const kick = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };
  function tick(ts) {
    queued = false;
    const dt = lastFrame ? Math.min(0.05, (ts - lastFrame) / 1000) : 0.016;
    lastFrame = ts;
    let busy = false;
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    mouse.amp += (mouse.tamp - mouse.amp) * 0.08;
    const t = nowS();
    scenes.forEach(sc => {
      if (!sc.visible) return;
      const p = oneShot(sc);
      const animating = (sc.start !== null && p < 1) || sc.until > t || (sc.def.hover && Math.abs(mouse.amp - mouse.tamp) > 0.01);
      if (animating) sc.clock += dt;
      if (animating || (scrolled && sc.def.scroll)) render(sc);
      if (animating) busy = true;
    });
    scrolled = false;
    drawProgress();
    if (busy) kick(); else lastFrame = 0;
  }
  function resizeAll() { scenes.forEach(sc => { setup(sc); render(sc); }); drawProgress(true); }

  const vis = new IntersectionObserver(entries => entries.forEach(e => {
    const sc = scenes.find(s => s.el === e.target);
    if (!sc) return;
    sc.visible = e.isIntersecting;
    if (sc.visible && sc.def.once && sc.start === null) sc.start = nowS();
    if (sc.visible) { render(sc); kick(); }
  }), { rootMargin: '0px 0px -10% 0px' });
  scenes.forEach(sc => {
    if (sc.def.intro) sc.start = nowS();
    vis.observe(sc.el);
  });

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
    const y0 = (G - scrollY % G) % G;
    if (!force && Math.abs(p - lastBarP) < 0.0005 && y0 === lastBarY) return;
    lastBarP = p; lastBarY = y0;
    const cols = Math.ceil(barW / G), filled = Math.round(p * cols);
    barCtx.clearRect(0, 0, bar.width, bar.height);
    barCtx.fillStyle = ON;
    for (let c = 0; c < filled; c++) fill(barCtx, null, c * G, y0, G - 1);
  }

  /* ---------- Input ---------- */
  addEventListener('scroll', () => { scrolled = true; kick(); }, { passive: true });

  // Hero organism stirs under the mouse (desktop only), and rests again after.
  const heroBand = document.querySelector('.band-hero');
  const heroScene = scenes.find(sc => sc.def.intro);
  if (heroBand && heroScene && fine && !reduce) {
    heroBand.addEventListener('pointermove', e => {
      const r = heroBand.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (mouse.x < 0) { mouse.x = x; mouse.y = y; }
      mouse.tx = x; mouse.ty = y; mouse.tamp = 1;
      heroScene.until = nowS() + 0.6;
      kick();
    });
    heroBand.addEventListener('pointerleave', () => { mouse.tamp = 0; heroScene.until = nowS() + 1.2; kick(); });
  }

  // Cards: the pixel artwork re-assembles on hover (Level 1 feedback).
  if (fine && !reduce) document.querySelectorAll('.card').forEach(card => {
    const sc = scenes.find(s => card.contains(s.el) && s.def.replay);
    if (!sc) return;
    card.addEventListener('pointerenter', () => { sc.start = nowS() - sc.def.once * 0.35; kick(); });
  });

  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(resizeAll, 120); });
  resizeAll();
  kick();
  // Layout settles after fonts and images: re-align the canvases to the grid then.
  if (document.fonts) document.fonts.ready.then(resizeAll);
  addEventListener('load', resizeAll);
  let bodyH = 0;
  new ResizeObserver(() => {
    if (Math.abs(document.body.offsetHeight - bodyH) < 1) return;
    bodyH = document.body.offsetHeight;
    clearTimeout(resizeT); resizeT = setTimeout(resizeAll, 120);
  }).observe(document.body);

  /* ---------- Contact address (set once on <body data-contact>) ---------- */
  const CONTACT = document.body.dataset.contact || 'info@ylvalabs.de';
  const mailto = (subject, body) =>
    `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}${body ? '&body=' + encodeURIComponent(body) : ''}`;
  document.querySelectorAll('[data-mailto]').forEach(a => { a.href = mailto(a.dataset.mailto); });
  document.querySelectorAll('[data-contact-text]').forEach(a => { a.href = `mailto:${CONTACT}`; a.textContent = CONTACT; });

  /* ---------- Finder: pick what costs time or what you wish for, get a pre-written enquiry ---------- */
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
      count.textContent = n === 0 ? 'Noch nichts ausgewählt' : n === 1 ? '1 Punkt ausgewählt' : `${n} Punkte ausgewählt`;
      const lines = [
        'Hallo Ylva Labs,', '',
        'wir interessieren uns für eine Zusammenarbeit und ein kostenloses Erstgespräch.', '',
        `Thema: ${branche}`, ''
      ];
      if (n) {
        lines.push('Das beschäftigt uns:');
        picked.forEach(v => lines.push(`- ${v}`));
        if (free) lines.push(`- ${free}`);
        lines.push('');
      }
      lines.push('Unternehmen:', 'Branche:', 'Ort:', 'Website (falls vorhanden):', 'Ansprechpartner:in:', 'Telefon (für Rückruf):', '', 'Viele Grüße');
      send.href = mailto(`Anfrage Zusammenarbeit: ${branche}`, lines.join('\n'));
      send.querySelector('.btn-text').textContent = n ? 'Anfrage mit Auswahl vorbereiten' : 'Anfrage vorbereiten';
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
  if (frame && !small) {
    new IntersectionObserver(([e], obs) => {
      if (!e.isIntersecting) return;
      frame.src = frame.dataset.src;
      obs.disconnect();
    }, { rootMargin: '400px' }).observe(frame);
  }

  /* ---------- Portfolio: centre the Safari window once you start using it ---------- */
  const safari = document.querySelector('.safari');
  if (safari && !small) {
    let autoScrolling = false;
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

  /* ---------- Footer "play": pixel games, loaded only when asked for ---------- */
  const playBtn = document.getElementById('play');
  if (playBtn && fine && !reduce) {
    playBtn.hidden = false;
    let show = null;
    playBtn.addEventListener('click', () => {
      if (show) { show(playBtn.parentElement); return; }
      window.YLVA = { G, snap, fill, ON, HERO };
      const s = document.createElement('script');
      s.src = playBtn.dataset.src;
      s.onload = () => { show = window.YLVA_GAMES; if (show) show(playBtn.parentElement); };
      document.head.appendChild(s);
    });
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

  /* ---------- Reveal: fade + 12px lift, once; section marks pop in with it ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.setProperty('--stagger', (i % 4) * 60 + 'ms');
    io.observe(el);
  });
})();
