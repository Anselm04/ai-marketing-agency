class AudioEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.masterGain = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.enginePlaying = false;
    this.engineSpeed = 0;
    this.sfxEnabled = true;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 0.4;
  }

  playTone(freq, duration, type = 'sine', volume = 0.3, startFreq = null, endFreq = null) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq || freq, this.ctx.currentTime);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playNoise(duration, volume = 0.3, filterFreq = 1000) {
    if (!this.ctx || this.muted) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  startEngine() {
    if (!this.ctx || this.muted || this.enginePlaying) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(80, this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();
    this.enginePlaying = true;
    this.engineFilter = filter;
  }

  updateEngine(speed) {
    if (!this.enginePlaying || !this.engineOsc) return;
    const targetFreq = 60 + Math.abs(speed) * 15;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(300 + Math.abs(speed) * 80, this.ctx.currentTime, 0.1);
    }
  }

  stopEngine() {
    if (!this.enginePlaying || !this.engineOsc) return;
    this.engineGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    this.engineOsc.stop(this.ctx.currentTime + 0.3);
    this.enginePlaying = false;
    this.engineOsc = null;
  }

  playJump() {
    this.playTone(200, 0.2, 'sine', 0.2, 200, 600);
    this.playNoise(0.15, 0.1, 2000);
  }

  playLanding(severity) {
    if (severity === 'perfect') {
      this.playTone(440, 0.15, 'sine', 0.3, 440, 880);
      this.playTone(660, 0.15, 'sine', 0.2, 660, 990);
    } else if (severity === 'crash') {
      this.playNoise(0.4, 0.4, 800);
      this.playTone(100, 0.3, 'square', 0.2, 100, 50);
    } else {
      this.playNoise(0.1, 0.15, 1500);
    }
  }

  playTrick(trickName) {
    const difficulty = trickSystem.getDifficulty(trickName);
    if (difficulty === 'extreme') {
      this.playTone(880, 0.3, 'sawtooth', 0.2, 440, 1320);
      this.playTone(660, 0.2, 'square', 0.15, 660, 990);
    } else if (difficulty === 'hard') {
      this.playTone(660, 0.25, 'sawtooth', 0.2, 330, 990);
    } else if (difficulty === 'medium') {
      this.playTone(550, 0.2, 'sine', 0.2, 275, 825);
    } else {
      this.playTone(440, 0.15, 'sine', 0.15, 220, 660);
    }
    this.playNoise(0.1, 0.05, 3000);
  }

  playCountdown(number) {
    if (number > 0) {
      this.playTone(440, 0.2, 'sine', 0.3);
    } else {
      this.playTone(880, 0.4, 'square', 0.3);
      this.playTone(440, 0.4, 'sine', 0.2);
    }
  }

  playMenuSelect() {
    this.playTone(660, 0.08, 'sine', 0.1);
  }

  playMenuConfirm() {
    this.playTone(880, 0.12, 'sine', 0.15, 660, 880);
  }

  playMenuBack() {
    this.playTone(330, 0.08, 'sine', 0.1);
  }

  playFinish() {
    this.playTone(523, 0.2, 'sine', 0.3);
    setTimeout(() => this.playTone(659, 0.2, 'sine', 0.3), 150);
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.3), 300);
    setTimeout(() => this.playTone(1047, 0.4, 'sine', 0.3), 450);
  }
}

const audio = new AudioEngine();
