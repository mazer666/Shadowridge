/**
 * src/input/controls.js
 * -----------------------------------------------------------------------------
 * Keyboard-Input (WASD + Pfeile) und ein Reset (R).
 *
 * Wir geben KEIN direktes DOM/Canvas Handling hier rein,
 * sondern rufen Callbacks auf -> sauberer Aufbau.
 */

export function setupControls({
  onMove,      // (dx, dy) => void
  onReset,     // () => void
  onLog,       // (text) => void
}) {
  function keyToMove(e) {
    // Wir ignorieren repeats, damit man nicht “zu schnell” durchrutscht (optional)
    if (e.repeat) return null;

    switch (e.key) {
      case "ArrowUp": return { dx: 0, dy: -1 };
      case "ArrowDown": return { dx: 0, dy: 1 };
      case "ArrowLeft": return { dx: -1, dy: 0 };
      case "ArrowRight": return { dx: 1, dy: 0 };
      case "w":
      case "W": return { dx: 0, dy: -1 };
      case "s":
      case "S": return { dx: 0, dy: 1 };
      case "a":
      case "A": return { dx: -1, dy: 0 };
      case "d":
      case "D": return { dx: 1, dy: 0 };
      default: return null;
    }
  }

  function onKeyDown(e) {
    // Verhindert, dass die Seite scrollt, wenn wir Pfeiltasten drücken
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
      e.preventDefault();
    }

    if (e.key === "r" || e.key === "R") {
      onLog?.("Etage neu generiert.");
      onReset?.();
      return;
    }

    const mv = keyToMove(e);
    if (!mv) return;

    onMove?.(mv.dx, mv.dy);
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });

  // Unsubscribe-Funktion
  return () => {
    window.removeEventListener("keydown", onKeyDown);
  };
}
