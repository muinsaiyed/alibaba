import { player, input } from './state.js';
import { COYOTE_TIME, DASH_DOUBLE_TAP_MS, WORLD, platforms } from './constants.js';
import { clamp, rectOverlap } from './utils.js';
import { handleLocalDashTrail, spawnDashTrail } from './dashTrails.js';

export function attemptDash(direction) {
  if (!player.alive) {
    return;
  }
  if (player.dashCooldownTimer > 0 || player.dashTimer > 0) {
    return;
  }

  player.dashTimer = player.dashDuration;
  player.dashDirection = direction;
  player.dashCooldownTimer = player.dashCooldown;
  player.vx = direction * player.dashSpeed;
  player.facing = direction;
  player.dashTrailTimer = 0;
  spawnDashTrail(player, { color: player.color, isLocal: true });
}

export function handleDashTap(direction, lastTapState) {
  const now = performance.now();
  if (direction === -1) {
    if (now - lastTapState.lastTapLeft < DASH_DOUBLE_TAP_MS) {
      lastTapState.lastTapLeft = Number.NEGATIVE_INFINITY;
      attemptDash(-1);
    } else {
      lastTapState.lastTapLeft = now;
    }
    lastTapState.lastTapRight = Number.NEGATIVE_INFINITY;
  } else if (direction === 1) {
    if (now - lastTapState.lastTapRight < DASH_DOUBLE_TAP_MS) {
      lastTapState.lastTapRight = Number.NEGATIVE_INFINITY;
      attemptDash(1);
    } else {
      lastTapState.lastTapRight = now;
    }
    lastTapState.lastTapLeft = Number.NEGATIVE_INFINITY;
  }
}

export function updateLocalPlayer(delta) {
  if (player.invuln > 0) {
    player.invuln = Math.max(0, player.invuln - delta);
  }

  if (player.hitFlash > 0) {
    player.hitFlash = Math.max(0, player.hitFlash - delta);
  }

  if (!player.alive) {
    updateDeathPhysics(delta);
    return false;
  }

  if (player.dashCooldownTimer > 0) {
    player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - delta);
  }

  const dashActive = player.dashTimer > 0;
  if (dashActive) {
    player.vx = player.dashDirection * player.dashSpeed;
    player.dashTimer = Math.max(0, player.dashTimer - delta);
    if (player.dashTimer === 0) {
      player.dashDirection = 0;
    }
  } else {
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const targetSpeed = direction * player.maxSpeed;
    const accel = player.acceleration * delta;
    if (targetSpeed > player.vx) {
      player.vx = Math.min(player.vx + accel, targetSpeed);
    } else if (targetSpeed < player.vx) {
      player.vx = Math.max(player.vx - accel, targetSpeed);
    } else if (direction === 0) {
      const friction = player.acceleration * delta;
      if (player.vx > 0) {
        player.vx = Math.max(0, player.vx - friction);
      } else if (player.vx < 0) {
        player.vx = Math.min(0, player.vx + friction);
      }
    }

    if (direction !== 0) {
      player.facing = direction;
    }
  }

  handleLocalDashTrail(delta, dashActive);

  if (input.jumpQueued) {
    attemptJump();
    input.jumpQueued = false;
  }

  player.vy += player.gravity * delta;
  player.vy = Math.min(player.vy, 900);

  moveEntity(player, delta);

  if (player.onGround) {
    player.jumpsRemaining = player.maxJumps;
    player.coyoteTimer = COYOTE_TIME;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - delta);
  }

  clampToWorld(player);
  player.anim = determinePlayerAnim();
  return true;
}

export function determinePlayerAnim() {
  if (!player.alive) {
    return 'down';
  }
  if (player.dashTimer > 0) {
    return 'dash';
  }
  if (!player.onGround) {
    return player.vy < -40 ? 'jump' : 'fall';
  }
  if (Math.abs(player.vx) > 40) {
    return 'run';
  }
  return 'idle';
}

function attemptJump() {
  const canJumpFromGround = player.coyoteTimer > 0 || player.onGround;
  const hasExtraJump = player.jumpsRemaining > 0 && !player.onGround;
  if (canJumpFromGround || hasExtraJump) {
    player.vy = -player.jumpStrength;
    player.onGround = false;
    player.jumpsRemaining = Math.max(0, player.jumpsRemaining - 1);
    player.coyoteTimer = 0;
  }
}

function updateDeathPhysics(delta) {
  player.vx = 0;
  player.vy += player.gravity * delta;
  player.vy = Math.min(player.vy, 900);
  moveEntity(player, delta);
  clampToWorld(player);
}

function moveEntity(entity, delta) {
  entity.x += entity.vx * delta;
  resolveAxisCollision(entity, 'x');

  entity.vy += 0;
  entity.onGround = false;
  entity.y += entity.vy * delta;
  resolveAxisCollision(entity, 'y');
}

function resolveAxisCollision(entity, axis) {
  for (const platform of platforms) {
    if (!rectOverlap(entity, platform)) {
      continue;
    }

    if (axis === 'x') {
      if (entity.vx > 0) {
        entity.x = platform.x - entity.width;
      } else if (entity.vx < 0) {
        entity.x = platform.x + platform.width;
      }
      entity.vx = 0;
    } else {
      if (entity.vy > 0) {
        entity.y = platform.y - entity.height;
        entity.vy = 0;
        entity.onGround = true;
      } else if (entity.vy < 0) {
        entity.y = platform.y + platform.height;
        entity.vy = 0;
      }
    }
  }
}

function clampToWorld(entity) {
  entity.x = clamp(entity.x, 0, WORLD.width - entity.width);
  entity.y = clamp(entity.y, 0, WORLD.height - entity.height);
}

export function resetDashTimers() {
  player.dashTimer = 0;
  player.dashDirection = 0;
  player.dashCooldownTimer = 0;
  player.dashTrailTimer = 0;
}
