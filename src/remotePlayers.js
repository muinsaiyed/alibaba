import { network, normalizeCharacter, player, remotePlayers } from './state.js';
import { DASH_TRAIL_INTERVAL, REMOTE_SMOOTHING_RATE, WORLD, SINBAD_ATTACK_DURATION } from './constants.js';
import { clamp } from './utils.js';
import { handleRemoteDashTrail } from './dashTrails.js';

export function updateRemotePlayers(delta) {
  if (remotePlayers.size === 0) {
    return;
  }

  const smoothing = 1 - Math.exp(-REMOTE_SMOOTHING_RATE * delta);
  for (const remote of remotePlayers.values()) {
    if (!Number.isFinite(remote.targetX) || !Number.isFinite(remote.targetY)) {
      continue;
    }

    if (remote.hitFlash > 0) {
      remote.hitFlash = Math.max(0, remote.hitFlash - delta);
    }

    if (remote.attackTimer > 0) {
      remote.attackTimer = Math.max(0, remote.attackTimer - delta);
      remote.attackAnimTime = (remote.attackAnimTime ?? 0) + delta;
      if (remote.attackTimer === 0) {
        remote.attackAnimTime = 0;
      }
    } else if (remote.anim !== 'attack' && remote.attackAnimTime) {
      remote.attackAnimTime = 0;
    }
    const offsetX = remote.targetX - remote.x;
    const offsetY = remote.targetY - remote.y;

    if (Math.abs(offsetX) < 0.1 && Math.abs(offsetY) < 0.1) {
      remote.x = remote.targetX;
      remote.y = remote.targetY;
    } else {
      remote.x += offsetX * smoothing;
      remote.y += offsetY * smoothing;
    }

    remote.x = clamp(remote.x, 0, WORLD.width - remote.width);
    remote.y = clamp(remote.y, 0, WORLD.height - remote.height);
    handleRemoteDashTrail(remote, delta);
  }
}

export function registerRemotePlayer(data = {}) {
  if (!data.id || data.id === network.localPlayerId) {
    return null;
  }

  const previous = remotePlayers.get(data.id);
  const width = previous?.width ?? player.width;
  const height = previous?.height ?? player.height;
  const facing = data.facing === -1 || data.facing === 1 ? data.facing : previous?.facing ?? 1;
  const anim = typeof data.anim === 'string' ? data.anim : previous?.anim ?? 'idle';
  const incomingX = Number.isFinite(data.x) ? data.x : previous?.targetX ?? previous?.x ?? 140;
  const incomingY = Number.isFinite(data.y) ? data.y : previous?.targetY ?? previous?.y ?? WORLD.groundY - player.height;
  const timestamp = performance.now();
  const previousAttackTimer = previous?.attackTimer ?? 0;
  const previousAttackAnimTime = previous?.attackAnimTime ?? 0;
  const attackActive = anim === 'attack';
  const attackTimer = attackActive
    ? (previousAttackTimer > 0 ? previousAttackTimer : SINBAD_ATTACK_DURATION)
    : 0;
  const attackAnimTime = attackActive
    ? (previousAttackTimer > 0 ? previousAttackAnimTime : 0)
    : 0;

  const remote = {
    id: data.id,
    name: typeof data.name === 'string' && data.name.trim()
      ? data.name.trim()
      : previous?.name || 'Ally',
    color: data.color || previous?.color || '#66ffcc',
    character: previous?.character ?? normalizeCharacter(data.character),
    x: previous?.x ?? incomingX,
    y: previous?.y ?? incomingY,
    targetX: incomingX,
    targetY: incomingY,
    width,
    height,
    facing,
    anim,
    attackTimer,
    attackAnimTime,
    dashTrailInterval: previous?.dashTrailInterval ?? DASH_TRAIL_INTERVAL * 1.1,
    dashTrailTimer: previous?.dashTrailTimer ?? 0,
    dashTrailActive: previous?.dashTrailActive ?? false,
    health: typeof data.health === 'number' ? data.health : previous?.health ?? player.maxHealth,
    maxHealth: typeof data.maxHealth === 'number' ? data.maxHealth : previous?.maxHealth ?? player.maxHealth,
    alive: typeof data.alive === 'boolean' ? data.alive : previous?.alive ?? true,
    kills: typeof data.kills === 'number' ? data.kills : previous?.kills ?? 0,
    deaths: typeof data.deaths === 'number' ? data.deaths : previous?.deaths ?? 0,
    lastUpdate: timestamp,
    hitFlash: previous?.hitFlash ?? 0,
  };

  remotePlayers.set(data.id, remote);
  return remote;
}

export function removeRemotePlayer(id) {
  if (!id) {
    return;
  }
  remotePlayers.delete(id);
}

export function clearRemotePlayers() {
  remotePlayers.clear();
}

export function getPlayerName(id) {
  if (!id) {
    return null;
  }
  if (id === network.localPlayerId) {
    return player.displayName;
  }
  return remotePlayers.get(id)?.name ?? null;
}
