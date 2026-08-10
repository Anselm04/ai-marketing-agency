class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new Renderer(this.canvas);
    this.physics = new BMXPhysics();
    this.camera = new Camera();
    this.ui = new UI();
    this.audio = audio;

    this.state = 'loading'; // loading, title, lobby, racing, results
    this.raceStartTime = 0;
    this.raceFinished = false;
    this.score = 0;
    this.finishTime = 0;
    this.singlePlayerMode = false;
    this.timeTrialMode = false;
    this.bestTimeTrial = Infinity;
    this.ghostData = [];
    this.recordingGhost = false;

    this.playerId = null;
    this.playerName = 'Rider';
    this.selectedCountry = '🇺🇸';
    this.selectedColor = '#FF0000';
    this.roomId = null;

    this.remotePlayers = new Map();
    this.results = [];
    this.input = { left: false, right: false, up: false, down: false, jump: false };
    this.keysDown = new Set();

    this.mobileInput = { left: false, right: false, up: false, down: false, jump: false };
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.initInput();
    this.initMobileInput();
    this.initNetwork();
    this.initPreloader();

    this.lastFrame = 0;
    this.animId = null;
    this.loop = this.loop.bind(this);
  }

  initPreloader() {
    this.ui.showScreen('preloader');
    setTimeout(() => {
      this.audio.init();
      this.ui.showScreen('title');
      this.state = 'title';
      this.audio.playMenuSelect();
    }, 1500);
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
        case 'Digit6': this.attemptTrick('invert'); break;
        case 'Digit7': this.attemptTrick('doubletailwhip'); break;
        case 'Digit8': this.attemptTrick('tucknohander'); break;
        case 'Digit9': this.attemptTrick('whiplash'); break;
        case 'Digit0': this.attemptTrick('flipwhip'); break;
        case 'KeyC': this.toggleChat(); break;
        case 'KeyM': this.audio.setMuted(!this.audio.muted); break;
      }

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

    document.addEventListener('keydown', (e) => {
      if (this.state === 'title' && e.code === 'Enter') {
        this.audio.playMenuConfirm();
        this.startLobby();
      }
    });
  }

  initMobileInput() {
    if (!this.isMobile) {
      document.getElementById('mobile-controls')?.classList.add('hidden');
      return;
    }

    const touchBtn = (id, inputKey) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.mobileInput[inputKey] = true; el.classList.add('active'); });
      el.addEventListener('touchend', (e) => { e.preventDefault(); this.mobileInput[inputKey] = false; el.classList.remove('active'); });
      el.addEventListener('touchcancel', (e) => { e.preventDefault(); this.mobileInput[inputKey] = false; el.classList.remove('active'); });
    };

    touchBtn('mobile-left', 'left');
    touchBtn('mobile-right', 'right');
    touchBtn('mobile-up', 'up');
    touchBtn('mobile-down', 'down');
    touchBtn('mobile-jump', 'jump');

    const trickBtns = [
      { id: 'mobile-trick-1', trick: 'barspin' },
      { id: 'mobile-trick-2', trick: 'tailwhip' },
      { id: 'mobile-trick-3', trick: 'superman' },
    ];
    trickBtns.forEach(({ id, trick }) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        el.classList.add('active');
        this.attemptTrick(trick);
      });
      el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('active'); });
    });

    document.getElementById('mobile-controls')?.classList.remove('hidden');
  }

  getCombinedInput() {
    return {
      left: this.input.left || this.mobileInput.left,
      right: this.input.right || this.mobileInput.right,
      up: this.input.up || this.mobileInput.up,
      down: this.input.down || this.mobileInput.down,
      jump: this.input.jump || this.mobileInput.jump
    };
  }

  toggleChat() {
    if (this.state === 'racing' || this.state === 'countdown') {
      this.ui.toggleChat();
    }
  }

  sendChatMessage(msg) {
    if (!msg.trim()) return;
    network.sendChat(msg.trim());
  }

  initNetwork() {
    network.onConnected = () => {
      this.playerId = network.playerId;
    };

    network.onDisconnected = () => {
      this.remotePlayers.clear();
      if (!this.singlePlayerMode) {
        this.ui.showNotification('Disconnected from server', 'error');
      }
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

    network.onPlayerLeft = (data) => {
      this.remotePlayers.delete(data.playerId);
      this.ui.showNotification(`${data.name || 'A player'} left`, 'info');
      this.updateLobbyUI();
    };

    network.onUpdate = (msg) => {
      const remote = this.remotePlayers.get(msg.playerId);
      if (remote && msg.position) {
        remote.physics.x = msg.position.x;
        remote.physics.y = msg.position.y;
        remote.physics.rotation = msg.rotation || 0;
        remote.physics.crashed = msg.crashed || false;
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

    network.onChat = (msg) => {
      this.ui.addChatMessage(msg.name, msg.message, msg.playerId === this.playerId);
    };

    network.onMessage = (msg) => {
      if (msg.type === 'joinedRoom') {
        this.roomId = msg.roomId;
        this.updateLobbyUI();
      }
      if (msg.type === 'error') {
        this.ui.showNotification(msg.message, 'error');
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
    this.audio.playMenuConfirm();
    this.audio.init();
    this.audio.resume();
    network.auth(this.playerName, this.selectedCountry, this.selectedColor);
    this.ui.showScreen('lobby');
    this.state = 'lobby';
    this.joinRoom();
  }

  startSinglePlayer() {
    const nameInput = document.getElementById('player-name');
    if (nameInput) this.playerName = nameInput.value || 'Rider';
    this.audio.playMenuConfirm();
    this.audio.init();
    this.audio.resume();
    this.singlePlayerMode = true;
    this.startRaceLocal();
  }

  startTimeTrial() {
    const nameInput = document.getElementById('player-name');
    if (nameInput) this.playerName = nameInput.value || 'Rider';
    this.audio.playMenuConfirm();
    this.audio.init();
    this.audio.resume();
    this.timeTrialMode = true;
    this.singlePlayerMode = true;
    this.startRaceLocal();
  }

  joinRoom() {
    network.joinRoom();
  }

  startRace() {
    network.startRace();
  }

  startRaceLocal() {
    this.ui.showScreen('race');
    this.state = 'countdown';
    this.singlePlayerMode = true;
    this.physics.reset(0, this.physics.groundY);
    this.physics.generateTrack(8000);
    this.score = 0;
    this.raceFinished = false;
    this.finishTime = 0;
    this.results = [];
    this.recordingGhost = true;
    this.ghostData = [];

    let countdown = 3;
    const tick = () => {
      if (countdown > 0) {
        this.audio.playCountdown(countdown);
        this.ui.showCountdown(countdown.toString());
        countdown--;
        setTimeout(tick, 1000);
      } else {
        this.audio.playCountdown(0);
        this.ui.showCountdown('GO!');
        setTimeout(() => this.ui.hideCountdown(), 500);
        this.state = 'racing';
        this.raceStartTime = Date.now();
        this.audio.startEngine();
      }
    };
    tick();
  }

  startCountdown(serverStartTime) {
    this.ui.showScreen('race');
    this.state = 'countdown';
    this.singlePlayerMode = false;
    this.physics.reset(0, this.physics.groundY);
    this.physics.generateTrack(8000);
    this.remotePlayers.forEach(p => p.physics.reset(0, this.physics.groundY));
    this.score = 0;
    this.raceFinished = false;
    this.finishTime = 0;
    this.results = [];
    this.recordingGhost = true;
    this.ghostData = [];

    const delay = Math.max(0, serverStartTime - Date.now());
    let countdown = 3;

    const tick = () => {
      if (countdown > 0) {
        this.audio.playCountdown(countdown);
        this.ui.showCountdown(countdown.toString());
        countdown--;
        setTimeout(tick, 1000);
      } else {
        this.audio.playCountdown(0);
        this.ui.showCountdown('GO!');
        setTimeout(() => this.ui.hideCountdown(), 500);
        this.state = 'racing';
        this.raceStartTime = Date.now();
        this.audio.startEngine();
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
      this.renderer.drawSparks(this.physics.x, this.physics.y, '#00d4ff', 6);
      this.audio.playTrick(trickKey);
      if (!this.singlePlayerMode) {
        network.performTrick(trickKey, result.score);
      }
    }
  }

  finishRace() {
    if (this.raceFinished) return;
    this.raceFinished = true;
    this.finishTime = (Date.now() - this.raceStartTime) / 1000;
    this.audio.stopEngine();
    this.audio.playFinish();
    this.recordingGhost = false;

    if (!this.singlePlayerMode) {
      network.finishRace(this.finishTime, this.score);
    }

    this.results.push({
      playerId: this.playerId,
      name: this.playerName,
      country: this.selectedCountry,
      time: this.finishTime,
      score: this.score
    });

    if (this.timeTrialMode) {
      if (this.finishTime < this.bestTimeTrial) {
        this.bestTimeTrial = this.finishTime;
        this.ui.showNotification(`New best time: ${this.finishTime.toFixed(2)}s!`, 'success');
      }
    }

    this.results.sort((a, b) => (a.time || Infinity) - (b.time || Infinity));
    this.ui.showResults(this.results);
    this.state = 'results';
  }

  endRace() {
    this.results.sort((a, b) => (a.time || Infinity) - (b.time || Infinity));
    this.ui.showResults(this.results);
    this.state = 'results';
    this.audio.stopEngine();
  }

  restartRace() {
    if (this.singlePlayerMode) {
      this.startRaceLocal();
    } else {
      this.startRace();
    }
  }

  backToTitle() {
    this.audio.playMenuBack();
    this.ui.showScreen('title');
    this.state = 'title';
    this.remotePlayers.clear();
    this.singlePlayerMode = false;
    this.timeTrialMode = false;
    this.audio.stopEngine();
  }

  showLeaderboard() {
    this.audio.playMenuSelect();
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
    this.audio.playMenuSelect();
    this.ui.showScreen('controls');
  }

  showTrackEditor() {
    this.audio.playMenuSelect();
    if (!trackEditorUI) {
      trackEditorUI = new TrackConnectorUI(trackEditor);
      trackEditorUI.ui = this.ui;
      trackEditorUI.createUI();
    }
    trackEditorUI.show();
  }

  loadCustomTrack(trackData) {
    this.audio.playMenuConfirm();
    this.ui.showScreen('race');
    this.state = 'countdown';
    this.singlePlayerMode = true;
    this.physics.reset(0, this.physics.groundY);
    this.physics.trackLength = trackData.length;
    this.physics.ramps = trackData.ramps.map(r => ({
      x: r.x,
      width: r.width,
      height: r.height,
      type: r.type
    }));
    this.score = 0;
    this.raceFinished = false;
    this.finishTime = 0;
    this.results = [];
    this.recordingGhost = true;
    this.ghostData = [];

    let countdown = 3;
    const tick = () => {
      if (countdown > 0) {
        this.audio.playCountdown(countdown);
        this.ui.showCountdown(countdown.toString());
        countdown--;
        setTimeout(tick, 1000);
      } else {
        this.audio.playCountdown(0);
        this.ui.showCountdown('GO!');
        setTimeout(() => this.ui.hideCountdown(), 500);
        this.state = 'racing';
        this.raceStartTime = Date.now();
        this.audio.startEngine();
      }
    };
    tick();
  }

  update() {
    if (this.state === 'racing') {
      const input = this.getCombinedInput();
      const prevGrounded = this.physics.grounded;
      const prevCrashed = this.physics.crashed;
      this.physics.update(input, 1);
      this.audio.updateEngine(this.physics.vx);

      // Landing detection
      if (!prevGrounded && this.physics.grounded) {
        const landing = this.physics.checkLanding();
        this.score += landing.score;
        if (landing.score !== 0) {
          this.renderer.addLandingMessage(this.physics.x, this.physics.y - 40, landing.message, landing.severity);
        }
        this.audio.playLanding(landing.severity);
        if (landing.severity === 'crash') {
          this.camera.shake(12);
          this.renderer.drawSparks(this.physics.x, this.physics.y + 10, '#ff6600', 12);
        } else if (landing.severity === 'perfect') {
          this.camera.shake(4);
          this.renderer.drawSparks(this.physics.x, this.physics.y + 10, '#00ff66', 8);
        }
      }

      // Jump detection
      if (prevGrounded && !this.physics.grounded && !prevCrashed) {
        this.audio.playJump();
      }

      // Record ghost
      if (this.recordingGhost && this.state === 'racing') {
        this.ghostData.push({
          x: this.physics.x,
          y: this.physics.y,
          rotation: this.physics.rotation,
          time: (Date.now() - this.raceStartTime) / 1000
        });
      }

      // Check finish
      if (this.physics.x >= this.physics.trackLength && !this.raceFinished) {
        this.finishRace();
      }

      // Player collisions
      this.remotePlayers.forEach(p => {
        this.physics.checkCollision(p.physics);
      });

      // Send sync to server
      if (!this.singlePlayerMode && Date.now() % 50 < 16) {
        network.sync(
          { x: this.physics.x, y: this.physics.y },
          this.physics.rotation,
          this.physics.trickState,
          this.score
        );
      }

      // Camera follow
      this.camera.follow(this.physics.x, this.physics.y, this.physics.vx, this.canvas.width, this.canvas.height);

      // Update HUD
      const timer = (Date.now() - this.raceStartTime) / 1000;
      const totalPlayers = this.remotePlayers.size + 1;
      const ahead = Array.from(this.remotePlayers.values()).filter(p => p.physics.x > this.physics.x).length;
      const position = ahead + 1;
      this.ui.updateHUD(timer, this.score, this.physics.vx, position, totalPlayers, this.physics.comboMultiplier);
    }

    // Update weather
    this.renderer.updateWeather();
    this.renderer.timeOfDay = ((Date.now() / 1000) % 60) / 60; // 60-second day cycle
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
