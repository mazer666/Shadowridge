/**
 * src/ui/hotbarData.js
 * -----------------------------------------------------------------------------
 * Daten/Definitions-Schicht für die Hotbar.
 *
 * Ziel:
 * - UI (hotbar.js) rendert & verwaltet Cooldown/Charges/Tooltips
 * - Diese Datei liefert nur "Was gibt es für Slots?"
 *
 * Später:
 * - Ersetzt du die Demo-Daten durch echte Skills/Items aus deinem Game-State
 * - Oder du baust mehrere Presets (z.B. Klasse Krieger/Magier/Schurke)
 */

/**
 * Slot-Keys: 0..9 -> "1".."9","0"
 */
export function keyFromIndex(i) {
  return i === 9 ? "0" : String(i + 1);
}

/**
 * Demo-Slot-Definitionen (Vorlagen).
 * Du kannst diese Liste später leicht ersetzen (z.B. aus state.player.skills).
 */
function getDemoTemplates() {
  return [
    {
      name: "Hieb",
      icon: "sword",
      desc: "Ein schneller Nahkampfangriff.",
      meta: "AP 1 • Physisch",
      cd: 2.5,
      maxCharges: 0,
      recharge: false,
    },
    {
      name: "Schildwall",
      icon: "shield",
      desc: "Kurzzeitig mehr Schutz.",
      meta: "AP 1 • Defensiv",
      cd: 6.0,
      maxCharges: 0,
      recharge: false,
    },
    {
      name: "Trank",
      icon: "potion",
      desc: "Heilt eine kleine Menge.",
      meta: "Item",
      cd: 8.0,
      maxCharges: 2,
      recharge: false,
    },
    {
      name: "Funke",
      icon: "spell",
      desc: "Ein kleiner arkaner Stoß.",
      meta: "AP 2 • Magie",
      cd: 4.0,
      maxCharges: 3,
      recharge: true, // Demo: am Cooldown-Ende kommt 1 Charge zurück
    },
    {
      name: "Sprint",
      icon: "boot",
      desc: "Bewegung erhöht für kurze Zeit.",
      meta: "AP 1 • Buff",
      cd: 5.0,
      maxCharges: 0,
      recharge: false,
    },
    {
      name: "Laterne",
      icon: "lantern",
      desc: "Licht an/aus – beeinflusst Sicht.",
      meta: "Toggle",
      cd: 0.0,
      maxCharges: 0,
      recharge: false,
    },
  ];
}

/**
 * buildDemoHotbarSlots()
 * - liefert 10 Slots (Keys 1..0)
 * - rotiert durch die Templates
 *
 * Rückgabe-Objekte sind "runtime-ready":
 * - cooldownEndMs / charges etc. sind initialisiert,
 *   damit die UI sofort laufen kann.
 */
export function buildDemoHotbarSlots() {
  const templates = getDemoTemplates();

  return Array.from({ length: 10 }, (_, i) => {
    const key = keyFromIndex(i);
    const t = templates[i % templates.length];

    return {
      id: `slot-${i}`,
      index: i,
      key,

      // Anzeige
      name: t.name,
      desc: t.desc,
      baseMeta: t.meta,
      icon: t.icon,

      // Cooldown
      cooldownSec: t.cd,
      cooldownEndMs: 0,
      lastCooldownDurSec: 0,

      // Charges
      maxCharges: t.maxCharges,
      charges: t.maxCharges > 0 ? t.maxCharges : 0,

      // Demo-Regel
      rechargeOnCooldownEnd: t.recharge,
    };
  });
}
