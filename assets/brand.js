// Ylva Labs brand guidelines: generates the pixel grids (logo mark, band motif,
// icons, colour swatches) for brand.html. Every pixel is one solid colour.
(() => {
  const SEED = 3;   // band motif variant
  const H = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), s = t => t * t * (3 - 2 * t), a = s(x - xi), b = s(y - yi), l = (p, q, t) => p + (q - p) * t;
    return l(l(H(xi + SEED * 131, yi), H(xi + 1 + SEED * 131, yi), a), l(H(xi + SEED * 131, yi + 1), H(xi + 1 + SEED * 131, yi + 1), a), b);
  };
  const ZONES = ['#9fd4ff', '#5aa9e6', '#2f5bd3', '#1d2126', '#8a929c'];

  // Organism band: diagonal ribbon (amp 1) or horizontal strip (amp 2) with flat colour zones.
  const band = (cols, rows, amp = 1) => {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const nx = c / cols, ny = r / rows;
      const cy = amp === 1 ? .08 + .8 * nx + .07 * Math.sin(nx * 10) : .5 + .18 * Math.sin(nx * 7 + SEED);
      const d = (ny - cy) / (amp === 1 ? .36 - .12 * nx : .42);
      const n = vn(c * .13, r * .13) * .65 + vn(c * .3, r * .3) * .35;
      const f = (1 - d * d) * .8 + (n - .5) * 1.3;
      const lv = (f - .3) / .35;
      let col = '';
      if (lv > 0) {
        if (lv * 1.4 > bayer(c, r)) {
          const z = d * .55 + (n - .5) * 2.2;
          col = ZONES[Math.max(0, Math.min(4, Math.floor((z + 1) / 2 * 5)))];
        }
      } else if (lv > -.7 && H(c + SEED, r + 99) < .014) col = '#f6d36d';
      out.push(col);
    }
    return out;
  };
  const px = (rows, map) => rows.flatMap(row => [...row].map(ch => map[ch] || ''));

  const A = ['##.b', '##bb', '.b##', 'bb##'];
  const BM = {
    werkstatt: ['.....##.....', '....####....', '...######...', '..########..', '.##########.', '############', '.#........#.', '.#.++..##.#.', '.#.++..##.#.', '.#.....##.#.', '.#.....##.#.', '############'],
    mikro: ['....####....', '...#++++#...', '...#++++#...', '...#++++#...', '...#++++#...', '...######...', '.#.######.#.', '.#..####..#.', '..#......#..', '...######...', '.....##.....', '...######...'],
    aehre: ['.....#......', '....#.#.....', '...#.#.#....', '....###.....', '...#.#.#....', '....###.....', '...#.#.#....', '....###.....', '.....#......', '.....#......', '...#####....', '..#######...'],
    blitz: ['.......####.', '......####..', '.....####...', '....####....', '...########.', '..########..', '.....####...', '....####....', '...###......', '..##........', '.#..........', '............'],
    herz: ['............', '.###....###.', '#####..#####', '############', '#####++#####', '####++++####', '.##########.', '..########..', '...######...', '....####....', '.....##.....', '............']
  };
  const blue = { '#': '#5aa9e6' };
  const LABELS = { werkstatt: 'Werkstatt', mikro: 'Sprache', aehre: 'Landwirtschaft', blitz: 'Talente', herz: 'Förderer' };

  const GRIDS = {
    markA: () => px(A, { '#': '#1d2126', b: '#5aa9e6' }),
    markAInv: () => px(A, { '#': '#ffffff', b: '#8fd0ff' }),
    markAOnBlue: () => px(A, { '#': '#1d2126', b: '#ffffff' }),
    band: () => band(96, 24),
    bandStrip: () => band(48, 7, 2),
    bandBanner: () => band(24, 6, 2),
    iconWerkstatt: () => px(BM.werkstatt, blue)
  };

  // Fill a grid container with one div per pixel ("" = pixel off).
  const paint = (el, colors) => {
    const frag = document.createDocumentFragment();
    colors.forEach(c => {
      const d = document.createElement('div');
      if (c) d.style.background = c;
      frag.appendChild(d);
    });
    el.replaceChildren(frag);
  };
  document.querySelectorAll('[data-grid]').forEach(el => {
    const make = GRIDS[el.dataset.grid];
    if (make) paint(el, make());
  });

  // Icon row (05 · Pixelsprache)
  const icons = document.getElementById('icons');
  if (icons) {
    Object.keys(BM).forEach(k => {
      const item = document.createElement('div');
      item.className = 'icon-item';
      item.innerHTML = '<div class="icon-tile"><div class="px-grid icon-grid"></div></div><span class="mono muted"></span>';
      paint(item.querySelector('.icon-grid'), px(BM[k], blue));
      item.querySelector('span').textContent = LABELS[k];
      icons.appendChild(item);
    });
  }

  // Colour swatches (03 · Farbe)
  const SWATCHES = [
    { name: 'Paper', hex: '#FFFFFF', role: 'Hintergrund' },
    { name: 'Tint', hex: '#F1F4F7', role: 'Flächen, Karten' },
    { name: 'Ink', hex: '#1D2126', role: 'Text, dunkle Flächen' },
    { name: 'Body', hex: '#5B636C', role: 'Fließtext' },
    { name: 'Muted', hex: '#8A929C', role: 'Labels, Meta' },
    { name: 'Deep', hex: '#4A525C', role: 'Pills, Sekundärflächen' },
    { name: 'Pixel-Blau', hex: '#5AA9E6', role: 'Die eine Pixelfarbe' },
    { name: 'Hellblau', hex: '#8FD0FF', role: 'Akzent, Hover' },
    { name: 'Eisblau', hex: '#D4ECFF', role: 'Helle Akzentfläche' },
    { name: 'Spore', hex: '#F6D36D', role: 'Nur einzelne Pixel' }
  ];
  const sw = document.getElementById('swatches');
  if (sw) {
    SWATCHES.forEach(s => {
      const item = document.createElement('div');
      item.className = 'swatch';
      item.innerHTML = '<div class="swatch-chip"></div><div><div class="swatch-name"></div><div class="swatch-hex mono muted"></div><div class="swatch-role"></div></div>';
      item.querySelector('.swatch-chip').style.background = s.hex;
      item.querySelector('.swatch-name').textContent = s.name;
      item.querySelector('.swatch-hex').textContent = s.hex;
      item.querySelector('.swatch-role').textContent = s.role;
      sw.appendChild(item);
    });
  }
})();
