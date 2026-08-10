# RideGlobal

Multiplayer BMX stunt racing game — rebuilt for the web. Race globally, perform tricks, and rule the leaderboard.

## What Changed

This is a ground-up web-based rewrite of the original Unity-based RideGlobal concept. Instead of a Unity desktop client, the game now runs entirely in the browser using HTML5 Canvas with a Node.js multiplayer backend.

## Architecture

| Layer | Technology |
|-------|-----------|
| Client | HTML5 Canvas + vanilla JS (no build step) |
| Physics | Custom 2D BMX physics engine |
| Networking | WebSocket (native browser API) |
| Server | Node.js + Express + ws |
| Rendering | Canvas 2D with particle effects |

## Features

- Real-time multiplayer racing (up to 4 players per room)
- BMX physics: acceleration, jumping, ramps, gravity
- Trick system: Barspin, Tailwhip, Superman, Backflip, 360 Spin
- Combo multiplier system for chained tricks
- Procedural track generation with ramps and kickers
- Country flag selection (represent your nation)
- Bike color customization
- Live leaderboard with global and room-scoped rankings
- Tournament support
- Ghost recording (coming soon)
- Auto-reconnect on connection loss

## Quick Start

### Server

```bash
cd server
npm install
npm start
```

Server runs on port 3000. Health check at `/health`.

### Client

The client is served statically by the Express server. Just open `http://localhost:3000` in your browser after starting the server.

No build step required — pure HTML/CSS/JS.

## Controls

| Key | Action |
|-----|--------|
| Left/Right Arrow | Accelerate / Brake |
| Up Arrow | Lean back / Backflip prep |
| Down Arrow | Lean forward / Superman prep |
| Space | Jump |
| 1 | Barspin |
| 2 | Tailwhip |
| 3 | Superman |
| 4 | Backflip |
| 5 | 360 Spin |

## File Structure

```
ride-global/
├── client/
│   ├── index.html
│   ├── style.css
│   └── src/
│       ├── game.js        # Main game loop & state management
│       ├── network.js     # WebSocket client
│       ├── physics.js     # BMX physics engine
│       ├── renderer.js    # Canvas rendering
│       ├── tricks.js      # Trick combo system
│       └── ui.js          # UI screens & HUD
└── server/
    ├── package.json
    └── index.js           # Express + WebSocket server
```

## API Endpoints

- `GET /health` — Server health check
- `GET /api/rooms` — List active rooms
- `GET /api/leaderboard/:roomId?` — Room leaderboard
- `GET /api/leaderboard/global` — Global leaderboard
- `GET /api/tournaments/:id` — Tournament status
- `GET /api/ghosts` — Recent ghost runs
- `GET /api/player/:id` — Player info

## WebSocket Protocol

| Message Type | Direction | Description |
|-------------|-----------|-------------|
| `auth` | Client -> Server | Authenticate with name/country/color |
| `joinRoom` | Client -> Server | Join or create a room |
| `startRace` | Client -> Server | Start race countdown |
| `sync` | Client -> Server | Send position/rotation update |
| `finishRace` | Client -> Server | Submit race finish time |
| `trick` | Client -> Server | Perform a trick |
| `playerJoined` | Server -> Client | New player joined room |
| `playerLeft` | Server -> Client | Player left room |
| `raceStarted` | Server -> Client | Race countdown started |
| `update` | Server -> Client | Remote player position update |
| `playerFinished` | Server -> Client | Player finished race |
| `trickPerformed` | Server -> Client | Remote player performed trick |

## License

MIT
