import { buildDemoHotbarSlots } from "./hotbarData.js";

function isTouchLikely() {
  return window.matchMedia("(pointer: coarse)").matches;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nowMs() {
  return Date.now();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rectIntersects(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function positionTooltipDocked({ tooltipEl, anchorRect, padding = 8, gap = 8 }) {
  tooltipEl.classList.add("is-on");
  tooltipEl.style.left = "0px";
  tooltipEl.style.top = "0px";

  const tipRect = tooltipEl.getBoundingClientRect();
  const tipW = tipRect.width;
  const tipH = tipRect.height;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const anchor = anchorRect;

  const candidates = [
    { x: anchor.right + gap, y: anchor.bottom + gap },                 // RB (prefer)
    { x: anchor.left, y: anchor.bottom + gap },                        // BL
    { x: anchor.right + gap, y: anchor.top - tipH - gap },             // TR
    { x: anchor.left, y: anchor.top - tipH - gap },                    // TL
    { x: anchor.right + gap, y: anchor.top },                          // R
    { x: anchor.left - tipW - gap, y: anchor.top },                    // L
  ];

  const fits = (x, y) =>
    x >= padding &&
    y >= padding &&
    x + tipW <= vw - padding &&
    y + tipH <= vh - padding;

  for (const c of candidates) {
    const testRect = { left: c.x, top: c.y, right: c.x + tipW, bottom: c.y + tipH };
    if (fits(c.x, c.y) && !rectIntersects(testRect, anchor)) {
      tooltipEl.style.left = `${Math.round(c.x)}px`;
      tooltipEl.style.top = `${Math.round(c.y)}px`;
      return;
    }
  }

  // Fallback: clamp from preferred RB then push away from anchor if needed
  let x = anchor.right + gap;
  let y = anchor.bottom + gap;

  if (x + tipW > vw - padding) x = anchor.left;
  if (y + tipH > vh - padding) y = anchor.top - tipH - gap;

  x = clamp(x, padding, vw - tipW - padding);
  y = clamp(y, padding, vh - tipH - padding);

  let testRect = { left: x, top: y, right: x + tipW, bottom: y + tipH };
  if (rectIntersects(testRect, anchor)) {
    const downY = anchor.bottom + gap;
    const upY = anchor.top - tipH - gap;

    if (downY + tipH <= vh - padding) y = downY;
    else if (upY >= padding) y = upY;

    const rightX = anchor.right + gap;
    const leftX = anchor.left - tipW - gap;

    if (rightX + tipW <= vw - padding) x = rightX;
    else if (leftX >= padding) x = leftX;

    x = clamp(x, padding, vw - tipW - padding);
    y = clamp(y, padding, vh - tipH - padding);
  }

  tooltipEl.style.left = `${Math.round(x)}px`;
  tooltipEl.style.top = `${Math.round(y)}px`;
}

function createSlotButton(slot) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hotbarSlot";
  btn.setAttribute("role", "button");
  btn.dataset.icon = slot.icon || "sword";
  btn.dataset.slotId = slot.id;
  btn.setAttribute("aria-label", `${slot.name} (Taste ${slot.key})`);

  const key = document.createElement("div");
  key.className = "hotbarKey";
  key.textContent = slot.key;

  const icon = document.createElement("div");
  icon.className = "hotbarIcon";
  icon.setAttribute("aria-hidden", "true");

  const overlay = document.createElement("div");
  overlay.className = "hotbarOverlay";
  overlay.setAttribute("aria-hidden", "true");

  const shade = document.createElement("div");
  shade.className = "hotbarCooldownShade";

  const ring = document.createElement("div");
  ring.className = "hotbarCooldownRing";

  const inner = document.createElement("div");
  inner.className = "hotbarCooldownInner";

  const cdText = document.createElement("div");
  cdText.className = "hotbarCooldownText";
  cdText.textContent = "";

  overlay.appendChild(shade);
  overlay.appendChild(ring);
  overlay.appendChild(inner);
  overlay.appendChild(cdText);

  const charges = document.createElement("div");
  charges.className = "hotbarCharges";
  charges.textContent = "";

  btn.appendChild(key);
  btn.appendChild(icon);
  btn.appendChild(overlay);
  btn.appendChild(charges);

  btn._sr = { cdText, charges };

  return btn;
}

export function setupHotbar({
  slotsEl,
  tooltipEl,
  tooltipTitleEl,
  tooltipDescEl,
  tooltipMetaEl,
  onActivate,
  onFail,
}) {
  if (!slotsEl || !tooltipEl) return () => {};

  const wrapEl = slotsEl.closest(".hotbarWrap") || slotsEl.parentElement;
  const hotbarPanelEl = wrapEl?.closest?.(".hudPanel--hotbar");

  const originalTooltipParent = tooltipEl.parentElement;
  if (tooltipEl.parentElement !== document.body) document.body.appendChild(tooltipEl);

  const slots = buildDemoHotbarSlots();
  let selectedIndex = 0;
  let tooltipOpen = false;

  slotsEl.innerHTML = "";
  const slotButtons = slots.map((slot) => {
    const btn = createSlotButton(slot);
    slotsEl.appendChild(btn);
    return btn;
  });

  function setLayoutMode(mode) {
    slotsEl.classList.toggle("is-row10", mode === "row10");
    slotsEl.classList.toggle("is-grid2x5", mode === "grid2x5");
  }

  function readCssPx(el, propName, fallbackPx) {
    const v = getComputedStyle(el).getPropertyValue(propName).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallbackPx;
  }

  function applyAutoLayout() {
    if (!wrapEl) return;

    const slotPx = readCssPx(slotsEl, "--slot", 52);
    const gapPx = readCssPx(slotsEl, "--gap", 10);

    const available = wrapEl.clientWidth - 20;
    const needRow10 = (10 * slotPx) + (9 * gapPx);

    if (available >= needRow10) setLayoutMode("row10");
    else setLayoutMode("grid2x5");
  }

  let resizeObs = null;
  if (hotbarPanelEl && "ResizeObserver" in window) {
    resizeObs = new ResizeObserver(() => {
      applyAutoLayout();
      if (tooltipOpen) {
        const btn = slotButtons[selectedIndex];
        if (btn) showTooltipForIndex(selectedIndex, btn);
      }
    });
    resizeObs.observe(hotbarPanelEl);
  } else {
    window.addEventListener("resize", applyAutoLayout);
  }

  applyAutoLayout();

  function setSelected(index) {
    selectedIndex = Math.max(0, Math.min(index, slotButtons.length - 1));
    for (let i = 0; i < slotButtons.length; i++) {
      slotButtons[i].classList.toggle("is-selected", i === selectedIndex);
    }
  }

  function slotIsOnCooldown(slot) {
    return slot.cooldownEndMs > nowMs();
  }
  function slotHasCharges(slot) {
    return slot.maxCharges > 0;
  }
  function slotIsOutOfCharges(slot) {
    return slotHasCharges(slot) && slot.charges <= 0;
  }
  function slotIsUsable(slot) {
    if (slotIsOnCooldown(slot)) return false;
    if (slotIsOutOfCharges(slot)) return false;
    return true;
  }

  function buildMetaPills(slot) {
    const pills = [];
    pills.push({ text: `Taste ${slot.key}`, cls: "" });
    if (slot.baseMeta) pills.push({ text: slot.baseMeta, cls: "" });

    if (slotHasCharges(slot)) {
      pills.push({ text: `Charges ${slot.charges}/${slot.maxCharges}`, cls: "hotbarPill--charges" });
    }

    if (slot.cooldownSec > 0) {
      if (slotIsOnCooldown(slot)) {
        const rem = Math.max(0, slot.cooldownEndMs - nowMs()) / 1000;
        pills.push({ text: `Cooldown ${Math.ceil(rem)}s`, cls: "hotbarPill--cd" });
      } else {
        pills.push({ text: `Cooldown ${slot.cooldownSec}s`, cls: "hotbarPill--cd" });
      }
    }

    if (!slotIsUsable(slot)) {
      if (slotIsOnCooldown(slot)) pills.push({ text: "⛔ On Cooldown", cls: "hotbarPill--bad" });
      if (slotIsOutOfCharges(slot)) pills.push({ text: "⛔ Keine Charges", cls: "hotbarPill--bad" });
    }

    return pills;
  }

  function renderMetaPills(slot) {
    if (!tooltipMetaEl) return;
    const pills = buildMetaPills(slot);
    tooltipMetaEl.innerHTML = pills.map(p => {
      const cls = `hotbarPill ${p.cls || ""}`.trim();
      return `<span class="${cls}"><strong>•</strong> ${escapeHtml(p.text)}</span>`;
    }).join("");
  }

  function showTooltipForIndex(index, anchorEl) {
    const slot = slots[index];
    if (!slot) return;

    if (tooltipTitleEl) tooltipTitleEl.textContent = slot.name;
    if (tooltipDescEl) tooltipDescEl.textContent = slot.desc;
    renderMetaPills(slot);

    tooltipEl.setAttribute("aria-hidden", "false");
    tooltipEl.classList.add("is-on");
    tooltipOpen = true;

    const r = anchorEl.getBoundingClientRect();
    positionTooltipDocked({ tooltipEl, anchorRect: r, padding: 8, gap: 8 });
  }

  function hideTooltip() {
    tooltipEl.classList.remove("is-on");
    tooltipEl.setAttribute("aria-hidden", "true");
    tooltipOpen = false;
  }

  function updateSlotVisual(index) {
    const slot = slots[index];
    const btn = slotButtons[index];
    if (!slot || !btn) return;

    const hasC = slotHasCharges(slot);
    btn.classList.toggle("has-charges", hasC);
    btn._sr.charges.textContent = hasC ? `${slot.charges}/${slot.maxCharges}` : "";

    const onCd = slotIsOnCooldown(slot);
    btn.classList.toggle("is-cooldown", onCd);
    btn.classList.toggle("is-disabled", !slotIsUsable(slot));

    if (onCd) {
      const remMs = Math.max(0, slot.cooldownEndMs - nowMs());
      const rem = remMs / 1000;
      btn._sr.cdText.textContent = String(Math.ceil(rem));

      const dur = Math.max(0.001, slot.lastCooldownDurSec || slot.cooldownSec || 1);
      const progress = Math.max(0, Math.min(1, rem / dur));
      const angle = Math.round(360 * progress);
      btn.style.setProperty("--cdAngle", `${angle}deg`);
    } else {
      btn._sr.cdText.textContent = "";
      btn.style.setProperty("--cdAngle", `0deg`);
    }
  }

  function updateAllVisuals() {
    for (let i = 0; i < slots.length; i++) updateSlotVisual(i);
    if (tooltipOpen) {
      const btn = slotButtons[selectedIndex];
      if (btn) showTooltipForIndex(selectedIndex, btn);
    }
  }

  let tickTimer = null;

  function anyCooldownActive() {
    return slots.some(s => slotIsOnCooldown(s));
  }

  function ensureTicking() {
    if (tickTimer) return;
    tickTimer = window.setInterval(() => {
      const t = nowMs();

      for (const s of slots) {
        if (s.cooldownEndMs > 0 && s.cooldownEndMs <= t) {
          s.cooldownEndMs = 0;
          if (s.rechargeOnCooldownEnd && s.maxCharges > 0) {
            s.charges = Math.min(s.maxCharges, s.charges + 1);
          }
        }
      }

      updateAllVisuals();

      if (!anyCooldownActive()) {
        window.clearInterval(tickTimer);
        tickTimer = null;
      }
    }, 80);
  }

  function tryActivate(index) {
    const slot = slots[index];
    if (!slot) return false;

    if (!slotIsUsable(slot)) {
      if (slotIsOnCooldown(slot)) onFail?.(`⛔ ${slot.name}: noch auf Cooldown.`);
      else if (slotIsOutOfCharges(slot)) onFail?.(`⛔ ${slot.name}: keine Charges mehr.`);
      else onFail?.(`⛔ ${slot.name}: nicht verfügbar.`);
      return false;
    }

    if (slotHasCharges(slot)) slot.charges = Math.max(0, slot.charges - 1);

    if (slot.cooldownSec > 0) {
      slot.lastCooldownDurSec = slot.cooldownSec;
      slot.cooldownEndMs = nowMs() + Math.round(slot.cooldownSec * 1000);
      ensureTicking();
    }

    onActivate?.(slot);
    updateAllVisuals();
    return true;
  }

  function onPointerEnter(e) {
    if (isTouchLikely()) return;
    const btn = e.currentTarget;
    const idx = slotButtons.indexOf(btn);
    if (idx < 0) return;
    setSelected(idx);
    showTooltipForIndex(idx, btn);
  }

  function onPointerLeave() {
    if (!isTouchLikely()) hideTooltip();
  }

  function onClick(e) {
    const btn = e.currentTarget;
    const idx = slotButtons.indexOf(btn);
    if (idx < 0) return;

    if (isTouchLikely()) {
      if (!tooltipOpen || selectedIndex !== idx) {
        setSelected(idx);
        showTooltipForIndex(idx, btn);
        return;
      }
      const ok = tryActivate(idx);
      if (ok) hideTooltip();
      else showTooltipForIndex(idx, btn);
      return;
    }

    tryActivate(idx);
  }

  function onDocPointerDown(e) {
    if (!isTouchLikely()) return;
    if (!tooltipOpen) return;
    const t = e.target;
    const inside = wrapEl && wrapEl.contains(t);
    if (!inside) hideTooltip();
  }

  function onKeyDown(e) {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    const k = e.key;
    let idx = -1;
    if (k >= "1" && k <= "9") idx = Number(k) - 1;
    if (k === "0") idx = 9;

    if (idx >= 0) {
      e.preventDefault();
      setSelected(idx);
      const ok = tryActivate(idx);

      if (!isTouchLikely()) {
        const b = slotButtons[idx];
        if (b) showTooltipForIndex(idx, b);
        window.setTimeout(() => hideTooltip(), ok ? 700 : 1100);
      }
    }
  }

  function onWindowMove() {
    if (!tooltipOpen) return;
    const btn = slotButtons[selectedIndex];
    if (btn) showTooltipForIndex(selectedIndex, btn);
  }

  slotButtons.forEach((btn) => {
    btn.addEventListener("pointerenter", onPointerEnter);
    btn.addEventListener("pointerleave", onPointerLeave);
    btn.addEventListener("click", onClick);
  });

  document.addEventListener("pointerdown", onDocPointerDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onWindowMove);
  window.addEventListener("scroll", onWindowMove, true);

  setSelected(0);
  updateAllVisuals();

  return () => {
    slotButtons.forEach((btn) => {
      btn.removeEventListener("pointerenter", onPointerEnter);
      btn.removeEventListener("pointerleave", onPointerLeave);
      btn.removeEventListener("click", onClick);
    });

    document.removeEventListener("pointerdown", onDocPointerDown);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onWindowMove);
    window.removeEventListener("scroll", onWindowMove, true);

    if (tickTimer) window.clearInterval(tickTimer);
    tickTimer = null;

    if (resizeObs) resizeObs.disconnect();
    else window.removeEventListener("resize", applyAutoLayout);

    if (originalTooltipParent && tooltipEl.parentElement !== originalTooltipParent) {
      originalTooltipParent.appendChild(tooltipEl);
    }
  };
}
