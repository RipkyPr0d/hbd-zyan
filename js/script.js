/* =========================================================
   UNTUK JUNGWON — interaction logic
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------
     1. OPEN ANIMATION (shake -> crack -> split)
     --------------------------------------------------- */
  const openBtn        = document.getElementById('openBtn');
  const landing         = document.getElementById('landing');
  const landingContent  = document.getElementById('landingContent');
  const crackOverlay    = document.getElementById('crackOverlay');
  const impactFlash     = document.getElementById('impactFlash');
  const shards          = Array.from(document.querySelectorAll('.shard'));
  const cakeEnter       = document.getElementById('cakeEnter');
  const bgAudio         = document.getElementById('bgAudio');

  // read each shard's fly-out direction/rotation/stagger from its data-* attrs
  shards.forEach(shard => {
    shard.style.setProperty('--tx', shard.dataset.tx);
    shard.style.setProperty('--ty', shard.dataset.ty);
    shard.style.setProperty('--rot', shard.dataset.rot);
  });

  let opened = false;

  openBtn.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    openBtn.disabled = true;

    // 1. shake
    landingContent.classList.add('is-shaking');

    setTimeout(() => {
      // 2. fade out text/button
      landingContent.classList.add('is-fading');

      // 3. crack effect + impact flash at the moment of breaking
      crackOverlay.classList.add('show');
      impactFlash.classList.add('show');

      setTimeout(() => {
        // 4. shards reveal, then each flies apart in its own direction
        shards.forEach(shard => shard.classList.add('reveal'));

        requestAnimationFrame(() => {
          shards.forEach(shard => {
            shard.style.transitionDelay = shard.dataset.delay;
            shard.classList.add('split');
          });
        });

        // 5. after the pieces have flown off, remove landing + unlock cake view
        setTimeout(() => {
          landing.classList.add('is-done');
          document.body.classList.remove('locked');
          document.body.classList.add('candle-lock');
          cakeEnter.classList.add('show');
          startBackgroundMusic();
        }, 1150);

      }, 380);
    }, 480);
  });

  function startBackgroundMusic(){
    bgAudio.volume = 0;
    bgAudio.play().catch(() => {
      // autoplay might be blocked until a further user gesture; harmless
    });
    fadeAudio(bgAudio, 0.55, 1800);
  }

  /* ---------------------------------------------------
     Generic volume fade helper
     --------------------------------------------------- */
  const fadeTimers = new WeakMap();

  function fadeAudio(audioEl, target, duration){
    if (fadeTimers.has(audioEl)) clearInterval(fadeTimers.get(audioEl));
    const start = audioEl.volume;
    const diff = target - start;
    if (diff === 0) return;
    const steps = Math.max(Math.round(duration / 40), 1);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      const t = i / steps;
      audioEl.volume = Math.min(Math.max(start + diff * t, 0), 1);
      if (i >= steps){
        clearInterval(timer);
        fadeTimers.delete(audioEl);
      }
    }, 40);
    fadeTimers.set(audioEl, timer);
  }

  /* ---------------------------------------------------
     2. BIRTHDAY CAKE — candle interaction
     --------------------------------------------------- */
  const candles    = Array.from(document.querySelectorAll('.candle'));
  const cakeStatus = document.getElementById('cakeStatus');
  const cakeEl     = document.getElementById('cake');
  let litCount = candles.length;

  candles.forEach(candle => {
    const flame = candle.querySelector('.flame');
    flame.addEventListener('click', () => extinguish(candle));
    flame.addEventListener('touchstart', (e) => { e.preventDefault(); extinguish(candle); }, { passive: false });
  });

  function extinguish(candle){
    if (candle.dataset.lit === 'false') return;
    candle.dataset.lit = 'false';

    const smoke = document.createElement('div');
    smoke.className = 'smoke';
    candle.appendChild(smoke);
    setTimeout(() => smoke.remove(), 1000);

    litCount--;
    if (litCount > 0){
      cakeStatus.textContent = `${litCount} lilin lagi...`;
    } else {
      allCandlesOut();
    }
  }

  function allCandlesOut(){
    cakeEl.classList.add('all-out');
    cakeStatus.textContent = 'yeay, semoga semua harapannya jadi kenyataan 🤍';

    setTimeout(() => {
      document.body.classList.remove('candle-lock');
    }, 500);
  }

  /* ---------------------------------------------------
     3. MINI SPOTIFY
     --------------------------------------------------- */
  const tracks = [
    { title: 'Shout Out', artist: 'ENHYPEN', src: 'assets/music/lagu-1.mp3', cover: 'assets/images/cover/cover-1.jpeg' },
    { title: 'Bite Me',   artist: 'ENHYPEN', src: 'assets/music/lagu-2.mp3', cover: 'assets/images/cover/cover-2.jpeg' },
    { title: 'Loose',     artist: 'ENHYPEN', src: 'assets/music/lagu-3.mp3', cover: 'assets/images/cover/cover-3.jpeg' },
  ];

  const trackAudio  = document.getElementById('trackAudio');
  const trackCover  = document.getElementById('trackCover');
  const trackTitle  = document.getElementById('trackTitle');
  const trackArtist = document.getElementById('trackArtist');
  const playBtn     = document.getElementById('playBtn');
  const playIcon    = document.getElementById('playIcon');
  const prevBtn     = document.getElementById('prevBtn');
  const nextBtn     = document.getElementById('nextBtn');
  const seek        = document.getElementById('seek');
  const curTimeEl   = document.getElementById('curTime');
  const durTimeEl   = document.getElementById('durTime');
  const trackItems  = Array.from(document.querySelectorAll('.track-item'));

  const ICON_PLAY  = '<path d="M8 5v14l11-7z"/>';
  const ICON_PAUSE = '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';

  let currentIndex = 0;
  let isPlaying = false;
  let isSeeking = false;

  loadTrack(currentIndex, false);

  function loadTrack(index, autoplay){
    currentIndex = (index + tracks.length) % tracks.length;
    const t = tracks[currentIndex];
    trackAudio.src = t.src;
    trackCover.src = t.cover;
    trackTitle.textContent = t.title;
    trackArtist.textContent = t.artist;

    trackItems.forEach(item => {
      item.classList.toggle('active', Number(item.dataset.index) === currentIndex);
    });

    seek.value = 0;
    updateSeekFill(0);
    curTimeEl.textContent = '0:00';

    if (autoplay){
      trackAudio.play().then(() => setPlayingState(true)).catch(() => {});
    }
  }

  function setPlayingState(playing){
    isPlaying = playing;
    playIcon.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;

    if (playing){
      fadeAudio(bgAudio, 0.08, 500);
    } else {
      fadeAudio(bgAudio, 0.55, 800);
    }
  }

  playBtn.addEventListener('click', () => {
    if (trackAudio.paused){
      trackAudio.play().then(() => setPlayingState(true)).catch(() => {});
    } else {
      trackAudio.pause();
      setPlayingState(false);
    }
  });

  prevBtn.addEventListener('click', () => loadTrack(currentIndex - 1, true));
  nextBtn.addEventListener('click', () => loadTrack(currentIndex + 1, true));

  trackItems.forEach(item => {
    item.addEventListener('click', () => loadTrack(Number(item.dataset.index), true));
  });

  trackAudio.addEventListener('loadedmetadata', () => {
    durTimeEl.textContent = formatTime(trackAudio.duration);
  });

  trackAudio.addEventListener('timeupdate', () => {
    if (isSeeking || !trackAudio.duration) return;
    const pct = (trackAudio.currentTime / trackAudio.duration) * 100;
    seek.value = pct;
    updateSeekFill(pct);
    curTimeEl.textContent = formatTime(trackAudio.currentTime);
  });

  trackAudio.addEventListener('ended', () => {
    loadTrack(currentIndex + 1, true);
  });

  seek.addEventListener('input', () => {
    isSeeking = true;
    updateSeekFill(Number(seek.value));
  });
  seek.addEventListener('change', () => {
    if (trackAudio.duration){
      trackAudio.currentTime = (Number(seek.value) / 100) * trackAudio.duration;
    }
    isSeeking = false;
  });

  function updateSeekFill(pct){
    seek.style.background = `linear-gradient(to right, var(--blue-500) ${pct}%, var(--blue-100) ${pct}%)`;
  }

  function formatTime(sec){
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  /* ---------------------------------------------------
     4a. GENERIC SCROLL FADE-IN (section kickers, player card)
     --------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  revealEls.forEach(el => revealObserver.observe(el));

  /* ---------------------------------------------------
     4. GALLERY — scroll reveal
     --------------------------------------------------- */
  const galleryItems = document.querySelectorAll('.gallery-item');
  const galleryObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('visible');
        galleryObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  galleryItems.forEach(item => galleryObserver.observe(item));

  /* ---------------------------------------------------
     5. LETTER — sequential line reveal
     --------------------------------------------------- */
  const letterLines = document.querySelectorAll('.letter-line');
  const letterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        const idx = Array.from(letterLines).indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('in-view'), idx * 220);
        letterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });
  letterLines.forEach(line => letterObserver.observe(line));

});
