import { canvas, dashInput, input } from './state.js';
import { handleDashTap } from './player.js';
import { recalcPointerWorld, updatePointerFromEvent } from './viewport.js';

export function setupInput() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', resetFireInput);
  canvas.addEventListener('mousedown', onMouseDown);
}

function onKeyDown(event) {
  switch (event.code) {
    case 'ArrowLeft':
    case 'KeyA':
      if (!event.repeat) {
        handleDashTap(-1, dashInput);
      }
      input.left = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      if (!event.repeat) {
        handleDashTap(1, dashInput);
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
}

function onKeyUp(event) {
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
}

function onPointerMove(event) {
  updatePointerFromEvent(event);
  recalcPointerWorld();
}

function onMouseDown(event) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  updatePointerFromEvent(event);
  recalcPointerWorld();
  input.fire = true;
}

function onMouseUp(event) {
  if (event.button === 0) {
    input.fire = false;
  }
}

function resetFireInput() {
  input.fire = false;
}
