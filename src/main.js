/**
 * src/main.js
 * -----------------------------------------------------------------------------
 * Einstiegspunkt. Verdrahtet:
 * - State
 * - Dungeon Generator
 * - Controls
 * - MapCanvas Rendering
 * - Log
 * - (NEU) HUD Panels: Drag/Resize + Persistenz
 */

import { state, setState } from "./state.js";
import { generateDungeon, isWalkable } from "./game/dungeon.js";
import { MapCanvas } from "./ui/mapCanvas.js";
import { startLoop } from "./game/loop.js";
import { setupControls } from "./input/controls.js";
import { setupPanels } from "./ui/panels.js";

// --- DOM helpers -----------------------------------------------------------

function $(id) {
  return document.getElementById(id);
}

function addLog(text) {
  const log = $("log");
  if (!log) return;

  const line = document.createElement("div");
  line.className = "logLine";
  line.textContent = text;

  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

// --- Game init -------------------------------------------------------------

function regenerateDungeon() {
  state.dungeon.tiles = generateDungeon(state.dungeon.width, state.dungeon.height);

  // Spieler auf einen sicheren Start setzen: wir suchen einen begehbaren Tile.
  for (let y = 1; y < state.dungeon.height - 1; y++) {
    for (let x = 1; x < state.dungeon.width - 1; x++) {
      if (isWalkable(state.dungeon.tiles, x, y)) {
        state.player.x = x;
        state.player.y = y;
        setState("ui.statusText", `Etage generiert: ${state.dungeon.width}×${state.dungeon.height}`);
        return;
      }
    }
  }
}

// --- Main ------------------------------------------------------------------

const canvasEl = $("map");
const statusEl = $("statusText");
const hudEl = $("hud");

// Map Canvas
const map = new MapCanvas(canvasEl);
map.resizeToParent();

// Dungeon einmal erzeugen
regenerateDungeon();
addLog("Schritt B1 bereit: Desktop Panels sind jetzt verschiebbar + resizable.");

// Controls
setupControls({
  onMove: (dx, dy) => {
    const nx = state.player.x + dx;
    const ny = state.player.y + dy;

    if (isWalkable(state.dungeon.tiles, nx, ny)) {
      state.player.x = nx;
      state.player.y = ny;
      setState("ui.statusText", `Position: (${nx}, ${ny})`);
    } else {
      setState("ui.statusText", "Bump! (Wand)");
    }
  },
  onReset: () => {
    regenerateDungeon();
    addLog("Neu generiert.");
  },
  onLog: (t) => addLog(t),
});

// HUD Panels (Drag/Resize) – bounds ist die canvasWrap (Parent vom Canvas)
if (hudEl && canvasEl?.parentElement) {
  setupPanels({
    hudEl,
    boundsEl: canvasEl.parentElement, // .canvasWrap
  });
}

// Render loop
startLoop({
  render: () => {
    // Statuszeile im DOM
    if (statusEl) statusEl.textContent = state.ui.statusText;

    // Canvas rendern
    map.render({
      tiles: state.dungeon.tiles,
      player: state.player,
      statusText: state.ui.statusText,
    });
  },
});
