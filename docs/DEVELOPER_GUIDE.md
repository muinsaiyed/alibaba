# Developer Guide

This document explains how the Ali Baba & the 40 Thieves project is organised, how the real-time game loop works, and how to extend or deploy the experience safely.

---

## 1. Project layout

```
root
├── assets/                # Static art/audio used by the client
├── docs/                  # Documentation (this guide)
├── main.js                # Client entry point (ES module)
├── server.js              # Node/Express + Socket.IO server
├── src/                   # Client-side modules (pure ES modules)
│   ├── assets.js          # Asset preloading helper
│   ├── audio.js           # Background score + SFX helpers
│   ├── constants.js       # Tunable game constants + platform layout
│   ├── dashTrails.js      # Dash trail spawning/update logic
│   ├── gameLoop.js        # `requestAnimationFrame` orchestration
│   ├── input.js           # Keyboard/mouse listeners
│   ├── network.js         # Socket.IO wiring & lobby/state mgmt
│   ├── player.js          # Local player physics & dash handling
│   ├── projectiles.js     # Fireball spawning, updates, collisions
│   ├── remotePlayers.js   # Remote player smoothing + registry
│   ├── rendering.js       # Canvas drawing pipeline
│   ├── state.js           # Shared mutable state + DOM handles
│   ├── ui.js              # HUD updates & toast messaging
│   └── viewport.js        # Camera, pointer mapping, canvas resizing
├── index.html             # Single-page client shell
├── style.css              # HUD + layout styling
└── package.json           # Scripts and dependencies
```

Key idea: every subsystem reads/writes through `src/state.js`, which exports shared objects (player, remotePlayers, canvas, UI handles). Modules stay isolated but coordinate via these references.

---

## 2. Running the project locally

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Start the dev server**
   ```bash
   npm start
   ```
   - Serves static assets from the repo root.
   - Hosts a Socket.IO server on `http://localhost:3000`.
3. **Open the client**
   - Navigate to `http://localhost:3000` in a modern Chromium/Firefox browser (ES module + `AudioContext` support required).
   - Opening multiple tabs simulates remote clients.

Hot reload is not bundled; refresh the browser after code updates.

---

## 3. Server architecture (`server.js`)

- **Express static host** – `express.static(__dirname)` serves `index.html`, `main.js`, and asset files.
- **Socket.IO events** (all namespaced with `player:`):
  - `player:join` – validates capacity (max 4), ensures unique name, assigns spawn + colour, returns current roster.
  - `player:update` – receives position, facing, and animation snapshots from clients; rebroadcasts deltas to other players.
  - `player:shoot` – trust-but-verify projectile payload; relays to peers.
  - `player:damage` – authoritative damage application. Handles self-hits when owner echoes damage back for local confirmation.
  - `player:defeated`, `player:respawn`, `player:respawned`, `player:left`, `player:kicked` – lifecycle notifications.
- **Gameplay rules enforced server-side**:
  - 20 HP max, 1 HP fireball damage (clamped to prevent large payloads).
  - Respawn delay: 3.2s, with rotating spawn points.
  - Idle kick: inactivity >30s triggers removal.
  - Name uniqueness, colour recycling, room-size gating.
- **Configuration**: optional `ALLOWED_ORIGINS` env var (comma-separated) restricts CORS in production; otherwise `*`.

---

## 4. Client architecture (`src/`)

### 4.1 State & utilities
- `state.js`: stores mutable game state (player, remote players, inputs), canvas context, and DOM references. Imported everywhere so every module reads the same objects.
- `constants.js`: world dimensions, physics tunables, spawn platforms, effect timings, Socket endpoint selection (local vs Fly.io).
- `utils.js`: math helpers (`clamp`, `getRect`, collision tests).

### 4.2 Systems
- **Input (`input.js`)** – registers key/mouse listeners, translates double-tap dash gestures, updates pointer world coordinates.
- **Player (`player.js`)** – handles movement physics (acceleration, triple jump, coyote time), dash cooldown, and death physics. Returns a boolean from `updateLocalPlayer` to signal if the avatar is alive.
- **Projectiles (`projectiles.js`)** – handles fireball spawn parameters, cooldowns, collision checks against platforms/local player/remote players, and damage reporting (`player:damage`).
- **Dash trails (`dashTrails.js`)** – spawns and ages motion streaks for both local and remote dashes.
- **Remote players (`remotePlayers.js`)** – keeps a Map of opponents, smooths positions using exponential easing, and exposes helpers for name lookup/removal.
- **Rendering (`rendering.js`)** – centralised Canvas drawing (background parallax, platforms, heroes, fireballs, UI nameplates). Relies on scaled transforms for HiDPI screens.
- **UI (`ui.js`)** – updates HUD text/health bar, handles toast messaging, initialises label text.
- **Audio (`audio.js`)** – auto-plays background loop upon first interaction, clones SFX for simultaneous playback.
- **Viewport (`viewport.js`)** – resizes the canvas on window changes, maps pointer coordinates into world space, manages camera tracking.
- **Game loop (`gameLoop.js`)** – `requestAnimationFrame` driver that steps local player physics, projectiles, dash trails, camera, networking, and rendering each frame.
- **Network (`network.js`)** – encapsulates Socket.IO wiring, join/leave flow, state sync, respawn handling, and lobby resets. Coordinates UI and state resets when disconnected.
- **Assets (`assets.js`)** – preloads the hero sprite and background image before gameplay begins.

### 4.3 Entry point (`main.js`)
- Sets up audio unlock, networking, input, canvas resizing.
- Preloads assets, initialises UI, shows onboarding toast.
- Starts the game loop once assets are ready.

---

## 5. Modifying or extending the game

### Add a new ability or mechanic
1. Extend constants in `constants.js` if new tunables are needed.
2. Update `state.js` to track any extra timers or flags.
3. Implement behaviour inside the relevant system (e.g. `player.js` for movement, `projectiles.js` for new weapons).
4. Ensure network messages cover the new state—add payload fields in `network.js` and `server.js`.
5. Update `rendering.js` and `audio.js` for new feedback, plus docs/UI text.

### Adjusting physics or balance
- Movement speed, gravity, jump strength, dash properties live in `state.js` (player defaults) and `constants.js`.
- Projectile speed/damage comes from `projectiles.js` (client) and is clamped in `server.js` for safety.

### Tweaking platform layout
- Edit the `platforms` array in `constants.js`. Client collision and rendering use the same data; no server changes required.

### Changing capacity or health rules
- `MAX_PLAYERS`, `DEFAULT_HEALTH`, and `FIREBALL_LIFETIME` are defined in `server.js`. Mirror any gameplay-critical change on the client to keep UI consistent.

---

## 6. Production considerations

- **Deployment**: the repository includes `fly.toml` and a Dockerfile for Fly.io hosting. Ensure `ALLOWED_ORIGINS` is set to your production domain.
- **SSL / custom domain**: terminate TLS at the proxy/load balancer and point WebSocket upgrades to the Node server.
- **Monitoring**: add logging/metrics inside Socket.IO event handlers or hook into Fly.io’s built-in monitoring.
- **Scaling**: the game currently assumes a single room capped at four players. Supporting larger lobbies requires sharding `MAIN_ROOM`, tracking per-room player lists, and load balancing join requests.

---

## 7. Testing tips

- **Local multiplayer**: open several browser tabs or use different browsers/devices on the LAN.
- **Automated checks**: run `node --check <file>` to validate syntax (already used in the refactor). Consider adding ESLint/Prettier for linting.
- **Network simulation**: throttle network speed or add latency via browser dev tools to observe smoothing behaviour (`REMOTE_SMOOTHING_RATE`).

---

## 8. Useful constants & timers

| Constant                         | Location              | Purpose                                    |
|---------------------------------|-----------------------|--------------------------------------------|
| `WORLD.width/height`            | `src/constants.js`    | Size of the playable cavern space          |
| `COYOTE_TIME`                   | `src/constants.js`    | Late jump grace period                     |
| `DASH_DOUBLE_TAP_MS`            | `src/constants.js`    | Double-tap detection window                |
| `FIREBALL_LIFETIME`             | Client + server       | Projectile lifespan                        |
| `NETWORK_SEND_INTERVAL`         | `src/constants.js`    | Client snapshot cadence (15 Hz)            |
| `REMOTE_SMOOTHING_RATE`         | `src/constants.js`    | Exponential smoothing factor               |
| `RESPAWN_DELAY_MS`              | `server.js`           | Delay before a defeated player returns     |
| `IDLE_TIMEOUT_MS`               | `server.js`           | Auto-kick window for inactive players      |
| `MAX_PLAYERS`                   | `server.js`           | Room capacity                              |

---

## 9. Future improvements (suggested)
- Add automated integration tests that spin up a headless browser and Socket.IO client.
- Introduce power-ups or area hazards by expanding the projectile system or platform definitions.
- Provide a spectator mode or scoreboard overlay for streaming sessions.

With this overview, new contributors can navigate the codebase, reproduce the environment, and extend the game without re-learning the entire architecture.
