class BMXPhysics {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.angularVelocity = 0;
    this.grounded = false;
    this.onRamp = false;

    this.gravity = 0.6;
    this.friction = 0.92;
    this.airFriction = 0.98;
    this.groundFriction = 0.85;
    this.acceleration = 0.8;
    this.jumpForce = 14;
    this.maxSpeed = 12;
    this.maxAngularSpeed = 0.3;
    this.bikeWidth = 40;
    this.bikeHeight = 20;
    this.wheelRadius = 10;
    this.rampBoost = 1.5;

    this.trickState = null;
    this.trickTimer = 0;
    this.trickRotation = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;

    this.groundY = 0;
    this.ramps = [];
    this.trackLength = 8000;
  }

  reset(startX = 0, startY = 0) {
    this.x = startX;
    this.y = startY;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.angularVelocity = 0;
    this.grounded = true;
    this.onRamp = false;
    this.trickState = null;
    this.trickTimer = 0;
    this.trickRotation = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.groundY = startY;
  }

  generateTrack(length) {
    this.trackLength = length;
    this.ramps = [];
    let x = 400;
    while (x < length - 400) {
      const gap = 300 + Math.random() * 600;
      x += gap;
      if (x >= length - 400) break;
      const rampWidth = 80 + Math.random() * 120;
      const rampHeight = -60 - Math.random() * 100;
      this.ramps.push({ x, width: rampWidth, height: rampHeight, type: Math.random() > 0.7 ? 'quarter' : 'kicker' });
    }
    this.ramps.push({ x: length, width: 200, height: 0, type: 'finish' });
  }

  getGroundY(x) {
    const base = this.groundY + Math.sin(x * 0.002) * 15;

    for (const ramp of this.ramps) {
      if (x >= ramp.x && x <= ramp.x + ramp.width) {
        const t = (x - ramp.x) / ramp.width;
        if (ramp.type === 'quarter') {
          return base + Math.sin(t * Math.PI * 0.5) * ramp.height;
        } else if (ramp.type === 'kicker') {
          return base + Math.sin(t * Math.PI) * ramp.height * 0.5;
        } else if (ramp.type === 'finish') {
          return base;
        }
      }
    }
    return base;
  }

  getRampAngle(x) {
    for (const ramp of this.ramps) {
      if (x >= ramp.x && x <= ramp.x + ramp.width) {
        const t = (x - ramp.x) / ramp.width;
        if (t < 0.5) return -0.3;
        return 0.3;
      }
    }
    return 0;
  }

  update(input, dt = 1) {
    this.vy += this.gravity;

    if (input.left) {
      this.vx -= this.acceleration;
      if (this.grounded) this.angularVelocity -= 0.02;
    }
    if (input.right) {
      this.vx += this.acceleration;
      if (this.grounded) this.angularVelocity += 0.02;
    }

    if (input.jump && this.grounded) {
      this.vy = -this.jumpForce;
      this.grounded = false;
      this.onRamp = false;
    }

    if (!this.grounded) {
      if (input.up) this.angularVelocity -= 0.08;
      if (input.down) this.angularVelocity += 0.08;
      if (input.left) this.angularVelocity -= 0.05;
      if (input.right) this.angularVelocity += 0.05;
    }

    this.vx = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.vx));
    this.angularVelocity = Math.max(-this.maxAngularSpeed, Math.min(this.maxAngularSpeed, this.angularVelocity));

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;

    const groundY = this.getGroundY(this.x);
    const distToGround = this.y + this.wheelRadius - groundY;

    if (distToGround >= 0) {
      this.y = groundY - this.wheelRadius;
      this.vy = 0;
      this.grounded = true;
      this.onRamp = Math.abs(this.getRampAngle(this.x)) > 0.05;

      if (Math.abs(this.vx) < 0.1) this.vx = 0;
      else this.vx *= this.groundFriction;

      this.angularVelocity *= 0.8;
      this.rotation *= 0.9;

      if (this.onRamp && Math.abs(this.vx) > 2) {
        this.vx *= this.rampBoost;
        this.vy = -this.jumpForce * 0.6;
        this.grounded = false;
        this.onRamp = false;
      }
    } else {
      this.grounded = false;
      this.vx *= this.airFriction;
      this.angularVelocity *= 0.99;
    }

    this.x = Math.max(0, Math.min(this.trackLength, this.x));

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = 1;
      }
    }

    if (this.trickState) {
      this.trickTimer -= dt;
      this.trickRotation += this.angularVelocity * dt;
      if (this.trickTimer <= 0) {
        this.trickState = null;
        this.trickRotation = 0;
      }
    }
  }

  doTrick(trickName) {
    if (this.grounded) return null;
    if (this.trickState) return null;

    const tricks = {
      'tailwhip': { duration: 40, baseScore: 150 },
      'barspin': { duration: 30, baseScore: 120 },
      'superman': { duration: 50, baseScore: 200 },
      'backflip': { duration: 60, baseScore: 300 },
      '360': { duration: 45, baseScore: 180 },
    };

    const trick = tricks[trickName];
    if (!trick) return null;

    this.trickState = trickName;
    this.trickTimer = trick.duration;
    this.trickRotation = 0;

    this.comboMultiplier = Math.min(this.comboMultiplier + 0.5, 5);
    this.comboTimer = 120;

    const score = Math.floor(trick.baseScore * this.comboMultiplier);
    return { name: trickName, score, multiplier: this.comboMultiplier };
  }

  getState() {
    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      rotation: this.rotation,
      angularVelocity: this.angularVelocity,
      grounded: this.grounded,
      trickState: this.trickState,
      trickRotation: this.trickRotation,
      comboMultiplier: this.comboMultiplier
    };
  }
}

class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.smoothing = 0.08;
    this.zoom = 1;
  }

  follow(targetX, targetY, canvasWidth, canvasHeight) {
    this.targetX = targetX - canvasWidth / 2;
    this.targetY = targetY - canvasHeight / 2 + 100;

    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
  }

  apply(ctx) {
    ctx.translate(-this.x, -this.y);
  }
}
