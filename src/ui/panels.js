/**
 * src/ui/panels.js
 * -----------------------------------------------------------------------------
 * Desktop (>=981px):
 * - Drag (Titelbar)
 * - Resize (Ecke)
 * - Z-Order: angeklicktes Panel nach vorne
 * - Persistenz: Position/Größe/Collapsed in localStorage
 * - (NEU) vernünftige Default-Positionen/Größen, wenn noch nichts gespeichert ist
 *
 * Mobile (<=980px):
 * - Unter der Karte Buttons (Party/Inventar/Log/Hotbar)
 * - Tap öffnet Panel als Fullscreen Sheet (.is-mobile-open)
 * - Overlay/Close Button schließt wieder
 */

const STORAGE_KEY = "sr.panels.v2"; // v2 weil wir Defaults/Mode erweitert haben

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
 * Erzeugt ein “gutes” Default Layout basierend auf der Map-Fläche (boundsEl).
 * Das ist viel besser als harte calc()-Strings im HTML.
 */
function applyDefaultLayout(panels, boundsEl, layoutRef, zStart = 10) {
  const b = boundsEl.getBoundingClientRect();
  const margin = 16;

  // Helfer
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

  // Größen mit “BG3 HUD Gefühl”
  const partyW = 320;
  const partyH = 240;

  const invW = 340;
  const invH = 320;

  const logW = Math.min(560, Math.max(420, b.width * 0.52));
  const logH = 240;

  const hotW = Math.min(520, Math.max(380, b.width * 0.45));
  const hotH = 110;

  // Positionen
  put("party", margin, margin, partyW, partyH, zStart + 1);
  put("inventory", b.width - invW - margin, margin, invW, invH, zStart + 2);
  put("log", margin, b.height - logH - margin, logW, logH, zStart + 3);
  put("hotbar", (b.width - hotW) / 2, b.height - hotH - margin, hotW, hotH, zStart + 4);

  layoutRef.__zCounter = zStart + 10;
}

export function setupPanels({ hudEl, boundsEl, mobileTabsEl, mobileOverlayEl, mobileCloseEl }) {
  const panels = Array.from(hudEl.querySelectorAll(".hudPanel"));

  let layout = loadLayout() || {};
  let zCounter = layout.__zCounter || 10;

  // --- 1) Wenn noch kein Layout gespeichert ist, setze “gute Defaults” (Desktop)
  // Wir machen das nur im Desktop Mode, weil Mobile Fullscreen Panels nutzt.
  const hasAnyPanelSaved = panels.some(p => layout[p.dataset.panelId]);
  if (!hasAnyPanelSaved && isDesktopOverlay()) {
    applyDefaultLayout(panels, boundsEl, layout, zCounter);
    saveLayout(layout);
    zCounter = layout.__zCounter || (zCounter + 10);
  }

  // --- 2) Layout anwenden (wenn vorhanden)
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
  }

  // --- Helper: Panel Layout speichern --------------------------------------
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

  // --- Focus/Z-Order -------------------------------------------------------
  function activate(panel) {
    for (const p of panels) p.classList.remove("is-active");
    panel.classList.add("is-active");
    panel.style.zIndex = String(++zCounter);
    commitPanel(panel);
  }

  function toggleCollapse(panel) {
    panel.classList.toggle("is-collapsed");
    commitPanel(panel);
  }

  // --- Drag ----------------------------------------------------------------
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
      return { x: r.left - b.left, y: r.top - b.top };
    }

    handle.addEventListener("pointerdown", (e) => {
      if (!isDesktopOverlay()) return;
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
      const r = panel.getBoundingClientRect();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newX = clamp(startLeft + dx, 0, b.width - r.width);
      const newY = clamp(startTop + dy, 0, b.height - r.height);

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

  // --- Resize --------------------------------------------------------------
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

      const minW = 240;
      const minH = 100;

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

  // --- Normalize in bounds (Desktop) --------------------------------------
  function normalizeIntoBounds() {
    if (!isDesktopOverlay()) return;

    const b = boundsEl.getBoundingClientRect();

    for (const panel of panels) {
      // Wenn ein Panel im Mobile Fullscreen ist, nicht anfassen
      if (panel.classList.contains("is-mobile-open")) continue;

      const r = panel.getBoundingClientRect();
      const left = clamp(r.left - b.left, 0, b.width - r.width);
      const top = clamp(r.top - b.top, 0, b.height - r.height);

      panel.style.setProperty("--x", `${Math.round(left)}px`);
      panel.style.setProperty("--y", `${Math.round(top)}px`);
      commitPanel(panel);
    }
  }

  // --- Mobile Fullscreen Panels -------------------------------------------
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

    if (mobileOverlayEl) {
      mobileOverlayEl.classList.add("is-open");
      mobileOverlayEl.setAttribute("aria-hidden", "false");
    }
  }

  // --- Wire events ---------------------------------------------------------
  for (const panel of panels) {
    // Activate on pointerdown (Desktop)
    panel.addEventListener("pointerdown", () => {
      if (!isDesktopOverlay()) return;
      activate(panel);
    });

    // Collapse
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

  // Desktop resize normalize
  window.addEventListener("resize", normalizeIntoBounds);
  normalizeIntoBounds();

  // Mobile buttons
  if (mobileTabsEl) {
    mobileTabsEl.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-open-panel]");
      if (!btn) return;
      const panelId = btn.getAttribute("data-open-panel");
      openMobilePanel(panelId);
    });
  }

  // Mobile close
  if (mobileCloseEl) {
    mobileCloseEl.addEventListener("click", () => closeMobilePanel());
  }
  if (mobileOverlayEl) {
    // Klick auf Backdrop schließt auch
    mobileOverlayEl.addEventListener("click", (e) => {
      // Wenn man exakt aufs Overlay klickt (nicht auf Close-Button), schließen
      if (e.target === mobileOverlayEl) closeMobilePanel();
    });
  }

  // Wenn wir vom Mobile->Desktop wechseln: Mobile Panels schließen und Desktop bounds normalisieren
  const mqDesktop = window.matchMedia("(min-width: 981px)");
  const onModeChange = () => {
    closeMobilePanel();

    // Wenn jetzt Desktop aktiv ist und (noch) kein Layout existiert, setze Defaults
    const hasSaved = panels.some(p => layout[p.dataset.panelId]);
    if (mqDesktop.matches && !hasSaved) {
      applyDefaultLayout(panels, boundsEl, layout, zCounter);
      saveLayout(layout);
      zCounter = layout.__zCounter || (zCounter + 10);
    }

    normalizeIntoBounds();
  };

  mqDesktop.addEventListener?.("change", onModeChange);

  // Cleanup
  return () => {
    window.removeEventListener("resize", normalizeIntoBounds);
    mqDesktop.removeEventListener?.("change", onModeChange);
  };
}
