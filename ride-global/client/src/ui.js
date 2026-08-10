class UI {
  constructor() {
    this.overlay = document.getElementById('ui-overlay');
    this.screens = {};
    this.hud = {};
    this.activeScreen = null;
    this.initScreens();
  }

  initScreens() {
    this.createScreen('title', `
      <div class="ui-screen">
        <h1>RideGlobal</h1>
        <p>Multiplayer BMX Stunt Racing</p>
        <div class="color-picker" id="color-picker"></div>
        <input type="text" class="input" id="player-name" placeholder="Enter rider name" maxlength="16" value="Rider" />
        <div class="country-grid" id="country-grid"></div>
        <button class="btn btn-primary" onclick="game.startLobby()">Play</button>
        <button class="btn btn-secondary" onclick="game.showLeaderboard()">Leaderboard</button>
        <button class="btn btn-secondary" onclick="game.showControls()">Controls</button>
      </div>
    `);

    this.createScreen('lobby', `
      <div class="ui-screen" style="min-width: 400px;">
        <h2>Lobby</h2>
        <div id="lobby-players" style="width: 100%; min-height: 100px; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 12px;">
          <p style="color: #666;">Waiting for players...</p>
        </div>
        <div style="display: flex; gap: 8px; width: 100%;">
          <button class="btn btn-primary" onclick="game.startRace()">Start Race</button>
          <button class="btn btn-secondary" onclick="game.joinRoom()">Find Room</button>
          <button class="btn btn-danger" onclick="game.backToTitle()">Leave</button>
        </div>
      </div>
    `);

    this.createScreen('race', `
      <div class="ui-screen" style="background: none; border: none; box-shadow: none; padding: 0; width: 100%; height: 100%; max-width: none;">
        <div class="hud hud-top-left" id="hud-timer">Time: 0.00</div>
        <div class="hud hud-top-right" id="hud-score">Score: 0</div>
        <div class="hud hud-bottom-left" id="hud-speed">Speed: 0</div>
        <div class="hud hud-bottom-right" id="hud-position">1/4</div>
        <div class="hud" style="top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 4rem;" id="hud-countdown"></div>
      </div>
    `);

    this.createScreen('results', `
      <div class="ui-screen" style="min-width: 400px;">
        <h2>Race Results</h2>
        <table class="leaderboard-table" id="results-table">
          <thead><tr><th>Rank</th><th>Rider</th><th>Time</th><th>Score</th></tr></thead>
          <tbody></tbody>
        </table>
        <div style="display: flex; gap: 8px; width: 100%;">
          <button class="btn btn-primary" onclick="game.restartRace()">Race Again</button>
          <button class="btn btn-secondary" onclick="game.backToTitle()">Main Menu</button>
        </div>
      </div>
    `);

    this.createScreen('leaderboard', `
      <div class="ui-screen" style="min-width: 450px;">
        <h2>Global Leaderboard</h2>
        <table class="leaderboard-table" id="global-leaderboard">
          <thead><tr><th>Rank</th><th>Rider</th><th>Country</th><th>Time</th><th>Score</th></tr></thead>
          <tbody></tbody>
        </table>
        <button class="btn btn-secondary" onclick="game.backToTitle()">Back</button>
      </div>
    `);

    this.createScreen('controls', `
      <div class="ui-screen" style="min-width: 350px;">
        <h2>Controls</h2>
        <div style="width: 100%; text-align: left; color: #aaa; font-size: 0.9rem; line-height: 2;">
          <p><strong style="color:#fff;">Arrow Left/Right</strong> — Accelerate / Brake</p>
          <p><strong style="color:#fff;">Arrow Up</strong> — Lean back / Backflip prep</p>
          <p><strong style="color:#fff;">Arrow Down</strong> — Lean forward / Superman prep</p>
          <p><strong style="color:#fff;">Space</strong> — Jump</p>
          <p><strong style="color:#fff;">1</strong> — Barspin</p>
          <p><strong style="color:#fff;">2</strong> — Tailwhip</p>
          <p><strong style="color:#fff;">3</strong> — Superman</p>
          <p><strong style="color:#fff;">4</strong> — Backflip</p>
          <p><strong style="color:#fff;">5</strong> — 360 Spin</p>
          <p style="color:#888; font-size: 0.8rem; margin-top: 12px;">Perform tricks while airborne for combo multipliers!</p>
        </div>
        <button class="btn btn-secondary" onclick="game.backToTitle()">Back</button>
      </div>
    `);

    this.showScreen('title');
    this.populateTitleScreen();
  }

  createScreen(name, html) {
    const el = document.createElement('div');
    el.id = `screen-${name}`;
    el.innerHTML = html;
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.display = 'none';
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    this.overlay.appendChild(el);
    this.screens[name] = el;
  }

  showScreen(name) {
    if (this.activeScreen) {
      this.screens[this.activeScreen].style.display = 'none';
    }
    this.activeScreen = name;
    this.screens[name].style.display = 'flex';
  }

  hideScreen() {
    if (this.activeScreen) {
      this.screens[this.activeScreen].style.display = 'none';
      this.activeScreen = null;
    }
  }

  populateTitleScreen() {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FF6600', '#6600FF', '#FF006E', '#00D4FF'];
    const colorPicker = document.getElementById('color-picker');
    if (colorPicker) {
      colors.forEach((c, i) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch' + (i === 0 ? ' selected' : '');
        swatch.style.backgroundColor = c;
        swatch.onclick = () => {
          document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
          swatch.classList.add('selected');
          game.selectedColor = c;
        };
        colorPicker.appendChild(swatch);
      });
    }

    const countries = ['🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇯🇵', '🇧🇷', '🇦🇺', '🇨🇦', '🇮🇹', '🇪🇸', '🇳🇱', '🇰🇷', '🇲🇽', '🇷🇺', '🇨🇳', '🇮🇳'];
    const grid = document.getElementById('country-grid');
    if (grid) {
      countries.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'country-btn' + (i === 0 ? ' selected' : '');
        btn.textContent = c;
        btn.onclick = () => {
          document.querySelectorAll('.country-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          game.selectedCountry = c;
        };
        grid.appendChild(btn);
      });
    }
  }

  updateHUD(timer, score, speed, position, total) {
    const timerEl = document.getElementById('hud-timer');
    const scoreEl = document.getElementById('hud-score');
    const speedEl = document.getElementById('hud-speed');
    const posEl = document.getElementById('hud-position');
    if (timerEl) timerEl.textContent = `Time: ${timer.toFixed(2)}`;
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (speedEl) speedEl.textContent = `Speed: ${Math.abs(Math.round(speed))}`;
    if (posEl) posEl.textContent = `${position}/${total}`;
  }

  showCountdown(text) {
    const el = document.getElementById('hud-countdown');
    if (el) {
      el.textContent = text;
      el.style.animation = 'none';
      el.offsetHeight; // trigger reflow
      el.style.animation = 'pulse 0.5s ease-in-out';
    }
  }

  hideCountdown() {
    const el = document.getElementById('hud-countdown');
    if (el) el.textContent = '';
  }

  updateLobby(players) {
    const container = document.getElementById('lobby-players');
    if (!container) return;
    if (players.length === 0) {
      container.innerHTML = '<p style="color: #666;">Waiting for players...</p>';
      return;
    }
    container.innerHTML = players.map(p =>
      `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="color:${p.color || '#fff'};">●</span>
        <span>${p.country || '🌍'} ${p.name || 'Unknown'}</span>
        <span style="color:#666;margin-left:auto;font-size:0.8rem;">${p.id === game.playerId ? 'You' : ''}</span>
      </div>`
    ).join('');
  }

  showResults(results) {
    const tbody = document.querySelector('#results-table tbody');
    if (tbody) {
      tbody.innerHTML = results.map((r, i) =>
        `<tr>
          <td>${i + 1}</td>
          <td>${r.country || '🌍'} ${r.name || 'Unknown'}</td>
          <td>${r.time ? r.time.toFixed(2) + 's' : 'DNF'}</td>
          <td>${r.score || 0}</td>
        </tr>`
      ).join('');
    }
    this.showScreen('results');
  }

  showGlobalLeaderboard(entries) {
    const tbody = document.querySelector('#global-leaderboard tbody');
    if (tbody) {
      tbody.innerHTML = entries.slice(0, 20).map((e, i) =>
        `<tr>
          <td>${i + 1}</td>
          <td>${e.name || 'Unknown'}</td>
          <td>${e.country || '🌍'}</td>
          <td>${e.time ? e.time.toFixed(2) + 's' : '-'}</td>
          <td>${e.score || 0}</td>
        </tr>`
      ).join('');
    }
    this.showScreen('leaderboard');
  }
}
