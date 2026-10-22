# NEON STRIKE // AFTERLIGHT — Browser FPS

A single-player, original sci-fi arena shooter built with **Three.js, HTML, CSS and JavaScript**. No Unity or Unreal. Intended as a **standalone, Vercel-ready replacement foundation**, not a verified patch against your existing repository (its source was not provided/accessible).

## Features in this build

- Responsive cinematic main menu and animated Three.js background
- Five survival waves with five types of fictional robots including final-wave boss
- Pointer-lock mouse look, WASD movement, sprint, crouch, jump, wall/cover collision
- Three original energy blasters with raycast hit detection, headshot multipliers, recoil, reload, weapon switching, tracer effects and energy-cell ammo
- Enemy chase/strafe/retreat behavior, simple obstacle avoidance, health, attack charging/telegraphs and slow-moving energy projectiles
- HUD: wave, goals, enemies, score, eliminations, accuracy, combo, health, shield, stamina, ammo and XP
- Pause/resume/quit, victory/defeat report, local high-score records, XP/level-based visual skin unlocks and four local achievements
- Settings persisted with localStorage, selectable quality presets and optional bloom
- Mobile joystick, touch aim, shoot, reload, jump and weapon swap
- Procedural city/skyline, lighting, rain, holographic signs and synth SFX using Web Audio
- Autosaved wave checkpoint, **not** exact world-state suspension (enemies respawn on Continue)

## Install / run

No `npm install` required. This build uses a **pinned Three.js CDN dependency** loaded by browser import map; internet access is required to load Three.js and its post-processing modules. You can vendor these modules locally if offline operation is required.

For local development, open the `neonstrikebrowser` directory in VS Code and serve using a local HTTP server:

```sh
python -m http.server 5500
```

Then open `http://localhost:5500/`. Opening `index.html` directly via `file://` can cause browser module/CORS restrictions.

**Deploy on Vercel**: Push `index.html`, `styles.css`, `game.js`, `vercel.json` and `README.md` to the repository root. In Vercel choose Framework Preset **Other** (no build command, no output directory; serve repository root). Keep a backup branch of any existing game first.

```sh
git checkout -b backup-before-afterlight
git checkout main
git add .
git commit -m "Upgrade Neon Strike with Afterlight FPS engine"
git push origin main
```

The first command only creates a branch locally; push it as well if you want a remote backup: `git push -u origin backup-before-afterlight`. Make sure your existing source is backed up before overwriting or merging.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Movement | WASD | Left joystick |
| Aim | Mouse pointer lock | Drag right side of 3D scene |
| Fire | Left mouse | FIRE |
| Sprint | Shift | Not separately mapped (desktop-only sprint in this build) |
| Jump | Space | JUMP |
| Crouch | Control or C | Not separately mapped (desktop-only crouch in this build) |
| Reload | R | RELOAD |
| Switch | 1, 2, 3 | SWAP |
| Pause | ESC or HUD pause | HUD pause |

## Settings and saved data

LocalStorage keys are prefixed with `neonstrike_afterlight_v2_`. Saves contain settings, top scores and a lightweight per-wave checkpoint. A Continue reloads a wave at the checkpoint's stats and refreshed enemy placements; it does not restore each enemy's exact position or health. High scores are **local only**, not global rankings.

## Graphics & performance

- Renderer: ACES filmic, sRGB, PCF soft shadows (when enabled)
- High: dynamic shadows, bloom, 1x resolution scale, dense rain
- Medium: bloom, reduced rain, no dynamic shadows, 0.84x resolution scale
- Low: no bloom or shadows, rain off, 0.65x resolution scale
- DPR is capped at 2 * preset scale * user resolution scale
- Instanced city towers/windows, shared primitive geometries, recycled tracer segments and enemy energy projectiles
- 60 FPS is a *target*, not a guarantee. Test on target phones and laptops.

## Architecture and limitations

- One ES module `game.js` contains rendering, entity logic, UI state and input handlers for easy static deployment. Split it into modules when expanding.
- The AI uses steering and obstacle checks, **not full pathfinding/navmesh**; enemies may stall near complicated cover.
- Audio is procedural, not mastered soundtrack. Vignette uses CSS. There is no custom chromatic aberration shader.
- Dynamic pixel ratio and particle/shadow controls are implemented; merged model geometry, GPU resource lifecycle, enemy pooling and advanced light budgets can be improved.
- Textures are procedural; Three.js itself loads from CDN.
- Mobile landscape is recommended. Sprint and crouch are desktop-only in this version.
- No server or online matchmaking is included; online leaderboard is intentionally not claimed.
- This code should be validated in actual browsers before claiming production-ready performance.

## Automated static checks

```sh
node tests/smoke-check.js
```

These checks verify syntax, JSON, file references and HTML element links, **not full browser gameplay**.

## QA checklist

1. From menu choose Start; camera enters arena; lock mouse.
2. Move with WASD, look with mouse, fire energy shots, reload with R, swap 1/2/3.
3. Defeat a wave; next wave begins after delay; final wave includes boss.
4. Hit ESC to pause; verify enemy/projectile movement freezes; resume.
5. Quit to menu and Continue; verify wave checkpoint, score, health and inventory load.
6. Save Graphics/Audio/Controls settings; reload browser and verify persistence.
7. Play to defeat or victory; verify local leaderboard and score.
8. Test portrait and landscape mobile controls; verify fire hold releases cleanly.
9. Check console for module, WebGL or GPU context errors after deploying on HTTPS.

## Copyright

Original procedural graphics and code scaffold provided for this project; no commercial-game models, recordings, maps, trademarks or artwork are included.
