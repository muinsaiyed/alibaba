import { fireballs, input, network, player, pointer, remotePlayers } from './state.js';
import {
  FIREBALL_LIFETIME,
  HIT_FLASH_DURATION,
  SINBAD_ATTACK_DURATION,
  SINBAD_WAVE_HEIGHT,
  SINBAD_WAVE_LIFETIME,
  SINBAD_WAVE_SPEED,
  SINBAD_WAVE_WIDTH,
  WORLD,
  platforms,
} from './constants.js';
import { playFireballSound } from './audio.js';
import { predictCameraPosition, recalcPointerWorld } from './viewport.js';
import { getRect, rectIntersect } from './utils.js';

const DEFAULT_FIRE_COOLDOWN = 0.45;
const SINBAD_FIRE_COOLDOWN = 0.56;

export function handlePlayerAttack(delta) {
  if (player.fireCooldown > 0) {
    player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  }

  if (!player.alive || !network.hasJoinedGame || !network.localPlayerId) {
    return;
  }

  if (!input.fire || player.fireCooldown > 0) {
    return;
  }

  const predictedCamera = predictCameraPosition();
  recalcPointerWorld(predictedCamera);

  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  let targetX = pointer.worldX;
  let targetY = pointer.worldY;

  const dx = targetX - centerX;
  const dy = targetY - centerY;
  const distance = Math.hypot(dx, dy);

  if (distance < 12) {
    targetX = centerX + player.facing * 160;
    targetY = centerY;
  }

  player.facing = targetX >= centerX ? 1 : -1;

  const angle = Math.atan2(targetY - centerY, targetX - centerX);
  const isSinbad = player.character === 'sinbad';
  const projectile = isSinbad
    ? createSinbadWave(centerX, centerY, angle)
    : createStandardFireball(centerX, centerY, angle);

  addFireball(projectile);

  if (network.socket) {
    network.socket.emit('player:shoot', {
      x: projectile.x,
      y: projectile.y,
      vx: projectile.vx,
      vy: projectile.vy,
      width: projectile.width,
      height: projectile.height,
      damage: projectile.damage,
      lifetime: projectile.lifetime,
      type: projectile.type,
    });
  }

  player.fireCooldown = isSinbad ? SINBAD_FIRE_COOLDOWN : DEFAULT_FIRE_COOLDOWN;
  playFireballSound();
}

function createStandardFireball(centerX, centerY, angle) {
  if (player.character !== 'sinbad' && player.attackTimer > 0) {
    player.attackTimer = 0;
    player.attackAnimTime = 0;
  }

  const speed = 640;
  const size = 26;
  const originDistance = player.width * 0.6;
  const spawnX = centerX + Math.cos(angle) * originDistance - size / 2;
  const spawnY = centerY + Math.sin(angle) * originDistance - size / 2;

  return {
    id: `${network.localPlayerId}-${performance.now().toFixed(3)}`,
    ownerId: network.localPlayerId,
    x: spawnX,
    y: spawnY,
    width: size,
    height: size,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage: 1,
    lifetime: FIREBALL_LIFETIME,
    type: 'fireball',
    rotation: angle,
    friendly: true,
  };
}

function createSinbadWave(centerX, centerY, angle) {
  const originDistance = player.width * 2.2;
  const spawnX = centerX + Math.cos(angle) * originDistance - SINBAD_WAVE_WIDTH / 2;
  const spawnY = centerY + Math.sin(angle) * originDistance - SINBAD_WAVE_HEIGHT / 2;

  player.attackTimer = SINBAD_ATTACK_DURATION;
  player.attackAnimTime = 0;

  return {
    id: `${network.localPlayerId}-${performance.now().toFixed(3)}`,
    ownerId: network.localPlayerId,
    x: spawnX,
    y: spawnY,
    width: SINBAD_WAVE_WIDTH,
    height: SINBAD_WAVE_HEIGHT,
    vx: Math.cos(angle) * SINBAD_WAVE_SPEED,
    vy: Math.sin(angle) * SINBAD_WAVE_SPEED,
    damage: 1,
    lifetime: SINBAD_WAVE_LIFETIME,
    type: 'sinbadWave',
    rotation: angle,
    friendly: true,
  };
}

export function addFireball(data) {
  const vx = data.vx ?? 0;
  const vy = data.vy ?? 0;
  fireballs.push({
    id: data.id ?? `${data.ownerId ?? 'fb'}-${Math.random().toString(16).slice(2)}`,
    ownerId: data.ownerId ?? null,
    x: data.x,
    y: data.y,
    width: data.width ?? 24,
    height: data.height ?? 24,
    vx,
    vy,
    damage: data.damage ?? 1,
    lifetime: data.lifetime ?? FIREBALL_LIFETIME,
    type: data.type ?? 'fireball',
    rotation: typeof data.rotation === 'number' ? data.rotation : Math.atan2(vy, vx),
    friendly: Boolean(data.friendly),
  });
}

export function updateFireballs(delta) {
  if (fireballs.length === 0) {
    return;
  }

  const playerRect = getRect(player);

  for (let i = fireballs.length - 1; i >= 0; i -= 1) {
    const fireball = fireballs[i];
    fireball.x += fireball.vx * delta;
    fireball.y += fireball.vy * delta;
    fireball.lifetime -= delta;

    if (
      fireball.x < -160 ||
      fireball.x > WORLD.width + 160 ||
      fireball.y < -120 ||
      fireball.y > WORLD.height + 160 ||
      fireball.lifetime <= 0
    ) {
      fireballs.splice(i, 1);
      continue;
    }

    let destroyed = false;
    for (const platform of platforms) {
      if (rectIntersect(fireball, platform)) {
        destroyed = true;
        break;
      }
    }
    if (destroyed) {
      fireballs.splice(i, 1);
      continue;
    }

    if (fireball.ownerId === network.localPlayerId) {
      let hitId = null;
      for (const remote of remotePlayers.values()) {
        if (!remote.alive) {
          continue;
        }
        if (rectIntersect(fireball, getRect(remote))) {
          hitId = remote.id;
          break;
        }
      }
      if (hitId) {
        const hitRemote = remotePlayers.get(hitId);
        if (hitRemote) {
          hitRemote.hitFlash = HIT_FLASH_DURATION;
        }
        if (network.socket) {
          network.socket.emit('player:damage', {
            targetId: hitId,
            amount: fireball.damage ?? 1,
          });
        }
        fireballs.splice(i, 1);
      }
      continue;
    }

    if (fireball.ownerId && fireball.ownerId !== network.localPlayerId) {
      if (playerRect && player.alive && player.invuln <= 0 && rectIntersect(fireball, playerRect)) {
        reportLocalHit(fireball.ownerId, fireball.damage ?? 1);
        fireballs.splice(i, 1);
      }
      continue;
    }
  }
}

export function reportLocalHit(attackerId, amount) {
  if (!network.socket || !network.hasJoinedGame || !network.localPlayerId) {
    return;
  }
  network.socket.emit('player:damage', {
    targetId: network.localPlayerId,
    attackerId,
    amount,
  });
  player.invuln = Math.max(player.invuln, 0.25);
  player.hitFlash = HIT_FLASH_DURATION;
}
