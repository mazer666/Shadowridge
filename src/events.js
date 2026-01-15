/**
 * src/events.js
 * -----------------------------------------------------------------------------
 * Mini-Event-Bus.
 *
 * Warum?
 * - Laut README: “Globales state-Objekt + Custom Events”.
 * - So können UI, Game-Logic und Input miteinander reden, ohne sich hart zu koppeln.
 */

export const Events = {
  STATE_CHANGED: "sr:stateChanged",
  LOG: "sr:log",
};

/**
 * dispatch(name, detail)
 * - feuert ein CustomEvent am document
 * - detail kann ein Objekt sein (z.B. { key: "playerPos", value: ... })
 */
export function dispatch(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * on(name, handler)
 * - handler bekommt (event) übergeben
 * - Rückgabewert ist eine “unsubscribe”-Funktion
 */
export function on(name, handler) {
  document.addEventListener(name, handler);
  return () => document.removeEventListener(name, handler);
}
