/* Ylva Labs – page behaviour.
   Motion principle: calm by default. Three pictures live on their own, and only
   while they are on screen: the pixel organism in the hero, the waves of the
   "So läuft's" section and the slogan in the footer. Every other canvas redraws
   only on scroll, on hover, or during a short one-shot animation when it first
   comes into view. */
(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width:720px)').matches;          // phones: even fewer pixel animations
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;

  // One grid for all pixel art: every pixel is G css px and sits on the page grid.
  const G = 5;
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


  // The organism's body: a few lobes that circle, swell and merge (metaballs).
  // o = orbit and r = radius (shares of the body radius), v = angular speed, ph = phase, p = pulse speed
  const LOBES = [
    { o: 0.12, r: 0.62, v: 0.18, ph: 0, p: 0.9 },
    { o: 0.45, r: 0.46, v: -0.13, ph: 2.1, p: 1.1 },
    { o: 0.5, r: 0.4, v: 0.1, ph: 4.2, p: 0.7 },
    { o: 0.56, r: 0.36, v: -0.21, ph: 1, p: 1.3 }
  ];
  // Mostly blue, some ink and grey: upper bounds (0..1) for the colour zones of the organism.
  const ZONES = [0.24, 0.48, 0.7, 0.88, 1];
  // Text boxes as the browser laid them out: one per line of text, one per button.
  const textBoxes = nodes => {
    const range = document.createRange(), out = [];
    nodes.forEach(n => {
      if (n.matches('.btn')) { out.push(n.getBoundingClientRect()); return; }
      const walk = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) { range.selectNodeContents(t); out.push(...range.getClientRects()); }
    });
    return out;
  };

  // Footer marquee: speed in pixel columns per second, and the pixels that dance.
  // Time is cut into windows of DANCE_WINDOW seconds, each holding one or two events at
  // random moments: irregular, but never quiet for long. In an event a pixel on the edge
  // of a letter hops or floats off the top, or drops off the bottom, and falls back into
  // line; sometimes a few neighbours along the edge join in. Everything follows from
  // the clock, so nothing has to be stored between frames.
  const MARQUEE_SPEED = 9, DANCE_WINDOW = 2.5, DANCE_MAX = 1.6;
  // The top (or bottom) lit pixel of a bitmap column, -1 for an empty column.
  const edgeRow = (bm, col, fromTop) => {
    for (let i = 0; i < bm.h; i++) { const r = fromTop ? i : bm.h - 1 - i; if (bm.on[r * bm.w + col]) return r; }
    return -1;
  };
  function dancers(bm, t, cols) {
    const moved = new Map();                               // bitmap index -> [dx, dy] in pixels
    for (let m = Math.max(0, Math.floor((t - DANCE_MAX) / DANCE_WINDOW)); m <= Math.floor(t / DANCE_WINDOW); m++) {
      for (let e = 0, count = hash(m, 900) < 0.4 ? 2 : 1; e < count; e++) {
        const k = m * 2 + e;                                 // the event's number seeds all its choices
        const t0 = (m + hash(k, 902)) * DANCE_WINDOW, dur = 0.7 + hash(k, 903) * 0.9;
        const p = (t - t0) / dur;
        if (p <= 0 || p >= 1) continue;
        const kind = hash(k, 906), top = kind < 0.75;        // hop or float off the top, or drop off the bottom
        // a column that was well on screen when the event began
        let col = (Math.floor(t0 * MARQUEE_SPEED) + Math.floor(cols * (0.1 + hash(k, 904) * 0.8))) % bm.w;
        for (let tries = 0; tries < 16 && edgeRow(bm, col, top) < 0; tries++) col = (col + 1) % bm.w;
        const amp = 3 + Math.floor(hash(k, 907) * 3), n = hash(k, 908) < 0.3 ? 2 + Math.floor(hash(k, 909) * 3) : 1;
        for (let j = 0; j < n; j++) {                        // neighbours along the edge follow a little later
          const cj = (col + j) % bm.w, row = edgeRow(bm, cj, top);
          if (row < 0) break;
          const q = clamp01((p - j * 0.08) / (1 - (n - 1) * 0.08)), arc = Math.sin(Math.PI * q);
          const d = kind < 0.45 ? [0, -Math.round(amp * arc)]                                  // hop
            : top ? [Math.round(2 * Math.sin(2 * Math.PI * q)), -Math.round((amp - 1) * arc)]   // float
            : [0, Math.round((amp - 1) * arc)];                                               // drop
          if (d[0] || d[1]) moved.set(row * bm.w + cj, d);
        }
      }
    }
    return moved;
  }

  /* Scene options:
       intro: s   plays once from page load for s seconds (the hero)
       once:  s   plays once for s seconds when it first comes into view
       live       keeps moving while it is on screen (hero, flow, marquee; still for reduced motion)
       scroll     redraws while the page scrolls (scroll-linked)
       layout(el) sizes or measures before the canvas is set up (on load and resize)
     draw(ctx, w, h, t, el, p): t = the scene's own clock (only advances while it
     animates), p = progress of its one-shot animation, 0..1. */
  const SCENES = {
    // The pixel organism (Level 3): grows in, then lives. Its lobes drift and merge,
    // the membrane flows, colour bands stream through it and spores rise around it.
    // It keeps clear of the text, leans towards the mouse and dissolves as the hero
    // scrolls away.
    hero: {
      intro: 2.4, live: true, scroll: true,
      // Wide screens: the canvas covers the hero down to the facts line and the body
      // stays right of the text (per pixel row: the first x it may use). Smaller
      // screens: CSS turns it into a band above the headline.
      layout(el) {
        el._free = el._home = null;
        el.style.height = '';
        if (getComputedStyle(el).position !== 'absolute') return;
        const sec = el.parentElement, facts = sec.querySelector('.hero-facts');
        if (facts) el.style.height = Math.max(0, facts.getBoundingClientRect().top - sec.getBoundingClientRect().top - 14) + 'px';
        const cr = el.getBoundingClientRect(), rows = Math.ceil(cr.height / G), free = new Float32Array(rows);
        textBoxes(sec.querySelectorAll('.hero-kicker, .hero-title, .hero-lead, .hero-ctas .btn')).forEach(b => {
          const r0 = Math.max(0, Math.floor((b.top - cr.top - 14) / G)), r1 = Math.min(rows - 1, Math.ceil((b.bottom - cr.top + 14) / G));
          for (let r = r0; r <= r1; r++) free[r] = Math.max(free[r], b.right - cr.left + 36);
        });
        const edge = Math.max(...free);                                   // right end of the widest line
        el._free = free;
        el._home = { x: edge + (cr.width - edge) * 0.52, y: cr.height * 0.5, r: Math.max(0, Math.min((cr.width - edge) * 0.46, cr.height * 0.4)) };
      },
      draw(ctx, w, h, t, el, p) {
        const S = G, s = S - 1, cols = Math.ceil(w / S), rows = Math.ceil(h / S);
        const scroll = clamp01((80 - el.getBoundingClientRect().top) / Math.max(1, h));   // dissolves as it leaves the top
        const lift = scroll * rows * 0.6;
        const th = 0.36 + scroll * 0.35 + (1 - ease(p)) * 0.8;   // intro: the body grows in
        const free = el._free, home = el._home || { x: w / 2, y: h / 2, r: h * 0.5 };
        const R = home.r * (1 + 0.05 * Math.sin(t * 1.1));      // breathing
        // lobes travel round beside the text, and mostly sideways in the band
        const tx = free ? R : Math.min(w * 0.32, R * 3.2), ty = free ? R : R * 0.6;
        const lean = 0.1 * mouse.amp;
        const lobes = LOBES.map((b, i) => ({
          x: home.x + Math.cos(t * b.v + b.ph) * b.o * tx + (mouse.x - home.x) * lean,
          y: home.y + Math.sin(t * b.v * 1.3 + b.ph) * b.o * ty + (mouse.y - home.y) * lean,
          rr: (b.r * R * (1 + 0.1 * Math.sin(t * b.p + i * 2))) ** 2
        }));
        // Only the area the body can reach needs work: beyond E from every lobe centre the
        // field stays below 0.457, where even a membrane pixel or spore is impossible.
        let x0 = w, x1 = 0, y0 = h, y1 = 0, sum = 0;
        for (const b of lobes) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y); sum += b.rr; }
        const E = Math.sqrt(sum * 2.2);
        const c0 = Math.max(0, Math.floor((x0 - E) / S)), c1 = Math.min(cols, Math.ceil((x1 + E) / S));
        const r0 = Math.max(0, Math.floor((y0 - E) / S)), r1 = Math.min(rows, Math.ceil((y1 + E) / S));
        // the axis the colour bands run across turns slowly
        const a = 0.7 + 0.35 * Math.sin(t * 0.05), ax = Math.cos(a), ay = Math.sin(a);
        // evaluate the field on a coarse grid (every K cells), interpolate between
        const K = 2, gc = Math.ceil(cols / K) + 2, gr = Math.ceil(rows / K) + 2;
        if (!el._F || el._F.length !== gc * gr) { el._F = new Float32Array(gc * gr); el._Z = new Float32Array(gc * gr); }
        const F = el._F.fill(-1), Z = el._Z.fill(0);       // reused every frame
        for (let j = Math.floor(r0 / K), jEnd = Math.min(gr, Math.ceil(r1 / K) + 2); j < jEnd; j++) {
          const y = j * K * S, ry = j * K + lift;
          const fr = free ? free[Math.min(rows - 1, j * K)] : 0;
          const edge = free ? smooth(0, 60, y) * smooth(h, h - 60, y) : 1;   // fades out at the top and bottom of the hero
          for (let i = Math.floor(c0 / K), iEnd = Math.min(gc, Math.ceil(c1 / K) + 2); i < iEnd; i++) {
            const c = i * K, x = c * S;
            let m = 0;                                     // metaball field: 1 on the membrane
            for (const b of lobes) { const dx = x - b.x, dy = y - b.y; m += b.rr / (dx * dx + dy * dy + 1); }
            const keep = edge * (free ? smooth(fr, fr + 80, x) : 1);   // keeps clear of the text
            const base = (1 - Math.max(m, 1e-6) ** -0.75) * keep - (1 - keep) * 1.5;   // soft towards the membrane
            if (base < -0.8) continue;                     // far outside: no noise needed
            const q = fbm(c * 0.025, ry * 0.025, t * 0.12);
            const n = fbm(c * 0.042 + q * 2.4, ry * 0.042 - q * 1.8, t * 0.32);
            let f = base * 0.78 + (n - 0.46) * 1.4;
            if (mouse.amp > 0.01) {
              const dx = (x - mouse.x) / 150, dy = (y - mouse.y) / 150;
              f += 0.55 * mouse.amp * keep * Math.exp(-(dx * dx + dy * dy));
            }
            F[j * gc + i] = f;
            // zone coordinate: position along the axis, warped by the same noise,
            // drifting so the colour bands stream through the organism
            Z[j * gc + i] = ((x - home.x) * ax + (y - home.y) * ay) / (R * 1.25) + (q - 0.5) * 2.2 + Math.sin(t * 0.2 + x / w * 2) * 0.25;
          }
        }
        const rise = Math.floor(t * 2);                    // spores drift up one pixel every half second
        for (let r = r0; r < r1; r++) {
          const gy = r / K, j = Math.floor(gy), fy = gy - j;
          for (let c = Math.max(c0, free ? Math.floor(free[r] / S) : 0); c < c1; c++) {
            const gx = c / K, i = Math.floor(gx), fx = gx - i;
            const k = j * gc + i;
            const f = (F[k] * (1 - fx) + F[k + 1] * fx) * (1 - fy) + (F[k + gc] * (1 - fx) + F[k + gc + 1] * fx) * fy;
            const level = (f - th) / 0.35;               // <0 outside, >1 solid core
            if (level > 0) {
              if (level * 1.4 <= bayer(c, r)) continue;  // dithered membrane, solid core
              const z = (Z[k] * (1 - fx) + Z[k + 1] * fx) * (1 - fy) + (Z[k + gc] * (1 - fx) + Z[k + gc + 1] * fx) * fy;
              const z01 = clamp01((z + 1) / 2);
              fill(ctx, HERO[ZONES.findIndex(q => z01 <= q)], c * S, r * S, s);   // hard zone edges, no blending
            } else if (level > -0.6 && hash(c, r + rise) < 0.012) {
              fill(ctx, SPORE, c * S, r * S, s);         // spores around the body
            }
          }
        }
      }
    },

    // How it works, as a picture: on the left everything is still vague and the pixels
    // dance out of line; step by step (one stage per step below) they find their waves,
    // and on the right they only move the way they should. It lives while on screen;
    // on first view everything starts out vague and the order settles in stage by stage.
    flow: {
      once: 2.4, live: true,
      draw(ctx, w, h, t, el, p) {
        const S = G, s = S - 1, cols = Math.ceil(w / S), rows = Math.floor(h / S);
        const mid = rows / 2;
        // order 0..1 per column: four stages, each settling in a little after the one before
        const st = [smooth(0, 0.5, p) * 0.45, smooth(0.25, 0.75, p) * 0.35, smooth(0.5, 1, p) * 0.2];
        const order = x => st[0] * smooth(0.21, 0.29, x) + st[1] * smooth(0.46, 0.54, x) + st[2] * smooth(0.71, 0.79, x);
        const WAVES = [{ f: 2.2, p: 0.0, th: 2 }, { f: 1.6, p: 2.1, th: 1 }, { f: 2.9, p: 4.0, th: 1 }];
        ctx.fillStyle = ON;
        for (let c = 0; c < cols; c++) {
          const x = c / cols, wild = 1 - order(x);
          const amp = rows * 0.4 * (0.3 + 0.7 * smooth(0.1, 1, x));   // the waves open up to the right
          WAVES.forEach((W, k) => {
            const y = mid + amp * Math.sin(x * W.f * 6.283 + t * (0.6 + k * 0.2) + W.p);
            // out of line: every pixel wanders on its own, the vaguer the stage the further
            let dy = (vnoise(c * 0.23 + k * 31.7, k * 3.1, t * (0.7 + 0.6 * wild)) - 0.5) * rows * 1.1 * wild ** 1.6;
            const dx = Math.round((vnoise(c * 0.19 + k * 13.3, 7.7, t * 0.9) - 0.5) * 8 * wild);
            // and now and then one hops right out of its line and back in
            const beat = t * 0.9 + hash(c, k + 70) * 7, b = Math.floor(beat);
            if (hash(c * 5 + k, b) < 0.12 * wild) dy += Math.sin(Math.PI * (beat - b)) * rows * 0.22 * (hash(c * 7 + k, b) < 0.5 ? -1 : 1);
            const yy = Math.round(y + dy);
            for (let i = 0; i < W.th; i++) fill(ctx, null, (c + dx) * S, (yy + i) * S, s);
          });
          // loose pixels while things are still vague: each wanders about its spot
          if (wild > 0.05) for (let r = 0; r < rows; r++) {
            const band = Math.exp(-Math.pow((r - mid) / (rows * 0.42), 2));
            if (hash(c * 3, r) >= 0.15 * band * wild * wild) continue;
            const ox = Math.round((vnoise(c * 0.5, r * 0.5, t * 1.1) - 0.5) * 6 * wild);
            const oy = Math.round((vnoise(c * 0.5 + 50, r * 0.5, t * 1.1) - 0.5) * 6 * wild);
            fill(ctx, null, (c + ox) * S, (r + oy) * S, s);
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

    // Footer marquee: the slogan in big pixel letters. It runs on its own while it is
    // on screen, and now and then a few pixels step out of line and fall back in.
    marquee: {
      live: true,
      draw(ctx, w, h, t, el) {
        const bm = marqueeBitmap(el.dataset.text || '');
        if (!bm.w) return;
        const rows = bm.h, cols = Math.ceil(w / G) + 1;
        const off = reduce ? 0 : Math.floor(t * MARQUEE_SPEED);
        const y0 = Math.max(0, Math.floor((h / G - rows) / 2));
        const away = reduce ? null : dancers(bm, t, cols);
        const out = [];                                    // dancing pixels, drawn on top
        for (let c = 0; c < cols; c++) {
          const bc = (c + off) % bm.w;
          for (let r = 0; r < rows; r++) {
            const k = r * bm.w + bc;
            if (!bm.on[k]) continue;
            const d = away && away.get(k);
            if (d) out.push([pick(bc, r), c + d[0], y0 + r + d[1]]);
            else fill(ctx, pick(bc, r), c * G, (y0 + r) * G, G - 1);
          }
        }
        out.forEach(([color, c, r]) => fill(ctx, color, c * G, r * G, G - 1));
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
    clock: 0, start: null, drawn: 0
  })).filter(sc => sc.def);

  // Page position from the offset chain (ignores reveal transforms in flight).
  const pageOffset = el => { let x = 0, y = 0; for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return [x, y]; };
  function setup(sc) {
    if (sc.def.layout) sc.def.layout(sc.el);
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

  // Frames are requested only while something moves: a one-shot animation, the
  // page scrolling, or the living organism while it is on screen. Otherwise the loop stops.
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
    scenes.forEach(sc => {
      if (!sc.visible) return;
      const live = sc.def.live && !reduce;
      const animating = live || (sc.start !== null && oneShot(sc) < 1);
      if (animating) { sc.clock += dt; busy = true; }
      const due = !live || ts - sc.drawn > 30;          // living scenes redraw at about 30 fps, plenty for 5 px pixels
      if ((animating && due) || (scrolled && sc.def.scroll)) { render(sc); sc.drawn = ts; }
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

  // Hero organism leans towards the mouse anywhere in the hero (desktop only).
  const heroSec = document.querySelector('.hero-copy');
  const heroScene = scenes.find(sc => sc.def === SCENES.hero);
  if (heroSec && heroScene && fine && !reduce) {
    heroSec.addEventListener('pointermove', e => {
      const r = heroScene.el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (mouse.x < 0) { mouse.x = x; mouse.y = y; }
      mouse.tx = x; mouse.ty = y; mouse.tamp = 1;
    });
    heroSec.addEventListener('pointerleave', () => { mouse.tamp = 0; });
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

  /* ---------- Finder: tick what fits, get a pre-written, non-binding enquiry ---------- */
  const finder = document.getElementById('finder');
  if (finder) {
    const other = document.getElementById('finder-other');
    const send = document.getElementById('finder-send');
    const count = document.getElementById('finder-count');
    const pxBox = document.getElementById('finder-px');
    const MAX = 6;
    for (let i = 0; i < MAX; i++) pxBox.appendChild(document.createElement('i'));

    const update = () => {
      const picked = [...finder.querySelectorAll('.pains input:checked')].map(i => i.value);
      const free = other.value.trim();
      const n = picked.length + (free ? 1 : 0);
      [...pxBox.children].forEach((px, i) => px.classList.toggle('on', i < n));
      count.textContent = n === 0 ? 'Noch nichts ausgewählt' : n === 1 ? '1 Punkt ausgewählt' : `${n} Punkte ausgewählt`;
      const lines = [
        'Hallo Ylva Labs,', '',
        'wir würden gern unverbindlich mit euch schauen, ob und wie ihr uns helfen könnt.', '',
        'Das beschäftigt uns:'
      ];
      picked.forEach(v => lines.push(`- ${v}`));
      if (free) lines.push(`- ${free}`);
      if (!n) lines.push('- ');                           // nothing picked: leave a line to fill in
      lines.push('', 'Unternehmen:', 'Branche:', 'Ort:', 'Ansprechpartner:in:', 'Telefon (für Rückruf):', '', 'Viele Grüße');
      send.href = mailto('Unverbindliche Anfrage', lines.join('\n'));
      send.querySelector('.btn-text').textContent = n ? 'Anfrage mit Auswahl vorbereiten' : 'Anfrage vorbereiten';
    };

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

  /* ---------- Sticky CTA on mobile, shown once the hero is out of view ---------- */
  // Hidden again while the enquiry form or the contact block is on screen: it would only point at itself.
  const sticky = document.getElementById('sticky-cta');
  const heroCopy = document.querySelector('.hero-copy');
  const stops = ['anfrage', 'kontakt'].map(id => document.getElementById(id)).filter(Boolean);
  if (sticky && heroCopy) {
    let pastHero = false;
    const atStop = new Set();
    const sync = () => {
      const on = pastHero && !atStop.size;
      sticky.classList.toggle('show', on);
      sticky.setAttribute('aria-hidden', String(!on));
      sticky.querySelector('a').tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(heroCopy);
    const stopObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) atStop.add(e.target); else atStop.delete(e.target); });
      sync();
    });
    stops.forEach(el => stopObs.observe(el));
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
