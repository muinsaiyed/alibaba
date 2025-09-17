export const WORLD = {
  width: 7200,
  height: 720,
  groundY: 560,
};

export const backgroundConfig = {
  zoom: 1.25,
  parallaxX: 0.45,
  parallaxY: 0.3,
};

export const DASH_TRAIL_LIFETIME = 0.22;
export const DASH_TRAIL_INTERVAL = 0.045;
export const DASH_DOUBLE_TAP_MS = 260;
export const COYOTE_TIME = 0.12;
export const NETWORK_SEND_INTERVAL = 1 / 15;
export const REMOTE_SMOOTHING_RATE = 12;
export const FIREBALL_LIFETIME = 0.42;
export const SINBAD_ATTACK_DURATION = 0.62;
export const SINBAD_ATTACK_FRAMES = [
  { sx: 96, sy: 3, sw: 295, sh: 493, anchorX: 0.4983, anchorY: 0.9980 },
  { sx: 511, sy: 58, sw: 454, sh: 436, anchorX: 0.4989, anchorY: 0.9977 },
  { sx: 10, sy: 534, sw: 460, sh: 451, anchorX: 0.4989, anchorY: 0.9978 },
  { sx: 513, sy: 605, sw: 399, sh: 381, anchorX: 0.4987, anchorY: 0.9974 },
];
export const SINBAD_ATTACK_FRAME_COUNT = SINBAD_ATTACK_FRAMES.length;
export const SINBAD_ATTACK_HEIGHT_SCALE = 1.0;
export const CHARACTER_RENDER_SCALE = {
  aliBaba: 1,
  sinbad: 1.12,
};
export const SINBAD_WAVE_SPEED = 760;
export const SINBAD_WAVE_LIFETIME = 0.58;
export const SINBAD_WAVE_WIDTH = 160;
export const SINBAD_WAVE_HEIGHT = 84;
export const HIT_FLASH_DURATION = 0.28;

const localHosts = new Set(['localhost', '127.0.0.1']);
export const SOCKET_URL = localHosts.has(window.location.hostname)
  ? 'http://localhost:3000'
  : 'https://alibabagame-mp.fly.dev';

export const platforms = [
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
