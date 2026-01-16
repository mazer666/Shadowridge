/**
 * src/ui/panels/docking.js
 * -----------------------------------------------------------------------------
 * Reine Docking/Snapping Logik + Guides.
 *
 * Ziel:
 * - Panels können beim Drag/Resize an Ränder und aneinander "snappen"
 * - Sichtbare Guides (goldene Linien)
 *
 * Diese Datei enthält bewusst KEINE Pointer-Events und KEIN LocalStorage.
 * Das bleibt im Controller (panels.js).
 */

export const SNAP_DIST = 12; // wie nah muss man sein, um einzurasten?
export const DOCK_GAP = 12;  // Abstand, wenn Panels "aneinander" docken

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Docking Guides (goldene Linien).
 * Wir erzeugen sie dynamisch, damit du nicht am HTML schrauben musst.
 */
export function ensureDockGuides(boundsEl) {
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
  return { vLine, hLine };
}

export function hideGuides(vLine, hLine) {
  vLine?.classList.remove("is-on");
  hLine?.classList.remove("is-on");
}

/**
 * Panel-Rechtecke in "bounds"-Koordinaten (px) holen.
 * excludePanel wird ausgelassen (z.B. das Panel, das gerade gezogen wird).
 */
export function getPanelRectsInBounds(panels, boundsEl, excludePanel) {
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
 * - x/y sind die gewünschte Position (oben links) innerhalb bounds
 * - w/h sind Panelgröße
 * - others sind die anderen Panel-Rects (bounds-koordinaten)
 *
 * Rückgabe:
 * { x, y, guideX, guideY }
 */
export function snapDrag({
  x, y, w, h,
  boundsW, boundsH,
  others,
  allowSnap,
  snapDist = SNAP_DIST,
  dockGap = DOCK_GAP,
}) {
  if (!allowSnap) return { x, y, guideX: null, guideY: null };

  const xCandidates = [];
  const yCandidates = [];

  // 1) Bounds edges
  xCandidates.push({ val: 0, guide: 0 });                 // left
  xCandidates.push({ val: boundsW - w, guide: boundsW }); // right (guide at boundsW)
  yCandidates.push({ val: 0, guide: 0 });                 // top
  yCandidates.push({ val: boundsH - h, guide: boundsH }); // bottom

  // 2) other panels edges + adjacency docking
  for (const o of others) {
    // Align edges
    xCandidates.push({ val: o.left, guide: o.left });
    xCandidates.push({ val: o.right - w, guide: o.right }); // align our right to their right
    xCandidates.push({ val: o.left - w, guide: o.left });   // align our right to their left

    // adjacency (with gap)
    xCandidates.push({ val: o.right + dockGap, guide: o.right });
    xCandidates.push({ val: o.left - w - dockGap, guide: o.left });

    // Y equivalents
    yCandidates.push({ val: o.top, guide: o.top });
    yCandidates.push({ val: o.bottom - h, guide: o.bottom });
    yCandidates.push({ val: o.top - h, guide: o.top });

    yCandidates.push({ val: o.bottom + dockGap, guide: o.bottom });
    yCandidates.push({ val: o.top - h - dockGap, guide: o.top });
  }

  // find best x candidate
  let bestX = { dist: Infinity, val: x, guide: null };
  for (const c of xCandidates) {
    const d = Math.abs(x - c.val);
    if (d < bestX.dist) bestX = { dist: d, val: c.val, guide: c.guide };
  }

  // find best y candidate
  let bestY = { dist: Infinity, val: y, guide: null };
  for (const c of yCandidates) {
    const d = Math.abs(y - c.val);
    if (d < bestY.dist) bestY = { dist: d, val: c.val, guide: c.guide };
  }

  const outX = (bestX.dist <= snapDist) ? bestX.val : x;
  const outY = (bestY.dist <= snapDist) ? bestY.val : y;

  return {
    x: outX,
    y: outY,
    guideX: (bestX.dist <= snapDist) ? bestX.guide : null,
    guideY: (bestY.dist <= snapDist) ? bestY.guide : null,
  };
}

/**
 * Snap-Rechnung für Resize:
 * Wir snappen RIGHT und BOTTOM Kante (w/h) an bounds oder andere Panels.
 */
export function snapResize({
  left, top, w, h,
  boundsW, boundsH,
  others,
  allowSnap,
  snapDist = SNAP_DIST,
  dockGap = DOCK_GAP,
}) {
  if (!allowSnap) return { w, h, guideX: null, guideY: null };

  const right = left + w;
  const bottom = top + h;

  const rightCandidates = [{ edge: boundsW, guide: boundsW }];
  const bottomCandidates = [{ edge: boundsH, guide: boundsH }];

  for (const o of others) {
    // right edge snap to other edges (+ adjacency)
    rightCandidates.push({ edge: o.left, guide: o.left });
    rightCandidates.push({ edge: o.right, guide: o.right });
    rightCandidates.push({ edge: o.left - dockGap, guide: o.left });
    rightCandidates.push({ edge: o.right + dockGap, guide: o.right });

    // bottom edge snap to other edges (+ adjacency)
    bottomCandidates.push({ edge: o.top, guide: o.top });
    bottomCandidates.push({ edge: o.bottom, guide: o.bottom });
    bottomCandidates.push({ edge: o.top - dockGap, guide: o.top });
    bottomCandidates.push({ edge: o.bottom + dockGap, guide: o.bottom });
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

  const guideX = (bestR.dist <= snapDist) ? bestR.guide : null;
  const guideY = (bestB.dist <= snapDist) ? bestB.guide : null;

  if (bestR.dist <= snapDist) outW = bestR.edge - left;
  if (bestB.dist <= snapDist) outH = bestB.edge - top;

  // Sicherheit: nicht negativ werden
  outW = clamp(outW, 1, boundsW);
  outH = clamp(outH, 1, boundsH);

  return { w: outW, h: outH, guideX, guideY };
}
