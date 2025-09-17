import { canvas, camera, pointer, player, view } from './state.js';
import { WORLD } from './constants.js';
import { clamp } from './utils.js';

export function resizeCanvas() {
  const prevWidth = view.viewportWidth;
  const prevHeight = view.viewportHeight;

  view.viewportWidth = window.innerWidth;
  view.viewportHeight = window.innerHeight;
  view.scale = window.devicePixelRatio || 1;

  canvas.width = Math.floor(view.viewportWidth * view.scale);
  canvas.height = Math.floor(view.viewportHeight * view.scale);
  canvas.style.width = `${view.viewportWidth}px`;
  canvas.style.height = `${view.viewportHeight}px`;

  if (prevWidth && prevHeight) {
    const ratioX = prevWidth === 0 ? 0.5 : pointer.screenX / prevWidth;
    const ratioY = prevHeight === 0 ? 0.5 : pointer.screenY / prevHeight;
    pointer.screenX = clamp(ratioX * view.viewportWidth, 0, view.viewportWidth);
    pointer.screenY = clamp(ratioY * view.viewportHeight, 0, view.viewportHeight);
  }
}

export function updatePointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;
  pointer.screenX = clamp(event.clientX - rect.left, 0, width);
  pointer.screenY = clamp(event.clientY - rect.top, 0, height);
}

export function recalcPointerWorld(referenceCamera = camera) {
  const camX = referenceCamera.x ?? camera.x;
  const camY = referenceCamera.y ?? camera.y;
  pointer.worldX = clamp(camX + pointer.screenX, 0, WORLD.width);
  pointer.worldY = clamp(camY + pointer.screenY, 0, WORLD.height);
}

export function predictCameraPosition() {
  const halfWidth = view.viewportWidth / 2;
  const halfHeight = view.viewportHeight / 2;
  const desiredX = player.x + player.width / 2 - halfWidth;
  const desiredY = player.y + player.height / 2 - halfHeight;
  const maxCameraX = Math.max(0, WORLD.width - view.viewportWidth);
  const maxCameraY = Math.max(0, WORLD.height - view.viewportHeight);
  return {
    x: clamp(desiredX, 0, maxCameraX),
    y: clamp(desiredY, 0, maxCameraY),
  };
}

export function updateCamera() {
  camera.x = player.x + player.width / 2 - view.viewportWidth / 2;
  camera.y = player.y + player.height / 2 - view.viewportHeight / 2;
  camera.x = clamp(camera.x, 0, Math.max(0, WORLD.width - view.viewportWidth));
  camera.y = clamp(camera.y, 0, Math.max(0, WORLD.height - view.viewportHeight));
}
