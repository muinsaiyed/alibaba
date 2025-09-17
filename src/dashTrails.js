import { dashTrails, player } from './state.js';
import { DASH_TRAIL_INTERVAL, DASH_TRAIL_LIFETIME } from './constants.js';

export function spawnDashTrail(source, options = {}) {
  if (!source || !Number.isFinite(source.x) || !Number.isFinite(source.y)) {
    return;
  }

  const maxTrailCount = 60;
  if (dashTrails.length >= maxTrailCount) {
    dashTrails.splice(0, dashTrails.length - maxTrailCount + 1);
  }

  dashTrails.push({
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
    facing: source.facing,
    color: options.color || source.color || '#ffffff',
    life: DASH_TRAIL_LIFETIME,
    maxLife: DASH_TRAIL_LIFETIME,
    opacity: typeof options.opacity === 'number' ? options.opacity : 0.65,
  });
}

export function updateDashTrails(delta) {
  if (dashTrails.length === 0) {
    return;
  }

  for (let i = dashTrails.length - 1; i >= 0; i -= 1) {
    const trail = dashTrails[i];
    trail.life -= delta;
    if (trail.life <= 0) {
      dashTrails.splice(i, 1);
    }
  }
}

export function handleLocalDashTrail(delta, dashActive) {
  if (!dashActive || !player.alive) {
    player.dashTrailTimer = 0;
    return;
  }

  player.dashTrailTimer -= delta;
  if (player.dashTrailTimer <= 0) {
    spawnDashTrail(player, { color: player.color, isLocal: true });
    player.dashTrailTimer = player.dashTrailInterval;
  }
}

export function handleRemoteDashTrail(remote, delta) {
  if (!remote) {
    return;
  }

  const trailInterval = remote.dashTrailInterval ?? DASH_TRAIL_INTERVAL * 1.1;
  const isDashing = remote.anim === 'dash' && remote.alive;
  if (!isDashing) {
    remote.dashTrailActive = false;
    remote.dashTrailTimer = trailInterval;
    return;
  }

  remote.dashTrailTimer = (remote.dashTrailTimer ?? 0) - delta;
  if (!remote.dashTrailActive || remote.dashTrailTimer <= 0) {
    spawnDashTrail(remote, { color: remote.color, opacity: 0.55 });
    remote.dashTrailTimer = trailInterval;
    remote.dashTrailActive = true;
  }
}
