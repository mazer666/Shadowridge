/**
 * src/game/loop.js
 * -----------------------------------------------------------------------------
 * Minimaler Game-Loop.
 *
 * Schritt 1:
 * - Wir rendern einfach bei jeder Animation Frame.
 * - Später können wir auf “render nur bei Änderungen” optimieren.
 */

export function startLoop({ render }) {
  let running = true;

  function frame() {
    if (!running) return;
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return () => { running = false; };
}
