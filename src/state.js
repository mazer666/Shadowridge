/**
 * src/state.js
 * -----------------------------------------------------------------------------
 * Ein globales State-Objekt (super simpel).
 *
 * Später:
 * - Hier kommen Party, Inventory, Encounter-States, RNG Seeds, etc. hinein.
 */

import { dispatch, Events } from "./events.js";

export const state = {
  // "dungeon" enthält bei uns erstmal ein Grid und die Spielerposition.
  dungeon: {
    width: 29,
    height: 20,
    tiles: [], // wird in dungeon.js befüllt
  },

  // Spielerposition (später: Partyposition, Facing, Path, etc.)
  player: {
    x: 1,
    y: 1,
  },

  // UI-Infos (Statuszeile etc.)
  ui: {
    statusText: "Init…",
  },
};

/**
 * setState(path, value)
 * - path ist ein String wie "player.x" oder "ui.statusText"
 * - value ist der neue Wert
 *
 * Diese Funktion:
 * - setzt den Wert
 * - feuert ein STATE_CHANGED Event
 */
export function setState(path, value) {
  const parts = path.split(".");
  let obj = state;

  // bis zum vorletzten Teil “durchhangeln”
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
  }

  const last = parts[parts.length - 1];
  obj[last] = value;

  dispatch(Events.STATE_CHANGED, { path, value });
}
