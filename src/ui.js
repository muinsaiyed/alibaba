import { network, normalizeCharacter, player, remotePlayers, ui } from './state.js';
import { clamp } from './utils.js';

export function initUI() {
  setupCharacterSelection();
  if (ui.playerNameLabel) {
    ui.playerNameLabel.textContent = player.displayName;
  }
  updateHealthUI();
  updateEnemyCounter();
}

export function syncCharacterSelection(character) {
  applyCharacterSelection(character, { updatePlayer: false, force: true });
}

export function updateHealthUI() {
  if (!ui.health) {
    return;
  }
  const ratio = clamp(player.health / player.maxHealth, 0, 1);
  if (ui.healthBarFill) {
    ui.healthBarFill.style.width = `${(ratio * 100).toFixed(1)}%`;
  }
  if (ui.healthBarText) {
    ui.healthBarText.textContent = `${Math.max(0, Math.round(player.health))} / ${player.maxHealth}`;
  }
}

export function updateEnemyCounter() {
  if (!ui.enemyCounter) {
    return;
  }
  const online = (network.hasJoinedGame ? 1 : 0) + remotePlayers.size;
  const hpText = `${Math.max(0, Math.round(player.health))}/${player.maxHealth}`;
  ui.enemyCounter.textContent = `Players online: ${online} • HP: ${hpText} • K:${player.kills} D:${player.deaths}`;
}

export function showMessage(text) {
  if (!ui.messageEl) {
    return;
  }
  ui.messageEl.textContent = text;
  ui.messageEl.style.opacity = '1';
}

export function hideMessage() {
  if (!ui.messageEl) {
    return;
  }
  ui.messageEl.style.opacity = '0';
}

let availableCharacters = new Set();
let currentCharacter = null;
let characterSelectionSetup = false;

function setupCharacterSelection() {
  if (!Array.isArray(ui.characterOptions) || ui.characterOptions.length === 0) {
    return;
  }

  if (characterSelectionSetup) {
    applyCharacterSelection(player.character, { updatePlayer: false, force: true });
    return;
  }

  characterSelectionSetup = true;
  availableCharacters = new Set();
  for (const option of ui.characterOptions) {
    const characterId = option.dataset.character;
    if (!characterId) {
      continue;
    }
    availableCharacters.add(normalizeCharacter(characterId));
    option.addEventListener('click', () => {
      applyCharacterSelection(option.dataset.character, { updatePlayer: true });
    });
    option.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        applyCharacterSelection(option.dataset.character, { updatePlayer: true });
      }
    });
  }

  applyCharacterSelection(player.character, { updatePlayer: false, force: true });
}

function applyCharacterSelection(desiredCharacter, { updatePlayer = true, force = false } = {}) {
  if (!Array.isArray(ui.characterOptions) || ui.characterOptions.length === 0) {
    return;
  }

  const normalized = normalizeCharacter(desiredCharacter);
  const fallback = availableCharacters.values().next().value ?? normalizeCharacter();
  const target = availableCharacters.has(normalized) ? normalized : fallback;

  if (!force && currentCharacter === target) {
    if (updatePlayer) {
      player.character = target;
    }
    return;
  }

  currentCharacter = target;
  for (const option of ui.characterOptions) {
    const isSelected = option.dataset.character === currentCharacter;
    option.classList.toggle('selected', isSelected);
    option.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  }

  if (updatePlayer) {
    player.character = currentCharacter;
  }
}

setupCharacterSelection();
