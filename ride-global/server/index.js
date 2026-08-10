const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../client')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboards.json');
const GHOSTS_FILE = path.join(DATA_DIR, 'ghosts.json');
const BANS_FILE = path.join(DATA_DIR, 'bans.json');

function loadJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const leaderboards = loadJson(LEADERBOARD_FILE, {});
const ghosts = loadJson(GHOSTS_FILE, {});
const bannedIps = new Set(loadJson(BANS_FILE, []).ips || []);
const rooms = {};
const tournaments = {};
const players = {};
const playerCounter = { value: 0 };
let totalRequests = 0;

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta);
}

// Anti-cheat: validate sync position
function validateSync(prev, next) {
  if (!next || typeof next.x !== 'number' || typeof next.y !== 'number') return false;
  const maxSpeed = 25; // max units per tick
  const dx = next.x - (prev ? prev.x : next.x);
  const dy = next.y - (prev ? prev.y : next.y);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > maxSpeed) {
    log('warn', 'Speed hack detected', { dist: dist.toFixed(2), max: maxSpeed });
    return false;
  }
  if (next.x < -100 || next.y < -500 || next.y > 2000) {
    log('warn', 'Out of bounds position', { x: next.x, y: next.y });
    return false;
  }
  return true;
}

function persistLeaderboards() {
  saveJson(LEADERBOARD_FILE, leaderboards);
}

function persistGhosts() {
  saveJson(GHOSTS_FILE, ghosts);
}

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (bannedIps.has(ip)) {
    ws.close(1008, 'Banned');
    return;
  }

  let playerId = `player_${playerCounter.value++}`;
  let currentRoom = null;
  let tournamentId = null;
  let playerData = { id: playerId, ws, country: '🌍', color: '#FF0000', name: `Rider ${playerCounter.value}`, ip, lastSync: null, messageCount: 0, lastMessageTime: Date.now() };
  let isAlive = true;

  // Heartbeat
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      ws.terminate();
      clearInterval(heartbeat);
      return;
    }
    isAlive = false;
    ws.ping();
  }, 30000);

  ws.on('pong', () => { isAlive = true; });

  ws.on('message', (rawData) => {
    try {
      // Rate limit: max 60 messages per 10 seconds
      const now = Date.now();
      if (now - playerData.lastMessageTime > 10000) {
        playerData.messageCount = 0;
        playerData.lastMessageTime = now;
      }
      playerData.messageCount++;
      if (playerData.messageCount > 60) {
        log('warn', 'Rate limit exceeded', { playerId, ip });
        ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
        return;
      }

      totalRequests++;
      const msg = JSON.parse(rawData);

      switch (msg.type) {
        case 'auth': {
          const name = (msg.name || `Rider ${playerCounter.value}`).slice(0, 20).replace(/[<>]/g, '');
          playerData.name = name;
          if (msg.country) playerData.country = msg.country.slice(0, 8);
          if (msg.color) playerData.color = msg.color;
          players[playerId] = playerData;
          ws.send(JSON.stringify({ type: 'auth', playerId, name: playerData.name }));
          log('info', 'Player authenticated', { playerId, name: playerData.name, ip });
          break;
        }

        case 'joinRoom': {
          let targetRoom = msg.roomId;
          if (!targetRoom) {
            for (const id in rooms) {
              if (rooms[id].players.length < 4 && rooms[id].state === 'waiting') {
                targetRoom = id;
                break;
              }
            }
          }
          if (!targetRoom) {
            targetRoom = generateId('room');
            rooms[targetRoom] = { id: targetRoom, players: [], state: 'waiting', createdAt: Date.now() };
          }

          if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].players = rooms[currentRoom].players.filter(p => p.id !== playerId);
            broadcastToRoom(currentRoom, { type: 'playerLeft', playerId, name: playerData.name });
          }

          currentRoom = targetRoom;
          rooms[targetRoom].players.push(playerData);

          ws.send(JSON.stringify({ type: 'joinedRoom', roomId: targetRoom, playerId, players: rooms[targetRoom].players.map(p => ({ id: p.id, name: p.name, country: p.country, color: p.color })) }));
          broadcastToRoom(targetRoom, { type: 'playerJoined', player: { id: playerId, name: playerData.name, country: playerData.country, color: playerData.color } }, playerId);
          log('info', 'Player joined room', { playerId, roomId: targetRoom });
          break;
        }

        case 'startRace': {
          if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players.length > 0) {
            rooms[currentRoom].state = 'racing';
            rooms[currentRoom].startTime = Date.now() + 3000;
            broadcastToRoom(currentRoom, { type: 'raceStarted', startTime: rooms[currentRoom].startTime });
            log('info', 'Race started', { roomId: currentRoom, players: rooms[currentRoom].players.length });
          }
          break;
        }

        case 'sync': {
          if (currentRoom && rooms[currentRoom]) {
            if (!validateSync(playerData.lastSync, msg.position)) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid sync data' }));
              return;
            }
            playerData.lastSync = msg.position;
            broadcastToRoom(currentRoom, {
              type: 'update',
              playerId,
              position: msg.position,
              rotation: msg.rotation,
              trick: msg.trick || null,
              score: msg.score || 0,
              crashed: msg.crashed || false
            }, playerId);
          }
          break;
        }

        case 'finishRace': {
          if (currentRoom && rooms[currentRoom]) {
            const time = msg.time || ((Date.now() - rooms[currentRoom].startTime) / 1000);
            if (time < 0 || time > 600) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid finish time' }));
              return;
            }
            const entry = { playerId, name: playerData.name, country: playerData.country, time, score: msg.score || 0, date: new Date() };

            if (!leaderboards[currentRoom]) leaderboards[currentRoom] = [];
            leaderboards[currentRoom].push(entry);
            leaderboards[currentRoom].sort((a, b) => a.time - b.time);
            leaderboards[currentRoom] = leaderboards[currentRoom].slice(0, 100); // cap at 100
            persistLeaderboards();

            broadcastToRoom(currentRoom, { type: 'playerFinished', playerId, name: playerData.name, time, score: msg.score || 0 });
            log('info', 'Player finished race', { playerId, time: time.toFixed(2), score: msg.score || 0 });
          }
          break;
        }

        case 'joinTournament': {
          const tid = msg.tournamentId || 'daily_race';
          if (!tournaments[tid]) tournaments[tid] = { id: tid, players: [], started: false, results: [] };

          tournamentId = tid;
          tournaments[tid].players.push(playerData);

          ws.send(JSON.stringify({ type: 'joinedTournament', tournamentId: tid, playerId }));
          broadcastToTournament(tid, { type: 'tournamentPlayerJoined', playerId, name: playerData.name }, playerId);
          break;
        }

        case 'submitTournamentTime': {
          if (tournamentId && tournaments[tournamentId]) {
            const t = tournaments[tournamentId];
            const entry = { playerId, name: playerData.name, country: playerData.country, time: msg.time, score: msg.score || 0 };
            t.results.push(entry);
            t.results.sort((a, b) => a.time - b.time);
            t.results = t.results.slice(0, 100);

            broadcastToTournament(tournamentId, { type: 'tournamentResult', entry });
          }
          break;
        }

        case 'ghost': {
          const ghostId = generateId('ghost');
          const ghostEntry = { playerId, name: playerData.name, country: playerData.country, data: msg.data, time: msg.time, date: new Date() };
          ghosts[ghostId] = ghostEntry;
          if (Object.keys(ghosts).length > 200) {
            const oldest = Object.keys(ghosts).sort((a, b) => new Date(ghosts[a].date) - new Date(ghosts[b].date))[0];
            delete ghosts[oldest];
          }
          persistGhosts();
          ws.send(JSON.stringify({ type: 'ghostSaved', ghostId }));
          break;
        }

        case 'trick': {
          if (currentRoom && rooms[currentRoom]) {
            broadcastToRoom(currentRoom, { type: 'trickPerformed', playerId, trick: msg.trick, score: msg.score }, playerId);
          }
          break;
        }

        case 'chat': {
          if (currentRoom && rooms[currentRoom]) {
            const message = (msg.message || '').slice(0, 200).replace(/[<>]/g, '');
            if (!message.trim()) return;
            broadcastToRoom(currentRoom, { type: 'chat', playerId, name: playerData.name, message });
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp, serverTime: Date.now() }));
          break;
        }

        case 'requestLeaderboard': {
          const roomId = msg.roomId || currentRoom || 'global';
          const entries = (leaderboards[roomId] || []).slice(0, 50);
          ws.send(JSON.stringify({ type: 'leaderboardData', roomId, entries }));
          break;
        }

        case 'requestGhosts': {
          const ghostList = Object.values(ghosts).slice(-20).reverse();
          ws.send(JSON.stringify({ type: 'ghostData', ghosts: ghostList }));
          break;
        }
      }
    } catch (err) {
      log('error', 'WS message error', { error: err.message, playerId });
    }
  });

  ws.on('close', () => {
    clearInterval(heartbeat);
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].players = rooms[currentRoom].players.filter(p => p.id !== playerId);
      broadcastToRoom(currentRoom, { type: 'playerLeft', playerId, name: playerData.name });
      if (rooms[currentRoom].players.length === 0) {
        delete rooms[currentRoom];
      }
      log('info', 'Player disconnected', { playerId, roomId: currentRoom });
    }
    if (tournamentId && tournaments[tournamentId]) {
      tournaments[tournamentId].players = tournaments[tournamentId].players.filter(p => p.id !== playerId);
    }
    delete players[playerId];
  });

  ws.on('error', (err) => {
    log('error', 'WebSocket error', { error: err.message, playerId });
  });

  ws.send(JSON.stringify({ type: 'connected', playerId }));
});

function broadcastToRoom(roomId, data, excludePlayerId) {
  if (!rooms[roomId]) return;
  rooms[roomId].players.forEach(p => {
    if (p.id !== excludePlayerId && p.ws && p.ws.readyState === WebSocket.OPEN) {
      try {
        p.ws.send(JSON.stringify(data));
      } catch (err) {
        log('error', 'Broadcast error', { error: err.message, targetPlayer: p.id });
      }
    }
  });
}

function broadcastToTournament(tournamentId, data, excludePlayerId) {
  if (!tournaments[tournamentId]) return;
  tournaments[tournamentId].players.forEach(p => {
    if (p.id !== excludePlayerId && p.ws && p.ws.readyState === WebSocket.OPEN) {
      try {
        p.ws.send(JSON.stringify(data));
      } catch (err) {
        log('error', 'Tournament broadcast error', { error: err.message });
      }
    }
  });
}

app.get('/api/leaderboard/:roomId?', (req, res) => {
  const roomId = req.params.roomId || 'global';
  const entries = (leaderboards[roomId] || []).slice(0, 50);
  res.json({ success: true, entries });
});

app.get('/api/leaderboard/global', (req, res) => {
  const allEntries = Object.values(leaderboards).flat().sort((a, b) => a.time - b.time).slice(0, 50);
  res.json({ success: true, entries: allEntries });
});

app.get('/api/tournaments/:tournamentId', (req, res) => {
  const t = tournaments[req.params.tournamentId];
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  res.json({ success: true, tournament: { id: t.id, playerCount: t.players.length, started: t.started, results: t.results.slice(0, 20) } });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Object.values(rooms).map(r => ({
    id: r.id,
    playerCount: r.players.length,
    state: r.state,
    maxPlayers: 4
  }));
  res.json({ success: true, rooms: roomList });
});

app.get('/api/ghosts', (req, res) => {
  const ghostList = Object.values(ghosts).slice(-20).reverse();
  res.json({ success: true, ghosts: ghostList });
});

app.get('/api/player/:playerId', (req, res) => {
  const p = players[req.params.playerId];
  if (!p) return res.status(404).json({ error: 'Player not found' });
  res.json({ success: true, player: { id: p.id, name: p.name, country: p.country, color: p.color } });
});

app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      players: Object.keys(players).length,
      rooms: Object.keys(rooms).length,
      tournaments: Object.keys(tournaments).length,
      totalRequests,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: Object.keys(players).length, rooms: Object.keys(rooms).length, uptime: process.uptime() });
});

// Custom tracks API
const TRACKS_FILE = path.join(DATA_DIR, 'tracks.json');
const customTracks = loadJson(TRACKS_FILE, {});

function persistTracks() {
  saveJson(TRACKS_FILE, customTracks);
}

app.post('/api/tracks', bodyParser.json({ limit: '2mb' }), (req, res) => {
  try {
    const { name, pieces, length } = req.body;
    if (!name || !pieces || !Array.isArray(pieces)) {
      return res.status(400).json({ error: 'Invalid track data' });
    }
    const trackId = generateId('track');
    const track = {
      id: trackId,
      name: String(name).slice(0, 50).replace(/[<>]/g, ''),
      pieces: pieces.slice(0, 100), // max 100 pieces
      length: Number(length) || 0,
      createdAt: new Date(),
      plays: 0,
      likes: 0
    };
    customTracks[trackId] = track;
    if (Object.keys(customTracks).length > 500) {
      const oldest = Object.keys(customTracks).sort((a, b) => new Date(customTracks[a].createdAt) - new Date(customTracks[b].createdAt))[0];
      delete customTracks[oldest];
    }
    persistTracks();
    res.json({ success: true, trackId, track });
  } catch (err) {
    log('error', 'Track save error', { error: err.message });
    res.status(500).json({ error: 'Failed to save track' });
  }
});

app.get('/api/tracks', (req, res) => {
  const trackList = Object.values(customTracks)
    .sort((a, b) => (b.plays || 0) - (a.plays || 0))
    .slice(0, 50)
    .map(t => ({ id: t.id, name: t.name, length: t.length, plays: t.plays, likes: t.likes, createdAt: t.createdAt }));
  res.json({ success: true, tracks: trackList });
});

app.get('/api/tracks/:trackId', (req, res) => {
  const track = customTracks[req.params.trackId];
  if (!track) return res.status(404).json({ error: 'Track not found' });
  track.plays = (track.plays || 0) + 1;
  persistTracks();
  res.json({ success: true, track });
});

app.post('/api/tracks/:trackId/like', (req, res) => {
  const track = customTracks[req.params.trackId];
  if (!track) return res.status(404).json({ error: 'Track not found' });
  track.likes = (track.likes || 0) + 1;
  persistTracks();
  res.json({ success: true, likes: track.likes });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log('info', `RideGlobal server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  persistLeaderboards();
  persistGhosts();
  server.close(() => {
    wss.clients.forEach(ws => ws.terminate());
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down gracefully');
  persistLeaderboards();
  persistGhosts();
  server.close(() => {
    wss.clients.forEach(ws => ws.terminate());
    process.exit(0);
  });
});
