/**
 * src/ui/panels.js
 * -----------------------------------------------------------------------------
 * Desktop (>=981px):
 * - Drag (Titelbar)
 * - Resize (Ecke)
 * - Z-Order
 * - Persistenz
 * - Collapse = Mini-Panel (Titlebar bleibt sichtbar)
 * - (NEU) Docking/Snapping:
 *    - an Bounds (Kartenrand / Map-Container)
 *    - an andere Panels (Kanten ausrichten, “aneinander” andocken)
 *    - sichtbare Guides (goldene Linien)
 *    - ALT gedrückt: Snapping temporär aus
 *
 * Mobile (<=980px):
 * - Buttons unter der Karte öffnen Panels Fullscreen (.is-mobile-open)
 */

const STORAGE_KEY = "sr.panels.v2";

/** Snapping-Parameter (leicht anpassbar) */
const SNAP_DIST = 12;   // wie nah muss man sein, um einzurasten?
const DOCK_GAP  = 12;   // Abstand, wenn Panels "aneinander" docken

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
 * Default-Layout basierend auf boundsEl (Map-Fläche).
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
  const hotH = 110;

  put("party", margin, margin, partyW, partyH, zStart + 1);
  put("inventory", b.width - invW - margin, margin, invW, invH, zStart + 2);
  put("log", margin, b.height - logH - margin, logW, logH, zStart + 3);
  put("hotbar", (b.width - hotW) / 2, b.height - hotH - margin, hotW, hotH, zStart + 4);

  layoutRef.__zCounter = zStart + 10;
}

/**
 * Docking Guides (goldene Linien).
 * Wir erzeugen sie dynamisch, damit du nicht am HTML schrauben musst.
 */
function ensureDockGuides(boundsEl) {
  let guides = boundsEl.querySelector(".dockGuides");
  if (!guides) {
    guides = document.createElement("div");
    guides.className = "dockGuides";
    guides.setAttribute("aria-hidden", "true");

    const v = document.createElement("div");
    v.className = "dockGuideLine dockGuideLine--v";
    const h = document.createElement("div");
    h.className = "dockGuideLine dockGuideLine--h";

    guides.appendChild(v);
    guides.appendChild(h);
    boundsEl.appendChild(guides);
  }

  const vLine = guides.querySelector(".dockGuideLine--v");
  const hLine = guides.querySelector(".dockGuideLine--h");
  return { guides, vLine, hLine };
}

function hideGuides(vLine, hLine) {
  vLine?.classList.remove("is-on");
  hLine?.classList.remove("is-on");
}

/**
 * Hilfsfunktion: Panel-Rechtecke in bounds-Koordinaten holen.
 */
function getPanelRectsInBounds(panels, boundsEl, excludePanel) {
  const b = boundsEl.getBoundingClientRect();

  return panels
    .filter(p => p !== excludePanel)
    .filter(p => !p.classList.contains("is-mobile-open"))
    .map(p => {
      const r = p.getBoundingClientRect();
      return {
        panel: p,
        left: r.left - b.left,
        top: r.top - b.top,
        right: r.right - b.left,
        bottom: r.bottom - b.top,
        width: r.width,
        height: r.height,
      };
    });
}

/**
 * Snap-Rechnung für Drag:
 * - x/y sind die gewünschte Position (oben links) in px innerhalb bounds
 * - w/h Panel Größe
 * - candidates: bounds edges + other panels edges + "dock adjacency"
 *
 * Rückgabe: { x, y, guideX, guideY }
 * - guideX: x-Koordinate für vertikale Dock-Linie oder null
 * - guideY: y-Koordinate für horizontale Dock-Linie oder null
 */
function snapDrag({ x, y, w, h, boundsW, boundsH, others, allowSnap }) {
  if (!allowSnap) return { x, y, guideX: null, guideY: null };

  // Kandidaten für X/Y
  const xCandidates = [];
  const yCandidates = [];

  // 1) Bounds edges
  xCandidates.push({ val: 0, guide: 0 });                 // left
  xCandidates.push({ val: boundsW - w, guide: boundsW }); // right edge as guide at boundsW
  yCandidates.push({ val: 0, guide: 0 });                 // top
  yCandidates.push({ val: boundsH - h, guide: boundsH }); // bottom

  // 2) Align edges with other panels + adjacency docking
  for (const o of others) {
    // align left edge to other left
    xCandidates.push({ val: o.left, guide: o.left });
    // align left edge to other right - w (so our right aligns to their right)
    xCandidates.push({ val: o.right - w, guide: o.right });
    // align right edge to other left (our right -> their left)
    xCandidates.push({ val: o.left - w, guide: o.left });
    // adjacency docking: place right next to other (with gap)
    xCandidates.push({ val: o.right + DOCK_GAP, guide: o.right });
    // adjacency docking: place left next to other (with gap)
    xCandidates.push({ val: o.left - w - DOCK_GAP, guide: o.left });

    // Y equivalents
    yCandidates.push({ val: o.top, guide: o.top });
    yCandidates.push({ val: o.bottom - h, guide: o.bottom });
    yCandidates.push({ val: o.top - h, guide: o.top });
    yCandidates.push({ val: o.bottom + DOCK_GAP, guide: o.bottom });
    yCandidates.push({ val: o.top - h - DOCK_GAP, guide: o.top });
  }

  // best snap for x
  let bestX = { dist: Infinity, val: x, guide: null };
  for (const c of xCandidates) {
    const d = Math.abs(x - c.val);
    if (d < bestX.dist) bestX = { dist: d, val: c.val, guide: c.guide };
  }

  // best snap for y
  let bestY = { dist: Infinity, val: y, guide: null };
  for (const c of yCandidates) {
    const d = Math.abs(y - c.val);
    if (d < bestY.dist) bestY = { dist: d, val: c.val, guide: c.guide };
  }

  // apply if within threshold
  const outX = (bestX.dist <= SNAP_DIST) ? bestX.val : x;
  const outY = (bestY.dist <= SNAP_DIST) ? bestY.val : y;

  return {
    x: outX,
    y: outY,
    guideX: (bestX.dist <= SNAP_DIST) ? bestX.guide : null,
    guideY: (bestY.dist <= SNAP_DIST) ? bestY.guide : null,
  };
}

/**
 * Snap-Rechnung für Resize:
 * Wir snappen den RIGHT und BOTTOM Rand (w/h) an bounds oder andere Panels.
 */
function snapResize({ left, top, w, h, boundsW, boundsH, others, allowSnap }) {
  if (!allowSnap) return { w, h, guideX: null, guideY: null };

  const right = left + w;
  const bottom = top + h;

  // Kandidaten: bounds right/bottom + other panel edges (left/right/top/bottom)
  const rightCandidates = [{ edge: boundsW, guide: boundsW }];
  const bottomCandidates = [{ edge: boundsH, guide: boundsH }];

  for (const o of others) {
    // align right to other left/right (+ adjacency gap)
    rightCandidates.push({ edge: o.left, guide: o.left });
    rightCandidates.push({ edge: o.right, guide: o.right });
    rightCandidates.push({ edge: o.left - DOCK_GAP, guide: o.left });
    rightCandidates.push({ edge: o.right + DOCK_GAP, guide: o.right });

    // align bottom to other top/bottom (+ adjacency gap)
    bottomCandidates.push({ edge: o.top, guide: o.top });
    bottomCandidates.push({ edge: o.bottom, guide: o.bottom });
    bottomCandidates.push({ edge: o.top - DOCK_GAP, guide: o.top });
    bottomCandidates.push({ edge: o.bottom + DOCK_GAP, guide: o.bottom });
  }

  let bestR = { dist: Infinity, edge: right, guide: null };
  for (const c of rightCandidates) {
    const d = Math.abs(right - c.edge);
    if (d < bestR.dist) bestR = { dist: d, edge: c.edge, guide: c.guide };
  }

  let bestB = { dist: Infinity, edge: bottom, guide: null };
  for (const c of bottomCandidates) {
    const d = Math.abs(bottom - c.edge);
    if (d < bestB.dist) bestB = { dist: d, edge: c.edge, guide: c.guide };
  }

  let outW = w;
  let outH = h;

  const guideX = (bestR.dist <= SNAP_DIST) ? bestR.guide : null;
  const guideY = (bestB.dist <= SNAP_DIST) ? bestB.guide : null;

  if (bestR.dist <= SNAP_DIST) outW = bestR.edge - left;
  if (bestB.dist <= SNAP_DIST) outH = bestB.edge - top;

  return { w: outW, h: outH, guideX, guideY };
}

export function setupPanels({ hudEl, boundsEl, mobileTabsEl, mobileOverlayEl, mobileCloseEl }) {
  const panels = Array.from(hudEl.querySelectorAll(".hudPanel"));

  // Dock guides (Desktop)
  const { vLine, hLine } = ensureDockGuides(boundsEl);

  let layout = loadLayout() || {};
  let zCounter = layout.__zCounter || 10;

  // Desktop Defaults: nur wenn noch nichts gespeichert ist
  const hasAnyPanelSaved = panels.some(p => layout[p.dataset.panelId]);
  if (!hasAnyPanelSaved && isDesktopOverlay()) {
    applyDefaultLayout(panels, boundsEl, layout, zCounter);
    saveLayout(layout);
    zCounter = layout.__zCounter || (zCounter + 10);
  }

  // Layout anwenden + Button-Icons initial setzen
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

  // Speichern
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

  // Z-Order / Active
  function activate(panel) {
    for (const p of panels) p.classList.remove("is-active");
    panel.classList.add("is-active");
    panel.style.zIndex = String(++zCounter);
    commitPanel(panel);
  }

  // Collapse toggle
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

      // Rohposition
      let nx = clamp(startLeft + dx, 0, b.width - cur.w);
      let ny = clamp(startTop + dy, 0, b.height - cur.h);

      // Andere Panels als Snap-Kandidaten
      const others = getPanelRectsInBounds(panels, boundsEl, panel);

      const allowSnap = !e.altKey; // ALT gedrückt = frei bewegen
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
      } else {
        vLine.classList.remove("is-on");
      }

      if (snapped.guideY != null) {
        hLine.style.top = `${Math.round(snapped.guideY)}px`;
        hLine.classList.add("is-on");
      } else {
        hLine.classList.remove("is-on");
      }
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

      // roh
      let newW = clamp(startW + dx, minW, b.width - panelLeft);
      let newH = clamp(startH + dy, minH, b.height - panelTop);

      // andere panels als candidates
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

      // Guides anzeigen (wir zeigen die Kante, an die wir snappen: right/bottom)
      if (snapped.guideX != null) {
        vLine.style.left = `${Math.round(snapped.guideX)}px`;
        vLine.classList.add("is-on");
      } else {
        vLine.classList.remove("is-on");
      }

      if (snapped.guideY != null) {
        hLine.style.top = `${Math.round(snapped.guideY)}px`;
        hLine.classList.add("is-on");
      } else {
        hLine.classList.remove("is-on");
      }
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

  // Desktop: innerhalb bounds halten (z.B. nach Browser-Resize)
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

    if (mobileOverlayEl) {
      mobileOverlayEl.classList.add("is-open");
      mobileOverlayEl.setAttribute("aria-hidden", "false");
    }
  }

  // Wire events
  for (const panel of panels) {
    // Activate on pointerdown (aber nicht bei Button-Klick)
    panel.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.closest && e.target.closest("button")) return;
      if (!isDesktopOverlay()) return;
      activate(panel);
    });

    const collapseBtn = panel.querySelector('[data-action="collapse"]');
    if (collapseBtn) {
      // pointerdown stoppen, damit Drag nicht startet
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

  // Mobile buttons
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
  }

  // Mode switch
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
