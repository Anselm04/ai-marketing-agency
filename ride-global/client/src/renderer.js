class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.particles = [];
    this.trickPopups = [];
    this.trails = [];
    this.weather = 'clear';
    this.weatherIntensity = 0;
    this.weatherParticles = [];
    this.landingMessages = [];
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.timeOfDay = 0; // 0-1 cycle
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawSky() {
    const ctx = this.ctx;
    const timeColor = this.timeOfDay;
    const r1 = 10 + timeColor * 40;
    const g1 = 10 + timeColor * 80;
    const b1 = 26 + timeColor * 100;
    const r2 = 26 + timeColor * 60;
    const g2 = 26 + timeColor * 100;
    const b2 = 62 + timeColor * 120;

    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.6);
    gradient.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    gradient.addColorStop(1, `rgb(${r2},${g2},${b2})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.6);

    // Stars (fade out during day)
    ctx.fillStyle = '#fff';
    const starAlpha = Math.max(0, 1 - timeColor * 2);
    ctx.globalAlpha = starAlpha;
    for (let i = 0; i < 50; i++) {
      const x = (i * 137.5) % this.canvas.width;
      const y = (i * 73.3) % (this.canvas.height * 0.4);
      const size = 0.5 + (i % 3) * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawTrack(physics, camera) {
    const ctx = this.ctx;
    const startX = Math.floor(camera.x / 50) * 50 - 100;
    const endX = startX + (this.canvas.width / camera.zoom) + 200;

    // Ground
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(startX, physics.groundY + 200);
    for (let x = startX; x <= endX; x += 10) {
      const y = physics.getGroundY(x);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(endX, this.canvas.height + 200);
    ctx.lineTo(startX, this.canvas.height + 200);
    ctx.closePath();
    ctx.fill();

    // Track surface
    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 4 / camera.zoom;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += 10) {
      const y = physics.getGroundY(x);
      if (x === startX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Track markings
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.setLineDash([20, 40]);
    ctx.beginPath();
    for (let x = startX; x <= endX; x += 10) {
      const y = physics.getGroundY(x) - 3;
      if (x === startX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw ramps
    for (const ramp of physics.ramps) {
      if (ramp.x + ramp.width < camera.x - 100 || ramp.x > camera.x + (this.canvas.width / camera.zoom) + 100) continue;

      const rampY = physics.getGroundY(ramp.x);
      const endY = physics.getGroundY(ramp.x + ramp.width);

      ctx.fillStyle = ramp.type === 'finish' ? '#ff006e' : '#3a3a6e';
      ctx.beginPath();
      ctx.moveTo(ramp.x, rampY);
      if (ramp.type === 'quarter') {
        for (let t = 0; t <= 1; t += 0.05) {
          const rx = ramp.x + t * ramp.width;
          const ry = rampY + Math.sin(t * Math.PI * 0.5) * ramp.height;
          ctx.lineTo(rx, ry);
        }
      } else if (ramp.type === 'kicker') {
        for (let t = 0; t <= 1; t += 0.05) {
          const rx = ramp.x + t * ramp.width;
          const ry = rampY + Math.sin(t * Math.PI) * ramp.height * 0.5;
          ctx.lineTo(rx, ry);
        }
      } else {
        ctx.lineTo(ramp.x + ramp.width, endY);
      }
      ctx.lineTo(ramp.x + ramp.width, rampY + 100);
      ctx.lineTo(ramp.x, rampY + 100);
      ctx.closePath();
      ctx.fill();

      if (ramp.type === 'finish') {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${16 / camera.zoom}px sans-serif`;
        ctx.fillText('FINISH', ramp.x + ramp.width / 2 - 30, rampY - 20);
      }
    }

    // Start line
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(0, physics.groundY - 40, 10, 40);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${14 / camera.zoom}px sans-serif`;
    ctx.fillText('START', 20, physics.groundY - 50);
  }

  drawBike(physics, color, isLocal, name, country, crashed) {
    const ctx = this.ctx;
    const x = physics.x;
    const y = physics.y;
    const rot = crashed ? physics.rotation + Math.sin(physics.crashTimer * 0.2) * 0.5 : physics.rotation + (physics.trickRotation || 0);
    const w = physics.bikeWidth;
    const h = physics.bikeHeight;
    const r = physics.wheelRadius;

    ctx.save();
    ctx.translate(x, y);
    if (crashed) ctx.rotate(rot);
    else ctx.rotate(rot);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 25, w * 0.6, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (crashed) {
      // Crashed bike - scattered parts
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w/2, 0);
      ctx.lineTo(w/2, h/2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#999';
      ctx.fill();
      ctx.restore();
      return;
    }

    // Frame
    ctx.strokeStyle = color || '#ff006e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 4, -h);
    ctx.lineTo(w / 4, -h);
    ctx.lineTo(w / 2, 0);
    ctx.stroke();

    // Crossbar
    ctx.beginPath();
    ctx.moveTo(-w / 4, -h);
    ctx.lineTo(w / 4, -h * 0.6);
    ctx.stroke();

    // Handlebars
    ctx.beginPath();
    ctx.moveTo(w / 4, -h);
    ctx.lineTo(w / 4, -h - 10);
    ctx.lineTo(w / 4 + 8, -h - 12);
    ctx.stroke();

    // Seat
    ctx.beginPath();
    ctx.moveTo(-w / 4, -h);
    ctx.lineTo(-w / 4 - 6, -h - 4);
    ctx.stroke();

    // Rider (simplified)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-w / 6, -h - 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.strokeStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(-w / 6, -h - 6);
    ctx.lineTo(-w / 8, -h + 4);
    ctx.stroke();

    ctx.restore();

    // Wheels (always upright relative to ground, not rotated with bike)
    const wheelX = x;
    const wheelY = y + 10;

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#111';

    // Front wheel
    ctx.beginPath();
    ctx.arc(wheelX + w / 2, wheelY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Back wheel
    ctx.beginPath();
    ctx.arc(wheelX - w / 2, wheelY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spokes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    const spokeRot = (x * 0.1) % (Math.PI * 2);
    [-w / 2, w / 2].forEach(ox => {
      for (let i = 0; i < 4; i++) {
        const angle = spokeRot + (i * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(wheelX + ox, wheelY);
        ctx.lineTo(wheelX + ox + Math.cos(angle) * r, wheelY + Math.sin(angle) * r);
        ctx.stroke();
      }
    });

    // Name tag
    if (name) {
      ctx.fillStyle = isLocal ? '#00d4ff' : '#fff';
      ctx.font = 'bold 12px sans-serif';
      const label = `${country || ''} ${name}`;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, x - tw / 2, y - 50);
    }
  }

  drawTrail(physics, color) {
    if (!physics.grounded) return;
    if (Math.abs(physics.vx) < 1) return;
    this.trails.push({ x: physics.x, y: physics.y + 15, color, life: 20, alpha: 0.3 });
  }

  updateTrails() {
    this.trails = this.trails.filter(t => {
      t.life--;
      t.alpha *= 0.9;
      return t.life > 0;
    });
  }

  drawTrails() {
    const ctx = this.ctx;
    this.trails.forEach(t => {
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = t.color;
      ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
  }

  drawParticle(x, y, color, size) {
    this.particles.push({ x, y, color, size, life: 1, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 });
  }

  drawSparks(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        color: color || '#ffaa00',
        size: 1 + Math.random() * 2,
        life: 1,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2
      });
    }
  }

  updateParticles() {
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= 0.02;
      p.size *= 0.98;
      return p.life > 0;
    });
  }

  drawParticles() {
    const ctx = this.ctx;
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  addTrickPopup(x, y, text, score) {
    this.trickPopups.push({ x, y, text, score, life: 1, offsetY: 0 });
  }

  addLandingMessage(x, y, text, severity) {
    const color = severity === 'perfect' ? '#00ff66' : severity === 'crash' ? '#ff006e' : '#ffaa00';
    this.landingMessages.push({ x, y, text, color, life: 1.5, offsetY: 0 });
  }

  updateTrickPopups() {
    this.trickPopups = this.trickPopups.filter(p => {
      p.life -= 0.015;
      p.offsetY -= 1.5;
      return p.life > 0;
    });
  }

  updateLandingMessages() {
    this.landingMessages = this.landingMessages.filter(p => {
      p.life -= 0.01;
      p.offsetY -= 1;
      return p.life > 0;
    });
  }

  drawTrickPopups() {
    const ctx = this.ctx;
    this.trickPopups.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${p.text} +${p.score}`, p.x, p.y + p.offsetY);
      ctx.globalAlpha = 1;
    });
  }

  drawLandingMessages() {
    const ctx = this.ctx;
    this.landingMessages.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(p.text, p.x, p.y + p.offsetY);
      ctx.globalAlpha = 1;
    });
  }

  setWeather(type, intensity = 0.5) {
    this.weather = type;
    this.weatherIntensity = intensity;
    this.weatherParticles = [];
  }

  updateWeather() {
    if (this.weather === 'rain') {
      for (let i = 0; i < Math.floor(3 * this.weatherIntensity); i++) {
        this.weatherParticles.push({
          x: Math.random() * this.canvas.width,
          y: -10,
          vy: 8 + Math.random() * 6,
          vx: (Math.random() - 0.5) * 2,
          life: 1,
          type: 'rain'
        });
      }
    } else if (this.weather === 'snow') {
      for (let i = 0; i < Math.floor(2 * this.weatherIntensity); i++) {
        this.weatherParticles.push({
          x: Math.random() * this.canvas.width,
          y: -10,
          vy: 1 + Math.random() * 2,
          vx: (Math.random() - 0.5) * 1,
          life: 1,
          type: 'snow'
        });
      }
    }

    this.weatherParticles = this.weatherParticles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.005;
      return p.y < this.canvas.height + 10 && p.life > 0;
    });
  }

  drawWeather() {
    const ctx = this.ctx;
    this.weatherParticles.forEach(p => {
      ctx.globalAlpha = p.life * 0.4;
      if (p.type === 'rain') {
        ctx.strokeStyle = '#88aaff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx, p.y + 10);
        ctx.stroke();
      } else if (p.type === 'snow') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  drawMinimap(physics, remotePlayers, camera) {
    const ctx = this.ctx;
    const mmW = 200;
    const mmH = 40;
    const mmX = this.canvas.width - mmW - 20;
    const mmY = 20;
    const scale = mmW / physics.trackLength;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mmX, mmY, mmW, mmH, 4);
    ctx.fill();
    ctx.stroke();

    // Track line
    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mmX, mmY + mmH / 2);
    ctx.lineTo(mmX + mmW, mmY + mmH / 2);
    ctx.stroke();

    // Ramps on minimap
    for (const ramp of physics.ramps) {
      const rx = mmX + ramp.x * scale;
      if (ramp.type === 'finish') {
        ctx.fillStyle = '#ff006e';
        ctx.fillRect(rx - 2, mmY + 2, 4, mmH - 4);
      } else {
        ctx.fillStyle = '#3a3a6e';
        ctx.fillRect(rx, mmY + mmH / 2 - 3, ramp.width * scale, 6);
      }
    }

    // Players on minimap
    const drawPlayerDot = (x, color, isLocal) => {
      const px = mmX + x * scale;
      const py = mmY + mmH / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, isLocal ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (isLocal) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    drawPlayerDot(physics.x, game.selectedColor, true);
    if (remotePlayers) {
      remotePlayers.forEach(p => {
        drawPlayerDot(p.physics.x, p.color || '#fff', false);
      });
    }
  }

  drawFPS() {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 10, 60, 20);
    ctx.fillStyle = this.fps >= 55 ? '#00ff66' : this.fps >= 30 ? '#ffaa00' : '#ff006e';
    ctx.font = '11px monospace';
    ctx.fillText(`FPS: ${this.fps}`, 14, 24);
  }

  render(physics, camera, remotePlayers, localPlayer) {
    this.clear();
    this.drawSky();

    this.ctx.save();
    camera.apply(this.ctx);

    this.drawTrack(physics, camera);
    this.drawTrails();
    this.drawParticles();
    this.drawLandingMessages();

    // Draw remote players
    if (remotePlayers) {
      remotePlayers.forEach(p => {
        this.drawBike(p.physics, p.color, false, p.name, p.country, p.physics.crashed);
      });
    }

    // Draw local player
    this.drawBike(physics, localPlayer.color, true, localPlayer.name, localPlayer.country, physics.crashed);
    this.drawTrail(physics, localPlayer.color);

    this.drawTrickPopups();

    this.ctx.restore();

    this.drawWeather();
    this.drawMinimap(physics, remotePlayers, camera);
    this.drawFPS();
  }
}
