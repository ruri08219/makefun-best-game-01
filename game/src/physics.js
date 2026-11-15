// The comet's flight: gravity wells, collisions, pickups.
// One clear job: step the comet through the world, report what it hit.

import { PHYSICS } from './config.js';

// Integrate one fixed step. Returns an event string or null:
// 'planet' | 'hole' | 'offscreen' | 'shard:<id>' | 'nova:<id>'
export function stepComet(comet, world, dt) {
  const bodies = world.planets.concat(world.blackHoles);
  let ax = 0;
  let ay = 0;
  for (const body of bodies) {
    const dx = body.x - comet.x;
    const dy = body.y - comet.y;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2) || 1;
    const pull = (PHYSICS.gravity * body.mass) / Math.max(d2, body.radius * body.radius * 0.4);
    ax += (dx / d) * pull;
    ay += (dy / d) * pull;
  }
  comet.vx += ax * dt;
  comet.vy += ay * dt;
  const speed = Math.hypot(comet.vx, comet.vy);
  if (speed > PHYSICS.maxSpeed) {
    comet.vx = (comet.vx / speed) * PHYSICS.maxSpeed;
    comet.vy = (comet.vy / speed) * PHYSICS.maxSpeed;
  }
  comet.x += comet.vx * dt;
  comet.y += comet.vy * dt;
  comet.trail.push({ x: comet.x, y: comet.y });
  if (comet.trail.length > PHYSICS.trailLength) comet.trail.shift();
  comet.age += dt;

  // Planet or black hole impact.
  for (const body of bodies) {
    const d = Math.hypot(comet.x - body.x, comet.y - body.y);
    if (d < body.radius + PHYSICS.cometRadius * 0.6) {
      return body.kind === 'hole' ? 'hole' : 'planet';
    }
  }
  // Shard pickup.
  for (const shard of world.shards) {
    if (shard.taken) continue;
    if (Math.hypot(comet.x - shard.x, comet.y - shard.y) < PHYSICS.collectRadius) {
      shard.taken = true;
      return `shard:${shard.id}`;
    }
  }
  // Nova pickup: +1 launch.
  for (const nova of world.novas) {
    if (nova.taken) continue;
    if (Math.hypot(comet.x - nova.x, comet.y - nova.y) < PHYSICS.collectRadius + 6) {
      nova.taken = true;
      return `nova:${nova.id}`;
    }
  }
  // Flew off the edge of the sky.
  const m = PHYSICS.offscreenMargin;
  if (comet.x < -m || comet.x > 1280 + m || comet.y < -m || comet.y > 720 + m) {
    return 'offscreen';
  }
  return null;
}

// Dotted aim preview: simulate the flight without touching the real comet.
// Shards and novas are copied so the preview can never collect a real one.
export function predictPath(startX, startY, vx, vy, world, steps = 90, stepDt = 1 / 60) {
  const ghost = { x: startX, y: startY, vx, vy, trail: [], age: 0 };
  const simWorld = {
    planets: world.planets,
    blackHoles: world.blackHoles,
    shards: world.shards.map((s) => ({ ...s })),
    novas: world.novas.map((n) => ({ ...n })),
  };
  const points = [];
  // Sub-step like the real flight (1/240 s): the 1/60 s preview diverged
  // from the real path near planets, where gravity is stiff, so aimed
  // shots that looked good on the dotted line missed or crashed.
  const sub = stepDt / 4;
  for (let i = 0; i < steps; i += 1) {
    for (let k = 0; k < 4; k += 1) stepComet(ghost, simWorld, sub);
    if (i % 3 === 0) points.push({ x: ghost.x, y: ghost.y });
    if (ghost.x < -40 || ghost.x > 1320 || ghost.y < -40 || ghost.y > 760) break;
    // Stop the preview at the first impact.
    for (const body of world.planets.concat(world.blackHoles)) {
      if (Math.hypot(ghost.x - body.x, ghost.y - body.y) < body.radius + 6) return points;
    }
  }
  return points;
}

// Moving shards drift on small orbits around their anchor point.
export function stepShards(world, time) {
  for (const shard of world.shards) {
    if (shard.taken) continue;
    if (shard.orbit) {
      shard.x = shard.anchorX + Math.cos(time * shard.orbitSpeed + shard.phase) * shard.orbit;
      shard.y = shard.anchorY + Math.sin(time * shard.orbitSpeed + shard.phase) * shard.orbit * 0.6;
    }
  }
}
