(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = { paper: '#FFFFFF' };
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
        const F = new Float32Array(gc * gr), Z = new Float32Array(gc * gr);
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
          // zone coordinate: position across the body, warped by the same noise,
          // drifting slowly so the colour bands travel through the organism
          Z[j * gc + i] = d * 0.55 + (q - 0.5) * 2.2 + Math.sin(t * 0.2 + nx * 2) * 0.25;
        }
        const spore = Math.floor(t * 5) * 17;
        const N = HERO.length;
        for (let r = 0; r < rows; r++) {
          const gy = r / G, j = Math.floor(gy), fy = gy - j;
          for (let c = 0; c < cols; c++) {
            const gx = c / G, i = Math.floor(gx), fx = gx - i;
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

  /* ---------- Pixel games: click into empty space ---------- */
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
  const PAC = '#f6d36d', INK = '#1d2126';
  const GHOSTS = ['#2f5bd3', ON, '#9fd4ff', '#8a929c'];
  const TETRO = [
    [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]]
  ];
  const TCOL = ['#9fd4ff', '#f6d36d', ON, '#2f5bd3', '#1d2126', '#8a929c', '#9fd4ff'];

  // Inline SVG sprites in section headers (two frames, toggled on a timer).
  function spriteSVG(frames, color) {
    const h = frames[0].length, w = frames[0][0].length;
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    frames.forEach((rows, i) => {
      const g = document.createElementNS(SVGNS, 'g');
      if (i === 0) g.classList.add('on');
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        const fillC = ch === '#' ? color : ch === 'w' ? '#fff' : ch === 'b' ? INK : null;
        if (!fillC) return;
        const r = document.createElementNS(SVGNS, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 1); r.setAttribute('height', 1);
        r.style.fill = fillC;
        g.appendChild(r);
      }));
      svg.appendChild(g);
    });
    return svg;
  }
  const SPRITE_SET = { invader: [['invA', 'invB'], INK], ghost: [['ghostA', 'ghostB'], '#2f5bd3'], pacman: [['pacOpen', 'pacShut'], PAC] };
  const headerSprites = [...document.querySelectorAll('[data-sprite]')];
  headerSprites.forEach(el => {
    const [names, color] = SPRITE_SET[el.dataset.sprite];
    el.appendChild(spriteSVG(names.map(n => SPRITES[n]), color));
    el.parentElement.classList.add('has-sprite');
  });
  if (!reduce && headerSprites.length) setInterval(() => {
    headerSprites.forEach(el => el.querySelectorAll('g').forEach(g => g.classList.toggle('on')));
  }, 420);

  const play = document.createElement('canvas');
  play.className = 'px-play';
  play.setAttribute('aria-hidden', 'true');
  document.body.appendChild(play);
  const pctx = play.getContext('2d');
  const P = 5;                                   // one game pixel in CSS px
  let VW = 0, VH = 0;
  const sizePlay = () => {
    const d = Math.min(devicePixelRatio || 1, 2);
    VW = innerWidth; VH = innerHeight;
    play.width = Math.round(VW * d); play.height = Math.round(VH * d);
    pctx.dpr = d;
  };
  sizePlay();
  addEventListener('resize', sizePlay);

  const px = (c, x, y, s = P) => fill(pctx, c, Math.round(x / P) * P, Math.round(y / P) * P, s);
  const drawSprite = (rows, color, x, y, flip = false) => {
    const w = rows[0].length;
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const c = ch === '#' ? color : ch === 'w' ? '#fff' : ch === 'b' ? INK : null;
      if (c) px(c, x + (flip ? w - 1 - i : i) * P, y + j * P);
    }));
  };
  const spriteParticles = (rows, color, x, y, power = 1) => {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '#') return;
      const a = Math.random() * Math.PI * 2, v = (120 + Math.random() * 260) * power;
      actors.push(particle(x + i * P, y + j * P, Math.cos(a) * v, Math.sin(a) * v - 180, color));
    }));
  };

  const actors = [];
  let running = false, last = 0;
  const loop = t => {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    pctx.clearRect(0, 0, play.width, play.height);
    for (let i = actors.length - 1; i >= 0; i--) {
      if (!actors[i].step(dt)) actors.splice(i, 1);
    }
    actors.forEach(a => a.draw());
    if (actors.length) requestAnimationFrame(loop);
    else { running = false; pctx.clearRect(0, 0, play.width, play.height); }
  };
  const spawn = (...list) => {
    actors.push(...list);
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  };

  // A single falling pixel. Blinks out at the end of its life (never fades: 1-bit).
  function particle(x, y, vx, vy, c, life = 0.9 + Math.random() * 0.6) {
    let t = 0;
    return {
      step(dt) { t += dt; vy += 900 * dt; x += vx * dt; y += vy * dt; return t < life && y < VH + 20; },
      draw() { if (life - t > 0.25 || Math.floor(t * 16) % 2) px(c, x, y); }
    };
  }

  // Pac-Man eats a line of dots, two ghosts give chase.
  function pacman(x, y, dir) {
    const cy = y - 6 * P, speed = 300, dots = [];
    for (let d = x + dir * 4 * P; d > -P && d < VW + P; d += dir * 5 * P) dots.push(d);
    let px0 = x - dir * 6 * P, t = 0;
    const ghosts = [0, 1].map(k => ({ x: px0 - dir * (22 + k * 18) * P, c: GHOSTS[k * 2 + (Math.random() * 2 | 0)] }));
    return {
      step(dt) {
        t += dt; px0 += dir * speed * dt;
        ghosts.forEach(g => { g.x += dir * speed * 0.93 * dt; });
        const mouth = px0 + dir * 6 * P;
        while (dots.length && (dir > 0 ? dots[0] <= mouth : dots[0] >= mouth)) dots.shift();
        const lastGhost = ghosts[ghosts.length - 1].x;
        return dir > 0 ? lastGhost < VW + 20 * P : lastGhost > -20 * P;
      },
      draw() {
        dots.forEach(d => px(INK, d, y - P / 2));
        const frame = Math.floor(t * 9) % 2 ? SPRITES.pacShut : SPRITES.pacOpen;
        drawSprite(frame, PAC, px0 - 6 * P, cy, dir < 0);
        const gf = Math.floor(t * 6) % 2 ? SPRITES.ghostB : SPRITES.ghostA;
        ghosts.forEach(g => drawSprite(gf, g.c, g.x - 7 * P, cy - P, dir < 0));
      }
    };
  }

  // A tetromino drops in steps, rotates once, lands on the click and crumbles.
  function tetris(x, y) {
    const C = 4 * P;
    let cells = TETRO[(Math.random() * TETRO.length) | 0].map(c => c.slice());
    const color = TCOL[(Math.random() * TCOL.length) | 0];
    const floor = Math.round(y / C) * C;
    let top = Math.max(-2 * C, floor - 7 * C), acc = 0, landed = 0, rotated = false;
    const x0 = Math.round(x / C) * C - C;
    const height = () => Math.max(...cells.map(c => c[1])) + 1;
    return {
      step(dt) {
        if (landed) {
          landed += dt;
          if (landed > 0.45) {
            cells.forEach(([i, j]) => {
              for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if ((a + b) % 2 === 0)
                actors.push(particle(x0 + i * C + a * P, top + j * C + b * P, (Math.random() - 0.5) * 240, -Math.random() * 260, color));
            });
            return false;
          }
          return true;
        }
        acc += dt;
        while (acc > 0.07) {
          acc -= 0.07;
          if (!rotated && top > floor - 4 * C) { cells = cells.map(([i, j]) => [2 - j, i]); rotated = true; }
          if (top + height() * C >= floor) { top = floor - height() * C; landed = 0.0001; break; }
          top += C / 2;
        }
        return true;
      },
      draw() {
        const flash = landed && Math.floor(landed * 14) % 2;
        cells.forEach(([i, j]) => {
          const cx = x0 + i * C, cy = top + j * C;
          fill(pctx, flash ? '#fff' : color, cx, cy, C - 1);
          if (!flash) fill(pctx, 'rgba(255,255,255,.55)', cx + P / 2, cy + P / 2, P);
        });
      }
    };
  }

  // A space invader wiggles, a laser comes up from the bottom and pops it.
  function invader(x, y) {
    const ix = x - 5.5 * P, iy = y - 4 * P;
    let t = 0, beam = VH, hit = false;
    return {
      step(dt) {
        t += dt;
        if (t > 0.8 && !hit) {
          beam -= 1800 * dt;
          if (beam <= iy + 8 * P) {
            hit = true;
            spriteParticles(SPRITES.invA, INK, ix + Math.sin(t * 8) * P, iy, 1);
            spawn(scoreText(x, iy - 2 * P, '+100'));
          }
        }
        return !hit;
      },
      draw() {
        if (t > 0.8) for (let yy = beam; yy < Math.min(VH, beam + 14 * P); yy += P) px(ON, x - P / 2, yy);
        drawSprite(Math.floor(t * 3) % 2 ? SPRITES.invB : SPRITES.invA, INK, ix + Math.sin(t * 8) * P, iy);
      }
    };
  }
  function scoreText(x, y, text) {
    let t = 0;
    return {
      step(dt) { t += dt; y -= 30 * dt; return t < 0.9; },
      draw() { pctx.save(); pctx.setTransform(pctx.dpr, 0, 0, pctx.dpr, 0, 0); pctx.font = '600 13px ' + css('--mono'); pctx.fillStyle = INK; pctx.textAlign = 'center'; pctx.fillText(text, x, y); pctx.restore(); }
    };
  }

  // Pixel firework.
  function burst(x, y) {
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2, v = 220 + (k % 3) * 90;
      actors.push(particle(x, y, Math.cos(a) * v, Math.sin(a) * v - 120, HERO[k % HERO.length]));
    }
    return { step: () => false, draw() {} };
  }

  const GAMES = [
    (x, y) => pacman(x, y, x < VW / 2 ? 1 : -1),
    tetris, invader, burst
  ];
  let gameIdx = 0;
  const hint = document.createElement('div');
  hint.className = 'play-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = '<i></i>Tipp: Klickt mal ins Leere';
  document.body.appendChild(hint);
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const played = () => { hint.classList.remove('show'); store('ylva-played', '1'); };

  // Games only with a real mouse: on phones a tap should just scroll and read.
  if (!reduce && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const SKIP = 'a,button,input,textarea,select,label,summary,iframe,img,p,h1,h2,h3,li,figcaption,small,b,.pill,.btn,.finder-box,.sticky-cta';
    document.addEventListener('click', e => {
      if (e.button !== 0 || e.defaultPrevented) return;
      const sprite = e.target.closest('[data-sprite]');
      if (sprite) {
        const r = sprite.getBoundingClientRect();
        const name = sprite.dataset.sprite;
        const [names, color] = SPRITE_SET[name];
        const rows = SPRITES[names[0]];
        spriteParticles(rows, color, r.left, r.top, 1.1);
        spawn(scoreText(r.left + r.width / 2, r.top - 6, name === 'pacman' ? '+500' : '+200'));
        sprite.classList.add('gone');
        setTimeout(() => sprite.classList.remove('gone'), 6000);
        played();
        return;
      }
      if (e.target.closest(SKIP)) return;
      if (String(getSelection && getSelection()).length) return;
      spawn(GAMES[gameIdx++ % GAMES.length](e.clientX, e.clientY));
      played();
    });

    // Every so often a Pac-Man parade crosses the bottom of the screen (wide screens only).
    const parade = () => {
      if (!document.hidden && innerWidth >= 1024 && !actors.length) spawn(pacman(-4 * P, innerHeight - 7 * P, 1));
      setTimeout(parade, 45000 + Math.random() * 30000);
    };
    setTimeout(parade, 20000);

    if (!store('ylva-played') && innerWidth >= 1024) {
      setTimeout(() => hint.classList.add('show'), 5000);
      setTimeout(() => hint.classList.remove('show'), 17000);
    }
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
