let backgroundMusicStarted = false;

const backgroundMusic = new Audio('assets/backgroundsound.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.55;
backgroundMusic.preload = 'auto';

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
      // Browser may require another user interaction before playback; ignore.
    });
}

function playOneShotSound(baseSound) {
  const sound = baseSound.cloneNode();
  sound.volume = baseSound.volume;
  const playPromise = sound.play();
  if (!playPromise) {
    return;
  }
  playPromise.catch(() => {
    // Ignore playback errors (e.g., no interaction or OS policy).
  });
}

export function setupAudioUnlock() {
  window.addEventListener('pointerdown', startBackgroundMusic);
  window.addEventListener('keydown', startBackgroundMusic);
}

export function tryStartBackgroundMusic() {
  startBackgroundMusic();
}

export function playFireballSound() {
  playOneShotSound(baseFireballSound);
}

export function playEnemyDeathSound() {
  playOneShotSound(baseEnemyDeathSound);
}
