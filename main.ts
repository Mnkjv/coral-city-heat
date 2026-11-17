// Coral City Heat — hand-in program for the make.fun gta6-01 bounty.
//
// The game itself is the static site under game/ (open game/index.html in a
// desktop browser and it plays offline; three.js is vendored beside it).
// This program's single job is delivery: copy game/ and screenshots/ into
// the output directory and write dossier.json there with the vendored
// make.fun library, using the gate's own caps so a hand-in the scorer
// would refuse fails here first instead.
//
// Run it locally with an output override:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game for a play with: node serve.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps come straight from the bounty's gate: the dossier text budget,
// at most 4 screenshots of at most 256 KiB each, and the game tree limits
// (993 entries, 48 MiB total, 1000 bytes per path).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
