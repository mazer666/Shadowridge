/**
 * src/game/dungeon.js
 * -----------------------------------------------------------------------------
 * Mini-Dungeon-Generator für Schritt 1.
 *
 * Noch KEIN echtes Roguelike – nur:
 * - Rand ist Wand
 * - innen Boden
 * - ein paar “Raum-Blobs” zur Optik
 *
 * Später ersetzen wir das durch eure richtige prozedurale Etagenlogik.
 */

export function generateDungeon(width, height) {
  // tiles[y][x] = 0 (Wand) oder 1 (Boden)
  const tiles = Array.from({ length: height }, () => Array(width).fill(0));

  // 1) Rand Wände, innen Boden
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBorder = (x === 0 || y === 0 || x === width - 1 || y === height - 1);
      tiles[y][x] = isBorder ? 0 : 1;
    }
  }

  // 2) Ein paar “Wandblobs” als Hindernisse (rein optisch/spielerisch fürs Testen)
  //    (Deterministisch wäre später besser – jetzt reicht simpel.)
  const blobs = 10;
  for (let i = 0; i < blobs; i++) {
    const cx = 2 + Math.floor(Math.random() * (width - 4));
    const cy = 2 + Math.floor(Math.random() * (height - 4));
    const r = 1 + Math.floor(Math.random() * 3);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
          // kleine Chance, Wand zu setzen
          if (Math.random() < 0.55) tiles[y][x] = 0;
        }
      }
    }
  }

  return tiles;
}

/**
 * isWalkable(tiles, x, y)
 * - true, wenn Feld begehbar (Boden)
 */
export function isWalkable(tiles, x, y) {
  const row = tiles[y];
  if (!row) return false;
  return row[x] === 1;
}
