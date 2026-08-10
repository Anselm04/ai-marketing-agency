class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new Renderer(this.canvas);
    this.physics = new BMXPhysics();
    this.camera = new Camera();
    this.ui = new UI();

    this.state = 'title'; // title, lobby, racing, results
    this.raceStartTime = 0;
    this.raceFinished = false;
    this.score = 0;
    this.finishTime = 0;

    this.playerId = null;
    this.playerName = 'Rider';
    this.selectedCountry = '🇺🇸';
    this.selectedColor = '#FF0000';
    this.roomId = null;

    this.remotePlayers = new Map();
    this.results = [];
    this.input = { left: false, right: false, up: false, down: false, jump: false };
    this.keysDown = new Set();

    this.initInput();
    this.initNetwork();

    this.lastFrame = 0;
    this.animId = null;

    this.loop = this.loop.bind(this);
  }

  initInput() {
    document.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);

      switch (e.code) {
        case 'ArrowLeft': this.input.left = true; e.preventDefault(); break;
        case 'ArrowRight': this.input.right = true; e.preventDefault(); break;
        case 'ArrowUp': this.input.up = true; e.preventDefault(); break;
        case 'ArrowDown': this.input.down = true; e.preventDefault(); break;
        case 'Space': this.input.jump = true; e.preventDefault(); break;
        case 'Digit1': this.attemptTrick('barspin'); break;
        case 'Digit2': this.attemptTrick('tailwhip'); break;
        case 'Digit3': this.attemptTrick('superman'); break;
        case 'Digit4': this.attemptTrick('backflip'); break;
        case 'Digit5': this.attemptTrick('360'); break;
      }

      // Trick combo system
      const trick = trickSystem.handleInput(e.code, true);
      if (trick) this.attemptTrick(trick);
    });

    document.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
      switch (e.code) {
        case 'ArrowLeft': this.input.left = false; break;
        case 'ArrowRight': this.input.right = false; break;
        case 'ArrowUp': this.input.up = false; break;
        case 'ArrowDown': this.input.down = false; break;
        case 'Space': this.input.jump = false; break;
      }
    });
  }

  initNetwork() {
    network.onConnected = () => {
      console.log('Connected to server');
      this.playerId = network.playerId;
    };

    network.onDisconnected = () => {
      console.log('Disconnected from server');
      this.remotePlayers.clear();
    };

    network.onPlayerJoined = (player) => {
      if (player.id !== this.playerId) {
        this.remotePlayers.set(player.id, {
          id: player.id,
          name: player.name,
          country: player.country,
          color: player.color,
          physics: new BMXPhysics()
        });
      }
      this.updateLobbyUI();
    };

    network.onPlayerLeft = (playerId) => {
      this.remotePlayers.delete(playerId);
      this.updateLobbyUI();
    };

    network.onUpdate = (msg) => {
      const remote = this.remotePlayers.get(msg.playerId);
      if (remote && msg.position) {
        remote.physics.x = msg.position.x;
        remote.physics.y = msg.position.y;
        remote.physics.rotation = msg.rotation || 0;
        if (msg.trick) {
          this.renderer.addTrickPopup(remote.physics.x, remote.physics.y - 50, trickSystem.getTrickName(msg.trick), msg.score || 0);
        }
      }
    };

    network.onRaceStarted = (msg) => {
      this.startCountdown(msg.startTime);
    };

    network.onPlayerFinished = (msg) => {
      this.results.push({
        playerId: msg.playerId,
        name: msg.name,
        time: msg.time,
        score: msg.score
      });
      if (!this.raceFinished && this.results.length >= this.remotePlayers.size + 1) {
        this.endRace();
      }
    };

    network.onTrick = (msg) => {
      const remote = this.remotePlayers.get(msg.playerId);
      if (remote) {
        this.renderer.addTrickPopup(remote.physics.x, remote.physics.y - 50, trickSystem.getTrickName(msg.trick), msg.score || 0);
      }
    };

    network.onMessage = (msg) => {
      if (msg.type === 'joinedRoom') {
        this.roomId = msg.roomId;
        this.updateLobbyUI();
      }
    };

    network.connect();
  }

  updateLobbyUI() {
    const players = [];
    if (this.playerId) {
      players.push({ id: this.playerId, name: this.playerName, country: this.selectedCountry, color: this.selectedColor });
    }
    this.remotePlayers.forEach(p => players.push(p));
    this.ui.updateLobby(players);
  }

  startLobby() {
    const nameInput = document.getElementById('player-name');
    if (nameInput) this.playerName = nameInput.value || 'Rider';

    network.auth(this.playerName, this.selectedCountry, this.selectedColor);
    this.ui.showScreen('lobby');
    this.state = 'lobby';
    this.joinRoom();
  }

  joinRoom() {
    network.joinRoom();
  }

  startRace() {
    network.startRace();
  }

  startCountdown(serverStartTime) {
    this.ui.showScreen('race');
    this.state = 'countdown';

    this.physics.reset(0, this.physics.groundY);
    this.physics.generateTrack(8000);
    this.remotePlayers.forEach(p => p.physics.reset(0, this.physics.groundY));

    this.score = 0;
    this.raceFinished = false;
    this.finishTime = 0;
    this.results = [];

    const delay = Math.max(0, serverStartTime - Date.now());
    let countdown = 3;

    const tick = () => {
      if (countdown > 0) {
        this.ui.showCountdown(countdown.toString());
        countdown--;
        setTimeout(tick, 1000);
      } else {
        this.ui.showCountdown('GO!');
        setTimeout(() => this.ui.hideCountdown(), 500);
        this.state = 'racing';
        this.raceStartTime = Date.now();
      }
    };

    setTimeout(tick, delay);
  }

  attemptTrick(trickKey) {
    if (this.state !== 'racing') return;
    const result = this.physics.doTrick(trickKey);
    if (result) {
      this.score += result.score;
      this.renderer.addTrickPopup(this.physics.x, this.physics.y - 50, trickSystem.getTrickName(trickKey), result.score);
      this.renderer.drawParticle(this.physics.x, this.physics.y, '#00d4ff', 4);
      network.performTrick(trickKey, result.score);
    }
  }

  finishRace() {
    if (this.raceFinished) return;
    this.raceFinished = true;
    this.finishTime = (Date.now() - this.raceStartTime) / 1000;
    network.finishRace(this.finishTime, this.score);

    this.results.push({
      playerId: this.playerId,
      name: this.playerName,
      country: this.selectedCountry,
      time: this.finishTime,
      score: this.score
    });

    this.results.sort((a, b) => (a.time || Infinity) - (b.time || Infinity));
    this.ui.showResults(this.results);
    this.state = 'results';
  }

  endRace() {
    this.results.sort((a, b) => (a.time || Infinity) - (b.time || Infinity));
    this.ui.showResults(this.results);
    this.state = 'results';
  }

  restartRace() {
    this.startRace();
  }

  backToTitle() {
    this.ui.showScreen('title');
    this.state = 'title';
    this.remotePlayers.clear();
  }

  showLeaderboard() {
    fetch('/api/leaderboard/global')
      .then(r => r.json())
      .then(data => {
        this.ui.showGlobalLeaderboard(data.entries || []);
      })
      .catch(() => {
        this.ui.showGlobalLeaderboard([]);
      });
  }

  showControls() {
    this.ui.showScreen('controls');
  }

  update() {
    if (this.state === 'racing') {
      this.physics.update(this.input, 1);

      // Check finish
      if (this.physics.x >= this.physics.trackLength && !this.raceFinished) {
        this.finishRace();
      }

      // Send sync to server
      if (Date.now() % 50 < 16) { // ~20Hz sync
        network.sync(
          { x: this.physics.x, y: this.physics.y },
          this.physics.rotation,
          this.physics.trickState,
          this.score
        );
      }

      // Camera follow
      this.camera.follow(this.physics.x, this.physics.y, this.canvas.width, this.canvas.height);

      // Update HUD
      const timer = (Date.now() - this.raceStartTime) / 1000;
      const totalPlayers = this.remotePlayers.size + 1;
      const ahead = Array.from(this.remotePlayers.values()).filter(p => p.physics.x > this.physics.x).length;
      const position = ahead + 1;
      this.ui.updateHUD(timer, this.score, this.physics.vx, position, totalPlayers);
    }
  }

  render() {
    if (this.state === 'racing' || this.state === 'countdown') {
      const localPlayer = {
        name: this.playerName,
        country: this.selectedCountry,
        color: this.selectedColor
      };
      this.renderer.render(this.physics, this.camera, Array.from(this.remotePlayers.values()), localPlayer);
    }
  }

  loop(timestamp) {
    this.animId = requestAnimationFrame(this.loop);
    this.update();
    this.render();
  }

  start() {
    this.animId = requestAnimationFrame(this.loop);
  }
}

const game = new Game();
game.start();
