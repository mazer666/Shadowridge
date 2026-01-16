/**
 * src/ui/panels/panels.js
 * -----------------------------------------------------------------------------
 * Panel-Controller:
 * - Desktop: Drag/Resize + Docking/Snapping + Collapse (Mini-Leiste)
 * - Mobile: Buttons öffnen Panels fullscreen (Sheets)
 * - Persistenz: Position/Größe/Collapsed in localStorage
 *
 * Docking-Logik ist ausgelagert nach: ./docking.js
 */

import {
  ensureDockGuides,
  hideGuides,
  getPanelRectsInBounds,
  snapDrag,
  snapResize,
} from "./docking.js";

const STORAGE_KEY = "sr.panels.v2";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function isDesktopOverlay() {
  return window.matchMedia("(min-width: 981px)").matches;
}

function isMobile() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

/**
 * "Gute Defaults" basierend auf Bounds (Map-Fläche).
 * Das ist besser als fixe Werte im HTML.
 */
function applyDefaultLayout(panels, boundsEl, layoutRef, zStart = 10) {
  const b = boundsEl.getBoundingClientRect();
  const margin = 16;

  const put = (id, x, y, w, h, z) => {
    const panel = panels.find(p => p.dataset.panelId === id);
    if (!panel) return;

    panel.style.setProperty("--x", `${Math.round(x)}px`);
    panel.style.setProperty("--y", `${Math.round(y)}px`);
    panel.style.setProperty("--w", `${Math.round(w)}px`);
    panel.style.setProperty("--h", `${Math.round(h)}px`);
    panel.style.zIndex = String(z);

    layoutRef[id] = {
      x: `${Math.round(x)}px`,
      y: `${Math.round(y)}px`,
      w: `${Math.round(w)}px`,
      h: `${Math.round(h)}px`,
      z,
      collapsed: false,
    };
  };

  const partyW = 320, partyH = 240;
  const invW = 340, invH = 320;
  const logW = Math.min(560, Math.max(420, b.width * 0.52));
  const logH = 240;
  const hotW = Math.min(520, Math.max(380, b.width * 0.45));
  const hotH = 140; // Hotbar ist jetzt “fetter” wegen Tooltip/Slots

  put("party", margin, margin, partyW, partyH, zStart + 1);
  put("inventory", b.width - invW - margin, margin, invW, invH, zStart + 2);
  put("log", margin, b.height - logH - margin, logW, logH, zStart + 3);
  put("hotbar", (b.width - hotW) / 2, b.height - hotH - margin, hotW, hotH, zStart + 4);

  layoutRef.__zCounter = zStart + 10;
}

export function setupPanels({ hudEl, boundsEl, mobileTabsEl, mobileOverlayEl, mobileCloseEl }) {
  const panels = Array.from(hudEl.querySelectorAll(".hudPanel"));
  const { vLine, hLine } = ensureDockGuides(boundsEl);

  let layout = loadLayout() || {};
  let zCounter = layout.__zCounter || 10;

  // Defaults (nur Desktop, nur wenn noch nichts gespeichert ist)
  const hasAnyPanelSaved = panels.some(p => layout[p.dataset.panelId]);
  if (!hasAnyPanelSaved && isDesktopOverlay()) {
    applyDefaultLayout(panels, boundsEl, layout, zCounter);
    saveLayout(layout);
    zCounter = layout.__zCounter || (zCounter + 10);
  }

  // Layout anwenden + Collapse-Icon initial setzen
  for (const panel of panels) {
    const id = panel.dataset.panelId;
    const saved = layout[id];

    if (saved) {
      if (typeof saved.x === "string") panel.style.setProperty("--x", saved.x);
      if (typeof saved.y === "string") panel.style.setProperty("--y", saved.y);
      if (typeof saved.w === "string") panel.style.setProperty("--w", saved.w);
      if (typeof saved.h === "string") panel.style.setProperty("--h", saved.h);
      if (saved.collapsed) panel.classList.add("is-collapsed");
      if (typeof saved.z === "number") panel.style.zIndex = String(saved.z);
    } else {
      panel.style.zIndex = String(++zCounter);
    }

    const collapseBtn = panel.querySelector('[data-action="collapse"]');
    if (collapseBtn) {
      const collapsed = panel.classList.contains("is-collapsed");
      collapseBtn.textContent = collapsed ? "▸" : "▾";
      collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
  }

  function commitPanel(panel) {
    const id = panel.dataset.panelId;
    if (!id) return;

    const x = panel.style.getPropertyValue("--x") || getComputedStyle(panel).getPropertyValue("--x");
    const y = panel.style.getPropertyValue("--y") || getComputedStyle(panel).getPropertyValue("--y");
    const w = panel.style.getPropertyValue("--w") || getComputedStyle(panel).getPropertyValue("--w");
    const h = panel.style.getPropertyValue("--h") || getComputedStyle(panel).getPropertyValue("--h");

    layout[id] = {
      x: String(x).trim(),
      y: String(y).trim(),
      w: String(w).trim(),
      h: String(h).trim(),
      z: Number(panel.style.zIndex || 0),
      collapsed: panel.classList.contains("is-collapsed"),
    };
    layout.__zCounter = zCounter;
    saveLayout(layout);
  }

  function activate(panel) {
    for (const p of panels) p.classList.remove("is-active");
    panel.classList.add("is-active");
    panel.style.zIndex = String(++zCounter);
    commitPanel(panel);
  }

  function toggleCollapse(panel) {
    panel.classList.toggle("is-collapsed");

    const btn = panel.querySelector('[data-action="collapse"]');
    if (btn) {
      const collapsed = panel.classList.contains("is-collapsed");
      btn.textContent = collapsed ? "▸" : "▾";
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }

    commitPanel(panel);
  }

  // Drag
  function setupDrag(panel) {
    const handle = panel.querySelector("[data-drag-handle]");
    if (!handle) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    function getBoundsRect() {
      return boundsEl.getBoundingClientRect();
    }

    function getCurrentXYpx() {
      const b = getBoundsRect();
      const r = panel.getBoundingClientRect();
      return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
    }

    handle.addEventListener("pointerdown", (e) => {
      if (!isDesktopOverlay()) return;
      if (e.button !== 0) return;

      // Wenn Pointerdown von Button kommt, NICHT draggen (sonst Click verschluckt)
      const target = e.target;
      if (target && target.closest && target.closest("button")) return;

      activate(panel);

      dragging = true;
      handle.setPointerCapture(e.pointerId);
      handle.style.cursor = "grabbing";

      startX = e.clientX;
      startY = e.clientY;

      const cur = getCurrentXYpx();
      startLeft = cur.x;
      startTop = cur.y;

      e.preventDefault();
    });

    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      if (!isDesktopOverlay()) return;

      const b = getBoundsRect();
      const cur = getCurrentXYpx();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let nx = clamp(startLeft + dx, 0, b.width - cur.w);
      let ny = clamp(startTop + dy, 0, b.height - cur.h);

      const others = getPanelRectsInBounds(panels, boundsEl, panel);
      const allowSnap = !e.altKey; // ALT gedrückt = frei

      const snapped = snapDrag({
        x: nx, y: ny, w: cur.w, h: cur.h,
        boundsW: b.width, boundsH: b.height,
        others,
        allowSnap,
      });

      nx = snapped.x;
      ny = snapped.y;

      panel.style.setProperty("--x", `${Math.round(nx)}px`);
      panel.style.setProperty("--y", `${Math.round(ny)}px`);

      // Guides anzeigen
      if (snapped.guideX != null) {
        vLine.style.left = `${Math.round(snapped.guideX)}px`;
        vLine.classList.add("is-on");
      } else vLine.classList.remove("is-on");

      if (snapped.guideY != null) {
        hLine.style.top = `${Math.round(snapped.guideY)}px`;
        hLine.classList.add("is-on");
      } else hLine.classList.remove("is-on");
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      handle.style.cursor = "grab";
      hideGuides(vLine, hLine);
      commitPanel(panel);
      try { handle.releasePointerCapture(e.pointerId); } catch {}
    }

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  // Resize
  function setupResize(panel) {
    const handle = panel.querySelector("[data-resize-handle]");
    if (!handle) return;

    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let panelLeft = 0;
    let panelTop = 0;

    function getBoundsRect() {
      return boundsEl.getBoundingClientRect();
    }

    handle.addEventListener("pointerdown", (e) => {
      if (!isDesktopOverlay()) return;
      if (e.button !== 0) return;
      if (panel.classList.contains("is-collapsed")) return;

      activate(panel);

      resizing = true;
      handle.setPointerCapture(e.pointerId);

      startX = e.clientX;
      startY = e.clientY;

      const b = getBoundsRect();
      const rect = panel.getBoundingClientRect();

      startW = rect.width;
      startH = rect.height;
      panelLeft = rect.left - b.left;
      panelTop = rect.top - b.top;

      e.preventDefault();
    });

    handle.addEventListener("pointermove", (e) => {
      if (!resizing) return;
      if (!isDesktopOverlay()) return;

      const b = getBoundsRect();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const minW = 240;
      const minH = 100;

      let newW = clamp(startW + dx, minW, b.width - panelLeft);
      let newH = clamp(startH + dy, minH, b.height - panelTop);

      const others = getPanelRectsInBounds(panels, boundsEl, panel);
      const allowSnap = !e.altKey;

      const snapped = snapResize({
        left: panelLeft,
        top: panelTop,
        w: newW,
        h: newH,
        boundsW: b.width,
        boundsH: b.height,
        others,
        allowSnap,
      });

      newW = clamp(snapped.w, minW, b.width - panelLeft);
      newH = clamp(snapped.h, minH, b.height - panelTop);

      panel.style.setProperty("--w", `${Math.round(newW)}px`);
      panel.style.setProperty("--h", `${Math.round(newH)}px`);

      if (snapped.guideX != null) {
        vLine.style.left = `${Math.round(snapped.guideX)}px`;
        vLine.classList.add("is-on");
      } else vLine.classList.remove("is-on");

      if (snapped.guideY != null) {
        hLine.style.top = `${Math.round(snapped.guideY)}px`;
        hLine.classList.add("is-on");
      } else hLine.classList.remove("is-on");
    });

    function endResize(e) {
      if (!resizing) return;
      resizing = false;
      hideGuides(vLine, hLine);
      commitPanel(panel);
      try { handle.releasePointerCapture(e.pointerId); } catch {}
    }

    handle.addEventListener("pointerup", endResize);
    handle.addEventListener("pointercancel", endResize);
  }

  // Desktop: Panels innerhalb bounds halten
  function normalizeIntoBounds() {
    if (!isDesktopOverlay()) return;

    const b = boundsEl.getBoundingClientRect();

    for (const panel of panels) {
      if (panel.classList.contains("is-mobile-open")) continue;

      const r = panel.getBoundingClientRect();
      const left = clamp(r.left - b.left, 0, b.width - r.width);
      const top = clamp(r.top - b.top, 0, b.height - r.height);

      panel.style.setProperty("--x", `${Math.round(left)}px`);
      panel.style.setProperty("--y", `${Math.round(top)}px`);
      commitPanel(panel);
    }
  }

  // Mobile Fullscreen
  function closeMobilePanel() {
    if (!isMobile()) return;

    for (const p of panels) p.classList.remove("is-mobile-open");

    if (mobileOverlayEl) {
      mobileOverlayEl.classList.remove("is-open");
      mobileOverlayEl.setAttribute("aria-hidden", "true");
    }
  }

  function openMobilePanel(panelId) {
    if (!isMobile()) return;

    const target = panels.find(p => p.dataset.panelId === panelId);
    if (!target) return;

    for (const p of panels) p.classList.remove("is-mobile-open");
    target.classList.add("is-mobile-open");

    // Klicks im geöffneten Panel dürfen nicht “durchfallen”
    target.addEventListener("pointerdown", (e) => e.stopPropagation(), { once: false });

    if (mobileOverlayEl) {
      mobileOverlayEl.classList.add("is-open");
      mobileOverlayEl.setAttribute("aria-hidden", "false");
    }
  }

  // Wire events
  for (const panel of panels) {
    panel.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.closest && e.target.closest("button")) return;
      if (!isDesktopOverlay()) return;
      activate(panel);
    });

    const collapseBtn = panel.querySelector('[data-action="collapse"]');
    if (collapseBtn) {
      collapseBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
      collapseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCollapse(panel);
      });
    }

    setupDrag(panel);
    setupResize(panel);
  }

  window.addEventListener("resize", normalizeIntoBounds);
  normalizeIntoBounds();

  if (mobileTabsEl) {
    mobileTabsEl.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-open-panel]");
      if (!btn) return;
      openMobilePanel(btn.getAttribute("data-open-panel"));
    });
  }

  if (mobileCloseEl) {
    mobileCloseEl.addEventListener("click", () => closeMobilePanel());
  }

  if (mobileOverlayEl) {
    mobileOverlayEl.addEventListener("click", (e) => {
      if (e.target === mobileOverlayEl) closeMobilePanel();
    });

    mobileOverlayEl.addEventListener("pointerdown", (e) => {
      if (e.target === mobileOverlayEl) e.preventDefault();
    }, { passive: false });
  }

  // Mode switch (Desktop<->Mobile)
  const mqDesktop = window.matchMedia("(min-width: 981px)");
  const onModeChange = () => {
    closeMobilePanel();

    const hasSaved = panels.some(p => layout[p.dataset.panelId]);
    if (mqDesktop.matches && !hasSaved) {
      applyDefaultLayout(panels, boundsEl, layout, zCounter);
      saveLayout(layout);
      zCounter = layout.__zCounter || (zCounter + 10);
    }

    normalizeIntoBounds();
  };

  mqDesktop.addEventListener?.("change", onModeChange);

  return () => {
    window.removeEventListener("resize", normalizeIntoBounds);
    mqDesktop.removeEventListener?.("change", onModeChange);
  };
}
