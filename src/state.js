import { WORLD, DASH_TRAIL_INTERVAL } from './constants.js';

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

const uiHealth = document.getElementById('health');
const enemyCounter = document.getElementById('enemy-counter');
const healthBarFill = uiHealth?.querySelector('.health-bar-fill') ?? null;
const healthBarText = uiHealth?.querySelector('.health-bar-text') ?? null;
const joinOverlay = document.getElementById('join-overlay');
const joinForm = document.getElementById('join-form');
const joinNameInput = document.getElementById('join-name');
const playerNameLabel = document.getElementById('player-name');
const characterOptionButtons = Array.from(
  document.querySelectorAll('[data-character-option][data-character]'),
);

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

export const ui = {
  health: uiHealth,
  enemyCounter,
  healthBarFill,
  healthBarText,
  joinOverlay,
  joinForm,
  joinNameInput,
  playerNameLabel,
  messageEl,
  characterOptions: characterOptionButtons,
};

const characterSprites = {
  aliBaba: 'assets/alibaba_sprite.png',
  sinbad: 'assets/sinbadsprite.png',
};

export const CHARACTER_IDS = Object.keys(characterSprites);
const CHARACTER_ID_SET = new Set(CHARACTER_IDS);
export const DEFAULT_CHARACTER = CHARACTER_IDS[0];

export function normalizeCharacter(value) {
  if (typeof value === 'string' && CHARACTER_ID_SET.has(value)) {
    return value;
  }
  return DEFAULT_CHARACTER;
}

export const assetSources = {
  background: 'assets/cave-background.png',
  ...characterSprites,
  sinbadAttack: 'assets/sinbadspriteanimation.png',
  sinbadAttackWave: 'assets/sinbadattackwave.png',
};

export const images = {};

export const view = {
  viewportWidth: window.innerWidth,
  viewportHeight: window.innerHeight,
  scale: window.devicePixelRatio || 1,
};

export const input = {
  left: false,
  right: false,
  jumpPressed: false,
  jumpQueued: false,
  fire: false,
};

export const dashInput = {
  lastTapLeft: Number.NEGATIVE_INFINITY,
  lastTapRight: Number.NEGATIVE_INFINITY,
};

export const pointer = {
  screenX: 0,
  screenY: 0,
  worldX: 0,
  worldY: 0,
};

export const dashTrails = [];
export const fireballs = [];

export const player = {
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
  character: DEFAULT_CHARACTER,
  attackTimer: 0,
  attackAnimTime: 0,
};

export const camera = { x: 0, y: 0 };
export const remotePlayers = new Map();

export const network = {
  socket: null,
  localPlayerId: null,
  hasJoinedGame: false,
  joinInFlight: false,
  pendingJoinPayload: null,
  pendingJoinCallback: null,
  pendingJoinTimeout: null,
  networkAccumulator: 0,
};
