/* A small mascot (the yellow LottieFiles character) that can switch between poses.
 *
 *   const m = Mascot.create(containerEl, 'idle');   // starts looping the 'idle' pose
 *   m.play('cheer');                                 // switch pose (loops)
 *   m.play('wave', { then: 'idle' });                // play once, then go back to 'idle'
 *
 * Poses live in assets/mascot/<name>.json (Lottie, vector). Needs lottie_light from cdnjs.
 * Animations: LottieFiles free animations (Lottie Simple License), same author/character.
 */
(() => {
  const BASE = 'assets/mascot/';
  const cache = {};
  const load = (name) => (cache[name] ||= fetch(BASE + name + '.json').then((r) => r.json()));
  // Warm the cache so a pose change never waits on the network.
  ['idle', 'look', 'wave', 'cheer', 'cheer-big'].forEach(load);

  function create(el, pose = 'idle') {
    let anim = null, token = 0;
    async function play(name, { then } = {}) {
      const mine = ++token;
      const data = await load(name);
      if (mine !== token || !window.lottie) return;   // a newer pose was asked for meanwhile
      if (anim) anim.destroy();
      anim = window.lottie.loadAnimation({
        container: el, renderer: 'svg', autoplay: true, loop: !then,
        animationData: data, rendererSettings: { preserveAspectRatio: 'xMidYMax meet' },
      });
      if (then) anim.addEventListener('complete', () => { if (mine === token) play(then); });
    }
    play(pose);
    return { play, el };
  }

  window.Mascot = { create };
})();
