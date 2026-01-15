/**
 * src/ui/panels.js
 * -----------------------------------------------------------------------------
 * BG3-like Desktop HUD Panels:
 * - Drag (Titelbar)
 * - Resize (Ecke)
 * - Z-Order: angeklicktes Panel kommt nach vorne
 * - Persistenz: Position/Größe/Collapsed in localStorage
 *
 * WICHTIG:
 * - Wir aktivieren Drag/Resize nur, wenn wir im "Desktop Overlay" sind (>=981px).
 * - Auf Mobile bleiben die Panels normale Blöcke (CSS übernimmt das).
 */

const STORAGE_KEY = "sr.panels.v1";

/**
 * Hilfsfunktion: clamp = Wert begrenzen
 */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * true, wenn Desktop-Overlay aktiv sein soll (muss zur CSS Media Query passen!)
 */
function isDesktopOverlay() {
  return window.matchMedia("(min-width: 981px)").matches;
}

/**
 * Load gespeichertes Layout (oder null)
 */
function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save Layout
 */
function saveLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Falls storage blockiert ist, ignorieren wir das einfach.
  }
}

/**
 * Setup Panels:
 * - HUD Container + Panels finden
 * - gespeichertes Layout anwenden
 * - Events: Drag/Resize/Collapse
 */
export function setupPanels({ hudEl, boundsEl }) {
  const panels = Array.from(hudEl.querySelectorAll(".hudPanel"));
  const layout = loadLayout() || {};
  let zCounter = layout.__zCounter || 10;

  // --- 1) Layout anwenden ---------------------------------------------------
  for (const panel of panels) {
    const id = panel.dataset.panelId;
    const saved = layout[id];

    if (saved) {
      // Position/Größe als CSS-Variablen setzen
      if (typeof saved.x === "string") panel.style.setProperty("--x", saved.x);
      if (typeof saved.y === "string") panel.style.setProperty("--y", saved.y);
      if (typeof saved.w === "string") panel.style.setProperty("--w", saved.w);
      if (typeof saved.h === "string") panel.style.setProperty("--h", saved.h);

      // Collapsed
      if (saved.collapsed) panel.classList.add("is-collapsed");

      // Z-Index
      if (typeof saved.z === "number") panel.style.zIndex = String(saved.z);
    } else {
      // Default z-index
      panel.style.zIndex = String(zCounter++);
    }
  }

  // --- 2) Helper: Panel state ins Layout schreiben und speichern ------------
  function commitPanel(panel) {
    const id = panel.dataset.panelId;
    if (!id) return;

    // Wir speichern Strings inklusive "px" oder "calc(...)"
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

  // --- 3) Focus/Z-Order -----------------------------------------------------
  function activate(panel) {
    for (const p of panels) p.classList.remove("is-active");
    panel.classList.add("is-active");

    // nach vorne holen
    panel.style.zIndex = String(++zCounter);
    commitPanel(panel);
  }

  // --- 4) Collapse Button ---------------------------------------------------
  function toggleCollapse(panel) {
    panel.classList.toggle("is-collapsed");
    commitPanel(panel);
  }

  // --- 5) Drag/Resize Implementation ---------------------------------------
  // Wir benutzen Pointer Events (funktioniert für Mouse + Touch, aber Touch ist
  // in Mobile-Layout eh deaktiviert durch CSS/Breakpoint).
  function setupDrag(panel) {
    const handle = panel.querySelector("[data-drag-handle]");
    if (!handle) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    function getPanelRect() {
      return panel.getBoundingClientRect();
    }

    function getBoundsRect() {
      return boundsEl.getBoundingClientRect();
    }

    // Wir parsen aktuell gesetzte --x/--y (in px) für wirklich saubere clamps.
    // Wenn x/y ein calc(...) ist, nehmen wir als Start die reale Pixelposition.
    function getCurrentXYpx() {
      const b = getBoundsRect();
      const r = getPanelRect();
      return {
        x: r.left - b.left,
        y: r.top - b.top,
      };
    }

    handle.addEventListener("pointerdown", (e) => {
      if (!isDesktopOverlay()) return;

      // Links-Klick / Primary pointer only
      if (e.button !== 0) return;

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
      const r = getPanelRect();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // neue Position (in px) + clamp innerhalb bounds
      const newX = clamp(startLeft + dx, 0, b.width - r.width);
      const newY = clamp(startTop + dy, 0, b.height - r.height);

      // als CSS var speichern
      panel.style.setProperty("--x", `${Math.round(newX)}px`);
      panel.style.setProperty("--y", `${Math.round(newY)}px`);
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      handle.style.cursor = "grab";
      commitPanel(panel);
      try { handle.releasePointerCapture(e.pointerId); } catch {}
    }

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  function setupResize(panel) {
    const handle = panel.querySelector("[data-resize-handle]");
    if (!handle) return;

    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;

    function getBoundsRect() {
      return boundsEl.getBoundingClientRect();
    }

    handle.addEventListener("pointerdown", (e) => {
      if (!isDesktopOverlay()) return;
      if (e.button !== 0) return;

      activate(panel);

      resizing = true;
      handle.setPointerCapture(e.pointerId);

      startX = e.clientX;
      startY = e.clientY;

      const rect = panel.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;

      e.preventDefault();
    });

    handle.addEventListener("pointermove", (e) => {
      if (!resizing) return;
      if (!isDesktopOverlay()) return;

      const b = getBoundsRect();
      const rect = panel.getBoundingClientRect();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Minimalgrößen (damit das Panel bedienbar bleibt)
      const minW = 220;
      const minH = 90;

      // Begrenzen, damit es nicht aus dem Bounds-Bereich rauswächst
      // Wir rechnen: aktuelle Panel-Position + neue Größe <= bounds
      const panelLeft = rect.left - b.left;
      const panelTop = rect.top - b.top;

      const maxW = Math.max(minW, b.width - panelLeft);
      const maxH = Math.max(minH, b.height - panelTop);

      const newW = clamp(startW + dx, minW, maxW);
      const newH = clamp(startH + dy, minH, maxH);

      panel.style.setProperty("--w", `${Math.round(newW)}px`);
      panel.style.setProperty("--h", `${Math.round(newH)}px`);
    });

    function endResize(e) {
      if (!resizing) return;
      resizing = false;
      commitPanel(panel);
      try { handle.releasePointerCapture(e.pointerId); } catch {}
    }

    handle.addEventListener("pointerup", endResize);
    handle.addEventListener("pointercancel", endResize);
  }

  // --- 6) Panel Events verdrahten ------------------------------------------
  for (const panel of panels) {
    // Klick: aktivieren (nach vorne)
    panel.addEventListener("pointerdown", () => {
      if (!isDesktopOverlay()) return;
      activate(panel);
    });

    // Collapse Button
    const collapseBtn = panel.querySelector('[data-action="collapse"]');
    if (collapseBtn) {
      collapseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCollapse(panel);
      });
    }

    setupDrag(panel);
    setupResize(panel);
  }

  // --- 7) Bei Resize (Breakpoint Wechsel) aktivieren wir “sicheren Zustand”
  // Wenn du vom Desktop ins Mobile wechselst, ist das okay (CSS übernimmt).
  // Wenn du vom Mobile ins Desktop wechselst, sorgen wir dafür, dass Panels
  // vernünftig in Bounds liegen (besonders nach sehr kleinen Viewports).
  function normalizeIntoBounds() {
    if (!isDesktopOverlay()) return;

    const b = boundsEl.getBoundingClientRect();

    for (const panel of panels) {
      const r = panel.getBoundingClientRect();

      const left = clamp(r.left - b.left, 0, b.width - r.width);
      const top = clamp(r.top - b.top, 0, b.height - r.height);

      panel.style.setProperty("--x", `${Math.round(left)}px`);
      panel.style.setProperty("--y", `${Math.round(top)}px`);

      commitPanel(panel);
    }
  }

  window.addEventListener("resize", normalizeIntoBounds);

  // Initial normalize (hilft, wenn calc(100% - ...) etc. benutzt wurde)
  normalizeIntoBounds();

  // Cleanup
  return () => {
    window.removeEventListener("resize", normalizeIntoBounds);
  };
}
