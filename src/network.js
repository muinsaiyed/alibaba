import { addFireball } from './projectiles.js';
import { playEnemyDeathSound, playFireballSound } from './audio.js';
import { determinePlayerAnim, resetDashTimers } from './player.js';
import {
  dashTrails,
  fireballs,
  input,
  network,
  normalizeCharacter,
  player,
  remotePlayers,
  ui,
} from './state.js';
import { DASH_TRAIL_INTERVAL, HIT_FLASH_DURATION, NETWORK_SEND_INTERVAL, SOCKET_URL } from './constants.js';
import { clearRemotePlayers, getPlayerName, registerRemotePlayer, removeRemotePlayer } from './remotePlayers.js';
import { hideMessage, showMessage, syncCharacterSelection, updateEnemyCounter, updateHealthUI } from './ui.js';

export function initNetwork() {
  if (ui.joinForm) {
    ui.joinForm.addEventListener('submit', handleJoinSubmit);
  }
}

export function updateNetwork(delta) {
  if (!network.socket || !network.hasJoinedGame || !network.socket.connected) {
    return;
  }

  network.networkAccumulator += delta;
  if (network.networkAccumulator < NETWORK_SEND_INTERVAL) {
    return;
  }
  network.networkAccumulator = 0;
  sendPlayerSnapshot(false);
}

export function ensureSocket() {
  if (network.socket) {
    return network.socket;
  }

  if (typeof window === 'undefined' || typeof window.io !== 'function') {
    console.error('Socket.IO client library is missing.');
    return null;
  }

  const socket = window.io(SOCKET_URL, { autoConnect: false });
  network.socket = socket;

  socket.on('player:joined', onPlayerJoined);
  socket.on('player:updated', onPlayerUpdated);
  socket.on('player:left', onPlayerLeft);
  socket.on('player:shot', onPlayerShot);
  socket.on('player:state', onPlayerState);
  socket.on('player:defeated', onPlayerDefeated);
  socket.on('player:respawn', onPlayerRespawn);
  socket.on('player:respawned', onPlayerRespawned);
  socket.on('player:kicked', onPlayerKicked);
  socket.on('disconnect', handleSocketDisconnect);
  socket.on('connect_error', handleConnectError);
  socket.on('connect', handleSocketConnected);

  return socket;
}

export function sendPlayerSnapshot(force = false) {
  if (!network.socket || !network.socket.connected || !network.hasJoinedGame) {
    return;
  }

  if (force) {
    network.networkAccumulator = 0;
  }

  const anim = player.anim ?? determinePlayerAnim();
  player.anim = anim;
  network.socket.emit('player:update', {
    x: player.x,
    y: player.y,
    facing: player.facing >= 0 ? 1 : -1,
    anim,
  });
}

function handleJoinSubmit(event) {
  event.preventDefault();
  if (network.joinInFlight || network.hasJoinedGame) {
    return;
  }

  const name = ui.joinNameInput?.value.trim() ?? '';
  if (!name) {
    if (ui.joinNameInput) {
      ui.joinNameInput.focus();
    }
    return;
  }

  const socket = ensureSocket();
  if (!socket) {
    showMessage('Multiplayer service unavailable.');
    setTimeout(() => hideMessage(), 2800);
    return;
  }

  cancelPendingJoin();
  network.joinInFlight = true;
  const submitButton = ui.joinForm?.querySelector('button');
  if (ui.joinNameInput) {
    ui.joinNameInput.disabled = true;
  }
  if (submitButton) {
    submitButton.disabled = true;
  }

  const completeJoin = (response) => {
    clearPendingJoinTimeout();
    network.joinInFlight = false;
    if (ui.joinNameInput) {
      ui.joinNameInput.disabled = false;
    }
    if (submitButton) {
      submitButton.disabled = false;
    }

    if (!response || response.error) {
      const errorCode = response?.error;
      const errorMessage =
        errorCode === 'room_full'
          ? `The room is full right now (max ${response?.maxPlayers ?? 4} players).`
          : errorCode === 'name_taken'
            ? 'That name is already taken. Try a different one.'
            : 'Unable to join right now. Try again soon.';
      const nameTaken = errorCode === 'name_taken';
      if (nameTaken && ui.joinNameInput) {
        ui.joinNameInput.value = name;
      }
      returnToLobby({ message: errorMessage, autoHide: !nameTaken });
      if (nameTaken && ui.joinNameInput) {
        setTimeout(() => {
          ui.joinNameInput.focus();
          ui.joinNameInput.select();
        }, 0);
      }
      return;
    }

    network.localPlayerId = response.id;
    player.displayName = response.name || name;
    player.color = response.color || player.color;
    const joinedCharacter = normalizeCharacter(response.character);
    player.character = joinedCharacter;
    syncCharacterSelection(joinedCharacter);
    if (ui.playerNameLabel) {
      ui.playerNameLabel.textContent = player.displayName;
    }
    if (Number.isFinite(response.x)) {
      player.x = response.x;
    }
    if (Number.isFinite(response.y)) {
      player.y = response.y;
    }
    player.health = typeof response.health === 'number' ? response.health : player.health;
    player.maxHealth = typeof response.maxHealth === 'number' ? response.maxHealth : player.maxHealth;
    player.kills = typeof response.kills === 'number' ? response.kills : 0;
    player.deaths = typeof response.deaths === 'number' ? response.deaths : 0;
    player.alive = true;
    resetDashTimers();
    player.invuln = 0;
    player.fireCooldown = 0;
    player.hitFlash = 0;
    input.fire = false;
    network.hasJoinedGame = true;

    if (ui.joinOverlay) {
      ui.joinOverlay.classList.add('overlay-hidden');
      ui.joinOverlay.setAttribute('aria-hidden', 'true');
    }
    if (ui.joinNameInput) {
      ui.joinNameInput.blur();
    }

    hideMessage();
    clearRemotePlayers();
    if (Array.isArray(response.players)) {
      for (const remote of response.players) {
        registerRemotePlayer(remote);
      }
    }

    updateEnemyCounter();
    updateHealthUI();
    sendPlayerSnapshot(true);
  };

  network.pendingJoinPayload = { name, x: player.x, y: player.y, character: player.character };
  network.pendingJoinCallback = completeJoin;
  network.pendingJoinTimeout = setTimeout(() => {
    if (!network.joinInFlight || network.pendingJoinCallback !== completeJoin) {
      return;
    }
    network.joinInFlight = false;
    cancelPendingJoin();
    if (ui.joinNameInput) {
      ui.joinNameInput.disabled = false;
      ui.joinNameInput.focus();
    }
    if (submitButton) {
      submitButton.disabled = false;
    }
    showMessage('Unable to join right now. Try again soon.');
    setTimeout(() => hideMessage(), 3200);
  }, 12000);

  if (socket.connected) {
    emitPendingJoin();
  } else {
    socket.connect();
  }
}

function clearPendingJoinTimeout() {
  if (network.pendingJoinTimeout) {
    clearTimeout(network.pendingJoinTimeout);
    network.pendingJoinTimeout = null;
  }
}

function cancelPendingJoin() {
  clearPendingJoinTimeout();
  network.pendingJoinPayload = null;
  network.pendingJoinCallback = null;
}

function emitPendingJoin() {
  if (!network.socket || !network.socket.connected) {
    return;
  }
  if (!network.pendingJoinPayload || !network.pendingJoinCallback) {
    return;
  }

  const payload = network.pendingJoinPayload;
  const callback = network.pendingJoinCallback;
  network.socket.emit('player:join', payload, (response) => {
    if (network.pendingJoinCallback !== callback) {
      return;
    }
    cancelPendingJoin();
    callback(response);
  });
}

function handleSocketConnected() {
  if (network.pendingJoinPayload && network.pendingJoinCallback) {
    emitPendingJoin();
    return;
  }
  if (network.hasJoinedGame) {
    sendPlayerSnapshot(true);
  }
}

function onPlayerJoined(data) {
  registerRemotePlayer(data);
  updateEnemyCounter();
}

function onPlayerUpdated(data) {
  if (!data || !data.id || data.id === network.localPlayerId) {
    return;
  }

  const remote = remotePlayers.get(data.id);
  if (!remote) {
    registerRemotePlayer(data);
    updateEnemyCounter();
    return;
  }

  if (typeof data.x === 'number') {
    remote.targetX = data.x;
  }
  if (typeof data.y === 'number') {
    remote.targetY = data.y;
  }
  if (data.facing === -1 || data.facing === 1) {
    remote.facing = data.facing;
  }
  if (typeof data.character === 'string') {
    remote.character = normalizeCharacter(data.character);
  }
  const previousAnim = remote.anim;
  if (typeof data.anim === 'string') {
    remote.anim = data.anim;
  }
  if (previousAnim !== remote.anim) {
    remote.dashTrailActive = false;
    remote.dashTrailTimer = remote.anim === 'dash' ? 0 : remote.dashTrailInterval ?? DASH_TRAIL_INTERVAL * 1.1;
  }
  remote.lastUpdate = performance.now();
}

function onPlayerLeft(data) {
  if (!data || !data.id) {
    return;
  }
  removeRemotePlayer(data.id);
  updateEnemyCounter();
}

function onPlayerShot(data = {}) {
  if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) {
    return;
  }
  addFireball({
    id: data.id,
    ownerId: data.ownerId,
    x: data.x,
    y: data.y,
    width: data.width,
    height: data.height,
    vx: data.vx,
    vy: data.vy,
    damage: data.damage,
    lifetime: data.lifetime,
  });
  playFireballSound();
}

function onPlayerState(data = {}) {
  if (!data.id) {
    return;
  }

  if (data.id === network.localPlayerId) {
    applyLocalStateUpdate(data);
    return;
  }

  const remote = remotePlayers.get(data.id) ?? registerRemotePlayer(data);
  if (!remote) {
    updateEnemyCounter();
    return;
  }

  const prevHealth = remote.health;
  if (typeof data.health === 'number') {
    remote.health = data.health;
  }
  remote.maxHealth = typeof data.maxHealth === 'number' ? data.maxHealth : remote.maxHealth;
  remote.alive = typeof data.alive === 'boolean' ? data.alive : remote.alive;
  remote.kills = typeof data.kills === 'number' ? data.kills : remote.kills;
  remote.deaths = typeof data.deaths === 'number' ? data.deaths : remote.deaths;
  if (typeof data.character === 'string') {
    remote.character = normalizeCharacter(data.character);
  }
  if (Number.isFinite(data.x)) {
    remote.targetX = data.x;
    if (!remote.alive) {
      remote.x = data.x;
    }
  }
  if (Number.isFinite(data.y)) {
    remote.targetY = data.y;
    if (!remote.alive) {
      remote.y = data.y;
    }
  }
  if (data.facing === -1 || data.facing === 1) {
    remote.facing = data.facing;
  }
  const prevAnim = remote.anim;
  if (typeof data.anim === 'string') {
    remote.anim = data.anim;
  }
  if (prevAnim !== remote.anim) {
    remote.dashTrailActive = false;
    remote.dashTrailTimer = remote.anim === 'dash' ? 0 : remote.dashTrailInterval ?? DASH_TRAIL_INTERVAL * 1.1;
  }
  remote.lastUpdate = performance.now();
  if (typeof prevHealth === 'number' && remote.health < prevHealth) {
    remote.hitFlash = HIT_FLASH_DURATION;
  }
  updateEnemyCounter();
}

function onPlayerDefeated(data = {}) {
  if (!data || !data.targetId) {
    return;
  }

  const targetName = getPlayerName(data.targetId);
  const attackerName = data.attackerId ? getPlayerName(data.attackerId) : null;
  if (targetName) {
    if (attackerName && attackerName !== targetName) {
      showMessage(`${attackerName} defeated ${targetName}!`);
    } else {
      showMessage(`${targetName} took themselves out!`);
    }
    setTimeout(() => hideMessage(), 2200);
    playEnemyDeathSound();
  }
}

function onPlayerRespawn(data = {}) {
  if (!network.hasJoinedGame || !network.localPlayerId || data.health == null) {
    return;
  }

  player.x = Number.isFinite(data.x) ? data.x : player.x;
  player.y = Number.isFinite(data.y) ? data.y : player.y;
  player.health = data.health;
  player.maxHealth = data.maxHealth ?? player.maxHealth;
  player.kills = data.kills ?? player.kills;
  player.deaths = data.deaths ?? player.deaths;
  player.alive = true;
  player.invuln = 1.2;
  player.vx = 0;
  player.vy = 0;
  player.jumpsRemaining = player.maxJumps;
  player.coyoteTimer = 0;
  resetDashTimers();
  player.anim = 'idle';
  fireballs.length = 0;
  player.hitFlash = 0;
  updateHealthUI();
  updateEnemyCounter();
}

function onPlayerRespawned(data = {}) {
  if (!data.id || data.id === network.localPlayerId) {
    return;
  }

  registerRemotePlayer({
    ...data,
    alive: true,
  });
  const remote = remotePlayers.get(data.id);
  if (remote) {
    remote.hitFlash = 0;
  }
  updateEnemyCounter();
}

function onPlayerKicked(data = {}) {
  const reason = data?.reason || 'You were removed from the room.';
  returnToLobby({ message: reason });
}

function handleSocketDisconnect() {
  if (!network.hasJoinedGame) {
    return;
  }

  returnToLobby({ message: 'Connection lost. Rejoin to keep playing together.' });
}

function handleConnectError(error) {
  console.error('Socket.IO connection error:', error);
  if (network.joinInFlight && network.pendingJoinCallback) {
    showMessage('Unable to reach the caravan. Retrying...');
    return;
  }

  if (network.joinInFlight) {
    network.joinInFlight = false;
    cancelPendingJoin();
    if (ui.joinNameInput) {
      ui.joinNameInput.disabled = false;
      ui.joinNameInput.focus();
    }
    const submitButton = ui.joinForm?.querySelector('button');
    if (submitButton) {
      submitButton.disabled = false;
    }
  }

  showMessage('Unable to reach the caravan. Please try again.');
  setTimeout(() => hideMessage(), 3200);
}

export function returnToLobby({ message, autoHide = true } = {}) {
  cancelPendingJoin();
  network.joinInFlight = false;
  network.hasJoinedGame = false;
  network.localPlayerId = null;
  clearRemotePlayers();
  input.fire = false;
  player.alive = true;
  player.health = player.maxHealth;
  player.kills = 0;
  player.deaths = 0;
  player.invuln = 0;
  player.fireCooldown = 0;
  resetDashTimers();
  player.hitFlash = 0;
  player.anim = 'idle';
  dashTrails.length = 0;
  fireballs.length = 0;
  updateEnemyCounter();
  updateHealthUI();
  syncCharacterSelection(player.character);

  if (ui.joinOverlay) {
    ui.joinOverlay.classList.remove('overlay-hidden');
    ui.joinOverlay.removeAttribute('aria-hidden');
  }
  if (ui.joinNameInput) {
    ui.joinNameInput.disabled = false;
    if (!ui.joinNameInput.value) {
      ui.joinNameInput.value = player.displayName;
    }
    ui.joinNameInput.focus();
  }
  const submitButton = ui.joinForm?.querySelector('button');
  if (submitButton) {
    submitButton.disabled = false;
  }

  if (message) {
    showMessage(message);
    if (autoHide) {
      setTimeout(() => hideMessage(), 3200);
    }
  } else {
    hideMessage();
  }
}

function applyLocalStateUpdate(data) {
  const wasAlive = player.alive;
  const prevHealth = player.health;
  if (Number.isFinite(data.x)) {
    player.x = data.x;
  }
  if (Number.isFinite(data.y)) {
    player.y = data.y;
  }
  if (data.facing === -1 || data.facing === 1) {
    player.facing = data.facing;
  }
  if (typeof data.anim === 'string') {
    player.anim = data.anim;
  }
  if (typeof data.character === 'string') {
    const normalized = normalizeCharacter(data.character);
    if (player.character !== normalized) {
      player.character = normalized;
      syncCharacterSelection(normalized);
    }
  }

  if (typeof data.health === 'number') {
    player.health = data.health;
  }
  player.maxHealth = typeof data.maxHealth === 'number' ? data.maxHealth : player.maxHealth;
  player.kills = typeof data.kills === 'number' ? data.kills : player.kills;
  player.deaths = typeof data.deaths === 'number' ? data.deaths : player.deaths;
  if (typeof data.alive === 'boolean') {
    player.alive = data.alive;
  }

  if (player.health < prevHealth) {
    player.hitFlash = HIT_FLASH_DURATION;
  }

  if (!player.alive && wasAlive) {
    player.vx = 0;
    player.vy = -player.jumpStrength * 0.32;
    input.fire = false;
    player.invuln = 1.2;
    resetDashTimers();
  }

  updateHealthUI();
  updateEnemyCounter();
}
