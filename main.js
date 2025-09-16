const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const uiHealth = document.getElementById('health');
const enemyCounter = document.getElementById('enemy-counter');

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

const assetSources = {
  background: 'assets/cave-background.png',
  aliBaba: 'assets/alibaba_sprite.png',
  thief: 'assets/thief_sprite.png',
  boss: 'assets/thug_sprite.png',
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

const pointer = {
  screenX: 0,
  screenY: 0,
  worldX: 0,
  worldY: 0,
};

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
  maxJumps: 2,
  jumpsRemaining: 2,
  jumpStrength: 600,
  gravity: 1800,
  onGround: false,
  coyoteTimer: 0,
  facing: 1,
  health: 3,
  invuln: 0,
  hasFireballPower: false,
  fireCooldown: 0,
};

const COYOTE_TIME = 0.12;

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

const goal = {
  x: WORLD.width - 160,
  y: platforms[platforms.length - 1].y - 120,
  width: 80,
  height: 120,
};

const thieves = [
  createThief(340, WORLD.groundY - 72, 180, 440),
  createThief(620, WORLD.groundY - 272, 520, 760),
  createThief(980, WORLD.groundY - 232, 860, 1080),
  createThief(1540, WORLD.groundY - 392, 1500, 1720),
  createThief(1820, WORLD.groundY - 332, 1780, 2000),
  createThief(2120, WORLD.groundY - 272, 2060, 2300),
  createThief(2420, WORLD.groundY - 272, 2360, 2580),
  createThief(2760, WORLD.groundY - 352, 2680, 2880),
  createThief(3120, WORLD.groundY - 412, 3020, 3240),
  createThief(3520, WORLD.groundY - 292, 3440, 3660),
  createThief(3880, WORLD.groundY - 332, 3820, 4020),
  createThief(4240, WORLD.groundY - 252, 4180, 4360),
  createThief(4620, WORLD.groundY - 312, 4540, 4720),
  createThief(4980, WORLD.groundY - 372, 4900, 5080),
  createThief(5360, WORLD.groundY - 332, 5280, 5440),
  createThief(5720, WORLD.groundY - 252, 5640, 5800),
  createThief(6080, WORLD.groundY - 292, 6000, 6160),
  createThief(6440, WORLD.groundY - 352, 6360, 6520),
  createThief(6800, WORLD.groundY - 232, 6720, 6880),
];
const bosses = [
  createBoss(3320, WORLD.groundY - 110, 2100, 3800),
  createBoss(WORLD.width - 520, WORLD.groundY - 110, 5400, WORLD.width - 180),
];

const powerup = {
  x: 1680,
  y: WORLD.groundY - 332,
  width: 42,
  height: 42,
  collected: false,
  pulse: 0,
};

const rubies = [
  createRuby(1220, WORLD.groundY - 360),
  createRuby(3920, WORLD.groundY - 360),
  createRuby(6360, WORLD.groundY - 360),
];

let defeatedThieves = 0;
let levelCompleted = false;
let collectedRubies = 0;

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
    showMessage('Objective: Defeat every thug and gather all 3 rubies.');
    setTimeout(() => {
      hideMessage();
    }, 3200);
    requestAnimationFrame(loop);
  })
  .catch((err) => {
    console.error('Failed to load assets', err);
  });

function createThief(x, y, minX, maxX) {
  return {
    x,
    y,
    width: 54,
    height: 70,
    vx: 0,
    vy: 0,
    speed: 120,
    direction: 1,
    minX,
    maxX,
    onGround: false,
    alive: true,
    spawnX: x,
    spawnY: y,
    health: 2,
    maxHealth: 2,
    invuln: 0,
    damage: 2,
    fireTimer: randomRange(1.4, 3.2),
  };
}

function createBoss(x, y, minX, maxX) {
  return {
    x,
    y,
    width: 84,
    height: 96,
    vx: 0,
    vy: 0,
    speed: 160,
    direction: -1,
    minX,
    maxX,
    onGround: false,
    alive: true,
    health: 6,
    maxHealth: 6,
    invuln: 0,
    spawnDirection: -1,
    spawnX: x,
    spawnY: y,
    damage: 3,
    fireTimer: randomRange(1.6, 3.4),
  };
}

function createRuby(x, y) {
  return {
    x,
    y,
    width: 32,
    height: 42,
    collected: false,
    pulse: 0,
  };
}

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
        input.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
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
  render();
  requestAnimationFrame(loop);
}

function update(delta) {
  if (levelCompleted) {
    return;
  }

  powerup.pulse += delta * 2.4;

  if (player.invuln > 0) {
    player.invuln = Math.max(0, player.invuln - delta);
  }

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

  if (input.jumpQueued) {
    attemptJump();
    input.jumpQueued = false;
  }

  player.vy += player.gravity * delta;
  player.vy = Math.min(player.vy, 900);

  const previousPlayer = { x: player.x, y: player.y };

  moveEntity(player, delta);

  if (player.onGround) {
    player.jumpsRemaining = player.maxJumps;
    player.coyoteTimer = COYOTE_TIME;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - delta);
  }

  clampToWorld(player);

  handlePowerup();
  updateRubies(delta);
  handleThieves(delta, previousPlayer);
  handleBosses(delta, previousPlayer);
  handlePlayerFireball(delta);
  updateFireballs(delta);

  updateCamera();
  recalcPointerWorld();

  const allThievesDown = thieves.every((thief) => !thief.alive);
  const allBossesDown = bosses.every((boss) => !boss.alive);
  const allRubiesCollected = collectedRubies === rubies.length;

  if (!levelCompleted && allThievesDown && allBossesDown && allRubiesCollected) {
    levelCompleted = true;
    showMessage('Victory! All thugs defeated and rubies recovered!');
    setTimeout(() => {
      hideMessage();
    }, 3200);
  }
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

function handleThieves(delta, previousPlayer) {
  for (const thief of thieves) {
    if (!thief.alive) {
      continue;
    }

    if (thief.invuln > 0) {
      thief.invuln = Math.max(0, thief.invuln - delta);
    }

    thief.fireTimer -= delta;
    if (thief.fireTimer <= 0) {
      const distanceToPlayer = Math.abs(
        thief.x + thief.width / 2 - (player.x + player.width / 2),
      );
      if (distanceToPlayer < 680 && Math.random() < 0.75) {
        spawnFireball(thief, { speed: randomRange(320, 420) });
      }
      thief.fireTimer = randomRange(1.3, 2.6);
    }

    thief.vy += player.gravity * delta;
    thief.vy = Math.min(thief.vy, 900);
    thief.vx = thief.speed * thief.direction;
    moveEntity(thief, delta);
    clampToWorld(thief);

    if (thief.x < thief.minX) {
      thief.x = thief.minX;
      thief.direction = 1;
    } else if (thief.x + thief.width > thief.maxX) {
      thief.x = thief.maxX - thief.width;
      thief.direction = -1;
    }

    const playerRect = getRect(player);
    const thiefRect = getRect(thief);

    if (!rectIntersect(playerRect, thiefRect)) {
      continue;
    }

    const wasAbove = previousPlayer.y + player.height <= thief.y + 4;
    const playerFalling = player.vy >= 0 && previousPlayer.y <= player.y;

    if (wasAbove && playerFalling) {
      const killed = damageThief(thief, 1, { ignoreInvuln: true });
      player.vy = -player.jumpStrength * 0.65;
      player.y = thief.y - player.height;
      player.onGround = false;
      player.jumpsRemaining = Math.max(1, player.maxJumps - 1);
      if (!killed) {
        thief.vy = Math.max(thief.vy, 260);
      }
    } else {
      damagePlayer(thief, thief.damage);
    }
  }
}

function handlePowerup() {
  if (powerup.collected) {
    return;
  }

  if (rectIntersect(getRect(player), powerup)) {
    powerup.collected = true;
    player.hasFireballPower = true;
    showMessage('Fireball unlocked! Click to shoot.');
    setTimeout(() => {
      hideMessage();
    }, 2600);
  }
}

function updateRubies(delta) {
  for (const ruby of rubies) {
    if (ruby.collected) {
      continue;
    }
    ruby.pulse += delta * 3.2;

    const rubyRect = {
      x: ruby.x,
      y: ruby.y,
      width: ruby.width,
      height: ruby.height,
    };

    if (rectIntersect(getRect(player), rubyRect)) {
      ruby.collected = true;
      collectedRubies += 1;
      updateEnemyCounter();
    }
  }
}

function handleBosses(delta, previousPlayer) {
  for (const boss of bosses) {
    if (!boss.alive) {
      continue;
    }

    if (boss.invuln > 0) {
      boss.invuln = Math.max(0, boss.invuln - delta);
    }

    boss.fireTimer -= delta;

    boss.vy += player.gravity * delta;
    boss.vy = Math.min(boss.vy, 900);
    boss.vx = boss.speed * boss.direction;
    moveEntity(boss, delta);
    clampToWorld(boss);

    if (boss.x < boss.minX) {
      boss.x = boss.minX;
      boss.direction = 1;
    } else if (boss.x + boss.width > boss.maxX) {
      boss.x = boss.maxX - boss.width;
      boss.direction = -1;
    }

    if (boss.fireTimer <= 0) {
      const distanceToPlayer = Math.abs(
        boss.x + boss.width / 2 - (player.x + player.width / 2),
      );
      if (distanceToPlayer < 900) {
        spawnFireball(boss, {
          speed: randomRange(420, 520),
          trackPlayer: true,
          size: 26,
          damage: boss.damage,
        });
      }
      boss.fireTimer = randomRange(1, 2.1);
    }

    const bossRect = getRect(boss);
    const playerRect = getRect(player);

    if (!rectIntersect(playerRect, bossRect)) {
      continue;
    }

    const wasAbove = previousPlayer.y + player.height <= boss.y + 6;
    const playerFalling = player.vy >= 0 && previousPlayer.y <= player.y;

    if (wasAbove && playerFalling && boss.invuln <= 0) {
      boss.health -= 1;
      boss.invuln = 0.8;
      player.vy = -player.jumpStrength * 0.7;
      player.y = boss.y - player.height;
      player.onGround = false;
      player.jumpsRemaining = Math.max(1, player.maxJumps - 1);
      if (boss.health <= 0) {
        defeatBoss(boss);
      }
    } else {
      damagePlayer(boss, boss.damage);
    }
  }
}

function defeatBoss(boss) {
  if (!boss.alive) {
    return;
  }
  boss.alive = false;
  boss.health = 0;
  boss.invuln = 0;
  boss.vx = 0;
  boss.vy = 0;
  boss.fireTimer = Number.POSITIVE_INFINITY;
  updateEnemyCounter();
  playEnemyDeathSound();
  const objectivesRemain =
    bosses.some((other) => other.alive) ||
    thieves.some((thief) => thief.alive) ||
    collectedRubies < rubies.length;
  if (objectivesRemain) {
    showMessage('A warlord is defeated!');
    setTimeout(() => {
      hideMessage();
    }, 2400);
  }
}

function handlePlayerFireball(delta) {
  if (player.fireCooldown > 0) {
    player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  }

  if (!player.hasFireballPower || !input.fire || player.fireCooldown > 0) {
    return;
  }

  const predictedCamera = predictCameraPosition();
  recalcPointerWorld(predictedCamera);

  const playerCenterX = player.x + player.width / 2;
  const playerCenterY = player.y + player.height / 2;
  let targetX = pointer.worldX;
  let targetY = pointer.worldY;

  const dx = targetX - playerCenterX;
  const dy = targetY - playerCenterY;
  const distanceSq = dx * dx + dy * dy;

  if (distanceSq < 1) {
    targetX = playerCenterX + player.facing * 160;
    targetY = playerCenterY;
  }

  player.facing = targetX >= playerCenterX ? 1 : -1;

  spawnFireball(player, {
    speed: 620,
    size: 26,
    damage: 2,
    friendly: true,
    heightOffset: -10,
    target: { x: targetX, y: targetY },
  });
  player.fireCooldown = 0.45;
  playFireballSound();
}

function damageThief(thief, amount = 1, { ignoreInvuln = false } = {}) {
  if (!thief.alive) {
    return false;
  }
  if (!ignoreInvuln && thief.invuln > 0) {
    return false;
  }

  thief.health -= amount;
  if (thief.health <= 0) {
    defeatThief(thief);
    return true;
  }

  thief.invuln = 0.35;
  if (typeof thief.fireTimer === 'number') {
    thief.fireTimer = Math.min(thief.fireTimer, 0.8);
  }
  return false;
}
function defeatThief(thief) {
  thief.alive = false;
  thief.health = 0;
  thief.invuln = 0;
  thief.vx = 0;
  thief.vy = 0;
  defeatedThieves += 1;
  updateEnemyCounter();
  playEnemyDeathSound();
}

function spawnFireball(shooter, options = {}) {
  const size = options.size ?? 20;
  const shooterCenterX = shooter.x + shooter.width / 2;
  const shooterCenterY = shooter.y + shooter.height / 2;
  const heightOffset = options.heightOffset ?? 0;

  if (options.target) {
    const targetX = options.target.x;
    const targetY = options.target.y;
    const speed = options.speed ?? randomRange(320, 420);
    const dx = targetX - shooterCenterX;
    const dy = targetY - (shooterCenterY + heightOffset);
    const distance = Math.hypot(dx, dy) || 1;
    const dirX = dx / distance;
    const dirY = dy / distance;
    const spawnDistance = options.spawnDistance ?? shooter.width / 2 + size / 2 + 2;
    const originCenterX = shooterCenterX + dirX * spawnDistance;
    const originCenterY = shooterCenterY + heightOffset + dirY * spawnDistance;

    fireballs.push({
      x: originCenterX - size / 2,
      y: originCenterY - size / 2,
      width: size,
      height: size,
      vx: dirX * speed,
      vy: dirY * speed,
      damage: options.damage ?? shooter.damage ?? 2,
      lifetime: options.lifetime ?? 5,
      friendly: options.friendly ?? false,
    });
    return;
  }

  const preferredDirection =
    (options.facing ?? shooter.direction ?? Math.sign(shooter.vx)) || 1;
  const facing = options.trackPlayer
    ? Math.sign(player.x + player.width / 2 - shooterCenterX) || preferredDirection
    : preferredDirection;
  const speed = options.speed ?? randomRange(320, 420);
  const originX = facing > 0 ? shooter.x + shooter.width : shooter.x - size;
  const originYCenter = shooterCenterY + heightOffset;
  const projectileCenterX = originX + size / 2;
  let vy = options.vy ?? 0;
  if (options.trackPlayer) {
    const targetY = player.y + player.height / 2;
    const travelTime = Math.max(0.35, Math.abs((player.x + player.width / 2 - projectileCenterX) / speed));
    vy = (targetY - originYCenter) / travelTime;
  }

  fireballs.push({
    x: originX,
    y: originYCenter - size / 2,
    width: size,
    height: size,
    vx: speed * facing,
    vy,
    damage: options.damage ?? shooter.damage ?? 2,
    lifetime: options.lifetime ?? 5,
    friendly: options.friendly ?? false,
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
        fireballs.splice(i, 1);
        destroyed = true;
        break;
      }
    }
    if (destroyed) {
      continue;
    }

    if (fireball.friendly) {
      let hit = false;

      for (const thief of thieves) {
        if (!thief.alive) {
          continue;
        }
        if (rectIntersect(fireball, getRect(thief))) {
          damageThief(thief, fireball.damage ?? 1);
          hit = true;
          break;
        }
      }

      if (!hit) {
        for (const boss of bosses) {
          if (!boss.alive) {
            continue;
          }
          if (rectIntersect(fireball, getRect(boss))) {
            if (boss.invuln <= 0) {
              boss.health -= fireball.damage ?? 1;
              boss.invuln = 0.6;
              if (boss.health <= 0) {
                defeatBoss(boss);
              }
            } else {
              boss.invuln = Math.max(boss.invuln, 0.4);
            }
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        fireballs.splice(i, 1);
      }
      continue;
    }

    if (rectIntersect(fireball, playerRect)) {
      damagePlayer(fireball, fireball.damage);
      fireballs.splice(i, 1);
    }
  }
}

function damagePlayer(source, amount = 1) {
  if (player.invuln > 0) {
    return;
  }

  player.health = Math.max(0, player.health - amount);
  player.invuln = 1.2;
  const knockbackStrength = source && amount > 1 ? player.maxSpeed * 1.2 : player.maxSpeed;
  player.vx = source
    ? Math.sign(player.x + player.width / 2 - (source.x + source.width / 2)) * knockbackStrength
    : 0;
  player.vy = -player.jumpStrength * 0.5;
  updateHealthUI();

  if (player.health === 0) {
    showMessage('Ali Baba regroups to try again!');
    setTimeout(() => {
      hideMessage();
    }, 2200);
    resetLevel();
  }
}

function resetLevel() {
  player.x = 140;
  player.y = WORLD.groundY - player.height;
  player.vx = 0;
  player.vy = 0;
  player.health = 3;
  player.invuln = 1.2;
  player.jumpsRemaining = player.maxJumps;
  player.coyoteTimer = 0;
  player.hasFireballPower = false;
  player.fireCooldown = 0;
  fireballs.length = 0;
  collectedRubies = 0;
  defeatedThieves = 0;
  for (const thief of thieves) {
    thief.alive = true;
    thief.x = thief.spawnX;
    thief.y = thief.spawnY;
    thief.vx = 0;
    thief.vy = 0;
    thief.direction = 1;
    thief.health = thief.maxHealth;
    thief.invuln = 0;
    thief.fireTimer = randomRange(1.4, 3.2);
  }
  for (const ruby of rubies) {
    ruby.collected = false;
    ruby.pulse = 0;
  }
  for (const boss of bosses) {
    boss.alive = true;
    boss.health = boss.maxHealth;
    boss.invuln = 0;
    boss.x = boss.spawnX;
    boss.y = boss.spawnY;
    boss.vx = 0;
    boss.vy = 0;
    boss.direction = boss.spawnDirection;
    boss.fireTimer = randomRange(1.6, 3.4);
  }
  powerup.collected = false;
  powerup.pulse = 0;
  levelCompleted = false;
  updateEnemyCounter();
  updateHealthUI();
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
  const thiefSprite = images.thief;
  const bossSprite = images.boss;

  if (!bg || !hero || !thiefSprite || !bossSprite) {
    return;
  }

  const dpr = scale;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  renderBackground(bg);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  renderPlatforms();
  renderGoal();
  renderPowerup();
  renderRubies();

  for (const thief of thieves) {
    if (!thief.alive) {
      continue;
    }
    ctx.save();
    ctx.translate(thief.x + thief.width / 2, thief.y + thief.height / 2);
    ctx.scale(thief.direction < 0 ? -1 : 1, 1);
    ctx.drawImage(
      thiefSprite,
      -thief.width / 2,
      -thief.height / 2,
      thief.width,
      thief.height,
    );
    ctx.restore();
  }

  for (const boss of bosses) {
    if (!boss.alive) {
      continue;
    }
    renderBoss(bossSprite, boss);
  }

  ctx.save();
  ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
  ctx.scale(player.facing < 0 ? -1 : 1, 1);
  ctx.globalAlpha = player.invuln > 0 ? 0.6 : 1;
  ctx.drawImage(
    hero,
    -player.width / 2,
    -player.height / 2,
    player.width,
    player.height,
  );
  ctx.restore();

  renderFireballs();

  ctx.restore();
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

function renderGoal() {
  ctx.fillStyle = 'rgba(200, 172, 72, 0.7)';
  ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
  ctx.fillStyle = 'rgba(255, 229, 128, 0.9)';
  ctx.fillRect(goal.x + 20, goal.y + 12, goal.width - 40, goal.height - 24);
}

function renderPowerup() {
  if (powerup.collected) {
    return;
  }

  const centerX = powerup.x + powerup.width / 2;
  const centerY = powerup.y + powerup.height / 2;
  const glowRadius = 38 + Math.sin(powerup.pulse) * 10;
  const gradient = ctx.createRadialGradient(centerX, centerY, 6, centerX, centerY, glowRadius);
  gradient.addColorStop(0, 'rgba(176, 255, 255, 0.95)');
  gradient.addColorStop(0.4, 'rgba(88, 210, 255, 0.75)');
  gradient.addColorStop(1, 'rgba(5, 80, 173, 0)');

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(centerX, centerY);
  ctx.rotate(Math.sin(powerup.pulse * 0.6) * 0.3);
  ctx.fillStyle = 'rgba(220, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.moveTo(0, -powerup.height / 2);
  ctx.lineTo(powerup.width / 2, 0);
  ctx.lineTo(0, powerup.height / 2);
  ctx.lineTo(-powerup.width / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function renderRubies() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ruby of rubies) {
    if (ruby.collected) {
      continue;
    }

    const centerX = ruby.x + ruby.width / 2;
    const centerY = ruby.y + ruby.height / 2;
    const glowRadius = 28 + Math.sin(ruby.pulse) * 6;
    const gradient = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, glowRadius);
    gradient.addColorStop(0, 'rgba(255, 120, 160, 0.95)');
    gradient.addColorStop(0.4, 'rgba(255, 60, 120, 0.7)');
    gradient.addColorStop(1, 'rgba(200, 30, 80, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.sin(ruby.pulse * 0.6) * 0.2);
    ctx.fillStyle = 'rgba(255, 70, 130, 0.95)';
    ctx.beginPath();
    ctx.moveTo(0, -ruby.height / 2);
    ctx.lineTo(ruby.width / 2, 0);
    ctx.lineTo(0, ruby.height / 2);
    ctx.lineTo(-ruby.width / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function renderBoss(sprite, boss) {
  ctx.save();
  ctx.translate(boss.x + boss.width / 2, boss.y + boss.height / 2);
  ctx.scale(boss.direction < 0 ? -1 : 1, 1);
  if (boss.invuln > 0 && Math.floor(boss.invuln * 20) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }
  ctx.drawImage(
    sprite,
    -boss.width / 2,
    -boss.height / 2,
    boss.width,
    boss.height,
  );
  ctx.restore();

  const barWidth = 96;
  const barHeight = 10;
  const barX = boss.x + (boss.width - barWidth) / 2;
  const barY = boss.y - 20;
  ctx.fillStyle = 'rgba(18, 10, 8, 0.8)';
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = 'rgba(235, 74, 74, 0.9)';
  const filled = ((barWidth - 4) * boss.health) / boss.maxHealth;
  ctx.fillRect(barX + 2, barY + 2, Math.max(0, filled), barHeight - 4);
  ctx.strokeStyle = 'rgba(255, 229, 128, 0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
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
  uiHealth.innerHTML = '';
  for (let i = 0; i < player.health; i += 1) {
    const dot = document.createElement('div');
    dot.className = 'health-dot';
    uiHealth.appendChild(dot);
  }
}

function updateEnemyCounter() {
  const totalEnemies = thieves.length + bosses.length;
  const defeatedBosses = bosses.reduce(
    (count, boss) => count + (boss.alive ? 0 : 1),
    0,
  );
  const defeated = defeatedThieves + defeatedBosses;
  enemyCounter.textContent = `Enemies: ${defeated} / ${totalEnemies} | Rubies: ${collectedRubies} / ${rubies.length}`;
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.style.opacity = '1';
}

function hideMessage() {
  messageEl.style.opacity = '0';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
