/* =========================================================
   HbdForSiImut — script.js
   Semua logic ada di file ini, dibagi per bagian:

   0. Pengaturan (CONFIG)      7.  Candle + Microphone + Fallback
   1. Helper                   8.  Birthday message
   2. Scroll lock              9.  Music player (playlist, progress, volume)
   3. Dekorasi (petal/bunga)   10. Gallery Jungwon & Raka
   4. Audio: fade & volume     11. Lightbox
   5. Landing & tombol Open    12. Scroll reveal
   6. Transisi bunga/curtain   13. Mulai (init)
   ========================================================= */

(() => {
  'use strict';

  /* =======================================================
     0. PENGATURAN — ubah path / judul / angka di sini saja
     ======================================================= */
  const CONFIG = {
    // Musik latar (mulai setelah tombol Open ditekan)
    bgm: { src: 'assets/music/sempurna.mp3', volume: 0.6, fadeInMs: 4500 },

    // Ducking: seberapa kecil musik latar saat ada suara lain (0 = mati, 1 = normal)
    duck: { playlist: 0.12, listening: 0.3, downMs: 1400, upMs: 2000 },

    // Sensitivitas tiup lilin. Kalau lilin terlalu susah mati, kecilkan minLevel / factor.
    blow: { minLevel: 0.08, factor: 3, holdMs: 450, calibrateMs: 700, showButtonAfterMs: 12000 },

    // Playlist (cover tanpa ekstensi: .jpeg / .jpg / .png / .webp dicoba otomatis)
    playlist: [
      { title: 'Shout Out', artist: 'ENHYPEN', src: 'assets/music/lagu-1.mp3', cover: 'assets/covers/cover-1' },
      { title: 'Bite Me',   artist: 'ENHYPEN', src: 'assets/music/lagu-2.mp3', cover: 'assets/covers/cover-2' },
      { title: 'Loose',     artist: 'ENHYPEN', src: 'assets/music/lagu-3.mp3', cover: 'assets/covers/cover-3' }
    ],

    // Gallery: foto dibaca dari  dir + prefix + nomor + ekstensi  (contoh: .../jungwon-1.jpeg)
    galleries: [
      { id: 'jungwon', label: 'Jungwon', dir: 'assets/PacalZyan/jungwon/', prefix: 'jungwon-', count: 7 },
      { id: 'raka',    label: 'Raka',    dir: 'assets/PacalZyan/raka/',    prefix: 'raka-',    count: 7 }
    ],

    // Ekstensi foto yang dicoba berurutan. Jadi .jpeg / .jpg / .png / .webp semuanya aman.
    imageExts: ['.jpeg', '.jpg', '.png', '.webp'],

    // Dekorasi opsional dari assets/decorations/. Kosong = pakai bunga/kelopak bawaan (SVG).
    // Contoh: petals: ['assets/decorations/petals/petal-1.png', 'assets/decorations/petals/petal-2.png']
    decor: { petals: [], flowers: [], leaves: [] }
  };

  const SECTIONS_AFTER_CAKE = ['birthday', 'music', 'jungwon-gallery', 'raka-gallery', 'message'];
  const PETAL_COLORS = ['#ffffff', '#e6f1fd', '#dcebfb', '#cfe3f8', '#bcd7f2'];


  /* =======================================================
     1. HELPER
     ======================================================= */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const wait  = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const rand  = (a, b) => a + Math.random() * (b - a);
  const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Format detik -> m:ss */
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  /** Pasang gambar dengan mencoba beberapa ekstensi. Kalau semua gagal -> onFail(). */
  function setImage(img, basePath, onFail) {
    let i = 0;
    const tryNext = () => {
      if (i >= CONFIG.imageExts.length) {
        img.onerror = null;
        img.removeAttribute('src');
        if (onFail) onFail();
        return;
      }
      img.src = basePath + CONFIG.imageExts[i++];
    };
    img.onerror = tryNext;
    tryNext();
  }

  /** Pesan kecil di bawah layar */
  let toastTimer = 0;
  function showToast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 3200);
  }


  /* =======================================================
     2. SCROLL LOCK
     Beberapa "alasan" bisa mengunci scroll bersamaan (intro, lightbox).
     Scroll baru terbuka kalau semua alasan sudah dilepas.
     ======================================================= */
  const scrollLocks = new Set();

  function applyScrollLock() {
    document.documentElement.classList.toggle('is-scroll-locked', scrollLocks.size > 0);
  }
  function lockScroll(reason) { scrollLocks.add(reason); applyScrollLock(); }
  function unlockScroll(reason) { scrollLocks.delete(reason); applyScrollLock(); }

  // iOS Safari kadang tetap bisa scroll walau overflow:hidden, jadi kita blok juga eventnya
  function blockWhenLocked(e) { if (scrollLocks.size > 0) e.preventDefault(); }
  window.addEventListener('touchmove', blockWhenLocked, { passive: false });
  window.addEventListener('wheel', blockWhenLocked, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (scrollLocks.size === 0) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
    if ([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) e.preventDefault();
  });


  /* =======================================================
     3. DEKORASI (kelopak & bunga)
     Pakai file dari assets/decorations kalau diisi di CONFIG.decor,
     kalau tidak ada / gagal dimuat -> pakai SVG bawaan. Tidak pernah error.
     ======================================================= */
  function makeDecor(kind, symbolId) {
    const list = CONFIG.decor[kind] || [];
    const wrap = document.createElement('span');
    wrap.className = 'decor';

    const drawSvg = () => {
      wrap.innerHTML = '<svg aria-hidden="true" focusable="false"><use href="#' + symbolId + '"></use></svg>';
    };

    if (list.length > 0) {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.onerror = () => { img.remove(); drawSvg(); };
      img.src = pick(list);
      wrap.appendChild(img);
    } else {
      drawSvg();
    }
    return wrap;
  }

  /** Kelopak yang melayang pelan di dalam sebuah section */
  function fillPetalLayer(layer, count) {
    if (!layer || reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const p = makeDecor('petals', 'petal');
      p.classList.add('petal');
      p.style.setProperty('--x', rand(2, 96).toFixed(1) + '%');
      p.style.setProperty('--size', rand(11, 20).toFixed(1) + 'px');
      p.style.setProperty('--dur', rand(15, 26).toFixed(1) + 's');
      p.style.setProperty('--delay', (-rand(0, 26)).toFixed(1) + 's');
      p.style.setProperty('--rot', rand(0, 360).toFixed(0) + 'deg');
      p.style.setProperty('--drift', rand(-60, 80).toFixed(0) + 'px');
      p.style.setProperty('--petal', pick(PETAL_COLORS));
      layer.appendChild(p);
    }
    // Hemat baterai: animasi berhenti kalau section tidak terlihat
    if ('IntersectionObserver' in window && layer.parentElement) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => layer.classList.toggle('is-paused', !en.isIntersecting));
      }).observe(layer.parentElement);
    }
  }


  /* =======================================================
     4. AUDIO: volume control & fade
     Di iPhone, audio.volume tidak bisa diubah (selalu 1).
     Jadi di iPhone volume diatur lewat Web Audio (GainNode).
     Di Android / desktop cukup pakai audio.volume.
     ======================================================= */
  let audioCtx = null;
  function getAudioContext() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  const canSetVolume = (() => {
    try { const a = new Audio(); a.volume = 0.5; return a.volume === 0.5; }
    catch (e) { return true; }
  })();

  function createVolumeControl(audio) {
    const ctrl = { value: 1, gain: null, raf: 0 };

    if (!canSetVolume) {
      const ctx = getAudioContext();
      if (ctx) {
        try {
          const source = ctx.createMediaElementSource(audio);
          ctrl.gain = ctx.createGain();
          source.connect(ctrl.gain);
          ctrl.gain.connect(ctx.destination);
        } catch (e) { ctrl.gain = null; }
      }
    }

    ctrl.set = (v) => {
      ctrl.value = clamp(v, 0, 1);
      if (ctrl.gain) ctrl.gain.gain.value = ctrl.value;
      else audio.volume = ctrl.value;
    };
    return ctrl;
  }

  /** Ubah volume pelan-pelan dari nilai sekarang ke target */
  function fadeTo(ctrl, target, ms) {
    cancelAnimationFrame(ctrl.raf);
    const from = ctrl.value;
    if (ms <= 0 || from === target) { ctrl.set(target); return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp((now - t0) / ms, 0, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out
      ctrl.set(from + (target - from) * eased);
      if (t < 1) ctrl.raf = requestAnimationFrame(step);
    };
    ctrl.raf = requestAnimationFrame(step);
  }

  /* ---- Background music (sempurna.mp3) ---- */
  const bgm = {
    audio: null,
    ctrl: null,
    factors: { listening: 1, playlist: 1 } // pengali volume dari ducking
  };

  const player = {
    audio: new Audio(),
    ctrl: null,
    index: 0,
    needsSrc: true,
    dragging: false,
    muted: false,
    volume: 0.8,
    duckTimer: 0
  };

  let audioReady = false;

  /** Dipanggil SEKALI saat Open ditekan (butuh gesture user, aturan autoplay) */
  function initAudioSystem() {
    if (audioReady) return;
    audioReady = true;

    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

    bgm.audio = new Audio(CONFIG.bgm.src);
    bgm.audio.loop = true;
    bgm.audio.preload = 'auto';
    bgm.ctrl = createVolumeControl(bgm.audio);
    bgm.ctrl.set(0); // mulai dari senyap

    player.audio.preload = 'none';
    player.ctrl = createVolumeControl(player.audio);
    applyPlayerVolume();
  }

  function bgmTargetVolume() {
    return CONFIG.bgm.volume * bgm.factors.listening * bgm.factors.playlist;
  }
  function refreshBgmVolume(ms) {
    if (bgm.ctrl) fadeTo(bgm.ctrl, bgmTargetVolume(), ms);
  }

  function startBackgroundMusic() {
    const p = bgm.audio.play();
    if (p && p.catch) p.catch((err) => console.warn('[musik latar] tidak bisa diputar:', err && err.message));
    refreshBgmVolume(CONFIG.bgm.fadeInMs); // fade-in perlahan
  }


  /* =======================================================
     5. LANDING & TOMBOL OPEN
     ======================================================= */
  const cake = {
    root: null, svg: null, candles: [], status: null, fallbackBtn: null,
    blown: false, fallbackTimer: 0
  };

  function initLanding() {
    const openBtn = $('#open-btn');
    if (openBtn) openBtn.addEventListener('click', onOpen, { once: true });
  }

  async function onOpen() {
    const openBtn = $('#open-btn');
    openBtn.disabled = true;
    $('#landing').classList.add('is-leaving');

    // Urutan ini penting: audio harus dimulai langsung di dalam klik user
    initAudioSystem();
    startBackgroundMusic();

    await runCurtain(showCakeScene, () => cake.root.classList.add('is-ready'));
    beginCakeInteraction();
  }

  function showCakeScene() {
    $('#landing').hidden = true;
    cake.root.hidden = false;
    window.scrollTo(0, 0);
  }


  /* =======================================================
     6. TRANSISI BUNGA / PETAL (curtain)
     Dua panel berbunga menutup dari kiri & kanan, layar berganti
     di belakangnya, lalu panel membuka lagi.
     ======================================================= */
  function buildCurtain() {
    const curtain = $('#curtain');
    if (!curtain) return;

    [['left', 'right'], ['right', 'left']].forEach(([side, innerEdge]) => {
      const panel = $('.curtain-' + side, curtain);
      if (!panel) return;

      // daun (di belakang)
      for (let i = 0; i < 6; i++) {
        const leaf = makeDecor('leaves', 'leaf');
        const w = rand(80, 130);
        leaf.classList.add('curtain-flower');
        leaf.style.width = w + 'px';
        leaf.style.height = w / 2 + 'px';
        leaf.style.top = ((i + 0.5) / 6) * 100 + '%';
        leaf.style[innerEdge] = -w * rand(0.1, 0.4) + 'px';
        leaf.style.transform = 'translateY(-50%) rotate(' + rand(-50, 50) + 'deg)';
        panel.appendChild(leaf);
      }

      // bunga besar di pinggir tengah (tempat dua panel bertemu)
      const big = 8;
      for (let i = 0; i < big; i++) {
        const size = rand(110, 190);
        const f = makeDecor('flowers', 'flower');
        f.classList.add('curtain-flower');
        f.style.width = f.style.height = size + 'px';
        f.style.top = ((i + 0.5) / big) * 100 + rand(-3, 3) + '%';
        f.style[innerEdge] = -size * rand(0.35, 0.6) + 'px';
        f.style.setProperty('--petal', pick(PETAL_COLORS));
        f.style.transform = 'translateY(-50%) rotate(' + rand(0, 360) + 'deg)';
        panel.appendChild(f);
      }

      // bunga lebih kecil di dalam panel supaya penuh
      const small = 6;
      for (let i = 0; i < small; i++) {
        const size = rand(70, 120);
        const f = makeDecor('flowers', 'flower');
        f.classList.add('curtain-flower');
        f.style.width = f.style.height = size + 'px';
        f.style.top = ((i + 0.5) / small) * 100 + rand(-5, 5) + '%';
        f.style[innerEdge] = rand(30, 90) + 'px';
        f.style.setProperty('--petal', pick(PETAL_COLORS));
        f.style.transform = 'translateY(-50%) rotate(' + rand(0, 360) + 'deg)';
        panel.appendChild(f);
      }
    });
  }

  /** Kelopak beterbangan dari kiri & kanan saat curtain menutup */
  function burstPetals(count) {
    if (reducedMotion || !document.body.animate) return;
    const fx = $('#fx');
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < count; i++) {
      const p = makeDecor('petals', 'petal');
      const size = rand(14, 28);
      p.classList.add('fx-piece');
      p.style.width = size + 'px';
      p.style.height = size * 1.4 + 'px';
      p.style.setProperty('--petal', pick(PETAL_COLORS));
      fx.appendChild(p);

      const fromLeft = i % 2 === 0;
      const x0 = fromLeft ? -40 : w + 40;
      const y0 = rand(0.05, 0.95) * h;
      const x1 = w * 0.5 + rand(-w * 0.28, w * 0.28);
      const y1 = y0 + rand(-h * 0.2, h * 0.3);
      const r0 = rand(0, 360);
      const r1 = r0 + rand(-260, 260);

      p.animate([
        { transform: 'translate(' + x0 + 'px,' + y0 + 'px) rotate(' + r0 + 'deg)', opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { transform: 'translate(' + x1 + 'px,' + y1 + 'px) rotate(' + r1 + 'deg)', opacity: 1, offset: 0.75 },
        { transform: 'translate(' + x1 + 'px,' + (y1 + 40) + 'px) rotate(' + (r1 + 40) + 'deg)', opacity: 0 }
      ], {
        duration: rand(1500, 2400),
        delay: rand(0, 500),
        easing: 'cubic-bezier(0.3, 0.6, 0.3, 1)',
        fill: 'both'
      }).onfinish = () => p.remove();
    }
  }

  /**
   * swap()      dipanggil saat layar tertutup penuh (ganti landing -> cake)
   * onOpening() dipanggil tepat saat panel mulai membuka
   */
  async function runCurtain(swap, onOpening) {
    const curtain = $('#curtain');
    const slideMs = reducedMotion ? 200 : 1500;

    curtain.classList.add('is-active');
    void curtain.offsetWidth;                 // paksa browser membaca posisi awal dulu
    curtain.classList.add('is-closed');       // panel menutup
    burstPetals(26);

    await wait(slideMs + 120);
    swap();
    await wait(reducedMotion ? 100 : 450);

    curtain.classList.remove('is-closed');    // panel membuka
    if (onOpening) onOpening();
    await wait(slideMs + 120);
    curtain.classList.remove('is-active');
  }


  /* =======================================================
     7. CANDLE + MICROPHONE + FALLBACK BUTTON
     ======================================================= */
  const mic = {
    stream: null, source: null, analyser: null, data: null,
    raf: 0, active: false, last: 0,
    baseline: 0.01, held: 0, calibrateUntil: 0, lean: 0
  };

  function initCake() {
    cake.root = $('#cake');
    cake.svg = $('#cake-svg');
    cake.candles = $$('.candle', cake.svg);
    cake.status = $('#cake-status');
    cake.fallbackBtn = $('#candle-btn');
    cake.fallbackBtn.addEventListener('click', blowOut);
  }

  async function beginCakeInteraction() {
    await wait(reducedMotion ? 200 : 900); // biarkan cake muncul dulu
    if (cake.blown) return;

    cake.status.textContent = 'Izinkan mikrofon supaya bisa tiup lilin 🎤';
    // Jaga-jaga: kalau susah ditiup / izin tidak dijawab, tombol tetap muncul
    cake.fallbackTimer = setTimeout(() => {
      if (cake.blown) return;
      if (mic.active) cake.status.textContent = 'Susah ya? Pakai tombol ini juga boleh 🙂';
      showFallbackButton();
    }, CONFIG.blow.showButtonAfterMs);

    const ok = await startMic();
    if (cake.blown) return;

    if (ok) {
      cake.status.textContent = 'Tiup ke arah mic HP kamu 🎤';
    } else {
      cake.status.textContent = 'Mic tidak bisa dipakai, pakai tombol di bawah ya.';
      showFallbackButton();
    }
  }

  function showFallbackButton() {
    const btn = cake.fallbackBtn;
    if (!btn.hidden) return;
    btn.classList.add('enter');
    btn.hidden = false;
  }

  /* ---- Microphone ---- */
  async function startMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }
      });
    } catch (err) {
      return false; // izin ditolak / tidak ada mic -> pakai tombol
    }

    // Kalau selama menunggu izin lilin sudah dimatikan pakai tombol
    if (cake.blown) { stream.getTracks().forEach((t) => t.stop()); return false; }

    const ctx = getAudioContext();
    if (!ctx) { stream.getTracks().forEach((t) => t.stop()); return false; }
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* abaikan */ } }

    try {
      mic.stream = stream;
      mic.source = ctx.createMediaStreamSource(stream);
      mic.analyser = ctx.createAnalyser();
      mic.analyser.fftSize = 1024;
      mic.analyser.smoothingTimeConstant = 0.2;
      mic.source.connect(mic.analyser);           // tidak disambung ke speaker
      mic.data = new Uint8Array(mic.analyser.fftSize);
    } catch (e) {
      stopMic();
      return false;
    }

    mic.active = true;
    mic.baseline = 0.01;
    mic.held = 0;
    mic.lean = 0;
    mic.last = performance.now();
    mic.calibrateUntil = mic.last + CONFIG.blow.calibrateMs;

    // Musik latar dikecilkan sebentar supaya tidak dikira tiupan
    bgm.factors.listening = CONFIG.duck.listening;
    refreshBgmVolume(CONFIG.duck.downMs);

    mic.raf = requestAnimationFrame(micLoop);
    return true;
  }

  function micLoop(now) {
    if (!mic.active) return;
    mic.raf = requestAnimationFrame(micLoop);

    // Hitung "keras suara" (RMS 0..1)
    mic.analyser.getByteTimeDomainData(mic.data);
    let sum = 0;
    for (let i = 0; i < mic.data.length; i++) {
      const v = (mic.data[i] - 128) / 128;
      sum += v * v;
    }
    const level = Math.sqrt(sum / mic.data.length);
    const dt = Math.min(now - mic.last, 100);
    mic.last = now;

    // 0,7 detik pertama: pelajari dulu suara ruangan
    if (now < mic.calibrateUntil) {
      mic.baseline = mic.baseline * 0.9 + level * 0.1;
      return;
    }

    const threshold = Math.max(CONFIG.blow.minLevel, mic.baseline * CONFIG.blow.factor);
    const blowing = level > threshold;

    if (blowing) {
      mic.held += dt;                                      // tiupan harus bertahan sebentar
    } else {
      mic.held = Math.max(0, mic.held - dt * 0.6);
      mic.baseline = mic.baseline * 0.97 + level * 0.03;   // ikuti suara ruangan pelan-pelan
    }

    // Api ikut miring sesuai kerasnya tiupan
    setFlameLean(blowing ? clamp((level / threshold) * 7, 6, 22) : 0);

    if (mic.held >= CONFIG.blow.holdMs) blowOut();
  }

  function setFlameLean(deg) {
    if (Math.abs(deg - mic.lean) < 0.5) return;
    mic.lean = deg;
    cake.svg.style.setProperty('--lean', deg.toFixed(1) + 'deg');
  }

  function stopMic() {
    mic.active = false;
    cancelAnimationFrame(mic.raf);
    if (mic.source) { try { mic.source.disconnect(); } catch (e) { /* abaikan */ } mic.source = null; }
    if (mic.stream) { mic.stream.getTracks().forEach((t) => t.stop()); mic.stream = null; }
    if (bgm.factors.listening !== 1) {
      bgm.factors.listening = 1;
      refreshBgmVolume(CONFIG.duck.upMs);
    }
  }

  /* ---- Lilin padam ---- */
  function blowOut() {
    if (cake.blown) return;
    cake.blown = true;

    clearTimeout(cake.fallbackTimer);
    stopMic();
    cake.svg.style.setProperty('--lean', '0deg');
    cake.fallbackBtn.hidden = true;
    cake.status.textContent = '';

    // api padam satu per satu
    cake.candles.forEach((candle, i) => {
      setTimeout(() => candle.classList.add('is-out'), reducedMotion ? 0 : i * 150);
    });

    setTimeout(afterCandlesOut, reducedMotion ? 200 : cake.candles.length * 150 + 500);
  }

  function afterCandlesOut() {
    cake.root.classList.add('is-blown');
    $('#cake-title').textContent = 'Semoga wish kamu terkabul ✨';
    $('#cake-hint').textContent = 'Masih ada sedikit lagi di bawah 🤍';

    confettiBurst();
    revealRestOfPage();
  }

  /** Confetti + kelopak kecil dari arah kue */
  function confettiBurst() {
    if (reducedMotion || !document.body.animate) return;
    const fx = $('#fx');
    const rect = cake.svg.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height * 0.3;
    const colors = ['#ffffff', '#bcd7f2', '#7aa7d9', '#4f7fb5', '#ffd27a', '#dcebfb'];

    for (let i = 0; i < 44; i++) {
      let el;
      if (i % 4 === 0) {
        el = makeDecor('petals', 'petal');
        const s = rand(14, 22);
        el.style.width = s + 'px';
        el.style.height = s * 1.4 + 'px';
        el.style.setProperty('--petal', pick(PETAL_COLORS));
      } else {
        el = document.createElement('span');
        el.style.width = rand(6, 10) + 'px';
        el.style.height = rand(10, 16) + 'px';
        el.style.borderRadius = '2px';
        el.style.background = pick(colors);
      }
      el.classList.add('fx-piece');
      fx.appendChild(el);

      const angle = rand(-150, -30) * Math.PI / 180;    // ke arah atas
      const speed = rand(140, 340);
      const px = ox + Math.cos(angle) * speed;
      const py = oy + Math.sin(angle) * speed;
      const endX = px + rand(-70, 70);
      const endY = py + rand(220, 420);
      const r1 = rand(-360, 360);

      el.animate([
        { transform: 'translate(' + ox + 'px,' + oy + 'px) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(0.15, 0.8, 0.35, 1)' },
        { transform: 'translate(' + px + 'px,' + py + 'px) rotate(' + r1 * 0.5 + 'deg)', opacity: 1, offset: 0.38, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
        { transform: 'translate(' + endX + 'px,' + endY + 'px) rotate(' + r1 + 'deg)', opacity: 0 }
      ], { duration: rand(1900, 2800), fill: 'both' }).onfinish = () => el.remove();
    }
  }

  /** Buka bagian website lain & lanjutkan ke ucapan */
  function revealRestOfPage() {
    SECTIONS_AFTER_CAKE.forEach((id) => { const s = document.getElementById(id); if (s) s.hidden = false; });
    unlockScroll('intro');

    // Geser otomatis ke ucapan (kecuali dia sudah scroll sendiri)
    setTimeout(() => {
      if (window.scrollY < 40) {
        const target = document.getElementById('birthday');
        if (target) target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }, reducedMotion ? 300 : 2600);
  }


  /* =======================================================
     8. BIRTHDAY MESSAGE
     Teks ada langsung di index.html (section #birthday).
     Di sini hanya kelopak halus di latar belakangnya.
     ======================================================= */
  function initBirthday() {
    fillPetalLayer($('#birthday .petal-layer'), 8);
  }


  /* =======================================================
     9. MUSIC PLAYER (mini "spotify")
     ======================================================= */
  const ui = {}; // elemen-elemen player, diisi di initPlayer()

  function initPlayer() {
    ui.card = $('#player');
    ui.cover = $('#pl-cover');
    ui.coverWrap = $('.player-cover', ui.card);
    ui.title = $('#pl-title');
    ui.artist = $('#pl-artist');
    ui.status = $('#pl-status');
    ui.progress = $('#pl-progress');
    ui.current = $('#pl-current');
    ui.duration = $('#pl-duration');
    ui.prev = $('#pl-prev');
    ui.play = $('#pl-play');
    ui.next = $('#pl-next');
    ui.mute = $('#pl-mute');
    ui.volume = $('#pl-volume');
    ui.list = $('#pl-list');

    buildPlaylist();
    selectTrack(0);
    setRangeFill(ui.progress);
    setRangeFill(ui.volume);

    /* tombol */
    ui.play.addEventListener('click', togglePlay);
    ui.next.addEventListener('click', () => changeTrack(1, !player.audio.paused));
    ui.prev.addEventListener('click', () => {
      // seperti player biasa: kalau sudah lewat 3 detik, ulang lagu ini dulu
      if (player.audio.currentTime > 3) { player.audio.currentTime = 0; return; }
      changeTrack(-1, !player.audio.paused);
    });

    /* progress bar */
    ui.progress.addEventListener('input', () => {
      player.dragging = true;
      setRangeFill(ui.progress);
      const d = player.audio.duration;
      if (isFinite(d)) ui.current.textContent = formatTime((ui.progress.value / 1000) * d);
    });
    ui.progress.addEventListener('change', () => {
      const d = player.audio.duration;
      if (isFinite(d) && d > 0) player.audio.currentTime = (ui.progress.value / 1000) * d;
      player.dragging = false;
    });

    /* volume playlist */
    ui.volume.addEventListener('input', () => {
      player.volume = ui.volume.value / 100;
      player.muted = false;
      applyPlayerVolume();
    });
    ui.mute.addEventListener('click', () => {
      player.muted = !player.muted;
      applyPlayerVolume();
    });

    /* event dari elemen audio */
    const a = player.audio;
    a.addEventListener('play', () => { setPlayingUI(true); setPlaylistDuck(true); setPlayerStatus(''); });
    a.addEventListener('pause', () => { setPlayingUI(false); setPlaylistDuck(false); });
    a.addEventListener('ended', onTrackEnded);
    a.addEventListener('timeupdate', updateProgressUI);
    a.addEventListener('loadedmetadata', updateDuration);
    a.addEventListener('durationchange', updateDuration);
    a.addEventListener('error', () => setPlayerStatus('Lagu ini belum bisa diputar.'));
  }

  function buildPlaylist() {
    ui.list.innerHTML = '';
    CONFIG.playlist.forEach((track, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'track';
      btn.dataset.index = i;
      btn.setAttribute('aria-label', 'Putar ' + track.title + ' oleh ' + track.artist);

      const thumb = document.createElement('span');
      thumb.className = 'track-thumb';
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
      setImage(img, track.cover, () => thumb.classList.add('is-empty'));

      const text = document.createElement('span');
      const t = document.createElement('span');
      t.className = 'track-title';
      t.textContent = track.title;
      const ar = document.createElement('span');
      ar.className = 'track-artist';
      ar.textContent = track.artist;
      text.append(t, ar);

      const eq = document.createElement('span');
      eq.className = 'eq';
      eq.setAttribute('aria-hidden', 'true');
      eq.innerHTML = '<span></span><span></span><span></span>';

      btn.append(thumb, text, eq);
      btn.addEventListener('click', () => {
        if (i === player.index && !player.audio.paused) { player.audio.pause(); return; }
        if (i !== player.index) selectTrack(i);
        playTrack();
      });
      li.appendChild(btn);
      ui.list.appendChild(li);
    });
  }

  /** Ganti lagu yang aktif (tampilan saja; file baru dimuat saat diputar) */
  function selectTrack(i) {
    const n = CONFIG.playlist.length;
    player.index = ((i % n) + n) % n;
    player.needsSrc = true;
    const track = CONFIG.playlist[player.index];

    ui.title.textContent = track.title;
    ui.artist.textContent = track.artist;
    ui.coverWrap.classList.remove('is-empty');
    ui.cover.alt = 'Cover ' + track.title;
    setImage(ui.cover, track.cover, () => ui.coverWrap.classList.add('is-empty'));

    $$('.track', ui.list).forEach((el, idx) => el.classList.toggle('is-active', idx === player.index));

    ui.progress.value = 0;
    setRangeFill(ui.progress);
    ui.current.textContent = '0:00';
    ui.duration.textContent = '0:00';
    setPlayerStatus('');
  }

  function ensureSrc() {
    if (!player.needsSrc) return;
    player.audio.src = CONFIG.playlist[player.index].src;
    player.needsSrc = false;
  }

  function playTrack() {
    ensureSrc();
    const p = player.audio.play();
    if (p && p.catch) {
      p.catch((err) => {
        if (err && err.name === 'AbortError') return; // normal saat ganti lagu cepat
        setPlayerStatus('Lagu ini belum bisa diputar.');
      });
    }
  }

  function togglePlay() {
    if (player.audio.paused) playTrack();
    else player.audio.pause();
  }

  function changeTrack(dir, autoplay) {
    selectTrack(player.index + dir);
    if (autoplay) playTrack();
  }

  function onTrackEnded() {
    const isLast = player.index === CONFIG.playlist.length - 1;
    if (isLast) {
      selectTrack(0);              // kembali ke lagu pertama, berhenti
      setPlayingUI(false);
      setPlaylistDuck(false);
    } else {
      changeTrack(1, true);        // lanjut otomatis
    }
  }

  function setPlayingUI(isPlaying) {
    ui.card.classList.toggle('is-playing', isPlaying);
    ui.play.setAttribute('aria-label', isPlaying ? 'Jeda' : 'Putar');
  }

  function setPlayerStatus(text) { ui.status.textContent = text; }

  /* ---- Progress bar ---- */
  function setRangeFill(input) {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    input.style.setProperty('--p', ((input.value - min) / (max - min)) * 100 + '%');
  }

  function updateProgressUI() {
    if (player.dragging) return;
    const d = player.audio.duration;
    const t = player.audio.currentTime;
    ui.progress.value = isFinite(d) && d > 0 ? (t / d) * 1000 : 0;
    setRangeFill(ui.progress);
    ui.current.textContent = formatTime(t);
  }

  function updateDuration() {
    ui.duration.textContent = formatTime(player.audio.duration);
  }

  /* ---- Volume playlist ---- */
  function applyPlayerVolume() {
    const effective = player.muted ? 0 : player.volume;
    if (player.ctrl) player.ctrl.set(effective);
    else player.audio.volume = effective;
    if (ui.card) ui.card.classList.toggle('is-muted', effective === 0);
    if (ui.volume) {
      ui.volume.value = Math.round(effective * 100);
      setRangeFill(ui.volume);
    }
  }

  /* ---- Background music ducking ----
     Playlist jalan  -> "Sempurna" turun pelan-pelan
     Playlist berhenti -> "Sempurna" naik pelan-pelan
     Naiknya ditunda sebentar supaya tidak naik-turun saat pindah lagu. */
  function setPlaylistDuck(on) {
    clearTimeout(player.duckTimer);
    if (on) {
      bgm.factors.playlist = CONFIG.duck.playlist;
      refreshBgmVolume(CONFIG.duck.downMs);
    } else {
      player.duckTimer = setTimeout(() => {
        bgm.factors.playlist = 1;
        refreshBgmVolume(CONFIG.duck.upMs);
      }, 350);
    }
  }


  /* =======================================================
     10. GALLERY (Jungwon & Raka)
     Foto dibaca dari CONFIG.galleries. Tiap gallery punya
     daftar sendiri, jadi foto tidak pernah tercampur.
     ======================================================= */
  const galleryItems = {}; // { jungwon: [...], raka: [...] }

  function buildGalleries() {
    CONFIG.galleries.forEach(buildGallery);
  }

  function buildGallery(cfg) {
    const grid = document.getElementById(cfg.id + '-grid');
    if (!grid) return;

    const items = [];
    galleryItems[cfg.id] = items;

    for (let n = 1; n <= cfg.count; n++) {
      const item = { ok: false, src: '', alt: 'Foto ' + cfg.label + ' ' + n };

      const li = document.createElement('li');
      li.className = 'shot reveal';
      li.style.setProperty('--i', n - 1); // untuk staggered reveal

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shot-btn';
      btn.setAttribute('aria-label', 'Buka foto ' + cfg.label + ' ' + n);

      const img = new Image();
      img.alt = item.alt;
      img.decoding = 'async';
      img.loading = 'lazy';
      img.onload = () => {
        item.ok = true;
        item.src = img.currentSrc || img.src;
        btn.classList.add('is-loaded');
      };

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'shot-ico');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<use href="#i-expand"></use>';

      btn.append(img, icon);
      btn.addEventListener('click', () => {
        if (!item.ok) return;
        openLightbox(items, item, btn);
      });

      li.appendChild(btn);
      grid.appendChild(li);
      items.push(item);

      setImage(img, cfg.dir + cfg.prefix + n, () => {
        li.classList.add('is-missing');
        btn.disabled = true;
        btn.setAttribute('aria-label', 'Foto ' + cfg.label + ' ' + n + ' belum ditambahkan');
      });
    }
  }


  /* =======================================================
     11. LIGHTBOX
     ======================================================= */
  const lb = { el: null, img: null, count: null, bar: null, closeBtn: null, list: [], i: 0, opener: null, open: false };

  function initLightbox() {
    lb.el = $('#lightbox');
    lb.img = $('#lb-img');
    lb.count = $('#lb-count');
    lb.bar = $('.lb-bar', lb.el);
    lb.closeBtn = $('#lb-close');

    lb.closeBtn.addEventListener('click', closeLightbox);
    $('#lb-prev').addEventListener('click', () => stepLightbox(-1));
    $('#lb-next').addEventListener('click', () => stepLightbox(1));

    // klik area gelap di luar foto = tutup
    lb.el.addEventListener('click', (e) => { if (e.target === lb.el) closeLightbox(); });

    // keyboard
    document.addEventListener('keydown', (e) => {
      if (!lb.open) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
    });

    // swipe di HP: kiri/kanan = ganti foto, geser ke bawah = tutup
    let sx = 0, sy = 0;
    lb.el.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    }, { passive: true });
    lb.el.addEventListener('touchend', (e) => {
      if (!lb.open || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) stepLightbox(dx < 0 ? 1 : -1);
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) closeLightbox();
    }, { passive: true });
  }

  function openLightbox(items, startItem, opener) {
    lb.list = items.filter((it) => it.ok);           // hanya foto dari gallery ini yang berhasil dimuat
    lb.i = Math.max(0, lb.list.indexOf(startItem));
    lb.opener = opener;
    renderLightbox(false);

    lb.open = true;
    lb.el.inert = false;
    lb.el.classList.add('is-open');
    lockScroll('lightbox');
    lb.closeBtn.focus({ preventScroll: true });
  }

  function closeLightbox() {
    if (!lb.open) return;
    lb.open = false;
    lb.el.classList.remove('is-open');
    lb.el.inert = true;
    unlockScroll('lightbox');
    if (lb.opener) lb.opener.focus({ preventScroll: true });
  }

  function stepLightbox(dir) {
    if (lb.list.length < 2) return;
    lb.i = (lb.i + dir + lb.list.length) % lb.list.length;
    renderLightbox(true);
  }

  function renderLightbox(animate) {
    const item = lb.list[lb.i];
    if (!item) return;
    const show = () => {
      lb.img.src = item.src;
      lb.img.alt = item.alt;
      lb.count.textContent = (lb.i + 1) + ' / ' + lb.list.length;
      lb.bar.classList.toggle('is-single', lb.list.length < 2);
      lb.img.classList.remove('is-swapping');
    };
    if (animate && !reducedMotion) {
      lb.img.classList.add('is-swapping');
      setTimeout(show, 180);
    } else {
      show();
    }
  }


  /* =======================================================
     12. SCROLL REVEAL
     Elemen ber-class .reveal muncul halus saat masuk layar.
     ======================================================= */
  function initScrollReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
  }


  /* =======================================================
     13. MULAI
     ======================================================= */
  function init() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    lockScroll('intro');                       // terkunci sampai lilin padam

    buildCurtain();
    fillPetalLayer($('#landing .petal-layer'), 10);

    initCake();
    initBirthday();
    initPlayer();
    buildGalleries();
    initLightbox();
    initScrollReveal();                        // setelah gallery dibuat
    initLanding();

    const replay = $('#replay-btn');
    if (replay) replay.addEventListener('click', () => window.location.reload());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
