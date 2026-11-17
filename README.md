# Coral City Heat

![Coral City Heat on make.fun](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/Mnkjv/coral-city-heat/rank.svg)
![Reward](https://make.fun/badge/gta6-01/Mnkjv/coral-city-heat/reward.svg)

**Coral City Heat** is an original open-world crime game for the browser, built for the make.fun bounty [gta6-01](https://make.fun/bounty/gta6-01). Every name, character and line of story is original: you are **Sol Vega**, a courier-turned-wheelman in the sun-soaked coastal sprawl of Coral City. Fixer **Dario Fenn** feeds you work; the **Marlin Syndicate** of **Vera Calloway** owns the docks, the debts and half the police radio. Five jobs stand between you and owning the city back.

## The game

- **A living city, on foot and by car** — an 8×8-block road grid with window-lit towers, sidewalks, streetlights and palms, a marina, a beach and open water on the east shore, plus landmarks: Coral General Hospital, the Sparkle Wash garage, Fenn's chop shop and the Marlin freight warehouse.
- **Driving** — arcade car physics with acceleration, braking, reverse and a handbrake; parked cars everywhere, and traffic cars you can steal (their drivers bail out and run). A marked "wash" garage launders your wanted level for cash.
- **Traffic & crowds** — AI cars cruise lanes, turn at intersections and brake for you; ~50 pedestrians stroll the kerbs, flee from speeding cars and gunfire, and fall when hit.
- **Wanted system & police** — car theft, assault, gunfire and ramming police raise 1–5 stars. Stars decay out of sight. Police cars spawn with the heat, flash their light bars, pursue and ram; at 2+ stars officers chase and shoot on foot.
- **Combat** — a hitscan pistol with tracers and muzzle flash; syndicate guards and officers shoot back. Die and you wake at Coral General, poorer.
- **A five-mission story** — *First Wheels*, *Harbor Run* (timed, with heat on pickup), *Neon Debt* (hold-E collections), *Hot Cargo* (a forced 3-star delivery) and *The Marlin Job* (a five-guard warehouse shootout and a 4-star escape to the beach safehouse). Finishing the story unlocks free roam.
- **HUD & minimap** — cash, health, wanted stars, objective text with live distance, speed readout, damage vignette, dialogue and mission banners, and a north-up live minimap with roads, police blips, the gold mission marker and the wash garage.
- **Save** — cash, mission progress, story-complete flag and position persist in `localStorage`; Continue picks the run back up.

## How to play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and visit the local URL). Everything runs offline — three.js is vendored, all textures are generated on canvas, and all sound is synthesized with WebAudio.

| Input | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Mouse (click game to lock) | Orbit camera / aim |
| Shift | Sprint |
| F | Enter / exit car |
| Space | Handbrake |
| Mouse click | Fire pistol (on foot) |
| E | Collect debt · use the wash garage |
| P / Esc | Pause |
| M | Mute |

## Tech

- [three.js](https://threejs.org/) r160, vendored as a single module under `game/vendor/` and loaded through one import map — no network requests, no build step.
- Plain ES modules under `game/src/`, one job per file: `city` builds the world, `vehicle` is the shared car physics, `traffic` and `pedestrians` run the crowds, `police` + `wanted` run the law, `combat` resolves gunfire, `missions` runs Dario's story chain, `hud` paints the interface and minimap, `audio` synthesizes every sound, `save` persists the run, and `shots` stages the deterministic screenshot scenes (`?shot=chase|downtown|mission|menu&seed=1`).
- Deterministic seeded city generation, so a seed always builds the same Coral City.

Screenshots in `screenshots/` are real renders of the staged scenes (chase, downtown, the warehouse shootout, and the title screen over the orbiting city camera).
