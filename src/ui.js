import { network, player, remotePlayers, ui } from './state.js';
import { clamp } from './utils.js';

export function initUI() {
  if (ui.playerNameLabel) {
    ui.playerNameLabel.textContent = player.displayName;
  }
  updateHealthUI();
  updateEnemyCounter();
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
