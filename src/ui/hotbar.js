/**
 * src/ui/hotbar.js
 * -----------------------------------------------------------------------------
 * Hotbar (BG3-ish):
 * - 10 Slots (Keys 1..0)
 * - CSS-only Icons
 * - Tooltips:
 *    - Desktop (mouse): Tooltip als Overlay nahe Slot
 *    - Mobile (touch): Tooltip als Info-Block oberhalb der Slots (verdeckt nichts)
 * - Cooldown Overlay (Ring + Zahl)
 * - Charges Badge (x/y)
 *
 * Daten kommen aus: ./hotbarData.js
 */

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

function positionTooltipWithinWrap({ tooltipEl, wrapEl, anchorRect }) {
  const wrapRect = wrapEl.getBoundingClientRect();

  tooltipEl.style.left = "0px";
  tooltipEl.style.top = "0px";
  tooltipEl.classList.add("is-on");

  const tipRect = tooltipEl.getBoundingClientRect();

  let x = (anchorRect.left - wrapRect.left) + (anchorRect.width * 0.5) - (tipRect.width * 0.5);
  let y = (anchorRect.top - wrapRect.top) - tipRect.height - 10;

  x = Math.max(8, Math.min(x, wrapRect.width - tipRect.width - 8));
  y = Math.max(8, Math.min(y, wrapRect.height - tipRect.height - 8));

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

  btn._sr = { overlay, ring, cdText, charges };

  return btn;
}

function nowMs() {
  return Date.now();
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

  // ✅ Daten kommen jetzt aus eigener Datei (modular)
  const slots = buildDemoHotbarSlots();

  let selectedIndex = 0;
  let tooltipOpen = false;

  // Render Slots
  slotsEl.innerHTML = "";
  const slotButtons = slots.map((slot) => {
    const btn = createSlotButton(slot);
    slotsEl.appendChild(btn);
    return btn;
  });

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

    // Desktop: positionieren nahe Slot
    // Mobile: "inline" (CSS), also keine absolute Position
    if (!isTouchLikely() && wrapEl && anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      positionTooltipWithinWrap({ tooltipEl, wrapEl, anchorRect: r });
    } else {
      tooltipEl.style.left = "";
      tooltipEl.style.top = "";
    }
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
    if (hasC) btn._sr.charges.textContent = `${slot.charges}/${slot.maxCharges}`;
    else btn._sr.charges.textContent = "";

    const onCd = slotIsOnCooldown(slot);
    btn.classList.toggle("is-cooldown", onCd);
    btn.classList.toggle("is-disabled", !slotIsUsable(slot));

    if (onCd) {
      const remMs = Math.max(0, slot.cooldownEndMs - nowMs());
      const rem = remMs / 1000;
      btn._sr.cdText.textContent = String(Math.ceil(rem));

      const dur = Math.max(0.001, slot.lastCooldownDurSec || slot.cooldownSec || 1);
      const progress = Math.max(0, Math.min(1, rem / dur)); // 1..0
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
      const idx = selectedIndex;
      const btn = slotButtons[idx];
      if (btn) showTooltipForIndex(idx, btn);
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

          // Demo: am Cooldown-Ende 1 Charge zurück
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

  // Desktop Hover
  function onPointerEnter(e) {
    const btn = e.currentTarget;
    const idx = slotButtons.indexOf(btn);
    if (idx < 0) return;
    setSelected(idx);
    showTooltipForIndex(idx, btn);
  }

  function onPointerLeave() {
    if (!isTouchLikely()) hideTooltip();
  }

  // Click / Tap
  function onClick(e) {
    const btn = e.currentTarget;
    const idx = slotButtons.indexOf(btn);
    if (idx < 0) return;

    if (isTouchLikely()) {
      // 1. Tap -> Tooltip
      if (!tooltipOpen || selectedIndex !== idx) {
        setSelected(idx);
        showTooltipForIndex(idx, btn);
        return;
      }

      // 2. Tap -> Activate
      const ok = tryActivate(idx);
      if (ok) hideTooltip();
      else showTooltipForIndex(idx, btn);
      return;
    }

    // Desktop: sofort aktivieren
    tryActivate(idx);
  }

  // Outside closes tooltip (Mobile)
  function onDocPointerDown(e) {
    if (!isTouchLikely()) return;
    if (!tooltipOpen) return;

    const t = e.target;
    const insideHotbar = wrapEl && wrapEl.contains(t);
    if (!insideHotbar) hideTooltip();
  }

  // Keyboard 1..0
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

  // Wire
  slotButtons.forEach((btn) => {
    btn.addEventListener("pointerenter", onPointerEnter);
    btn.addEventListener("pointerleave", onPointerLeave);
    btn.addEventListener("click", onClick);
  });

  document.addEventListener("pointerdown", onDocPointerDown);
  window.addEventListener("keydown", onKeyDown);

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

    if (tickTimer) window.clearInterval(tickTimer);
    tickTimer = null;
  };
}
