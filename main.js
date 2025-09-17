const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const uiHealth = document.getElementById('health');
const enemyCounter = document.getElementById('enemy-counter');
const healthBarFill = uiHealth?.querySelector('.health-bar-fill') ?? null;
const healthBarText = uiHealth?.querySelector('.health-bar-text') ?? null;

const messageEl = document.createElement('div');
messageEl.style.position = 'fixed';
messageEl.style.bottom = '24px';
messageEl.style.left = '50%';
messageEl.style.transform = 'translateX(-50%)';
messageEl.style.color = '#f5d76e';
messageEl.style.fontSize = '24px';
messageEl.style.fontWeight = '600';
messageEl.style.letterSpacing = '2px';
messageEl.style.textShadow = '0 4px 8px rgba(0, 0, 0, 0.8)';
messageEl.style.pointerEvents = 'none';
messageEl.style.opacity = '0';
messageEl.style.transition = 'opacity 0.4s ease';
document.body.appendChild(messageEl);

const joinOverlay = document.getElementById('join-overlay');
const joinForm = document.getElementById('join-form');
const joinNameInput = document.getElementById('join-name');
const playerNameLabel = document.getElementById('player-name');

const assetSources = {
  background: 'assets/cave-background.png',
  aliBaba: 'assets/alibaba_sprite.png',
};
const images = {};

const backgroundMusic = new Audio('assets/backgroundsound.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.55;
backgroundMusic.preload = 'auto';
let backgroundMusicStarted = false;

const baseFireballSound = new Audio('assets/fireballsound.mp3');
baseFireballSound.volume = 0.7;
baseFireballSound.preload = 'auto';

const baseEnemyDeathSound = new Audio('assets/enemydeath.mp3');
baseEnemyDeathSound.volume = 0.75;
baseEnemyDeathSound.preload = 'auto';

function startBackgroundMusic() {
  if (backgroundMusicStarted) {
    return;
  }
  const playPromise = backgroundMusic.play();
  if (!playPromise) {
    return;
  }
  playPromise
    .then(() => {
      backgroundMusicStarted = true;
      window.removeEventListener('pointerdown', startBackgroundMusic);
      window.removeEventListener('keydown', startBackgroundMusic);
    })
    .catch(() => {
      // Ignore; browser needs another user interaction before playback.
    });
}

window.addEventListener('pointerdown', startBackgroundMusic);
window.addEventListener('keydown', startBackgroundMusic);

function playOneShotSound(baseSound) {
  const sound = baseSound.cloneNode();
  sound.volume = baseSound.volume;
  const playPromise = sound.play();
  if (!playPromise) {
    return;
  }
  playPromise.catch(() => {
    // Ignore playback errors (e.g., no interaction yet or OS policy).
  });
}

function playFireballSound() {
  playOneShotSound(baseFireballSound);
}

function playEnemyDeathSound() {
  playOneShotSound(baseEnemyDeathSound);
}

const WORLD = {
  width: 7200,
  height: 720,
  groundY: 560,
};

const backgroundConfig = {
  zoom: 1.25,
  parallaxX: 0.45,
  parallaxY: 0.3,
};

const input = {
  left: false,
  right: false,
  jumpPressed: false,
  jumpQueued: false,
  fire: false,
};

const dashInput = {
  lastTapLeft: Number.NEGATIVE_INFINITY,
  lastTapRight: Number.NEGATIVE_INFINITY,
};

const pointer = {
  screenX: 0,
  screenY: 0,
  worldX: 0,
  worldY: 0,
};

const dashTrails = [];
const DASH_TRAIL_LIFETIME = 0.22;
const DASH_TRAIL_INTERVAL = 0.045;

const player = {
  x: 140,
  y: WORLD.groundY - 72,
  width: 56,
  height: 72,
  vx: 0,
  vy: 0,
  moveSpeed: 260,
  acceleration: 2000,
  maxSpeed: 280,
  maxJumps: 3,
  jumpsRemaining: 3,
  jumpStrength: 600,
  gravity: 1800,
  onGround: false,
  coyoteTimer: 0,
  facing: 1,
  health: 20,
  maxHealth: 20,
  invuln: 0,
  fireCooldown: 0,
  color: '#ffcc66',
  displayName: 'Ali Baba',
  kills: 0,
  deaths: 0,
  alive: true,
  anim: 'idle',
  dashSpeed: 680,
  dashDuration: 0.26,
  dashCooldown: 0.6,
  dashTimer: 0,
  dashCooldownTimer: 0,
  dashDirection: 0,
  dashTrailTimer: 0,
  dashTrailInterval: DASH_TRAIL_INTERVAL,
  hitFlash: 0,
};

const DASH_DOUBLE_TAP_MS = 260;

const COYOTE_TIME = 0.12;

const remotePlayers = new Map();
let socket = null;
let localPlayerId = null;
let hasJoinedGame = false;
let joinInFlight = false;
let pendingJoinPayload = null;
let pendingJoinCallback = null;
let pendingJoinTimeout = null;
const NETWORK_SEND_INTERVAL = 1 / 15;
let networkAccumulator = 0;
const REMOTE_SMOOTHING_RATE = 12;

const FIREBALL_LIFETIME = 0.42;
const HIT_FLASH_DURATION = 0.28;

const localHosts = new Set(['localhost', '127.0.0.1']);
const SOCKET_URL = localHosts.has(window.location.hostname)
  ? 'http://localhost:3000'
  : 'https://alibabagame-mp.fly.dev';

if (joinForm) {
  joinForm.addEventListener('submit', handleJoinSubmit);
}

if (playerNameLabel) {
  playerNameLabel.textContent = player.displayName;
}

const platforms = [
  { x: -400, y: WORLD.groundY, width: WORLD.width + 800, height: 64 },
  { x: 180, y: WORLD.groundY - 120, width: 260, height: 24 },
  { x: 520, y: WORLD.groundY - 200, width: 240, height: 24 },
  { x: 860, y: WORLD.groundY - 160, width: 220, height: 24 },
  { x: 1180, y: WORLD.groundY - 260, width: 220, height: 24 },
  { x: 1500, y: WORLD.groundY - 320, width: 220, height: 24 },
  { x: 1780, y: WORLD.groundY - 260, width: 220, height: 24 },
  { x: 2060, y: WORLD.groundY - 200, width: 240, height: 24 },
  { x: 2360, y: WORLD.groundY - 200, width: 240, height: 24 },
  { x: 2680, y: WORLD.groundY - 280, width: 240, height: 24 },
  { x: 3020, y: WORLD.groundY - 340, width: 240, height: 24 },
  { x: 3340, y: WORLD.groundY - 260, width: 260, height: 24 },
  { x: 3340, y: WORLD.groundY - 120, width: 260, height: 24 },
  { x: 3680, y: WORLD.groundY - 220, width: 260, height: 24 },
  { x: 4040, y: WORLD.groundY - 280, width: 220, height: 24 },
  { x: 4380, y: WORLD.groundY - 200, width: 260, height: 24 },
  { x: 4760, y: WORLD.groundY - 260, width: 240, height: 24 },
  { x: 5120, y: WORLD.groundY - 340, width: 260, height: 24 },
  { x: 5480, y: WORLD.groundY - 300, width: 240, height: 24 },
  { x: 5840, y: WORLD.groundY - 220, width: 280, height: 24 },
  { x: 6180, y: WORLD.groundY - 260, width: 240, height: 24 },
  { x: 6520, y: WORLD.groundY - 320, width: 240, height: 24 },
  { x: 6860, y: WORLD.groundY - 200, width: 260, height: 24 },
  { x: 6860, y: WORLD.groundY - 80, width: 260, height: 24 },
];


let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
let scale = window.devicePixelRatio || 1;

const camera = { x: 0, y: 0 };
const fireballs = [];

Promise.all(
  Object.entries(assetSources).map(([key, src]) =>
    loadImage(src).then((img) => {
      images[key] = img;
    }),
  ),
)
  .then(() => {
    setupInput();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    updateHealthUI();
    updateEnemyCounter();
    startBackgroundMusic();
    if (joinNameInput) {
      setTimeout(() => {
        joinNameInput.focus();
      }, 160);
    }
    showMessage('Face off against other players! Aim and unleash your fireballs.');
    setTimeout(() => {
      hideMessage();
    }, 3200);
    requestAnimationFrame(loop);
  })
  .catch((err) => {
    console.error('Failed to load assets', err);
  });

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

function setupInput() {
  window.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        if (!event.repeat) {
          handleDashTap(-1);
        }
        input.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (!event.repeat) {
          handleDashTap(1);
        }
        input.right = true;
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        if (!input.jumpPressed) {
          input.jumpQueued = true;
        }
        input.jumpPressed = true;
        break;
      case 'KeyM':
        input.fire = true;
        break;
      default:
        break;
    }
  });

  window.addEventListener('keyup', (event) => {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        input.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        input.right = false;
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        input.jumpPressed = false;
        break;
      case 'KeyM':
        input.fire = false;
        break;
      default:
        break;
    }
  });

  window.addEventListener('mousemove', (event) => {
    updatePointerFromEvent(event);
  });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    updatePointerFromEvent(event);
    input.fire = true;
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      input.fire = false;
    }
  });

  window.addEventListener('blur', () => {
    input.fire = false;
  });
}

function handleDashTap(direction) {
  const now = performance.now();
  if (direction === -1) {
    if (now - dashInput.lastTapLeft < DASH_DOUBLE_TAP_MS) {
      dashInput.lastTapLeft = Number.NEGATIVE_INFINITY;
      attemptDash(-1);
    } else {
      dashInput.lastTapLeft = now;
    }
    dashInput.lastTapRight = Number.NEGATIVE_INFINITY;
  } else if (direction === 1) {
    if (now - dashInput.lastTapRight < DASH_DOUBLE_TAP_MS) {
      dashInput.lastTapRight = Number.NEGATIVE_INFINITY;
      attemptDash(1);
    } else {
      dashInput.lastTapRight = now;
    }
    dashInput.lastTapLeft = Number.NEGATIVE_INFINITY;
  }
}

function attemptDash(direction) {
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

function handleLocalDashTrail(delta, dashActive) {
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

function updatePointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;
  pointer.screenX = clamp(event.clientX - rect.left, 0, width);
  pointer.screenY = clamp(event.clientY - rect.top, 0, height);
  recalcPointerWorld();
}

function recalcPointerWorld(referenceCamera = camera) {
  const camX = referenceCamera.x ?? camera.x;
  const camY = referenceCamera.y ?? camera.y;
  pointer.worldX = clamp(camX + pointer.screenX, 0, WORLD.width);
  pointer.worldY = clamp(camY + pointer.screenY, 0, WORLD.height);
}

function predictCameraPosition() {
  const halfWidth = viewportWidth / 2;
  const halfHeight = viewportHeight / 2;
  const desiredX = player.x + player.width / 2 - halfWidth;
  const desiredY = player.y + player.height / 2 - halfHeight;
  const maxCameraX = Math.max(0, WORLD.width - viewportWidth);
  const maxCameraY = Math.max(0, WORLD.height - viewportHeight);
  return {
    x: clamp(desiredX, 0, maxCameraX),
    y: clamp(desiredY, 0, maxCameraY),
  };
}

function resizeCanvas() {
  const prevWidth = viewportWidth;
  const prevHeight = viewportHeight;
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewportWidth * scale);
  canvas.height = Math.floor(viewportHeight * scale);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;

  if (prevWidth && prevHeight) {
    const ratioX = prevWidth === 0 ? 0.5 : pointer.screenX / prevWidth;
    const ratioY = prevHeight === 0 ? 0.5 : pointer.screenY / prevHeight;
    pointer.screenX = clamp(ratioX * viewportWidth, 0, viewportWidth);
    pointer.screenY = clamp(ratioY * viewportHeight, 0, viewportHeight);
  }

  recalcPointerWorld();
}

let lastTime = performance.now();

function loop(now) {
  const delta = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;
  update(delta);
  updateNetwork(delta);
  render();
  requestAnimationFrame(loop);
}

function update(delta) {
  if (player.invuln > 0) {
    player.invuln = Math.max(0, player.invuln - delta);
  }

  if (player.hitFlash > 0) {
    player.hitFlash = Math.max(0, player.hitFlash - delta);
  }

  if (!player.alive) {
    updateDeathPhysics(delta);
    updateFireballs(delta);
    updateRemotePlayers(delta);
    updateCamera();
    recalcPointerWorld();
    return;
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

  handlePlayerFireball(delta);
  updateFireballs(delta);
  updateRemotePlayers(delta);
  updateDashTrails(delta);

  updateCamera();
  recalcPointerWorld();
}

function updateDeathPhysics(delta) {
  player.vx = 0;
  player.vy += player.gravity * delta;
  player.vy = Math.min(player.vy, 900);
  moveEntity(player, delta);
  clampToWorld(player);
}

function updateNetwork(delta) {
  if (!socket || !hasJoinedGame || !socket.connected) {
    return;
  }

  networkAccumulator += delta;
  if (networkAccumulator < NETWORK_SEND_INTERVAL) {
    return;
  }
  networkAccumulator = 0;

  sendPlayerSnapshot(false);
}

function determinePlayerAnim() {
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

function moveEntity(entity, delta) {
  entity.x += entity.vx * delta;
  resolveAxisCollision(entity, 'x');

  entity.vy += 0; // placeholder to keep structure consistent
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

function handlePlayerFireball(delta) {
  if (player.fireCooldown > 0) {
    player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  }

  if (!player.alive || !hasJoinedGame || !localPlayerId) {
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
  const speed = 640;
  const size = 26;
  const originDistance = player.width * 0.6;
  const spawnX = centerX + Math.cos(angle) * originDistance - size / 2;
  const spawnY = centerY + Math.sin(angle) * originDistance - size / 2;

  const fireball = {
    id: `${localPlayerId}-${performance.now().toFixed(3)}`,
    ownerId: localPlayerId,
    x: spawnX,
    y: spawnY,
    width: size,
    height: size,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage: 1,
    lifetime: FIREBALL_LIFETIME,
  };

  addFireball(fireball);
  socket.emit('player:shoot', {
    x: fireball.x,
    y: fireball.y,
    vx: fireball.vx,
    vy: fireball.vy,
    width: fireball.width,
    height: fireball.height,
    damage: fireball.damage,
    lifetime: fireball.lifetime,
  });

  player.fireCooldown = 0.45;
  playFireballSound();
}

function addFireball(data) {
  fireballs.push({
    id: data.id ?? `${data.ownerId ?? 'fb'}-${Math.random().toString(16).slice(2)}`,
    ownerId: data.ownerId ?? null,
    x: data.x,
    y: data.y,
    width: data.width ?? 24,
    height: data.height ?? 24,
    vx: data.vx,
    vy: data.vy,
    damage: data.damage ?? 1,
    lifetime: data.lifetime ?? FIREBALL_LIFETIME,
  });
}

function updateFireballs(delta) {
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

    if (fireball.ownerId === localPlayerId) {
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
        socket.emit('player:damage', {
          targetId: hitId,
          amount: fireball.damage ?? 1,
        });
        fireballs.splice(i, 1);
      }
      continue;
    }

    if (fireball.ownerId && fireball.ownerId !== localPlayerId) {
      if (playerRect && player.alive && player.invuln <= 0 && rectIntersect(fireball, playerRect)) {
        reportLocalHit(fireball.ownerId, fireball.damage ?? 1);
        fireballs.splice(i, 1);
      }
      continue;
    }
  }
}

function spawnDashTrail(source, options = {}) {
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

function updateDashTrails(delta) {
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

function handleRemoteDashTrail(remote, delta) {
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

function updateRemotePlayers(delta) {
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

function clampToWorld(entity) {
  entity.x = Math.max(0, Math.min(entity.x, WORLD.width - entity.width));
  entity.y = Math.max(0, Math.min(entity.y, WORLD.height - entity.height));
}

function updateCamera() {
  camera.x = player.x + player.width / 2 - viewportWidth / 2;
  camera.y = player.y + player.height / 2 - viewportHeight / 2;
  camera.x = Math.max(0, Math.min(camera.x, WORLD.width - viewportWidth));
  camera.y = Math.max(0, Math.min(camera.y, WORLD.height - viewportHeight));
}

function render() {
  const bg = images.background;
  const hero = images.aliBaba;

  if (!bg || !hero) {
    return;
  }

  const dpr = scale;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  renderBackground(bg);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  renderPlatforms();
  renderDashTrails();

  for (const remote of remotePlayers.values()) {
    renderHero(hero, remote, {
      color: remote.color,
      name: remote.name,
      opacity: remote.alive ? 0.95 : 0.3,
      invuln: 0,
      alive: remote.alive,
      hitFlash: remote.hitFlash,
      anim: remote.anim,
    });
  }

  renderHero(hero, player, {
    color: player.color,
    name: player.displayName,
    opacity: player.alive ? (player.invuln > 0 ? 0.6 : 1) : 0.4,
    invuln: player.invuln,
    isLocal: true,
    alive: player.alive,
    hitFlash: player.hitFlash,
    anim: player.anim,
  });

  renderFireballs();

  ctx.restore();
}

function renderDashTrails() {
  if (dashTrails.length === 0) {
    return;
  }

  const sprite = images.aliBaba;
  if (!sprite) {
    return;
  }

  for (const trail of dashTrails) {
    const progress = Math.max(0, Math.min(1, trail.life / trail.maxLife));
    const alpha = Math.max(0, Math.min(1, (trail.opacity ?? 0.6) * progress));
    if (alpha <= 0.01) {
      continue;
    }

    const scale = 1 + (1 - progress) * 0.12;
    const facingScaleX = (trail.facing < 0 ? -1 : 1) * scale;
    const centerX = trail.x + trail.width / 2;
    const centerY = trail.y + trail.height / 2;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.filter = 'brightness(1.35) saturate(1.08)';
    ctx.translate(centerX, centerY);
    ctx.scale(facingScaleX, scale);
    ctx.drawImage(sprite, -trail.width / 2, -trail.height / 2, trail.width, trail.height);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle = trail.color || '#f5d76e';
    ctx.beginPath();
    ctx.ellipse(centerX, trail.y + trail.height - 10, trail.width * 0.5, trail.height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.filter = 'none';
}

function renderBackground(bg) {
  const baseScale = Math.max(
    viewportWidth / bg.width,
    viewportHeight / bg.height,
  );
  const zoomedScale = baseScale * backgroundConfig.zoom;
  const scaledWidth = bg.width * zoomedScale;
  const scaledHeight = bg.height * zoomedScale;

  const extraWidth = Math.max(0, scaledWidth - viewportWidth);
  const extraHeight = Math.max(0, scaledHeight - viewportHeight);

  const cameraRangeX = Math.max(1, WORLD.width - viewportWidth);
  const cameraRangeY = Math.max(1, WORLD.height - viewportHeight);

  const tX = Math.min(1, Math.max(0, camera.x / cameraRangeX));
  const tY = Math.min(1, Math.max(0, camera.y / cameraRangeY));

  const parallaxSpanX = extraWidth * backgroundConfig.parallaxX;
  const parallaxSpanY = extraHeight * backgroundConfig.parallaxY;

  const offsetBaseX = (extraWidth - parallaxSpanX) / 2;
  const offsetBaseY = (extraHeight - parallaxSpanY) / 2;

  const offsetX = extraWidth === 0 ? 0 : offsetBaseX + tX * parallaxSpanX;
  const offsetY = extraHeight === 0 ? 0 : offsetBaseY + tY * parallaxSpanY;

  ctx.drawImage(bg, -offsetX, -offsetY, scaledWidth, scaledHeight);
}

function renderPlatforms() {
  ctx.fillStyle = 'rgba(63, 44, 32, 0.92)';
  for (const platform of platforms) {
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = 'rgba(91, 64, 47, 1)';
    ctx.fillRect(platform.x, platform.y, platform.width, 6);
    ctx.fillStyle = 'rgba(63, 44, 32, 0.92)';
  }
}

function renderHero(sprite, entity, options = {}) {
  const centerX = entity.x + entity.width / 2;
  const centerY = entity.y + entity.height / 2;
  const isAlive = options.alive !== false;

  ctx.save();
  ctx.translate(centerX, centerY);
  const animState = options.anim || entity.anim || null;
  const isDashing = animState === 'dash';

  if (options.color) {
    ctx.save();
    ctx.globalAlpha = isAlive ? (options.isLocal ? 0.34 : 0.26) : 0.16;
    ctx.fillStyle = options.color;
    ctx.beginPath();
    ctx.ellipse(0, entity.height / 2 - 6, entity.width * 0.62, entity.height * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (isDashing) {
    ctx.filter = 'brightness(1.2) saturate(1.05)';
  }

  ctx.scale(entity.facing < 0 ? -1 : 1, 1);
  if (!isAlive) {
    ctx.globalAlpha = 0.35;
  } else if (options.invuln && options.invuln > 0 && Math.floor(options.invuln * 20) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  } else if (typeof options.opacity === 'number') {
    ctx.globalAlpha = options.opacity;
  }

  ctx.drawImage(
    sprite,
    -entity.width / 2,
    -entity.height / 2,
    entity.width,
    entity.height,
  );
  if (isDashing) {
    ctx.filter = 'none';
  }

  if (isAlive && options.hitFlash && options.hitFlash > 0) {
    const flashStrength = clamp(options.hitFlash / HIT_FLASH_DURATION, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.min(1, 0.45 + flashStrength * 0.55);
    ctx.fillStyle = 'rgba(255, 60, 32, 1)';
    ctx.fillRect(-entity.width / 2, -entity.height / 2, entity.width, entity.height);
    ctx.restore();
  }
  ctx.restore();

  if (options.name) {
    renderPlayerNameplate(options.name, entity, options.color, isAlive);
  }
}

function renderPlayerNameplate(name, entity, color, isAlive = true) {
  if (!name) {
    return;
  }

  const textX = entity.x + entity.width / 2;
  const textY = entity.y + entity.height + 24;
  const paddingX = 8;
  const paddingY = 4;

  ctx.save();
  ctx.font = "16px 'Trebuchet MS', Arial, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText(name);
  const rectWidth = metrics.width + paddingX * 2;
  const rectHeight = 22;

  ctx.fillStyle = 'rgba(6, 3, 2, 0.72)';
  ctx.fillRect(textX - rectWidth / 2, textY - rectHeight + paddingY, rectWidth, rectHeight);
  ctx.fillStyle = isAlive ? color || '#f5d76e' : 'rgba(200, 200, 200, 0.8)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 3;
  ctx.fillText(name, textX, textY);
  ctx.restore();
}

function renderFireballs() {
  if (fireballs.length === 0) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const fireball of fireballs) {
    const centerX = fireball.x + fireball.width / 2;
    const centerY = fireball.y + fireball.height / 2;
    const radius = fireball.width / 2;
    const gradient = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, radius);
    if (fireball.friendly) {
      gradient.addColorStop(0, 'rgba(255, 246, 210, 0.95)');
      gradient.addColorStop(0.4, 'rgba(255, 190, 86, 0.9)');
      gradient.addColorStop(1, 'rgba(255, 130, 40, 0.05)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 250, 190, 0.95)');
      gradient.addColorStop(0.4, 'rgba(255, 160, 64, 0.9)');
      gradient.addColorStop(1, 'rgba(210, 52, 18, 0.05)');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function getRect(entity) {
  return {
    x: entity.x,
    y: entity.y,
    width: entity.width,
    height: entity.height,
  };
}

function rectOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function rectIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function updateHealthUI() {
  if (!uiHealth) {
    return;
  }
  const ratio = clamp(player.health / player.maxHealth, 0, 1);
  if (healthBarFill) {
    healthBarFill.style.width = `${(ratio * 100).toFixed(1)}%`;
  }
  if (healthBarText) {
    healthBarText.textContent = `${Math.max(0, Math.round(player.health))} / ${player.maxHealth}`;
  }
}

function updateEnemyCounter() {
  const online = (hasJoinedGame ? 1 : 0) + remotePlayers.size;
  const hpText = `${Math.max(0, Math.round(player.health))}/${player.maxHealth}`;
  enemyCounter.textContent = `Players online: ${online} • HP: ${hpText} • K:${player.kills} D:${player.deaths}`;
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.style.opacity = '1';
}

function hideMessage() {
  messageEl.style.opacity = '0';
}

function handleJoinSubmit(event) {
  event.preventDefault();
  if (joinInFlight || hasJoinedGame) {
    return;
  }

  const name = joinNameInput?.value.trim() ?? '';
  if (!name) {
    if (joinNameInput) {
      joinNameInput.focus();
    }
    return;
  }

  const socketInstance = ensureSocket();
  if (!socketInstance) {
    showMessage('Multiplayer service unavailable.');
    setTimeout(() => hideMessage(), 2800);
    return;
  }

  cancelPendingJoin();
  joinInFlight = true;
  const submitButton = joinForm?.querySelector('button');
  if (joinNameInput) {
    joinNameInput.disabled = true;
  }
  if (submitButton) {
    submitButton.disabled = true;
  }

  const completeJoin = (response) => {
    clearPendingJoinTimeout();
    joinInFlight = false;
    if (joinNameInput) {
      joinNameInput.disabled = false;
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
      if (nameTaken && joinNameInput) {
        joinNameInput.value = name;
      }
      returnToLobby({ message: errorMessage });
      if (nameTaken && joinNameInput) {
        setTimeout(() => {
          joinNameInput.focus();
          joinNameInput.select();
        }, 0);
      }
      return;
    }

    localPlayerId = response.id;
    player.displayName = response.name || name;
    player.color = response.color || player.color;
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
    player.dashTimer = 0;
    player.dashCooldownTimer = 0;
    player.dashDirection = 0;
    hasJoinedGame = true;

    if (playerNameLabel) {
      playerNameLabel.textContent = player.displayName;
    }
    if (joinOverlay) {
      joinOverlay.classList.add('overlay-hidden');
      joinOverlay.setAttribute('aria-hidden', 'true');
    }
    if (joinNameInput) {
      joinNameInput.blur();
    }

    hideMessage();

    remotePlayers.clear();
    if (Array.isArray(response.players)) {
      for (const remote of response.players) {
        registerRemotePlayer(remote);
      }
    }

    updateEnemyCounter();
    updateHealthUI();
    sendPlayerSnapshot(true);
  };

  pendingJoinPayload = { name, x: player.x, y: player.y };
  pendingJoinCallback = completeJoin;
  pendingJoinTimeout = setTimeout(() => {
    if (!joinInFlight || pendingJoinCallback !== completeJoin) {
      return;
    }
    joinInFlight = false;
    cancelPendingJoin();
    if (joinNameInput) {
      joinNameInput.disabled = false;
      joinNameInput.focus();
    }
    if (submitButton) {
      submitButton.disabled = false;
    }
    showMessage('Unable to join right now. Try again soon.');
    setTimeout(() => hideMessage(), 3200);
  }, 12000);

  if (socketInstance.connected) {
    emitPendingJoin();
  } else {
    socketInstance.connect();
  }
}

function clearPendingJoinTimeout() {
  if (pendingJoinTimeout) {
    clearTimeout(pendingJoinTimeout);
    pendingJoinTimeout = null;
  }
}

function cancelPendingJoin() {
  clearPendingJoinTimeout();
  pendingJoinPayload = null;
  pendingJoinCallback = null;
}

function emitPendingJoin() {
  if (!socket || !socket.connected) {
    return;
  }
  if (!pendingJoinPayload || !pendingJoinCallback) {
    return;
  }

  const payload = pendingJoinPayload;
  const callback = pendingJoinCallback;
  socket.emit('player:join', payload, (response) => {
    if (pendingJoinCallback !== callback) {
      return;
    }
    cancelPendingJoin();
    callback(response);
  });
}

function ensureSocket() {
  if (socket) {
    return socket;
  }

  if (typeof window === 'undefined' || typeof window.io !== 'function') {
    console.error('Socket.IO client library is missing.');
    return null;
  }

  socket = window.io(SOCKET_URL, { autoConnect: false });
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

function handleSocketConnected() {
  if (pendingJoinPayload && pendingJoinCallback) {
    emitPendingJoin();
    return;
  }
  if (hasJoinedGame) {
    sendPlayerSnapshot(true);
  }
}

function onPlayerJoined(data) {
  registerRemotePlayer(data);
}

function onPlayerUpdated(data) {
  if (!data || !data.id || data.id === localPlayerId) {
    return;
  }

  const remote = remotePlayers.get(data.id);
  if (!remote) {
    registerRemotePlayer(data);
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
  const previousAnim = remote.anim;
  if (typeof data.anim === 'string') {
    remote.anim = data.anim;
  }
  if (previousAnim !== remote.anim) {
    if (remote.anim === 'dash') {
      remote.dashTrailActive = false;
      remote.dashTrailTimer = 0;
    } else {
      remote.dashTrailActive = false;
      remote.dashTrailTimer = remote.dashTrailInterval ?? DASH_TRAIL_INTERVAL * 1.1;
    }
  }
  remote.lastUpdate = performance.now();
}

function onPlayerLeft(data) {
  if (!data || !data.id) {
    return;
  }
  remotePlayers.delete(data.id);
  updateEnemyCounter();
}

function registerRemotePlayer(data = {}) {
  if (!data.id || data.id === localPlayerId) {
    return;
  }

  const previous = remotePlayers.get(data.id);
  const width = previous?.width ?? player.width;
  const height = previous?.height ?? player.height;
  const facing = data.facing === -1 || data.facing === 1 ? data.facing : previous?.facing ?? 1;
  const anim = typeof data.anim === 'string' ? data.anim : previous?.anim ?? 'idle';
  const incomingX = Number.isFinite(data.x) ? data.x : previous?.targetX ?? previous?.x ?? 140;
  const incomingY = Number.isFinite(data.y) ? data.y : previous?.targetY ?? previous?.y ?? WORLD.groundY - player.height;
  const timestamp = performance.now();

  const remote = {
    id: data.id,
    name: typeof data.name === 'string' && data.name.trim()
      ? data.name.trim()
      : previous?.name || 'Ally',
    color: data.color || previous?.color || '#66ffcc',
    x: previous?.x ?? incomingX,
    y: previous?.y ?? incomingY,
    targetX: incomingX,
    targetY: incomingY,
    width,
    height,
    facing,
    anim,
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

  if (data.id === localPlayerId) {
    applyLocalStateUpdate(data);
    return;
  }

  const remote = remotePlayers.get(data.id);
  if (!remote) {
    registerRemotePlayer(data);
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
    if (remote.anim === 'dash') {
      remote.dashTrailActive = false;
      remote.dashTrailTimer = 0;
    } else {
      remote.dashTrailActive = false;
      remote.dashTrailTimer = remote.dashTrailInterval ?? DASH_TRAIL_INTERVAL * 1.1;
    }
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
  if (!hasJoinedGame || !localPlayerId || data.health == null) {
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
  player.dashTimer = 0;
  player.dashDirection = 0;
  player.dashCooldownTimer = 0;
  player.dashTrailTimer = 0;
  player.anim = 'idle';
  fireballs.length = 0;
  player.hitFlash = 0;
  updateHealthUI();
  updateEnemyCounter();
}

function onPlayerRespawned(data = {}) {
  if (!data.id || data.id === localPlayerId) {
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
}

function onPlayerKicked(data = {}) {
  const reason = data?.reason || 'You were removed from the room.';
  returnToLobby({ message: reason });
}

function handleSocketDisconnect() {
  if (!hasJoinedGame) {
    return;
  }

  returnToLobby({ message: 'Connection lost. Rejoin to keep playing together.' });
}

function handleConnectError(error) {
  console.error('Socket.IO connection error:', error);
  if (joinInFlight && pendingJoinCallback) {
    showMessage('Unable to reach the caravan. Retrying...');
    return;
  }

  if (joinInFlight) {
    joinInFlight = false;
    cancelPendingJoin();
    if (joinNameInput) {
      joinNameInput.disabled = false;
      joinNameInput.focus();
    }
    const submitButton = joinForm?.querySelector('button');
    if (submitButton) {
      submitButton.disabled = false;
    }
  }

  showMessage('Unable to reach the caravan. Please try again.');
  setTimeout(() => hideMessage(), 3200);
}

function returnToLobby({ message, autoHide = true } = {}) {
  cancelPendingJoin();
  joinInFlight = false;
  hasJoinedGame = false;
  localPlayerId = null;
  remotePlayers.clear();
  input.fire = false;
  player.alive = true;
  player.health = player.maxHealth;
  player.kills = 0;
  player.deaths = 0;
  player.invuln = 0;
  player.fireCooldown = 0;
  player.dashTimer = 0;
  player.dashCooldownTimer = 0;
  player.dashDirection = 0;
  player.dashTrailTimer = 0;
  player.hitFlash = 0;
  player.anim = 'idle';
  dashTrails.length = 0;
  updateEnemyCounter();
  updateHealthUI();

  if (joinOverlay) {
    joinOverlay.classList.remove('overlay-hidden');
    joinOverlay.removeAttribute('aria-hidden');
  }
  if (joinNameInput) {
    joinNameInput.disabled = false;
    if (!joinNameInput.value) {
      joinNameInput.value = player.displayName;
    }
    joinNameInput.focus();
  }
  const submitButton = joinForm?.querySelector('button');
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
    player.dashTimer = 0;
    player.dashDirection = 0;
    player.dashCooldownTimer = 0;
    player.dashTrailTimer = 0;
  }

  updateHealthUI();
  updateEnemyCounter();
}

function getPlayerName(id) {
  if (!id) {
    return null;
  }
  if (id === localPlayerId) {
    return player.displayName;
  }
  return remotePlayers.get(id)?.name ?? null;
}

function reportLocalHit(attackerId, amount) {
  if (!socket || !hasJoinedGame || !localPlayerId) {
    return;
  }
  socket.emit('player:damage', {
    targetId: localPlayerId,
    attackerId,
    amount,
  });
  player.invuln = Math.max(player.invuln, 0.25);
  player.hitFlash = HIT_FLASH_DURATION;
}

function sendPlayerSnapshot(force = false) {
  if (!socket || !socket.connected || !hasJoinedGame) {
    return;
  }

  if (force) {
    networkAccumulator = 0;
  }

  const anim = player.anim ?? determinePlayerAnim();
  player.anim = anim;
  socket.emit('player:update', {
    x: player.x,
    y: player.y,
    facing: player.facing >= 0 ? 1 : -1,
    anim,
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
