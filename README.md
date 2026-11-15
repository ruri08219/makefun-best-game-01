# Cometfall Harvest

[![Competition](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/ruri08219/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/ruri08219/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

A gravity-slingshot arcade game for the [make.fun best-game-01 bounty](https://make.fun/bounty/best-game-01) — "Make the best game".

**The game:** You are the keeper of the last comet launcher. Drag with the mouse to aim, release to fire a comet across a starfield — but planets bend your comet with real gravity, black holes swallow it whole, and every crash costs you one of your limited launches. Harvest every glowing star shard in the wave to advance. Green novas grant +1 launch. Clear all 10 waves to win; run out of comets and the sky goes dark.

**Features**

- 10 hand-tuned waves: more planets, moving shards, black holes from wave 4, novas from wave 3
- Real gravity: comets slingshot around planets, with a dotted trajectory preview while you aim
- Combo scoring — one launch can harvest several shards in a row
- WebAudio sound, all synthesised: launch whoosh, collect chimes that rise with your combo, wave fanfares, victory jingle, plus a quiet looping arpeggio (M to mute)
- Title, pause, wave-clear, game-over and victory screens, best score saved in localStorage
- Deterministic screenshot modes (`?shot=start|play|win|end&seed=N`) and an autoplay smoke-test mode (`?autoplay=1`)

**Controls:** mouse drag to aim, release to launch · arrow keys / WASD aim · SPACE launch · P pause · M mute · R restart · ENTER start / next wave.

**Play it:** serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) — no build step, no network requests, everything is a file under `game/` or synthesised at runtime.

**Tech:** plain ES modules on a 2D canvas, split by job — `config.js` (tuning), `random.js` (seeded RNG), `audio.js` (WebAudio synth), `input.js` (keyboard + mouse), `physics.js` (gravity + collisions), `world.js` (waves + score), `render.js` (all drawing), `shots.js` (screenshot scenes), `main.js` (loop + state machine). `main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and writes `dossier.json` via the vendored `vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE).
