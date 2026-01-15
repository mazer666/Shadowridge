# Shadowridge – Endless Descent

Ein browserbasiertes Solo-Roguelike: Inspiriert von **Four Against Darkness** trifft **Dungeon 100**-Vielfalt mit einem **Baldur's Gate 3**-inspirierten Interface.

**Endloser Dungeon-Crawl** – eine Party aus vier Helden kämpft sich durch prozedural generierte Etagen, besiegt Mini-Bosse und Final-Bosse, sammelt Gold, Items und überlebt so lange wie möglich.

Live-Demo:  
https://mazer666.github.io/Shadowridge/  
(aktuell in Entwicklung – regelmäßige Updates)

## Spielkonzept

- **Genre**: Solo Roguelike Dungeon-Crawler
- **Inspirationen**:
  - Einfache, zugängliche Party-Mechaniken à la *Four Against Darkness* (4AD)
  - Zufallsvielfalt und Tabellen ähnlich wie bei *Dungeon 100* (D100)
  - Atmosphärisches UI-Design inspiriert von *Baldur's Gate 3* (nicht kopiert!)
- **Ziel**: Highscore – wie tief kommst du? Wie viel Gold sammelst du?

### Deine Party (fix 4 Helden)
| Held       | Rolle                  | Stärken                          |
|------------|------------------------|----------------------------------|
| Barbarian  | Melee-Tank             | Hohe HP, Rage-Bonus, Cleave      |
| Ranger     | Range / Scout          | Fernkampf, Tracking, hohe Initiative |
| Wizard     | Magic-DPS              | Zauber, AoE-Schaden              |
| Paladin    | Support / Tank-Light   | Healing (Lay on Hands), Schutz   |

- Jeder Held hat **8 Inventar-Slots** (kein Gewichtslimit)
- Synchrone Bewegung: Die gesamte Party bewegt sich zusammen

### Wichtige Mechaniken
- **Combat**: Rundenbasiert – nur **du** würfelst (D6 + Bonus vs. Gegner-Level); Würfel explodieren
- **Dungeon**: Prozedurale Etagen (Desktop: 29×20 Grid horizontal, Mobile: 15×25 vertikal)
- **Bosse**: Jede Etage endet mit Mini-Boss (stärkere normale Gegner)  
  → alle 5 Etagen Final-Boss mit speziellen Fähigkeiten
- **Tabellen**: Erweiterte D100-Tabellen für Search, Combat, Fallen, Begegnungen, NPCs
- **Shop**: Zwischen Etagen + zufällig in Räumen (wenn entdeckt)
- **Progression**: Level-Up nach Boss-Kill (alle +1 HP/ATK, neue Traits möglich)

## Features (aktueller Stand & Roadmap)

### MVP (Phase 1–3 – bald spielbar)
- [x] Prozedurale Dungeon-Generierung (Canvas-Map)
- [x] Synchrone Party-Bewegung + Pathfinding
- [ ] Combat-System (nur Spieler-Würfel)
- [ ] Combat-Log (erweitert, scrollbar, farblich)
- [ ] Party-Panel (links: Portraits, HP, Stats)
- [ ] Quickcast-Hotbar (unten: Actions + Items, Hotkeys 1–0)
- [ ] Inventar-Grid (rechts: Drag & Drop)

### Nächste Phasen
- [ ] Shop-UI & Gold-Wirtschaft
- [ ] Erweiterte D100-Tabellen & Inhalte (JSON)
- [ ] Boss-Varianten (Mini- & Final-Bosse)
- [ ] Responsive-Optimierung + Mobile-Controls (Pan/Zoom)
- [ ] Options-Menü (u. a. Desktop/Mobile-Override)
- [ ] Highscore-Speicherung (LocalStorage)
- [ ] mehr visuelles Feedback
- [ ] Soundeffekte

## Technik

- **Frontend**: Vanilla JavaScript + Canvas + DOM
- **State**: Globales `state`-Objekt + Custom Events
- **Inhalte**: Getrennt in JSON-Dateien (`/data/`) → leicht editierbar / modbar
- **Deployment**: GitHub Pages (automatisch via Push)

## Installation / Lokal starten

1. Repository klonen
   ```bash
   git clone https://github.com/mazer666/Shadowridge.git
   cd Shadowridge

2. Einfach im Browser öffnen (kein Build nötig)
   **Öffne index.html** mit Live Server (VS Code Extension) oder direkt im Browser
   open index.html

   Oder **nutze** einen **lokalen Server**: Mit Python (sehr einfach)
   python -m http.server 8000

   Dann **http://localhost:8000** im Browser

## Assets & Design

- **Farbschema**: Dunkles Braun/Gold (BG3-inspiriert)
- **Fonts**: Cinzel (Titel), MedievalSharp (UI), Uncial Antiqua (Log)
- **Grafiken**: AI-generiert (Grok / Gemini / ChatGPT) + eigene SVGs
- Keine fertigen Asset-Packs – alles custom / selbst erstellt

## Mitmachen / Feedback

Das Projekt ist noch früh in der Entwicklung. Ich freue mich über:
- Bug-Reports
- Balancing-Vorschläge
- Ideen für neue Tabellen-Einträge / Items / Traits
- Playtest-Feedback

→ Issues oder Pull Requests sind herzlich willkommen!
