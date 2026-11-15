// Everything the player sees: space, planets, the comet, the HUD and every screen.
// One clear job: draw the current state onto the canvas, nothing else.

import { GAME, PALETTE, VIEW } from './config.js';
import { LAUNCHER } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStar(ctx, x, y, r, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.38;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBackdrop(ctx, state, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, PALETTE.spaceTop);
  grad.addColorStop(1, PALETTE.spaceBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  for (const n of state.nebulas) {
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, n.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = g;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }
  ctx.globalAlpha = 1;
  for (const s of state.stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * s.speed + s.twinkle);
    ctx.globalAlpha = tw;
    ctx.fillStyle = '#dfe9ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(ctx, planet, time) {
  const p = planet;
  // Gravity halo.
  const halo = ctx.createRadialGradient(p.x, p.y, p.radius * 0.7, p.x, p.y, p.radius * 2.1);
  halo.addColorStop(0, 'rgba(140, 180, 255, 0.10)');
  halo.addColorStop(1, 'rgba(140, 180, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(p.x - p.radius * 2.2, p.y - p.radius * 2.2, p.radius * 4.4, p.radius * 4.4);
  // Ring, drawn behind the body.
  if (p.style.ring) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.45);
    ctx.strokeStyle = 'rgba(220, 200, 255, 0.55)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.radius * 1.7, p.radius * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const body = ctx.createRadialGradient(p.x - p.radius * 0.35, p.y - p.radius * 0.4, p.radius * 0.1, p.x, p.y, p.radius);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.25, p.style.body);
  body.addColorStop(1, p.style.band);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  // Bands that slowly rotate.
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = p.style.band;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 7;
  const off = (time * p.spin * 20) % (p.radius * 2);
  for (let i = -2; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(p.x - p.radius, p.y + i * 22 + off * 0.2);
    ctx.quadraticCurveTo(p.x, p.y + i * 22 + 14 + off * 0.2, p.x + p.radius, p.y + i * 22 + off * 0.2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBlackHole(ctx, hole, time) {
  const pulse = 1 + 0.08 * Math.sin(time * 3);
  const g = ctx.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, hole.radius * 2.4 * pulse);
  g.addColorStop(0, '#000000');
  g.addColorStop(0.45, '#1a0b2e');
  g.addColorStop(0.75, 'rgba(180, 80, 255, 0.35)');
  g.addColorStop(1, 'rgba(180, 80, 255, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(hole.x, hole.y, hole.radius * 2.4 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Accretion swirl.
  ctx.strokeStyle = 'rgba(230, 180, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 40; i += 1) {
    const a = time * 2.2 + (i / 40) * Math.PI * 2;
    const r = hole.radius * (0.9 + i * 0.03);
    const x = hole.x + Math.cos(a) * r;
    const y = hole.y + Math.sin(a) * r * 0.85;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VOID', hole.x, hole.y + hole.radius + 22);
}

function drawShard(ctx, shard, time) {
  if (shard.taken) return;
  const pulse = 1 + 0.18 * Math.sin(time * 4 + shard.phase);
  const glow = ctx.createRadialGradient(shard.x, shard.y, 0, shard.x, shard.y, 34 * pulse);
  glow.addColorStop(0, 'rgba(255, 209, 102, 0.55)');
  glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(shard.x - 36, shard.y - 36, 72, 72);
  drawStar(ctx, shard.x, shard.y, 15 * pulse, time * 1.2 + shard.spin, PALETTE.gold);
  ctx.fillStyle = '#fff7dd';
  ctx.beginPath();
  ctx.arc(shard.x, shard.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawNova(ctx, nova, time) {
  if (nova.taken) return;
  const pulse = 1 + 0.22 * Math.sin(time * 5 + nova.phase);
  const glow = ctx.createRadialGradient(nova.x, nova.y, 0, nova.x, nova.y, 40 * pulse);
  glow.addColorStop(0, 'rgba(125, 255, 158, 0.5)');
  glow.addColorStop(1, 'rgba(125, 255, 158, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(nova.x - 42, nova.y - 42, 84, 84);
  drawStar(ctx, nova.x, nova.y, 17 * pulse, -time * 1.5, PALETTE.green);
  ctx.fillStyle = '#0b1030';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+1', nova.x, nova.y + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawComet(ctx, comet) {
  // Trail: fading ribbon from tail to head.
  for (let i = 0; i < comet.trail.length; i += 1) {
    const p = comet.trail[i];
    const t = i / comet.trail.length;
    ctx.globalAlpha = t * 0.75;
    ctx.fillStyle = i % 2 === 0 ? '#6ee7ff' : '#ffd166';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + t * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const glow = ctx.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, 30);
  glow.addColorStop(0, 'rgba(255, 240, 180, 0.9)');
  glow.addColorStop(0.4, 'rgba(255, 180, 80, 0.45)');
  glow.addColorStop(1, 'rgba(255, 180, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(comet.x - 32, comet.y - 32, 64, 64);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(comet.x, comet.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9a3d';
  ctx.beginPath();
  ctx.arc(comet.x - 2, comet.y - 2, 4.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawLauncher(ctx, state, aimAngle, aimPower, showAim, path) {
  const { x, y } = LAUNCHER;
  // Little asteroid base.
  ctx.fillStyle = '#5a4632';
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 74, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a6248';
  ctx.beginPath();
  ctx.ellipse(x - 18, y + 8, 26, 10, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Cannon barrel along the aim.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(aimAngle);
  ctx.fillStyle = '#2c3550';
  roundRect(ctx, 0, -9, 52, 18, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.launcher;
  roundRect(ctx, 40, -12, 16, 24, 6);
  ctx.fill();
  ctx.restore();
  // Power ring around the base.
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + aimPower * Math.PI * 2);
  ctx.stroke();
  // Dotted predicted path.
  if (showAim && path && path.length > 1) {
    ctx.fillStyle = 'rgba(234, 242, 255, 0.75)';
    for (const p of path) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticles(ctx, state) {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, state) {
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, 16, 14, 560, 54, 12);
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'left';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`SCORE ${state.score}`, 32, 40);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillText(`WAVE ${state.wave}/${GAME.totalWaves}`, 240, 40);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`SHARDS ${state.shardsTotal - state.shardsLeft}/${state.shardsTotal}`, 380, 40);
  // Launches as comet icons, top right.
  const label = 'LAUNCHES';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.textAlign = 'right';
  ctx.fillText(label, 1264, 30);
  for (let i = 0; i < state.launches; i += 1) {
    const cx = 1120 + i * 26;
    ctx.fillStyle = PALETTE.launcher;
    ctx.beginPath();
    ctx.arc(cx, 48, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(cx, 48, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Combo badge.
  if (state.combo >= 2) {
    ctx.fillStyle = PALETTE.pink;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`COMBO x${state.combo}`, 1264, 92);
  }
  // Best score, small.
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`BEST ${Math.max(state.best, state.score)}`, 32, 92);
  // Centre message banner.
  if (state.messageTimer > 0 && state.message) {
    ctx.globalAlpha = Math.min(1, state.messageTimer);
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(state.message, 640, 130);
    ctx.globalAlpha = 1;
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(6, 10, 28, 0.82)';
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function bigButton(ctx, x, y, w, h, label) {
  ctx.fillStyle = '#ffb347';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.fillStyle = '#241505';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 9);
}

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(4, 6, 20, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, 240, 92, 800, 520);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('COMETFALL', 640, 190);
  ctx.fillStyle = PALETTE.cyan;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('HARVEST', 640, 258);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Slingshot comets around planets. Harvest every star shard.', 640, 308);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('Drag with the mouse to aim — release to launch. Arrow keys aim too,', 640, 348);
  ctx.fillText('SPACE launches. Gravity bends your comet: use it, don\'t crash into it.', 640, 376);
  ctx.fillText('Green novas grant +1 launch. Black holes swallow everything.', 640, 404);
  ctx.fillText(`Clear all ${GAME.totalWaves} waves to win. Each wave gives you limited launches.`, 640, 432);
  bigButton(ctx, 490, 462, 300, 56, '▶  START  (ENTER)');
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('P pause   •   M sound   •   R restart', 640, 556);
  if (state.best > 0) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE  ${state.best}`, 640, 588);
  }
}

function drawWaveClear(ctx, state) {
  ctx.fillStyle = 'rgba(4, 6, 20, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, 340, 200, 600, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.green;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText(`WAVE ${state.wave} CLEAR!`, 640, 290);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(`Bonus +${GAME.waveClearBonus}   •   Score ${state.score}`, 640, 340);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('Next wave incoming — press ENTER or click to continue', 640, 392);
  bigButton(ctx, 490, 420, 300, 52, 'NEXT WAVE ▶');
}

function drawGameOver(ctx, state) {
  ctx.fillStyle = 'rgba(20, 4, 10, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, 300, 170, 680, 360);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.red;
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText('OUT OF COMETS', 640, 262);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(`You reached wave ${state.wave} and harvested ${state.shardsCollected} shards.`, 640, 314);
  ctx.fillText(`Score ${state.score}   •   Best combo x${state.bestCombo}   •   Best ${Math.max(state.best, state.score)}`, 640, 348);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('The shards drift on without you… for now.', 640, 384);
  bigButton(ctx, 490, 420, 300, 56, '↻  PLAY AGAIN  (R)');
}

function drawVictory(ctx, state) {
  ctx.fillStyle = 'rgba(4, 10, 6, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, 280, 140, 720, 420);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 58px system-ui, sans-serif';
  ctx.fillText('★ HARVEST COMPLETE ★', 640, 226);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText(`All ${GAME.totalWaves} waves cleared — the sky is yours!`, 640, 276);
  ctx.fillText(`Final score ${state.score}   •   Shards ${state.shardsCollected}   •   Best combo x${state.bestCombo}`, 640, 316);
  ctx.fillText(`Comets lost ${state.cometsLost}   •   Novas caught ${state.novasCollected}`, 640, 350);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(state.score >= state.best && state.score > 0 ? 'NEW BEST SCORE!' : `Best score ${state.best}`, 640, 392);
  bigButton(ctx, 490, 430, 300, 56, '↻  PLAY AGAIN  (R)');
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 20, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', 640, 340);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('Press P to resume', 640, 384);
}

function drawHint(ctx, state) {
  if (state.phase !== 'aiming' || state.wave > 1) return;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Drag from the launcher to aim — release to fire your comet', 640, 640);
}

// The one entry point the game loop calls each frame.
export function draw(ctx, state, aim) {
  drawBackdrop(ctx, state, state.time);
  for (const planet of state.planets) drawPlanet(ctx, planet, state.time);
  for (const hole of state.blackHoles) drawBlackHole(ctx, hole, state.time);
  for (const shard of state.shards) drawShard(ctx, shard, state.time);
  for (const nova of state.novas) drawNova(ctx, nova, state.time);
  if (state.comet) drawComet(ctx, state.comet);
  const showAim = state.phase === 'aiming' && state.launches > 0;
  drawLauncher(ctx, state, aim.angle, aim.power, showAim, aim.path);
  drawParticles(ctx, state);
  if (state.phase !== 'title') drawHud(ctx, state);
  drawHint(ctx, state);
  if (state.phase === 'title') drawTitle(ctx, state);
  else if (state.phase === 'waveclear') drawWaveClear(ctx, state);
  else if (state.phase === 'gameover') drawGameOver(ctx, state);
  else if (state.phase === 'victory') drawVictory(ctx, state);
  else if (state.phase === 'paused') drawPaused(ctx);
  // Mute badge.
  if (state.muted) {
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('🔇 MUTED (M)', 1264, 700);
  }
}
