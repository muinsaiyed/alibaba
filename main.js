import { loadAssets } from './src/assets.js';
import { setupAudioUnlock, tryStartBackgroundMusic } from './src/audio.js';
import { startGameLoop } from './src/gameLoop.js';
import { setupInput } from './src/input.js';
import { initNetwork } from './src/network.js';
import { player, ui } from './src/state.js';
import { hideMessage, initUI, showMessage } from './src/ui.js';
import { recalcPointerWorld, resizeCanvas } from './src/viewport.js';

setupAudioUnlock();
initNetwork();
setupInput();
resizeCanvas();
recalcPointerWorld();
window.addEventListener('resize', () => {
  resizeCanvas();
  recalcPointerWorld();
});

loadAssets()
  .then(() => {
    initUI();
    tryStartBackgroundMusic();
    if (ui.joinNameInput) {
      setTimeout(() => {
        ui.joinNameInput.focus();
      }, 160);
    }
    showMessage('Face off against other players! Aim and unleash your fireballs.');
    setTimeout(() => {
      hideMessage();
    }, 3200);
    startGameLoop();
  })
  .catch((err) => {
    console.error('Failed to load assets', err);
  });
