class NetworkManager {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.playerId = null;
    this.roomId = null;
    this.onMessage = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onUpdate = null;
    this.onRaceStarted = null;
    this.onPlayerFinished = null;
    this.onTrick = null;
    this.onChat = null;
    this.reconnectAttempts = 0;
    this.maxReconnect = 5;
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('Connected to RideGlobal server');
      if (this.onConnected) this.onConnected();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('Invalid message:', err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      console.log('Disconnected from server');
      if (this.onDisconnected) this.onDisconnected();
      if (this.reconnectAttempts < this.maxReconnect) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'connected':
        this.playerId = msg.playerId;
        break;
      case 'auth':
        this.playerId = msg.playerId;
        break;
      case 'joinedRoom':
        this.roomId = msg.roomId;
        if (this.onMessage) this.onMessage(msg);
        break;
      case 'playerJoined':
        if (this.onPlayerJoined) this.onPlayerJoined(msg.player);
        break;
      case 'playerLeft':
        if (this.onPlayerLeft) this.onPlayerLeft(msg.playerId);
        break;
      case 'update':
        if (this.onUpdate) this.onUpdate(msg);
        break;
      case 'raceStarted':
        if (this.onRaceStarted) this.onRaceStarted(msg);
        break;
      case 'playerFinished':
        if (this.onPlayerFinished) this.onPlayerFinished(msg);
        break;
      case 'trickPerformed':
        if (this.onTrick) this.onTrick(msg);
        break;
      case 'chat':
        if (this.onChat) this.onChat(msg);
        break;
      case 'pong':
        break;
      default:
        if (this.onMessage) this.onMessage(msg);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  auth(name, country, color) {
    this.send({ type: 'auth', name, country, color });
  }

  joinRoom(roomId) {
    this.send({ type: 'joinRoom', roomId });
  }

  startRace() {
    this.send({ type: 'startRace' });
  }

  sync(position, rotation, trick, score) {
    this.send({ type: 'sync', position, rotation, trick, score });
  }

  finishRace(time, score) {
    this.send({ type: 'finishRace', time, score });
  }

  performTrick(trick, score) {
    this.send({ type: 'trick', trick, score });
  }

  sendChat(message) {
    this.send({ type: 'chat', message });
  }

  joinTournament(tournamentId) {
    this.send({ type: 'joinTournament', tournamentId });
  }

  submitTournamentTime(time, score) {
    this.send({ type: 'submitTournamentTime', time, score });
  }

  sendGhost(data, time) {
    this.send({ type: 'ghost', data, time });
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}

const network = new NetworkManager();
