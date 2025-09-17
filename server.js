const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: allowedOrigins.length
    ? {
        origin: allowedOrigins,
        credentials: false,
      }
    : {
        origin: '*',
        credentials: false,
      },
});

const PORT = Number(process.env.PORT) || 3000;

const publicDir = path.join(__dirname);
app.use(express.static(publicDir));

const basePalette = [
  '#ffcc66',
  '#ff9966',
  '#ff6699',
  '#cc66ff',
  '#6699ff',
  '#66ffcc',
  '#66ff66',
  '#ccff66',
];
const availableColors = [...basePalette];
const players = new Map();
const nameRegistry = new Set();

const MAIN_ROOM = 'main';

const RESPAWN_DELAY_MS = 3200;
const DEFAULT_HEALTH = 20;
const MAX_PLAYERS = 4;
const IDLE_TIMEOUT_MS = 30000;
const SPAWN_POINTS = [
  { x: 140, y: 488 },
  { x: 420, y: 440 },
  { x: 760, y: 360 },
  { x: 1080, y: 300 },
  { x: 1420, y: 260 },
  { x: 1780, y: 320 },
  { x: 2120, y: 280 },
  { x: 2460, y: 320 },
];
const IDLE_CHECK_INTERVAL_MS = 5000;
let nextSpawnIndex = 0;
const FIREBALL_LIFETIME = 0.42;

function getSpawnPoint() {
  const point = SPAWN_POINTS[nextSpawnIndex % SPAWN_POINTS.length];
  nextSpawnIndex += 1;
  return { x: point.x, y: point.y };
}

setInterval(() => {
  const now = Date.now();
  for (const player of players.values()) {
    if (now - (player.lastActive || 0) > IDLE_TIMEOUT_MS) {
      removePlayer(player.id, {
        kicked: true,
        reason: 'Kicked for inactivity.',
      });
    }
  }
}, IDLE_CHECK_INTERVAL_MS).unref?.();

function sanitizePlayerState(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    x: player.x,
    y: player.y,
    facing: player.facing,
    anim: player.anim,
    health: player.health,
    maxHealth: player.maxHealth,
    alive: player.alive,
    kills: player.kills,
    deaths: player.deaths,
  };
}

function broadcastPlayerState(player) {
  io.to(MAIN_ROOM).emit('player:state', sanitizePlayerState(player));
}

function isValidProjectile(payload) {
  return (
    payload &&
    Number.isFinite(payload.x) &&
    Number.isFinite(payload.y) &&
    Number.isFinite(payload.vx) &&
    Number.isFinite(payload.vy)
  );
}

function scheduleRespawn(player) {
  if (player.respawnTimer) {
    clearTimeout(player.respawnTimer);
  }
  player.respawnTimer = setTimeout(() => {
    const spawn = getSpawnPoint();
    player.x = spawn.x;
    player.y = spawn.y;
    player.health = player.maxHealth;
    player.alive = true;
    player.anim = 'idle';
    player.respawnTimer = null;
    updateActivity(player);
    const socketInstance = io.sockets.sockets.get(player.id);
    if (socketInstance) {
      socketInstance.emit('player:respawn', {
        x: player.x,
        y: player.y,
        health: player.health,
        maxHealth: player.maxHealth,
        kills: player.kills,
        deaths: player.deaths,
      });
      socketInstance.to(MAIN_ROOM).emit('player:respawned', sanitizePlayerState(player));
    }
    broadcastPlayerState(player);
  }, RESPAWN_DELAY_MS);
}

function applyDamage(attackerId, targetId, amount) {
  const target = players.get(targetId);
  if (!target || !target.alive) {
    return;
  }

  const attacker = attackerId ? players.get(attackerId) : null;
  const damage = Math.max(0, Math.min(5, Number(amount) || 0));
  if (damage <= 0) {
    return;
  }

  updateActivity(target);
  if (attacker) {
    updateActivity(attacker);
  }

  target.health = Math.max(0, target.health - damage);

  if (target.health === 0) {
    target.alive = false;
    target.deaths += 1;
    target.anim = 'down';
    if (attacker && attacker.id !== target.id) {
      attacker.kills += 1;
      broadcastPlayerState(attacker);
    }
    broadcastPlayerState(target);
    io.to(MAIN_ROOM).emit('player:defeated', {
      targetId: target.id,
      attackerId: attacker && attacker.id !== target.id ? attacker.id : null,
    });
    scheduleRespawn(target);
    return;
  }

  broadcastPlayerState(target);
}

function updateActivity(player) {
  player.lastActive = Date.now();
}

function removePlayer(playerId, { reason, kicked = false } = {}) {
  const player = players.get(playerId);
  if (!player) {
    return;
  }

  if (player.respawnTimer) {
    clearTimeout(player.respawnTimer);
  }

  players.delete(playerId);
  releaseName(player.name);
  releaseColor(player.color);

  const socketInstance = io.sockets.sockets.get(playerId);
  if (socketInstance) {
    socketInstance.leave(MAIN_ROOM);
    if (kicked) {
      socketInstance.emit('player:kicked', {
        reason: reason || 'Removed from the room.',
      });
      setTimeout(() => {
        socketInstance.disconnect(true);
      }, 10);
    }
  }

  io.to(MAIN_ROOM).emit('player:left', { id: playerId });
}

function assignColor() {
  if (availableColors.length > 0) {
    return availableColors.shift();
  }

  // Generate a fallback color if all palette colors are in use.
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 60%)`;
}

function releaseColor(color) {
  if (!color) {
    return;
  }
  if (basePalette.includes(color) && !availableColors.includes(color)) {
    availableColors.push(color);
  }
}

function sanitizeName(input) {
  if (typeof input !== 'string') {
    return 'Adventurer';
  }
  return input.trim().slice(0, 20) || 'Adventurer';
}

function normalizeName(name) {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function claimName(name) {
  const key = normalizeName(name);
  if (!key) {
    return null;
  }
  if (nameRegistry.has(key)) {
    return null;
  }
  nameRegistry.add(key);
  return name;
}

function releaseName(name) {
  const key = normalizeName(name);
  if (!key) {
    return;
  }
  nameRegistry.delete(key);
}

io.on('connection', (socket) => {
  socket.on('player:join', (payload, callback) => {
    if (players.size >= MAX_PLAYERS) {
      if (typeof callback === 'function') {
        callback({
          error: 'room_full',
          maxPlayers: MAX_PLAYERS,
        });
      }
      socket.emit('player:kicked', {
        reason: `The room is full (max ${MAX_PLAYERS} players).`,
      });
      setTimeout(() => {
        socket.disconnect(true);
      }, 10);
      return;
    }

    if (players.has(socket.id)) {
      if (typeof callback === 'function') {
        callback({ error: 'already_joined' });
      }
      return;
    }

    const requestedName = sanitizeName(payload?.name);
    const claimedName = claimName(requestedName);
    if (!claimedName) {
      if (typeof callback === 'function') {
        callback({ error: 'name_taken' });
      }
      return;
    }

    const color = assignColor();
    const spawn = getSpawnPoint();

    const state = {
      id: socket.id,
      name: claimedName,
      color,
      x: spawn.x,
      y: spawn.y,
      facing: 1,
      anim: 'idle',
      health: DEFAULT_HEALTH,
      maxHealth: DEFAULT_HEALTH,
      alive: true,
      kills: 0,
      deaths: 0,
      respawnTimer: null,
      lastActive: Date.now(),
    };

    players.set(socket.id, state);
    socket.join(MAIN_ROOM);

    if (typeof callback === 'function') {
      const roster = Array.from(players.values())
        .filter((player) => player.id !== socket.id)
        .map((player) => sanitizePlayerState(player));
      callback({
        id: socket.id,
        name: state.name,
        color,
        x: state.x,
        y: state.y,
        health: state.health,
        maxHealth: state.maxHealth,
        kills: state.kills,
        deaths: state.deaths,
        players: roster,
      });
    }

    socket.to(MAIN_ROOM).emit('player:joined', sanitizePlayerState(state));
    broadcastPlayerState(state);
  });

  socket.on('player:update', (payload = {}) => {
    const player = players.get(socket.id);
    if (!player) {
      return;
    }

    const nextX = typeof payload.x === 'number' ? payload.x : player.x;
    const nextY = typeof payload.y === 'number' ? payload.y : player.y;
    const nextFacing = payload.facing === -1 || payload.facing === 1 ? payload.facing : player.facing;
    const nextAnim = typeof payload.anim === 'string' ? payload.anim : player.anim;

    const moved =
      player.alive &&
      (Math.abs(nextX - player.x) > 0.05 || Math.abs(nextY - player.y) > 0.05);
    const facingChanged = nextFacing !== player.facing;
    const animChanged = nextAnim !== player.anim;

    if (player.alive) {
      player.x = nextX;
      player.y = nextY;
    }
    player.facing = nextFacing;
    player.anim = nextAnim;

    if (moved || facingChanged || animChanged) {
      updateActivity(player);
      socket.to(MAIN_ROOM).emit('player:updated', {
        id: socket.id,
        x: player.x,
        y: player.y,
        facing: player.facing,
        anim: player.anim,
      });
    }
  });

  socket.on('player:shoot', (payload = {}) => {
    const player = players.get(socket.id);
    if (!player || !player.alive) {
      return;
    }

    if (!isValidProjectile(payload)) {
      return;
    }

    updateActivity(player);

    socket.to(MAIN_ROOM).emit('player:shot', {
      ownerId: socket.id,
      x: payload.x,
      y: payload.y,
      vx: payload.vx,
      vy: payload.vy,
      width: payload.width ?? 24,
      height: payload.height ?? 24,
      damage: payload.damage ?? 1,
      lifetime: payload.lifetime ?? FIREBALL_LIFETIME,
    });
  });

  socket.on('player:damage', (payload = {}) => {
    const targetId = typeof payload.targetId === 'string' ? payload.targetId : null;
    if (!targetId || !players.has(targetId)) {
      return;
    }

    let attackerId = socket.id;
    if (
      typeof payload.attackerId === 'string' &&
      players.has(payload.attackerId) &&
      targetId === socket.id
    ) {
      attackerId = payload.attackerId;
    }

    applyDamage(attackerId, targetId, payload.amount ?? 1);
  });

  socket.on('disconnect', () => {
    removePlayer(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
