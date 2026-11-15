// Cometfall Harvest — game loop, state machine and autoplay.
// One clear job: run the game: read input, step the world, draw, expose debug state.

import { GAME, PHYSICS, VIEW } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { predictPath, stepComet, stepShards } from './physics.js';
import { draw } from './render.js';
import { applyShot } from './shots.js';
import {
  LAUNCHER, addFloater, buildBackdrop, buildWave, burst, loadBest, newGameState,
  saveBest, scoreShard, showMessage, spawnComet, stepParticles,
} from './world.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');
const autoplay = params.get('autoplay') === '1';
const fast = params.get('fast') === '1';
const seed = Number(params.get('seed') || 1);

const state = newGameState();
state.best = loadBest();
state.muted = false;
const input = new Input(canvas);
const sounds = new SoundBank();
input.onFirstGesture = () => sounds.ensure();

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(canvas.width / VIEW.width, 0, 0, canvas.height / VIEW.height, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function announce(text) {
  statusEl.textContent = text;
}

function startGame() {
  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.cometsLost = 0;
  state.shardsCollected = 0;
  state.novasCollected = 0;
  state.wave = 1;
  autoplayNoShotSince = null;
  input._armed = false;
  buildWave(state, 1);
  state.phase = 'aiming';
  showMessage(state, 'WAVE 1 — HARVEST THEM ALL!', 2.6);
  sounds.ensure();
  sounds.startMusic();
  announce('Game started. Wave 1. Harvest all the star shards.');
}

function nextWave() {
  if (state.wave >= GAME.totalWaves) {
    winGame();
    return;
  }
  state.score += GAME.waveClearBonus;
  state.launches = Math.min(state.launches + GAME.launchRefundOnClear, GAME.maxLaunches);
  buildWave(state, state.wave + 1);
  state.phase = 'aiming';
  showMessage(state, `WAVE ${state.wave} — HARVEST THEM ALL!`, 2.6);
  sounds.waveClear();
  announce(`Wave ${state.wave}. ${state.shardsTotal} shards to harvest.`);
}

function winGame() {
  state.phase = 'victory';
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.score);
  }
  sounds.stopMusic();
  sounds.victory();
  burst(state, 420, 220, '#ffd166', 30, 320);
  burst(state, 860, 220, '#6ee7ff', 30, 320);
  announce(`Victory! All ${GAME.totalWaves} waves cleared. Final score ${state.score}.`);
}

function loseGame() {
  state.phase = 'gameover';
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.score);
  }
  sounds.stopMusic();
  sounds.gameOver();
  announce(`Game over. Score ${state.score}. Press R to play again.`);
}

function launchComet() {
  if (state.phase !== 'aiming' || state.launches <= 0) return;
  const v = input.launchVelocity();
  spawnComet(state, v.x, v.y);
  state.launches -= 1;
  state.phase = 'flying';
  sounds.launch();
}

function resolveComet(event) {
  const comet = state.comet;
  if (!comet) return;
  if (event.startsWith('shard:')) {
    const points = scoreShard(state);
    addFloater(state, comet.x, comet.y - 24, `+${points}`, '#ffd166');
    burst(state, comet.x, comet.y, '#ffd166', 16, 200);
    sounds.collect(state.combo);
    if (state.shardsLeft <= 0) {
      state.phase = 'waveclear';
      sounds.waveClear();
      return;
    }
    return; // comet keeps flying: one launch can harvest several shards
  }
  if (event.startsWith('nova:')) {
    state.launches = Math.min(state.launches + 1, GAME.maxLaunches);
    state.novasCollected += 1;
    addFloater(state, comet.x, comet.y - 24, '+1 LAUNCH', '#7dff9e');
    burst(state, comet.x, comet.y, '#7dff9e', 16, 200);
    sounds.nova();
    return;
  }
  // The comet is gone: crash, void or off-screen.
  state.cometsLost += 1;
  state.combo = 0;
  burst(state, comet.x, comet.y, event === 'hole' ? '#b050ff' : '#ff5d6c', 26, 280);
  sounds.crash();
  state.comet = null;
  if (state.launches <= 0 && state.shardsLeft > 0) {
    loseGame();
  } else {
    state.phase = 'aiming';
    if (event === 'planet') showMessage(state, 'CRASHED INTO A PLANET!', 1.4);
    else if (event === 'hole') showMessage(state, 'SWALLOWED BY THE VOID!', 1.4);
    else showMessage(state, 'COMET LOST TO THE DARK…', 1.4);
  }
}

// Simulate one launch against a cloned world and count what it harvests.
// The greedy planner for autoplay: the same physics as the real flight,
// including drifting shards, so a shot that scores here scores in the game.
function simulateShot(vx, vy) {
  const sim = {
    planets: state.planets,
    blackHoles: state.blackHoles,
    shards: state.shards.map((s) => ({ ...s })),
    novas: state.novas.map((n) => ({ ...n })),
  };
  const comet = { x: LAUNCHER.x, y: LAUNCHER.y - 18, vx, vy, trail: [], age: 0 };
  let shards = 0;
  let nova = false;
  let simTime = state.time;
  const sub = 1 / 240;
  const maxSteps = Math.round(14 / sub);
  for (let i = 0; i < maxSteps; i += 1) {
    // Shards drift slowly: refresh their positions every 10th sub-step.
    if (i % 10 === 0) {
      simTime += sub * 10;
      stepShards(sim, simTime);
    }
    const event = stepComet(comet, sim, sub);
    if (!event) continue;
    if (event.startsWith('shard:')) { shards += 1; continue; }
    if (event.startsWith('nova:')) { nova = true; continue; }
    return { shards, nova, lost: true };
  }
  return { shards, nova, lost: true }; // stuck in a slow orbit: a lost comet
}

// Autoplay only: game time when the planner last found no shot at all.
// A null value means it is not currently waiting on an orbit to swing around.
let autoplayNoShotSince = null;

function autoplayStep() {
  if (state.phase === 'title') {
    startGame();
    return;
  }
  // On gameover/victory autoplay stops: the test drives the restart (R key).
  if (state.phase === 'waveclear') {
    nextWave();
    return;
  }
  if (state.phase !== 'aiming') return;
  // Greedy planner: search an angle x power grid and fire the shot that
  // harvests the most shards (a nova breaks ties). Aiming AT a shard does
  // not work: shards orbit planets, so the straight line to one usually
  // runs straight into the planet. The winning shots slingshot around a
  // planet, and only a full search finds them.
  const open = state.shards.filter((s) => !s.taken).sort((a, b) => {
    const da = Math.hypot(a.x - LAUNCHER.x, a.y - LAUNCHER.y);
    const db = Math.hypot(b.x - LAUNCHER.x, b.y - LAUNCHER.y);
    return da - db;
  });
  let best = null;
  // Wide, fine grid: the collecting window for a slingshot can be narrow
  // (a few hundredths of a radian, a tenth of power), and a coarse grid
  // walks straight past it. Only autoplay pays this cost.
  for (let angle = -3.1; angle <= -0.1; angle += 0.06) {
    for (const power of [0.4, 0.55, 0.7, 0.85, 1.0]) {
      input.aimAngle = angle;
      input.aimPower = power;
      const v = input.launchVelocity();
      const result = simulateShot(v.x, v.y);
      const score = result.shards * 10 + (result.nova ? 3 : 0);
      if (result.shards > 0 && (!best || score > best.score)) {
        best = { score, angle, power };
      }
    }
  }
  if (best) {
    autoplayNoShotSince = null;
    input.aimAngle = best.angle;
    input.aimPower = best.power;
    launchComet();
    return;
  }
  // No shot collects anything right now: WAIT. Orbit shards swing around
  // their planet, so a shard on the far side becomes hittable a few
  // seconds later — a human waits for it, and so should the test player.
  // Only after 6 s with no shot at all does it fire blind to progress.
  if (autoplayNoShotSince === null) autoplayNoShotSince = state.time;
  if (state.time - autoplayNoShotSince < 6) return;
  autoplayNoShotSince = null;
  if (open.length > 0) {
    const target = open[0];
    input.aimAngle = Math.atan2(target.y - LAUNCHER.y, target.x - LAUNCHER.x);
    input.aimPower = 0.7;
    launchComet();
  }
}

function step(dt) {
  state.time += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  for (const p of state.planets) p.angle += p.spin * dt;
  stepShards(state, state.time);
  stepParticles(state, dt);

  if (state.phase === 'aiming') {
    input.updateAim(dt);
    if (autoplay) autoplayStep();
    else if (input.wasPressed(' ') || input.wasPressed('enter')) launchComet();
  } else if (state.phase === 'waveclear') {
    // Autoplay must advance past the wave-clear screen too: it used to
    // only run while aiming, so a cleared wave sat here forever.
    if (autoplay) autoplayStep();
  } else if (state.phase === 'flying' && state.comet) {
    // Fixed sub-steps keep fast comets from tunnelling through planets.
    const sub = 1 / 240;
    let left = dt;
    let event = null;
    while (left > 0 && !event) {
      const h = Math.min(sub, left);
      event = stepComet(state.comet, state, h);
      left -= h;
    }
    if (event) resolveComet(event);
    else if (state.comet && state.comet.age > 14) {
      // A comet stuck in a slow orbit is a lost comet.
      resolveComet('offscreen');
    }
  }

  if (input.wasPressed('p') && (state.phase === 'aiming' || state.phase === 'flying' || state.phase === 'paused')) {
    if (state.phase === 'paused') {
      state.phase = state.prevPhase;
      sounds.startMusic();
    } else {
      state.prevPhase = state.phase;
      state.phase = 'paused';
      sounds.stopMusic();
    }
  }
  if (input.wasPressed('m')) {
    state.muted = !state.muted;
    sounds.setMuted(state.muted);
  }
  if (input.wasPressed('r') && state.phase !== 'title') {
    sounds.stopMusic();
    startGame();
  }
  if (input.wasPressed('enter')) {
    if (state.phase === 'title') startGame();
    else if (state.phase === 'waveclear') nextWave();
    else if (state.phase === 'gameover' || state.phase === 'victory') startGame();
  }
  // Mouse: a fresh click on a menu screen advances it; a drag that began
  // while aiming launches the comet when released. A click that started the
  // game can never fire a comet, because it was never armed while aiming.
  if (input.downEdge) {
    if (state.phase === 'title') startGame();
    else if (state.phase === 'waveclear') nextWave();
    else if (state.phase === 'gameover' || state.phase === 'victory') startGame();
    else if (state.phase === 'aiming') input._armed = true;
  }
  if (state.phase === 'aiming' && input.upEdge && input._armed) {
    input._armed = false;
    launchComet();
  }
  input.endFrame();
}

// Aim preview, recomputed every frame while aiming.
function currentAim() {
  const angle = input.aimAngle;
  const power = input.aimPower;
  let path = null;
  if (state.phase === 'aiming' && state.launches > 0) {
    const v = input.launchVelocity();
    path = predictPath(LAUNCHER.x, LAUNCHER.y - 18, v.x, v.y, state, 90);
  }
  return { angle, power, path };
}

// ---- boot ----
if (shotMode) {
  applyShot(state, shotMode, seed);
  // One deterministic frame, then signal the screenshot runner.
  draw(ctx, state, { angle: -Math.PI / 2.4, power: 0.7, path: null });
  window.__shotReady = true;
} else {
  buildBackdrop(state, 20261116);
  buildWave(state, 1);
  state.phase = 'title';
  if (autoplay) startGame();
  let last = performance.now();
  const frame = (now) => {
    let dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (fast) dt *= 3;
    if (state.phase !== 'paused') step(dt);
    else input.endFrame();
    draw(ctx, state, currentAim());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Debug surface for smoke tests: never shown to the player.
window.__cometfall = {
  get phase() { return state.phase; },
  get wave() { return state.wave; },
  get score() { return state.score; },
  get launches() { return state.launches; },
  get shardsLeft() { return state.shardsLeft; },
  get shardsCollected() { return state.shardsCollected; },
  get cometsLost() { return state.cometsLost; },
  get best() { return state.best; },
  get wavesCleared() { return state.wave - 1 + (state.phase === 'victory' ? 1 : 0); },
};
