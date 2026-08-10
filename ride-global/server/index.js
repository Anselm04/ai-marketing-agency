const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../client')));

const rooms = {};
const tournaments = {};
const players = {};
const leaderboards = {};
const ghosts = {};
let playerCounter = 0;

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

wss.on('connection', (ws) => {
  let playerId = `player_${playerCounter++}`;
  let currentRoom = null;
  let tournamentId = null;
  let playerData = { id: playerId, ws, country: '\ud83c\udf0d', color: '#FF0000', name: `Rider ${playerCounter}` };

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData);

      switch (msg.type) {
        case 'auth': {
          if (msg.name) playerData.name = msg.name;
          if (msg.country) playerData.country = msg.country;
          if (msg.color) playerData.color = msg.color;
          players[playerId] = playerData;
          ws.send(JSON.stringify({ type: 'auth', playerId, name: playerData.name }));
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
            broadcastToRoom(currentRoom, { type: 'playerLeft', playerId });
          }

          currentRoom = targetRoom;
          rooms[targetRoom].players.push(playerData);

          ws.send(JSON.stringify({ type: 'joinedRoom', roomId: targetRoom, playerId, players: rooms[targetRoom].players.map(p => ({ id: p.id, name: p.name, country: p.country, color: p.color })) }));
          broadcastToRoom(targetRoom, { type: 'playerJoined', player: { id: playerId, name: playerData.name, country: playerData.country, color: playerData.color } }, playerId);
          break;
        }

        case 'startRace': {
          if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players.length > 0) {
            rooms[currentRoom].state = 'racing';
            rooms[currentRoom].startTime = Date.now() + 3000;
            broadcastToRoom(currentRoom, { type: 'raceStarted', startTime: rooms[currentRoom].startTime });
          }
          break;
        }

        case 'sync': {
          if (currentRoom && rooms[currentRoom]) {
            broadcastToRoom(currentRoom, {
              type: 'update',
              playerId,
              position: msg.position,
              rotation: msg.rotation,
              trick: msg.trick || null,
              score: msg.score || 0
            }, playerId);
          }
          break;
        }

        case 'finishRace': {
          if (currentRoom && rooms[currentRoom]) {
            const time = msg.time || ((Date.now() - rooms[currentRoom].startTime) / 1000);
            const entry = { playerId, name: playerData.name, country: playerData.country, time, score: msg.score || 0, date: new Date() };

            if (!leaderboards[currentRoom]) leaderboards[currentRoom] = [];
            leaderboards[currentRoom].push(entry);
            leaderboards[currentRoom].sort((a, b) => a.time - b.time);

            broadcastToRoom(currentRoom, { type: 'playerFinished', playerId, name: playerData.name, time, score: msg.score || 0 });
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

            broadcastToTournament(tournamentId, { type: 'tournamentResult', entry });
          }
          break;
        }

        case 'ghost': {
          const ghostId = generateId('ghost');
          ghosts[ghostId] = { playerId, name: playerData.name, country: playerData.country, data: msg.data, time: msg.time, date: new Date() };
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
            broadcastToRoom(currentRoom, { type: 'chat', playerId, name: playerData.name, message: msg.message });
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
          break;
        }
      }
    } catch (err) {
      console.error('WS message error:', err.message);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].players = rooms[currentRoom].players.filter(p => p.id !== playerId);
      broadcastToRoom(currentRoom, { type: 'playerLeft', playerId });
      if (rooms[currentRoom].players.length === 0) {
        delete rooms[currentRoom];
      }
    }
    if (tournamentId && tournaments[tournamentId]) {
      tournaments[tournamentId].players = tournaments[tournamentId].players.filter(p => p.id !== playerId);
    }
    delete players[playerId];
  });

  ws.send(JSON.stringify({ type: 'connected', playerId }));
});

function broadcastToRoom(roomId, data, excludePlayerId) {
  if (!rooms[roomId]) return;
  rooms[roomId].players.forEach(p => {
    if (p.id !== excludePlayerId && p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(data));
    }
  });
}

function broadcastToTournament(tournamentId, data, excludePlayerId) {
  if (!tournaments[tournamentId]) return;
  tournaments[tournamentId].players.forEach(p => {
    if (p.id !== excludePlayerId && p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(data));
    }
  });
}

app.get('/api/leaderboard/:roomId?', (req, res) => {
  const roomId = req.params.roomId || 'global';
  const entries = leaderboards[roomId] || [];
  res.json({ success: true, entries: entries.slice(0, 50) });
});

app.get('/api/leaderboard/global', (req, res) => {
  const allEntries = Object.values(leaderboards).flat().sort((a, b) => a.time - b.time);
  res.json({ success: true, entries: allEntries.slice(0, 50) });
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: Object.keys(players).length, rooms: Object.keys(rooms).length, uptime: process.uptime() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`RideGlobal server running on port ${PORT}`);
});
