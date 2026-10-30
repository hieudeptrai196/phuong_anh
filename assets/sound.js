/* Sound for both pages: short effects, background music, a synthesized scratch, and a music toggle.
 *
 *   window.Sound.play('flip', { volume, rate, delay })   // delay in seconds
 *   window.Sound.beep()                                  // synthesized barcode-scanner beep
 *   window.Sound.music.start() / .stop()
 *   window.Sound.scratch.start() / .level(0..1) / .stop()
 *
 * The on-page toggle only mutes background music (index). Effects and scratch always play.
 * Browsers only let a page make sound after the visitor taps or presses a key, so the first
 * gesture anywhere unlocks audio. Music is on by default; the choice is remembered per browser.
 * Effects and music: Mixkit (mixkit.co), free licence. The scratch noise is generated here.
 */
(() => {
  const BASE = 'assets/sounds/';
  const EFFECTS = ['page-open', 'page-turn', 'blow', 'pop', 'chime', 'shuffle', 'gather', 'deal', 'whoosh', 'flip', 'win', 'cheer'];
  const MUSIC_SRC = BASE + 'music.m4a?v=swing'; // Mixkit "Swing is the Answer"; bump v= when the track changes
  const MUSIC_VOLUME = 0.32;
  const STORE_KEY = 'pa22-music';

  let musicOn = true;
  try { musicOn = localStorage.getItem(STORE_KEY) !== 'off'; } catch { /* storage blocked: keep default */ }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = Ctx ? new Ctx() : null;
  const master = ctx ? ctx.createGain() : null;
  if (master) { master.gain.value = 1; master.connect(ctx.destination); }

  // Fetch and decode every effect up front; decoding works while the context is still suspended.
  const buffers = {};
  if (ctx) {
    EFFECTS.forEach((name) => {
      fetch(BASE + name + '.mp3')
        .then((r) => r.arrayBuffer())
        .then((data) => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
        .then((buf) => { buffers[name] = buf; })
        .catch(() => {});
    });
  }

  function unlock() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));

  function play(name, opts = {}) {
    if (!ctx) return;
    // Sounds asked for right after the first tap (e.g. the first shuffle) may arrive before the file is
    // decoded or while the context is still resuming: wait for both instead of dropping them.
    const asked = performance.now();
    const go = () => {
      if (!buffers[name]) {
        if (performance.now() - asked < 2000) setTimeout(go, 50);
        return;
      }
      if (ctx.state !== 'running') { ctx.resume().then(() => start(name, opts)).catch(() => {}); return; }
      start(name, opts);
    };
    go();
  }
  function start(name, { volume = 1, rate = 1, delay = 0 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(master);
    src.start(ctx.currentTime + delay);
  }

  /* ---- Background music: streamed, looped, faded in ---- */
  const audio = new Audio(MUSIC_SRC);
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;
  let musicWanted = false, fadeTimer = null, toggle = null;
  function fadeTo(target, ms = 1600) {
    clearInterval(fadeTimer);
    const start = audio.volume, t0 = performance.now();
    fadeTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      audio.volume = start + (target - start) * p;
      if (p >= 1) { clearInterval(fadeTimer); if (target === 0) audio.pause(); }
    }, 40);
  }
  function setMusicOn(on) {
    musicOn = on;
    try { localStorage.setItem(STORE_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
    if (on && musicWanted) { audio.play().then(() => fadeTo(MUSIC_VOLUME, 800)).catch(() => {}); }
    if (!on) fadeTo(0, 400);
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(on));
      toggle.querySelector('span').textContent = on ? 'Music on' : 'Music off';
    }
  }
  function ensureToggle() {
    if (toggle) return;
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sound-toggle';
    toggle.dataset.cursor = 'Music';
    toggle.innerHTML = '<i aria-hidden="true"><b></b><b></b><b></b></i><span></span>';
    toggle.addEventListener('click', () => setMusicOn(!musicOn));
    const style = document.createElement('style');
    style.textContent = `
      .sound-toggle { position: fixed; z-index: 85; right: max(16px, env(safe-area-inset-right, 0px)); bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: 0; border-radius: 999px; cursor: pointer;
        background: rgba(20, 18, 15, .55); color: #fbf8f4; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        font: 500 9px/1 'Be Vietnam Pro', Arial, sans-serif; letter-spacing: .16em; text-transform: uppercase; opacity: .8; transition: opacity .3s; }
      .sound-toggle:hover, .sound-toggle:focus-visible { opacity: 1; outline: none; }
      .sound-toggle i { display: flex; align-items: flex-end; gap: 2px; height: 10px; }
      .sound-toggle b { width: 2px; height: 100%; background: currentColor; border-radius: 1px; animation: sound-eq 1s ease-in-out infinite; }
      .sound-toggle b:nth-child(2) { animation-delay: -.35s; } .sound-toggle b:nth-child(3) { animation-delay: -.7s; }
      .sound-toggle[aria-pressed="false"] b { animation: none; height: 2px; }
      @keyframes sound-eq { 0%, 100% { height: 30%; } 50% { height: 100%; } }
      .shot .sound-toggle, .render .sound-toggle { display: none; }
      @media (prefers-reduced-motion: reduce) { .sound-toggle b { animation: none; height: 60%; } }`;
    document.head.appendChild(style);
    document.body.appendChild(toggle);
    setMusicOn(musicOn);
  }
  const music = {
    start() {
      musicWanted = true;
      ensureToggle();
      if (!musicOn) return;
      audio.play().then(() => fadeTo(MUSIC_VOLUME)).catch(() => {});
    },
    stop() { musicWanted = false; fadeTo(0, 600); },
  };

  /* ---- Scratch: band-passed noise whose loudness follows the finger's speed ---- */
  let scratchSrc = null, scratchGain = null;
  const scratch = {
    start() {
      if (!ctx || scratchSrc) return;
      unlock();
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      scratchSrc = ctx.createBufferSource();
      scratchSrc.buffer = buf;
      scratchSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.9;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 900;
      scratchGain = ctx.createGain();
      scratchGain.gain.value = 0;
      scratchSrc.connect(bp).connect(hp).connect(scratchGain).connect(master);
      scratchSrc.start();
    },
    level(v) {
      if (!scratchGain) return;
      scratchGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.28, ctx.currentTime, 0.03);
    },
    stop() {
      if (!scratchSrc) return;
      const src = scratchSrc;
      scratchGain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
      setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } }, 200);
      scratchSrc = null; scratchGain = null;
    },
  };

  /* ---- Beep: a checkout scanner's short square-wave chirp ---- */
  function beep() {
    if (!ctx) return;
    unlock();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1850;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.005);
    g.gain.setValueAtTime(0.07, t + 0.11);
    g.gain.linearRampToValueAtTime(0, t + 0.13);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  window.Sound = {
    play, music, scratch, unlock, beep,
    get musicOn() { return musicOn; },
    get musicPlaying() { return !audio.paused && audio.volume > 0; },
  };
})();
