/* A small mascot (the yellow LottieFiles character) that can switch between poses.
 *
 *   const m = Mascot.create(containerEl, 'idle', { gaze: true });  // loops 'idle'; eyes follow the pointer
 *   m.play('cheer');                                                // switch pose (loops)
 *   m.play('wave', { then: 'idle' });                               // play once, then go back to 'idle'
 *
 * Poses live in assets/mascot/<name>.json (Lottie, vector). Needs lottie_light from cdnjs.
 * Animations: LottieFiles free animations (Lottie Simple License), same author/character.
 *
 * Gaze: the two pupil layers ('popil…') are tagged with a class before loading, then nudged a few
 * units toward the mouse (or the last touch) on top of whatever the animation does. Only in calm
 * poses, so a cheer or a wave plays exactly as drawn.
 */
(() => {
  const BASE = 'assets/mascot/';
  const GAZE_POSES = ['idle'];   // 'look' rolls its own eyes, so it isn't steered
  const PUPIL_REACH = 55;      // max pupil shift, in the animation's own units (canvas is 1355×1526)
  const FACE_REACH = 16;        // the face turns a touch too
  const EASE = 0.12;           // how quickly the eyes catch up
  const TOUCH_HOLD_MS = 2500;  // after a tap, keep looking there this long, then drift back to centre
  const cache = {};
  const load = (name) => (cache[name] ||= fetch(BASE + name + '.json').then((r) => r.json()));
  // Warm the cache so a pose change never waits on the network.
  ['idle', 'look', 'wave', 'cheer', 'cheer-big'].forEach(load);

  /* ---- One shared pointer tracker for every mascot on the page ---- */
  const pointer = { x: 0, y: 0, active: false, until: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.active = true;
    pointer.until = e.pointerType === 'mouse' ? Infinity : performance.now() + TOUCH_HOLD_MS;
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.active = true;
    pointer.until = e.pointerType === 'mouse' ? Infinity : performance.now() + TOUCH_HOLD_MS;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { pointer.active = false; });

  // Copy the animation and tag the pupil and face layers so they can be found in the SVG.
  function tagged(data) {
    const copy = JSON.parse(JSON.stringify(data));
    copy.layers.forEach((L) => {
      if (/^popil/i.test(L.nm || '')) L.cl = 'mascot-pupil';
      // The face and the hair sit on it are separate (sibling) layers in the SVG, so move them together.
      else if (/^(face|saç)\//i.test(L.nm || '')) L.cl = 'mascot-face';
    });
    return copy;
  }

  function create(el, pose = 'idle', { gaze = false } = {}) {
    let anim = null, token = 0, current = pose;
    let pupils = [], faces = [];
    const look = { x: 0, y: 0 };

    async function play(name, { then } = {}) {
      const mine = ++token;
      const data = await load(name);
      if (mine !== token || !window.lottie) return;   // a newer pose was asked for meanwhile
      if (anim) anim.destroy();
      current = name;
      pupils = []; faces = [];
      anim = window.lottie.loadAnimation({
        container: el, renderer: 'svg', autoplay: true, loop: !then,
        animationData: gaze ? tagged(data) : data, rendererSettings: { preserveAspectRatio: 'xMidYMax meet' },
      });
      anim.addEventListener('DOMLoaded', () => {
        pupils = [...el.querySelectorAll('.mascot-pupil')];
        faces = [...el.querySelectorAll('.mascot-face')];
      });
      if (then) anim.addEventListener('complete', () => { if (mine === token) play(then); });
    }

    if (gaze && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = () => {
        let tx = 0, ty = 0;
        const following = GAZE_POSES.includes(current) && pointer.active && performance.now() < pointer.until;
        if (following) {
          const r = el.getBoundingClientRect();
          // the eyes sit about a third of the way down the figure
          const dx = pointer.x - (r.left + r.width / 2);
          const dy = pointer.y - (r.top + r.height * .36);
          const dist = Math.hypot(dx, dy) || 1;
          const pull = Math.min(1, dist / 220);       // close to the face, look less far
          tx = (dx / dist) * pull; ty = (dy / dist) * pull;
        }
        look.x += (tx - look.x) * EASE;
        look.y += (ty - look.y) * EASE;
        const fx = look.x * FACE_REACH, fy = look.y * FACE_REACH * .6;
        // pupils ride on the face, then look further on their own
        const px = fx + look.x * PUPIL_REACH, py = fy + look.y * PUPIL_REACH * .8;
        pupils.forEach((p) => { p.style.translate = `${px.toFixed(2)}px ${py.toFixed(2)}px`; });
        faces.forEach((f) => { f.style.translate = `${fx.toFixed(2)}px ${fy.toFixed(2)}px`; });
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }

    play(pose);
    return { play, el };
  }

  window.Mascot = { create };
})();
