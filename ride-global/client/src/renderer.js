class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.particles = [];
    this.trickPopups = [];
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
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.6);
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.6);

    // Stars
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 50; i++) {
      const x = (i * 137.5) % this.canvas.width;
      const y = (i * 73.3) % (this.canvas.height * 0.4);
      const size = 0.5 + (i % 3) * 0.5;
      ctx.globalAlpha = 0.3 + (i % 5) * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawTrack(physics, camera) {
    const ctx = this.ctx;
    const startX = Math.floor(camera.x / 50) * 50;
    const endX = startX + this.canvas.width + 100;

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
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += 10) {
      const y = physics.getGroundY(x);
      if (x === startX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Track markings
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
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
      if (ramp.x + ramp.width < camera.x - 100 || ramp.x > camera.x + this.canvas.width + 100) continue;

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
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('FINISH', ramp.x + ramp.width / 2 - 30, rampY - 20);
      }
    }

    // Start line
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(0, physics.groundY - 40, 10, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('START', 20, physics.groundY - 50);
  }

  drawBike(physics, color, isLocal, name, country) {
    const ctx = this.ctx;
    const x = physics.x;
    const y = physics.y;
    const rot = physics.rotation + (physics.trickRotation || 0);
    const w = physics.bikeWidth;
    const h = physics.bikeHeight;
    const r = physics.wheelRadius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 25, w * 0.6, 5, 0, 0, Math.PI * 2);
    ctx.fill();

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

  drawParticle(x, y, color, size) {
    this.particles.push({ x, y, color, size, life: 1, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 });
  }

  updateParticles() {
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
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

  updateTrickPopups() {
    this.trickPopups = this.trickPopups.filter(p => {
      p.life -= 0.015;
      p.offsetY -= 1.5;
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

  render(physics, camera, remotePlayers, localPlayer) {
    this.clear();
    this.drawSky();

    this.ctx.save();
    camera.apply(this.ctx);

    this.drawTrack(physics, camera);

    // Draw remote players
    if (remotePlayers) {
      remotePlayers.forEach(p => {
        this.drawBike(p.physics, p.color, false, p.name, p.country);
      });
    }

    // Draw local player
    this.drawBike(physics, localPlayer.color, true, localPlayer.name, localPlayer.country);

    this.updateParticles();
    this.drawParticles();
    this.updateTrickPopups();
    this.drawTrickPopups();

    this.ctx.restore();
  }
}
