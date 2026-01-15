/**
 * src/ui/hotbar.js
 * -----------------------------------------------------------------------------
 * BG3-like Hotbar:
 * - 10 Slots (Keys 1..0)
 * - Icons ohne Assets: nur CSS (wir setzen data-icon am Slot)
 * - Hover Tooltips (Desktop) + Tap Tooltips (Mobile)
 * - Aktionen per Klick oder Tastatur
 *
 * Integration:
 * - setupHotbar({ slotsEl, tooltipEl, onActivate })
 * - Du kannst später echte Skills/Items einhängen (Cooldowns, Charges, etc.)
 */

function keyFromIndex(i) {
  // Slot 0..9 -> Key "1".."9","0"
  return i === 9 ? "0" : String(i + 1);
}

/**
 * Ermittelt, ob wir eher "Touch" sind.
 * (Nicht perfekt, aber gut genug fürs Tooltip-Verhalten.)
 */
function isTouchLikely() {
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Tooltip positioniert nahe am Slot (innerhalb der hotbarWrap).
 * Damit der Tooltip nicht rausfliegt, clampen wir in die Wrap-Grenzen.
 */
function positionTooltipWithinWrap({ tooltipEl, wrapEl, anchorRect }) {
  const wrapRect = wrapEl.getBoundingClientRect();

  // Tooltip kurz sichtbar machen, damit wir Maße messen können
  tooltipEl.style.left = "0px";
  tooltipEl.style.top = "0px";
  tooltipEl.classList.add("is-on");

  const tipRect = tooltipEl.getBoundingClientRect();

  // Ziel: über dem Slot, leicht versetzt
  let x = (anchorRect.left - wrapRect.left) + (anchorRect.width * 0.5) - (tipRect.width * 0.5);
  let y = (anchorRect.top - wrapRect.top) - tipRect.height - 10;

  // Clamp: innerhalb wrap
  x = Math.max(8, Math.min(x, wrapRect.width - tipRect.width - 8));
  y = Math.max(8, Math.min(y, wrapRect.height - tipRect.height - 8));

  tooltipEl.style.left = `${Math.round(x)}px`;
  tooltipEl.style.top = `${Math.round(y)}px`;
}

/**
 * Baut einen Slot-Button (DOM) vollständig.
 */
function createSlotButton(slot) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hotbarSlot";
  btn.setAttribute("role", "button");

  // data-* für CSS Icon-Auswahl und fürs Tooltip
  btn.dataset.icon = slot.icon || "sword";
  btn.dataset.slotId = slot.id;

  // Accessibility
  btn.setAttribute("aria-label", `${slot.name} (Taste ${slot.key})`);

  // Key label oben links
  const key = document.createElement("div");
  key.className = "hotbarKey";
  key.textContent = slot.key;

  // Icon-Fläche (das Icon selbst kommt via CSS ::before)
  const icon = document.createElement("div");
  icon.className = "hotbarIcon";
  icon.setAttribute("aria-hidden", "true");

  btn.appendChild(key);
  btn.appendChild(icon);

  return btn;
}

export function setupHotbar({
  slotsEl,
  tooltipEl,
  tooltipTitleEl,
  tooltipDescEl,
  tooltipMetaEl,
  onActivate,
}) {
  if (!slotsEl || !tooltipEl) return () => {};

  const wrapEl = slotsEl.closest(".hotbarWrap") || slotsEl.parentElement;

  // Demo-Slots (später ersetzt du das durch echte Skills/Items)
  const slots = Array.from({ length: 10 }, (_, i) => {
    const key = keyFromIndex(i);

    // kleine “Fantasy”-Demo-Actions
    const samples = [
      { name: "Hieb", icon: "sword", desc: "Ein schneller Nahkampfangriff.", meta: "AP 1 • Physisch" },
      { name: "Schildwall", icon: "shield", desc: "Kurzzeitig mehr Schutz.", meta: "AP 1 • Defensiv" },
      { name: "Trank", icon: "potion", desc: "Heilt eine kleine Menge.", meta: "Item • 2 Ladungen" },
      { name: "Funke", icon: "spell", desc: "Ein kleiner arkaner Stoß.", meta: "AP 2 • Magie" },
      { name: "Sprint", icon: "boot", desc: "Bewegung erhöht für kurze Zeit.", meta: "AP 1 • Buff" },
      { name: "Laterne", icon: "lantern", desc: "Licht an/aus – beeinflusst Sicht.", meta: "Toggle" },
    ];

    const s = samples[i % samples.length];

    return {
      id: `slot-${i}`,
      index: i,
      key,
      name: s.name,
      desc: s.desc,
      meta: s.meta,
      icon: s.icon,
    };
  });

  // UI State
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

  function showTooltipForIndex(index, anchorEl) {
    const slot = slots[index];
    if (!slot) return;

    if (tooltipTitleEl) tooltipTitleEl.textContent = slot.name;
    if (tooltipDescEl) tooltipDescEl.textContent = slot.desc;
    if (tooltipMetaEl) tooltipMetaEl.textContent = `Taste ${slot.key} • ${slot.meta}`;

    tooltipEl.setAttribute("aria-hidden", "false");

    // Position
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

  function activate(index) {
    const slot = slots[index];
    if (!slot) return;

    setSelected(index);
    onActivate?.(slot);
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
    // Desktop Hover: Tooltip aus, sobald man weggeht
    // (Auf Touch lassen wir Tooltip länger stehen)
    if (!isTouchLikely()) hideTooltip();
  }

  // Click / Tap
  function onClick(e) {
    const btn = e.currentTarget;
    const idx = slotButtons.indexOf(btn);
    if (idx < 0) return;

    // Mobile: Tap zeigt Tooltip; zweiter Tap aktiviert
    if (isTouchLikely()) {
      if (!tooltipOpen || selectedIndex !== idx) {
        setSelected(idx);
        showTooltipForIndex(idx, btn);
        return;
      }
    }

    activate(idx);
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
    // Wir wollen nicht stören, wenn der User gerade in einem Input wäre (später relevant)
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    // Key -> Index
    const k = e.key;
    let idx = -1;
    if (k >= "1" && k <= "9") idx = Number(k) - 1;
    if (k === "0") idx = 9;

    if (idx >= 0) {
      e.preventDefault();
      activate(idx);

      // Tooltip kurz zeigen (Desktop)
      if (!isTouchLikely()) {
        showTooltipForIndex(idx, slotButtons[idx]);
        window.setTimeout(() => hideTooltip(), 900);
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

  // Cleanup
  return () => {
    slotButtons.forEach((btn) => {
      btn.removeEventListener("pointerenter", onPointerEnter);
      btn.removeEventListener("pointerleave", onPointerLeave);
      btn.removeEventListener("click", onClick);
    });
    document.removeEventListener("pointerdown", onDocPointerDown);
    window.removeEventListener("keydown", onKeyDown);
  };
}
