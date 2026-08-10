# RideGlobal

Multiplayer BMX stunt racing game — rebuilt for the web. Race globally, perform tricks, build custom tracks, and rule the leaderboard.

## What Changed

This is a ground-up web-based rewrite of the original Unity-based RideGlobal concept. Instead of a Unity desktop client, the game now runs entirely in the browser using HTML5 Canvas with a Node.js multiplayer backend.

## Architecture

| Layer | Technology |
|-------|-----------|
| Client | HTML5 Canvas + vanilla JS (no build step) |
| Physics | Custom 2D BMX physics engine with landing detection |
| Networking | WebSocket (native browser API) |
| Server | Node.js + Express + ws |
| Rendering | Canvas 2D with particle effects, minimap, screen shake |
| Audio | Web Audio API synthesized engine + trick sounds |
| World Builder | Track editor with connector pieces |

## Features

### Core Gameplay
- Real-time multiplayer racing (up to 4 players per room)
- BMX physics: acceleration, jumping, ramps, gravity, friction
- **Crash/bail system**: bad landings cause crashes, speed penalties, and score loss
- **Landing detection**: perfect, OK, bad, and crash landings with scoring bonuses
- **Player collision**: bikes can physically collide with each other
- **10 tricks**: Barspin, Tailwhip, Superman, Backflip, 360 Spin, Invert, Double Tailwhip, Tuck No-Hander, Whiplash, Flipwhip
- **Difficulty-based scoring**: easy tricks = 1x, extreme = 2x multiplier
- **Combo multiplier system**: chain tricks up to 5x multiplier
- **Procedural track generation** with ramps, kickers, quarter pipes, and gaps

### Game Modes
- **Online Multiplayer**: Matchmaking, lobbies, real-time sync
- **Practice Mode**: Single-player, no server required
- **Time Trial**: Race against your best time, track personal records
- **Track Editor**: Build custom tracks with connector pieces, save and test them

### Audio & Effects
- **Full Web Audio engine**: synthesized engine noise, jump sounds, trick sounds, landing sounds, crash sounds, finish fanfare
- **Screen shake**: on crashes and perfect landings
- **Particle effects**: sparks, trails, weather (rain, snow)
- **Day/night cycle**: 60-second time progression on sky rendering
- **Minimap**: live HUD showing all player positions on the track
- **FPS counter**: performance monitoring in top-left corner

### Mobile & Accessibility
- **Touch controls**: virtual joystick + jump + trick buttons on mobile devices
- **Responsive UI**: adapts to small screens
- **Keyboard shortcuts**: Enter to play, C for chat, M for mute

### Social
- **In-game chat**: real-time chat overlay during races
- **Country flag selection**: represent your nation (20 flags)
- **Bike color customization**: 12 color options
- **Live leaderboard**: global and room-scoped rankings
- **Tournament support**: daily races with live results
- **Ghost recording**: (API ready, replay system coming soon)

### Server Features
- **Anti-cheat**: server-side position validation, speed-hack detection, teleport detection
- **Rate limiting**: 60 messages per 10 seconds per player
- **Persistent leaderboards**: file-based storage, survives server restarts
- **Persistent ghosts**: file-based storage
- **Ban system**: IP-based ban support
- **Graceful shutdown**: SIGTERM/SIGINT handling with data persistence
- **Health endpoint**: `/health` with player/room counts
- **Stats endpoint**: `/api/stats` with memory and uptime metrics
- **Custom track sharing**: POST/GET `/api/tracks` for community tracks
- **Heartbeat**: 30-second WebSocket ping/pong to detect dead connections

### DevOps
- **Docker**: Dockerfile + docker-compose.yml included
- **Environment config**: `.env.example` provided
- **Test suite**: `npm test` runs server-side tests
- **Auto-reconnect**: client reconnects with exponential backoff (5 attempts)

## Quick Start

### Server

```bash
cd server
npm install
npm start
```

Server runs on port 3000. Health check at `/health`.

Run tests:
```bash
npm test
```

### Docker

```bash
docker-compose up --build
```

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
| 6 | Invert |
| 7 | Double Tailwhip |
| 8 | Tuck No-Hander |
| 9 | Whiplash |
| 0 | Flipwhip |
| C | Toggle Chat |
| M | Toggle Mute |
| Enter | Quick Play (from title) |

## Track Editor / World Builder

Build custom tracks using connector pieces that snap together end-to-end:

- **Straight**: Flat ground segment
- **Start/Finish Line**: Race markers
- **Small/Big Ramp**: Basic jump ramps
- **Kicker**: Steep launch ramp
- **Quarter Pipe**: Vertical launch ramp
- **Gap**: Empty space between pieces
- **Downhill/Uphill**: Slope segments
- **Loop**: Full loop segment (extreme)

Tracks can be saved to local storage, tested immediately, and shared via the server API.

## File Structure

```
ride-global/
├── client/
│   ├── index.html
│   ├── style.css
│   └── src/
│       ├── game.js        # Main game loop & state management
│       ├── network.js     # WebSocket client with auto-reconnect
│       ├── physics.js     # BMX physics engine with crash detection
│       ├── renderer.js    # Canvas rendering with minimap, weather, FX
│       ├── tricks.js      # Trick combo system with difficulties
│       ├── track-editor.js # Track builder with connector pieces
│       ├── ui.js          # UI screens, chat, HUD, notifications
│       └── audio.js       # Web Audio API sound engine
├── server/
│   ├── package.json
│   ├── index.js           # Express + WebSocket server
│   └── test.js            # Server test suite
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /health` | GET | Server health check |
| `GET /api/stats` | GET | Server stats (players, memory, uptime) |
| `GET /api/rooms` | GET | List active rooms |
| `GET /api/leaderboard/:roomId?` | GET | Room leaderboard |
| `GET /api/leaderboard/global` | GET | Global leaderboard |
| `GET /api/tournaments/:id` | GET | Tournament status |
| `GET /api/ghosts` | GET | Recent ghost runs |
| `GET /api/player/:id` | GET | Player info |
| `GET /api/tracks` | GET | List community tracks |
| `POST /api/tracks` | POST | Save a custom track |
| `GET /api/tracks/:id` | GET | Get track details (increments play count) |
| `POST /api/tracks/:id/like` | POST | Like a track |

## WebSocket Protocol

| Message Type | Direction | Description |
|-------------|-----------|-------------|
| `auth` | Client -> Server | Authenticate with name/country/color |
| `joinRoom` | Client -> Server | Join or create a room |
| `startRace` | Client -> Server | Start race countdown |
| `sync` | Client -> Server | Send position/rotation/crash update |
| `finishRace` | Client -> Server | Submit race finish time |
| `trick` | Client -> Server | Perform a trick |
| `chat` | Client -> Server | Send chat message |
| `playerJoined` | Server -> Client | New player joined room |
| `playerLeft` | Server -> Client | Player left room (with name) |
| `raceStarted` | Server -> Client | Race countdown started |
| `update` | Server -> Client | Remote player position + crash state |
| `playerFinished` | Server -> Client | Player finished race |
| `trickPerformed` | Server -> Client | Remote player performed trick |
| `chat` | Server -> Client | Chat message broadcast |
| `error` | Server -> Client | Error notification (rate limit, invalid sync) |
| `pong` | Server -> Client | Heartbeat response with server time |

## License

MIT
