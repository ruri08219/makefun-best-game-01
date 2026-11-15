// Deterministic screenshot scenes: ?shot=start|play|win|end&seed=N.
// One clear job: build a fixed, good-looking state for each screenshot.

import { GAME, PHYSICS } from './config.js';
import { buildBackdrop, buildWave, burst, newGameState, spawnComet } from './world.js';

// A comet frozen mid-flight with a long, curved trail, near uncollected shards.
function stagePlayComet(state) {
  spawnComet(state, -420, -260);
  const comet = state.comet;
  comet.x = 700;
  comet.y = 240;
  // Fake a curved trail behind it, as if it just slung around a planet.
  comet.trail = [];
  for (let i = 0; i < PHYSICS.trailLength; i += 1) {
    const t = i / PHYSICS.trailLength;
    comet.trail.push({
      x: 700 - t * 260 + Math.sin(t * 5) * 30,
      y: 240 + t * 190 - t * t * 60,
    });
  }
  // A couple of shards already harvested, the rest glowing ahead.
  state.shards[0].taken = true;
  state.shards[1].taken = true;
  state.shardsLeft = state.shards.length - 2;
  state.score = 480;
  state.combo = 2;
  state.bestCombo = 2;
  state.shardsCollected = 2;
  state.launches = 3;
  state.time = 6.4;
  burst(state, 640, 300, '#ffd166', 14, 160);
  burst(state, 700, 240, '#6ee7ff', 8, 120);
}

export function applyShot(state, shot, seed) {
  buildBackdrop(state, seed);
  if (shot === 'start') {
    state.phase = 'title';
    state.best = 2450;
    buildWave(state, 1);
    state.time = 2.0;
    return;
  }
  if (shot === 'play') {
    state.phase = 'flying';
    buildWave(state, 3);
    stagePlayComet(state);
    state.message = 'WAVE 3 — HARVEST THEM ALL!';
    state.messageTimer = 99;
    return;
  }
  if (shot === 'win') {
    state.phase = 'victory';
    buildWave(state, GAME.totalWaves);
    state.score = 6840;
    state.best = 6840;
    state.shardsCollected = 52;
    state.bestCombo = 6;
    state.cometsLost = 4;
    state.novasCollected = 3;
    state.shardsLeft = 0;
    state.time = 12.0;
    burst(state, 420, 200, '#ffd166', 26, 300);
    burst(state, 860, 180, '#6ee7ff', 26, 300);
    burst(state, 640, 320, '#ff7ad9', 26, 300);
    return;
  }
  // 'end' — game over.
  state.phase = 'gameover';
  buildWave(state, 5);
  state.score = 2310;
  state.best = 2450;
  state.shardsCollected = 21;
  state.bestCombo = 4;
  state.cometsLost = 6;
  state.launches = 0;
  state.shardsLeft = 3;
  state.time = 9.0;
  burst(state, 640, 660, '#ff5d6c', 20, 240);
}
