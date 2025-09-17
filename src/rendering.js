import { camera, ctx, dashTrails, images, player, remotePlayers, fireballs, view, DEFAULT_CHARACTER } from './state.js';
import { HIT_FLASH_DURATION, WORLD, backgroundConfig, platforms } from './constants.js';

function getCharacterSprite(character) {
  if (typeof character === 'string' && images[character]) {
    return images[character];
  }
  return images[DEFAULT_CHARACTER] ?? null;
}

export function render() {
  const bg = images.background;
  if (!bg) {
    return;
  }

  const localSprite = getCharacterSprite(player.character);
  if (!localSprite) {
    return;
  }

  const dpr = view.scale;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, view.viewportWidth, view.viewportHeight);

  renderBackground(bg);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  renderPlatforms();
  renderDashTrails();

  for (const remote of remotePlayers.values()) {
    const remoteSprite = getCharacterSprite(remote.character);
    if (!remoteSprite) {
      continue;
    }
    renderHero(remoteSprite, remote, {
      color: remote.color,
      name: remote.name,
      opacity: remote.alive ? 0.95 : 0.3,
      invuln: 0,
      alive: remote.alive,
      hitFlash: remote.hitFlash,
      anim: remote.anim,
    });
  }

  renderHero(localSprite, player, {
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

  for (const trail of dashTrails) {
    const sprite = getCharacterSprite(trail.character);
    if (!sprite) {
      continue;
    }
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
    view.viewportWidth / bg.width,
    view.viewportHeight / bg.height,
  );
  const zoomedScale = baseScale * backgroundConfig.zoom;
  const scaledWidth = bg.width * zoomedScale;
  const scaledHeight = bg.height * zoomedScale;

  const extraWidth = Math.max(0, scaledWidth - view.viewportWidth);
  const extraHeight = Math.max(0, scaledHeight - view.viewportHeight);

  const cameraRangeX = Math.max(1, WORLD.width - view.viewportWidth);
  const cameraRangeY = Math.max(1, WORLD.height - view.viewportHeight);

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
    const flashStrength = Math.min(1, Math.max(0, options.hitFlash / HIT_FLASH_DURATION));
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
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(name);
  const width = Math.max(metrics.width + paddingX * 2, 48);
  const height = 24;
  const opacity = isAlive ? 0.9 : 0.5;

  ctx.globalAlpha = opacity;
  ctx.fillStyle = 'rgba(21, 17, 13, 0.85)';
  ctx.fillRect(textX - width / 2, textY - height / 2, width, height);

  ctx.fillStyle = color || '#f5d76e';
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
