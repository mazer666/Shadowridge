/**
 * src/ui/hotbar.js
 * -----------------------------------------------------------------------------
 * BG3-like Hotbar:
 * - 10 Slots (Keys 1..0)
 * - CSS-only Icons
 * - Tooltips (Hover desktop, Tap mobile)
 * - (NEU) Cooldown Overlay (Ring + Zahl) + Charges Badge (x/y)
 *
 * Verhalten:
 * - Wenn Slot cooldown aktiv -> nicht aktivierbar
 * - Wenn Slot charges hat und charges=0 -> nicht aktivierbar
 * - Tap mobile: 1. Tap Tooltip, 2. Tap aktiviert (oder zeigt Fail-Grund)
 */

function keyFromIndex(i) {
  return i === 9 ? "0" : String(i + 1);
}

function isTouchLikely() {
  return window.matchMedia("(pointer: coarse)").matches;
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

/**
 * Slot DOM komplett bauen (inkl. overlay + charges badge).
 */
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

  // Cooldown overlay (Ring + Shade + Text)
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

  // Charges badge
  const charges = document.createElement("div");
  charges.className = "hotbarCharges";
  charges.textContent = "";

  btn.appendChild(key);
  btn.appendChild(icon);
  btn.appendChild(overlay);
  btn.appendChild(charges);

  // Referenzen merken (so müssen wir später nicht querySelectorn)
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

  // Demo-Slots:
  // - Einige haben Cooldown
  // - Einige haben Charges
  // - Potion hat Charges aber (für Demo) keine Auto-Recharge
  const slots = Array.from({ length: 10 }, (_, i) => {
    const key = keyFromIndex(i);

    const samples = [
      { name: "Hieb", icon: "sword",  desc: "Ein schneller Nahkampfangriff.", meta: "AP 1 • Physisch", cd: 2.5, maxCharges: 0, recharge: false },
      { name: "Schildwall", icon: "shield", desc: "Kurzzeitig mehr Schutz.", meta: "AP 1 • Defensiv", cd: 6.0, maxCharges: 0, recharge: false },
      { name: "Trank", icon: "potion", desc: "Heilt eine kleine Menge.", meta: "Item", cd: 8.0, maxCharges: 2, recharge: false },
      { name: "Funke", icon: "spell",  desc: "Ein kleiner arkaner Stoß.", meta: "AP 2 • Magie", cd: 4.0, maxCharges: 3, recharge: true },
      { name: "Sprint", icon: "boot",   desc: "Bewegung erhöht für kurze Zeit.", meta: "AP 1 • Buff", cd: 5.0, maxCharges: 0, recharge: false },
      { name: "Laterne", icon: "lantern", desc: "Licht an/aus – beeinflusst Sicht.", meta: "Toggle", cd: 0.0, maxCharges: 0, recharge: false },
    ];

    const s = samples[i % samples.length];

    return {
      id: `slot-${i}`,
      index: i,
      key,
      name: s.name,
      desc: s.desc,
      baseMeta: s.meta,
      icon: s.icon,

      cooldownSec: s.cd,          // 0 = kein cooldown
      cooldownEndMs: 0,           // timestamp wenn cooldown läuft
      lastCooldownDurSec: 0,      // merkt die Dauer für progress

      maxCharges: s.maxCharges,   // 0 = keine charges
      charges: s.maxCharges > 0 ? s.maxCharges : 0,
      rechargeOnCooldownEnd: s.recharge, // für Demo: Funke lädt nach Cooldown wieder 1 Charge nach
    };
  });

  // UI state
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

  function formatMeta(slot) {
    const parts = [];
    parts.push(`Taste ${slot.key}`);
    if (slot.baseMeta) parts.push(slot.baseMeta);

    // Charges
    if (slotHasCharges(slot)) parts.push(`Charges ${slot.charges}/${slot.maxCharges}`);

    // Cooldown
    if (slot.cooldownSec > 0) {
      if (slotIsOnCooldown(slot)) {
        const rem = Math.max(0, slot.cooldownEndMs - nowMs()) / 1000;
        parts.push(`CD ${Math.ceil(rem)}s`);
      } else {
        parts.push(`CD ${slot.cooldownSec}s`);
      }
    }

    // Usability hint
    if (!slotIsUsable(slot)) {
      if (slotIsOnCooldown(slot)) parts.push("⛔ Cooldown");
      if (slotIsOutOfCharges(slot)) parts.push("⛔ Keine Charges");
    }

    return parts.join(" • ");
  }

  function showTooltipForIndex(index, anchorEl) {
    const slot = slots[index];
    if (!slot) return;

    if (tooltipTitleEl) tooltipTitleEl.textContent = slot.name;
    if (tooltipDescEl) tooltipDescEl.textContent = slot.desc;
    if (tooltipMetaEl) tooltipMetaEl.textContent = formatMeta(slot);

    tooltipEl.setAttribute("aria-hidden", "false");

    if (wrapEl && anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      positionTooltipWithinWrap({ tooltipEl, wrapEl, anchorRect: r });
    }

    tooltipEl.classList.add("is-on");
    tooltipOpen = true;
  }

  function hideTooltip() {
    tooltipEl.classList.remove("is-on");
    tooltipEl.setAttribute("aria-hidden", "true");
    tooltipOpen = false;
  }

  /**
   * UI aktualisieren (cooldown ring, text, charges badge, disabled class)
   */
  function updateSlotVisual(index) {
    const slot = slots[index];
    const btn = slotButtons[index];
    if (!slot || !btn) return;

    // Charges badge
    const hasC = slotHasCharges(slot);
    btn.classList.toggle("has-charges", hasC);

    if (hasC) {
      btn._sr.charges.textContent = `${slot.charges}/${slot.maxCharges}`;
    } else {
      btn._sr.charges.textContent = "";
    }

    // Cooldown visuals
    const onCd = slotIsOnCooldown(slot);
    btn.classList.toggle("is-cooldown", onCd);

    // Disabled state (cooldown OR 0 charges)
    btn.classList.toggle("is-disabled", !slotIsUsable(slot));

    if (onCd) {
      const remMs = Math.max(0, slot.cooldownEndMs - nowMs());
      const rem = remMs / 1000;
      btn._sr.cdText.textContent = String(Math.ceil(rem));

      const dur = Math.max(0.001, slot.lastCooldownDurSec || slot.cooldownSec || 1);
      const progress = clamp(rem / dur, 0, 1); // 1..0
      const angle = Math.round(360 * progress);
      // gold segment zeigt “remaining”
      btn.style.setProperty("--cdAngle", `${angle}deg`);
    } else {
      btn._sr.cdText.textContent = "";
      btn.style.setProperty("--cdAngle", `0deg`);
    }
  }

  function updateAllVisuals() {
    for (let i = 0; i < slots.length; i++) updateSlotVisual(i);
    // Tooltip Meta live aktualisieren (CD runterzählen), falls offen
    if (tooltipOpen) {
      const idx = selectedIndex;
      const btn = slotButtons[idx];
      if (btn) showTooltipForIndex(idx, btn);
    }
  }

  /**
   * Cooldown “Tick” (nur wenn nötig)
   */
  let tickTimer = null;

  function anyCooldownActive() {
    return slots.some(s => slotIsOnCooldown(s));
  }

  function ensureTicking() {
    if (tickTimer) return;
    tickTimer = window.setInterval(() => {
      // Cooldowns ablaufen lassen + ggf. Charges recharge
      const t = nowMs();

      for (const s of slots) {
        if (s.cooldownEndMs > 0 && s.cooldownEndMs <= t) {
          // Cooldown endet genau jetzt
          s.cooldownEndMs = 0;

          // Optional: pro Cooldown-Ende 1 Charge zurück (Demo für “Funke”)
          if (s.rechargeOnCooldownEnd && s.maxCharges > 0) {
            s.charges = Math.min(s.maxCharges, s.charges + 1);
          }
        }
      }

      updateAllVisuals();

      // wenn nichts mehr läuft, stoppen (Performance)
      if (!anyCooldownActive()) {
        window.clearInterval(tickTimer);
        tickTimer = null;
      }
    }, 80);
  }

  /**
   * Aktivierung: setzt cooldown, zieht charges ab
   */
  function tryActivate(index) {
    const slot = slots[index];
    if (!slot) return false;

    if (!slotIsUsable(slot)) {
      // Fail message
      if (slotIsOnCooldown(slot)) onFail?.(`⛔ ${slot.name}: noch auf Cooldown.`);
      else if (slotIsOutOfCharges(slot)) onFail?.(`⛔ ${slot.name}: keine Charges mehr.`);
      else onFail?.(`⛔ ${slot.name}: nicht verfügbar.`);
      return false;
    }

    // Charges verbrauchen
    if (slotHasCharges(slot)) {
      slot.charges = Math.max(0, slot.charges - 1);
    }

    // Cooldown starten
    if (slot.cooldownSec > 0) {
      slot.lastCooldownDurSec = slot.cooldownSec;
      slot.cooldownEndMs = nowMs() + Math.round(slot.cooldownSec * 1000);
      ensureTicking();
    }

    onActivate?.(slot);
    updateAllVisuals();
    return true;
  }

  // Desktop: Hover
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

      // 2. Tap -> Activate attempt
      const ok = tryActivate(idx);
      // wenn ok: Tooltip weg (BG3-Feeling: du “castest” und machst weiter)
      if (ok) hideTooltip();
      else showTooltipForIndex(idx, btn);
      return;
    }

    // Desktop: Klick aktiviert sofort
    tryActivate(idx);
  }

  // Outside click closes tooltip (Mobile)
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

      // Tooltip kurz zeigen (Desktop)
      if (!isTouchLikely()) {
        const b = slotButtons[idx];
        if (b) showTooltipForIndex(idx, b);
        window.setTimeout(() => hideTooltip(), ok ? 700 : 1100);
      }
    }
  }

  // Wire Events
  slotButtons.forEach((btn) => {
    btn.addEventListener("pointerenter", onPointerEnter);
    btn.addEventListener("pointerleave", onPointerLeave);
    btn.addEventListener("click", onClick);
  });

  document.addEventListener("pointerdown", onDocPointerDown);
  window.addEventListener("keydown", onKeyDown);

  // Initial
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
