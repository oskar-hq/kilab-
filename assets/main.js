(() => {
  document.getElementById('year').textContent = new Date().getFullYear();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Generative pixel wave ---------- */
  const canvas = document.getElementById('wave');
  const ctx = canvas.getContext('2d');
  const coord = document.getElementById('coord');
  const CELL = 14, GAP = 2;
  const INK = '#0A0A0A', NEON = '#d8ff00', LINE = 'rgba(10,10,10,.12)';
  let W = 0, H = 0, cols = 0, rows = 0, dpr = 1;
  let mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };
  let visible = true;

  // deterministic per-cell noise for dithering
  const hash = (x, y) => {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
  }

  function height(c, t) {
    const x = c / cols;
    let h = 0.46
      + 0.16 * Math.sin(x * 5.2 + t * 0.55)
      + 0.08 * Math.sin(x * 11.7 - t * 0.9 + 1.3)
      + 0.04 * Math.sin(x * 23.0 + t * 1.6);
    // cursor pushes a swell upward
    const dx = (c * CELL - mouse.x) / 160;
    h += 0.22 * Math.exp(-dx * dx) * (mouse.y > -1e3 ? 1 : 0);
    return h;
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const s = CELL - GAP;
    for (let c = 0; c < cols; c++) {
      const crest = rows - Math.round(height(c, t) * rows);
      for (let r = 0; r < rows; r++) {
        const x = c * CELL, y = r * CELL;
        const d = r - crest; // depth below crest
        if (d < -2) {
          // faint grid above the wave
          if ((c + r) % 4 === 0 && r % 2 === 0) { ctx.fillStyle = LINE; ctx.fillRect(x + s / 2 - 1, y + s / 2 - 1, 2, 2); }
          continue;
        }
        const n = hash(c, r);
        if (d < 0) {
          // spray above the crest
          if (n > 0.82) { ctx.fillStyle = NEON; ctx.fillRect(x, y, s, s); }
          continue;
        }
        if (d < 2) { ctx.fillStyle = NEON; ctx.fillRect(x, y, s, s); continue; }
        // dithered density that grows with depth
        const density = Math.min(1, 0.35 + d / 10);
        if (n < density) {
          ctx.fillStyle = (d < 4 && n > 0.6) ? NEON : INK;
          ctx.fillRect(x, y, s, s);
        }
      }
    }
  }

  let t0 = performance.now();
  function loop(now) {
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    if (visible) draw((now - t0) / 1000);
    requestAnimationFrame(loop);
  }

  canvas.parentElement.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (mouse.tx < -1e3) { mouse.x = x; mouse.y = y; }
    mouse.tx = x; mouse.ty = y;
    coord.textContent = `x ${String(Math.floor(x / CELL)).padStart(3, '0')} · y ${String(Math.floor(y / CELL)).padStart(3, '0')}`;
  });
  canvas.parentElement.addEventListener('pointerleave', () => { mouse.tx = mouse.ty = -1e4; mouse.x = mouse.y = -1e4; coord.textContent = '54°N · 10°E'; });

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  addEventListener('resize', () => { resize(); if (reduce) draw(0); });
  resize();
  if (reduce) draw(0); else requestAnimationFrame(loop);

  /* ---------- Funnel cells ---------- */
  document.querySelectorAll('[data-cells]').forEach(box => {
    const n = +box.dataset.cells, off = +(box.dataset.off || 0), hit = +(box.dataset.hit || 0);
    for (let i = 0; i < n; i++) {
      const cell = document.createElement('i');
      if (i >= n - hit) cell.className = 'hit';
      else if (i >= n - off) cell.className = 'off';
      cell.style.transitionDelay = (i * 25) + 'ms';
      box.appendChild(cell);
    }
  });

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
