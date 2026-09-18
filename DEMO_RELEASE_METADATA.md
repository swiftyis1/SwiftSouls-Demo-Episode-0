# Project SwiftSouls — Official Isolated Prototype Demo Archive

**Version:** Sprint 28 Demo Milestone (`v0.28.0`)  
**Release Date:** September 11, 2026  
**Status:** Saved & Isolated Demo Clone  
**Deployment Target:** [`website/play/`](file:///c:/Users/swift/Project%20SwiftSouls/website/play/)  

---

## 🎮 Demo Specifications & Isolation Boundary

1. **Evaluation Gameplay Constraints:**
   - **Playtime Cap:** 2 Hours (7,200 seconds active playtime).
   - **Harvesting Cap:** 250 Soul Fragments (cliffhanger right before 254-kill Alpha Boss).
   - **Starter Species:** 7 species available (Keen Kat, Goblin, Snake, Slime, Bat, Skeleton, Phoenix).
   - **Characters:** Valen Swift (♂) and Cora Swift (♀).
   - **Synergy System:** 8 equipment sockets (*Sword, Shield, Armor, Helmet, Ring 1, Ring 2, Amulet, Earrings*) + autonomous companion Pet AI.

2. **Save File Isolation & Sandbox Safety:**
   - The demo save system operates in a self-contained browser sandbox.
   - **Zero Impact on Commercial Release:** Demo progress will not transfer to the final commercial release, preserving a clean slate across the full 150-species (200 if media challenge met) world map.
   - **No Cross-Pollution:** Demo save states and license keys are completely isolated.

3. **5-Minute Gameplay Telemetry & Live Player Counter:**
   - When a player starts/loads a save file and plays for at least **5 cumulative minutes (300 seconds)**, the engine dispatches a trial completion event.
   - Updates the live playtest counter on the official website via `POST /api/demo/trial-completed` and iframe `postMessage`.
   - Stored persistently in `website/demo_stats.json` with animated counter display on the website hero section and demo viewport banner.

4. **Preserved Stat Balance:**
   - Passive fragment bonuses and Extinction Mastery bonuses are scaled to the balanced 75% reduction tier.
   - HP/SP dynamic numbers are strictly truncated (`Math.trunc`).

---

## 📁 Archive Contents & Structure

- `phaser-game/`: Full TypeScript + Phaser 3 source code and production build.
- `website/`: Landing page, API endpoints, stylesheet, chiptune audio sampler, and embedded `play/` demo.
- `BESTIARY_AND_BALANCE.md`: Complete creature stats and infusion power matrix.
- `snapshots/Sprint28_Prototype_Demo_2026-09-11/`: Exact immutable point-in-time codebase clone.
