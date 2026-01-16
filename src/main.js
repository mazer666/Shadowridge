/**
 * src/main.js
 * -----------------------------------------------------------------------------
 * Verdrahtet:
 * - State
 * - Dungeon Generator
 * - Controls
 * - MapCanvas Rendering
 * - Log
 * - HUD Panels (Desktop: Drag/Resize + Docking; Mobile: Fullscreen Menüs)
 * - Hotbar Slots + Tooltips + Cooldown/Charges
 */

import { state, setState } from "./state.js";
import { generateDungeon, isWalkable } from "./game/dungeon.js";
import { MapCanvas } from "./ui/mapCanvas.js";
import { startLoop } from "./game/loop.js";
import { setupControls } from "./input/controls.js";

// WICHTIG: Panels sind jetzt modular in src/ui/panels/panels.js
import { setupPanels } from "./ui/panels/panels.js";

import { setupHotbar } from "./ui/hotbar.js";

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

function regenerateDungeon() {
  state.dungeon.tiles = generateDungeon(state.dungeon.width, state.dungeon.height);

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

const canvasEl = $("map");
const statusEl = $("statusText");
const hudEl = $("hud");
const mobileTabsEl = $("mobileTabs");
const mobileOverlayEl = $("mobileOverlay");
const mobileCloseEl = $("mobileClose");

// Hotbar elements
const hotbarSlotsEl = $("hotbarSlots");
const hotbarTooltipEl = $("hotbarTooltip");
const hotbarTooltipTitleEl = $("hotbarTooltipTitle");
const hotbarTooltipDescEl = $("hotbarTooltipDesc");
const hotbarTooltipMetaEl = $("hotbarTooltipMeta");

// Map
const map = new MapCanvas(canvasEl);
map.resizeToParent();

// Init Dungeon
regenerateDungeon();
addLog("M1: Docking wurde modularisiert (docking.js).");

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

// HUD Panels
if (hudEl && canvasEl?.parentElement) {
  setupPanels({
    hudEl,
    boundsEl: canvasEl.parentElement, // .canvasWrap
    mobileTabsEl,
    mobileOverlayEl,
    mobileCloseEl,
  });
}

// Hotbar
setupHotbar({
  slotsEl: hotbarSlotsEl,
  tooltipEl: hotbarTooltipEl,
  tooltipTitleEl: hotbarTooltipTitleEl,
  tooltipDescEl: hotbarTooltipDescEl,
  tooltipMetaEl: hotbarTooltipMetaEl,

  onActivate: (slot) => {
    addLog(`Hotbar: ${slot.key} → ${slot.name}`);
    setState("ui.statusText", `Aktion: ${slot.name}`);
  },

  onFail: (msg) => {
    addLog(msg);
    setState("ui.statusText", msg.replace(/^⛔\s*/, ""));
  },
});

// Render loop
startLoop({
  render: () => {
    if (statusEl) statusEl.textContent = state.ui.statusText;

    map.render({
      tiles: state.dungeon.tiles,
      player: state.player,
      statusText: state.ui.statusText,
    });
  },
});
