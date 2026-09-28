/* Ylva Labs – pixel games for the footer "play" button.
   Loaded on demand; draws on a canvas behind all content, on the 5px page grid. */
window.YLVA_GAMES = (({ G, snap, fill, ON, HERO }) => {
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


  const play = document.createElement('canvas');
  play.className = 'px-play';
  play.setAttribute('aria-hidden', 'true');
  document.body.appendChild(play);
  const pctx = play.getContext('2d');
  const size = () => {
    const d = Math.min(devicePixelRatio || 1, 2);
    play.width = Math.round(innerWidth * d); play.height = Math.round(innerHeight * d); pctx.dpr = d;
  };
  size();
  addEventListener('resize', size);

  // All actors live in page coordinates and are snapped to the page grid.
  const ctx = pctx;
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
  const spawn = (...list) => { actors.push(...list); wake(); };

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


  // The layer only animates while something is playing.
  let lastT = 0, running = false;
  const frame = ts => {
    const dt = Math.min(0.05, (ts - lastT) / 1000);
    lastT = ts;
    pctx.clearRect(0, 0, play.width, play.height);
    for (let i = actors.length - 1; i >= 0; i--) if (!actors[i].step(dt)) actors.splice(i, 1);
    actors.forEach(a => a.draw());
    if (actors.length) requestAnimationFrame(frame);
    else { running = false; pctx.clearRect(0, 0, play.width, play.height); }
  };
  function wake() { if (running) return; running = true; lastT = performance.now(); requestAnimationFrame(frame); }

  // A little show on top of the footer rubble.
  return function show(anchor) {
    const r = anchor.getBoundingClientRect(), y = r.top + scrollY;
    spawn(pacman(-4 * G, y + 10 * G, 1));
    for (let k = 0; k < 5; k++) setTimeout(() => spawn(tetris(innerWidth * (0.1 + Math.random() * 0.8), y + 12 * G)), 300 + k * 350);
    setTimeout(() => spawn(invader(innerWidth * (0.25 + Math.random() * 0.5), y - 20 * G)), 1200);
  };
})(window.YLVA);
