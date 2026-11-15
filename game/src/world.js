// Game state: waves, score, launches, particles and floating text.
// One clear job: build each wave and own the numbers the HUD shows.

import { GAME, PALETTE, PLANET_STYLES, VIEW, waveSpec } from './config.js';
import { makeRng, range, shuffle } from './random.js';

export const LAUNCHER = { x: 640, y: 660 };

export function newGameState() {
  return {
    phase: 'title', // title | aiming | flying | waveclear | gameover | victory | paused
    prevPhase: 'title',
    wave: 1,
    score: 0,
    best: 0,
    combo: 0,
    bestCombo: 0,
    launches: GAME.baseLaunches,
    shardsLeft: 0,
    shardsTotal: 0,
    cometsLost: 0,
    shardsCollected: 0,
    novasCollected: 0,
    time: 0,
    waveTime: 0,
    message: '',
    messageTimer: 0,
    planets: [],
    blackHoles: [],
    shards: [],
    novas: [],
    comet: null,
    particles: [],
    floaters: [],
    stars: [],
    nebulas: [],
  };
}

export function buildBackdrop(state, seed) {
  const rng = makeRng(seed);
  state.stars = [];
  for (let i = 0; i < 190; i += 1) {
    state.stars.push({
      x: rng() * VIEW.width,
      y: rng() * VIEW.height,
      r: 0.5 + rng() * 1.7,
      twinkle: rng() * Math.PI * 2,
      speed: 0.4 + rng() * 1.6,
    });
  }
  state.nebulas = [
    { x: 220, y: 140, r: 260, color: PALETTE.nebulaA },
    { x: 1050, y: 90, r: 220, color: PALETTE.nebulaB },
    { x: 880, y: 560, r: 240, color: PALETTE.nebulaC },
  ];
}

// Lay out one wave: planets with gravity wells, shards to harvest, hazards.
export function buildWave(state, wave) {
  const spec = waveSpec(wave);
  const rng = makeRng(wave * 7919 + 13);
  state.wave = wave;
  state.planets = [];
  state.blackHoles = [];
  state.shards = [];
  state.novas = [];
  state.comet = null;
  state.launches = spec.launches;
  state.waveTime = 0;
  state.combo = 0;

  // Planets sit in the upper two-thirds, never on top of the launcher.
  const slots = [
    { x: 300, y: 210 }, { x: 980, y: 200 }, { x: 640, y: 150 },
    { x: 200, y: 420 }, { x: 1080, y: 430 }, { x: 640, y: 330 },
  ];
  const usedSlots = slots.slice();
  const styles = shuffle(rng, PLANET_STYLES); // a wave never repeats a look
  for (let i = 0; i < spec.planets; i += 1) {
    const slot = usedSlots.splice(Math.floor(rng() * usedSlots.length), 1)[0];
    const style = styles[i % styles.length];
    const radius = range(rng, 42, 66);
    state.planets.push({
      kind: 'planet',
      x: slot.x + range(rng, -60, 60),
      y: slot.y + range(rng, -40, 40),
      radius,
      mass: range(rng, spec.planetMassMin, spec.planetMassMax) * (radius / 52),
      style,
      spin: range(rng, -0.25, 0.25),
      angle: rng() * Math.PI * 2,
    });
  }

  for (let i = 0; i < spec.blackHoles; i += 1) {
    state.blackHoles.push({
      kind: 'hole',
      x: range(rng, 280, 1000),
      y: range(rng, 120, 420),
      radius: 30,
      mass: 2.6,
    });
  }

  // Shards: some hug a planet's orbit, the rest float in open sky.
  const takenSpots = [];
  function freeSpot(minX, maxX, minY, maxY) {
    for (let tries = 0; tries < 40; tries += 1) {
      const x = range(rng, minX, maxX);
      const y = range(rng, minY, maxY);
      let ok = Math.hypot(x - LAUNCHER.x, y - LAUNCHER.y) > 130;
      for (const body of state.planets.concat(state.blackHoles)) {
        if (Math.hypot(x - body.x, y - body.y) < body.radius + 70) ok = false;
      }
      for (const s of takenSpots) {
        if (Math.hypot(x - s.x, y - s.y) < 80) ok = false;
      }
      if (ok) {
        takenSpots.push({ x, y });
        return { x, y };
      }
    }
    return { x: range(rng, 150, 1130), y: range(rng, 90, 380) };
  }
  for (let i = 0; i < spec.shards; i += 1) {
    const planet = state.planets.length > 0 && rng() < 0.55
      ? state.planets[Math.floor(rng() * state.planets.length)]
      : null;
    let shard;
    if (planet) {
      const orbit = planet.radius + range(rng, 55, 110);
      shard = {
        id: i, x: planet.x + orbit, y: planet.y, anchorX: planet.x, anchorY: planet.y,
        orbit, orbitSpeed: range(rng, 0.25, 0.6) * (rng() < 0.5 ? 1 : -1),
        phase: rng() * Math.PI * 2, taken: false, spin: rng() * Math.PI * 2,
      };
    } else {
      const spot = freeSpot(120, 1160, 80, 420);
      const moving = spec.movingShards && rng() < 0.6;
      shard = {
        id: i, x: spot.x, y: spot.y, anchorX: spot.x, anchorY: spot.y,
        orbit: moving ? range(rng, 26, 60) : 0,
        orbitSpeed: moving ? range(rng, 0.3, 0.8) : 0,
        phase: rng() * Math.PI * 2, taken: false, spin: rng() * Math.PI * 2,
      };
    }
    state.shards.push(shard);
  }
  state.shardsTotal = state.shards.length;
  state.shardsLeft = state.shards.length;

  for (let i = 0; i < spec.novas; i += 1) {
    const spot = freeSpot(180, 1100, 100, 480);
    state.novas.push({ id: i, x: spot.x, y: spot.y, taken: false, phase: rng() * Math.PI * 2 });
  }
}

export function spawnComet(state, vx, vy) {
  state.comet = {
    x: LAUNCHER.x, y: LAUNCHER.y - 18, vx, vy,
    trail: [], age: 0,
  };
}

export function burst(state, x, y, color, count, speed = 220) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.6, maxLife: 1.1,
      size: 2 + Math.random() * 3.5, color,
    });
  }
}

export function addFloater(state, x, y, text, color) {
  state.floaters.push({ x, y, text, color, life: 1.1 });
}

export function stepParticles(state, dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const f of state.floaters) {
    f.y -= 42 * dt;
    f.life -= dt;
  }
  state.floaters = state.floaters.filter((f) => f.life > 0);
}

export function showMessage(state, text, seconds = 2.2) {
  state.message = text;
  state.messageTimer = seconds;
}

// Scoring: shards pay base + combo bonus; a lost comet resets the combo.
export function scoreShard(state) {
  const points = GAME.shardBaseScore + state.combo * GAME.comboStep;
  state.score += points;
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.shardsCollected += 1;
  state.shardsLeft -= 1;
  return points;
}

export function loadBest() {
  try {
    return Number(window.localStorage.getItem(GAME.bestKey)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(score) {
  try {
    window.localStorage.setItem(GAME.bestKey, String(score));
  } catch {
    // Private mode: the best score just does not persist.
  }
}
