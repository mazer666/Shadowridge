/**
 * src/ui/mapCanvas.js
 * -----------------------------------------------------------------------------
 * Rendert die Dungeon-Map auf ein Canvas.
 *
 * Schritt 1:
 * - Jede Zelle ist ein Rechteck
 * - Wände dunkler, Boden heller
 * - Spieler als rotes Quadrat
 *
 * Wichtig: HiDPI / Retina:
 * - Canvas CSS-Größe != Canvas Pixelgröße
 * - Wir skalieren die Pixelgröße mit devicePixelRatio -> sieht scharf aus.
 */

export class MapCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // View-Infos
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.cellSize = 24; // “Weltgröße” pro Tile in CSS-Pixeln (wir passen das später an)
    this.padding = 16;

    // Resize-Handling
    this._onResize = () => this.resizeToParent();
    window.addEventListener("resize", this._onResize);
  }

  destroy() {
    window.removeEventListener("resize", this._onResize);
  }

  resizeToParent() {
    // Canvas soll den Parent komplett ausfüllen
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();

    // CSS-Größe (wie groß es “im Layout” sein soll)
    const cssW = Math.max(200, Math.floor(rect.width));
    const cssH = Math.max(200, Math.floor(rect.height));

    // Pixelgröße (wie viele echte Pixel gezeichnet werden)
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";

    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);

    // Zeichnen in “CSS-Pixeln”: wir skalieren die Zeichenfläche
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render({ tiles, player, statusText }) {
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;

    // Hintergrund
    ctx.clearRect(0, 0, w, h);

    // Map so zentrieren, dass sie “nett” im Canvas sitzt
    const gridH = tiles.length;
    const gridW = tiles[0]?.length || 0;

    const mapW = gridW * this.cellSize;
    const mapH = gridH * this.cellSize;

    const ox = Math.floor((w - mapW) * 0.5);
    const oy = Math.floor((h - mapH) * 0.5);

    // Draw tiles
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const t = tiles[y][x];

        // Wand vs. Boden
        if (t === 0) {
          ctx.fillStyle = "rgba(15,14,12,0.92)";
        } else {
          ctx.fillStyle = "rgba(60,52,40,0.70)";
        }

        const px = ox + x * this.cellSize;
        const py = oy + y * this.cellSize;

        ctx.fillRect(px, py, this.cellSize, this.cellSize);

        // dünne Gridlinie (sehr dezent)
        ctx.strokeStyle = "rgba(210,162,74,0.10)";
        ctx.strokeRect(px + 0.5, py + 0.5, this.cellSize - 1, this.cellSize - 1);
      }
    }

    // Spieler
    const spx = ox + player.x * this.cellSize;
    const spy = oy + player.y * this.cellSize;

    ctx.fillStyle = "rgba(200,75,75,0.95)";
    ctx.fillRect(spx + 4, spy + 4, this.cellSize - 8, this.cellSize - 8);

    // Status-Overlay (klein)
    ctx.fillStyle = "rgba(242,234,215,0.85)";
    ctx.font = "12px MedievalSharp";
    ctx.fillText(statusText, 12, 18);
  }
}
