/* Light deterrent against casual inspection: no right-click menu, no devtools / view-source shortcuts.
 * It cannot truly prevent inspection (browser menus still open devtools, and the source is public),
 * it only keeps a curious visitor from finding the voucher code with one key press. */
(() => {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const blocked =
      e.key === 'F12' ||
      (mod && e.shiftKey && ['i', 'j', 'c'].includes(k)) ||   // Ctrl/Cmd+Shift+I/J/C
      (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(k)) || // Cmd+Option+I/J/C/U (macOS)
      (mod && k === 'u');                                    // view source
    if (blocked) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
