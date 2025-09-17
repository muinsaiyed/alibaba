import { updateDashTrails } from './dashTrails.js';
import { updateNetwork } from './network.js';
import { updateLocalPlayer } from './player.js';
import { handlePlayerFireball, updateFireballs } from './projectiles.js';
import { render } from './rendering.js';
import { updateRemotePlayers } from './remotePlayers.js';
import { recalcPointerWorld, updateCamera } from './viewport.js';

let lastTime = performance.now();

export function startGameLoop() {
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  const delta = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  tick(delta);
  updateNetwork(delta);
  render();

  requestAnimationFrame(loop);
}

function tick(delta) {
  const alive = updateLocalPlayer(delta);

  handlePlayerFireball(delta);
  updateFireballs(delta);
  updateRemotePlayers(delta);
  updateDashTrails(delta);
  updateCamera();
  recalcPointerWorld();

  if (!alive) {
    // When the player is down, updateLocalPlayer already handled death physics.
  }
}
