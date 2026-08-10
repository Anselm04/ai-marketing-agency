class TrickSystem {
  constructor() {
    this.keyCombo = [];
    this.comboWindow = 500;
    this.lastKeyTime = 0;
    this.trickMap = this.buildTrickMap();
    this.onTrick = null;
    this.difficulties = { easy: 1.0, medium: 1.2, hard: 1.5, extreme: 2.0 };
  }

  buildTrickMap() {
    return {
      'ArrowUp+ArrowUp': 'backflip',
      'ArrowDown+ArrowDown': 'superman',
      'ArrowLeft+ArrowLeft': '360',
      'ArrowRight+ArrowRight': 'tailwhip',
      '1': 'barspin',
      '2': 'tailwhip',
      '3': 'superman',
      '4': 'backflip',
      '5': '360',
      '6': 'invert',
      '7': 'doubletailwhip',
      '8': 'tucknohander',
      '9': 'whiplash',
      '0': 'flipwhip',
    };
  }

  handleInput(key, isDown) {
    if (!isDown) return null;

    const now = Date.now();
    if (now - this.lastKeyTime > this.comboWindow) {
      this.keyCombo = [];
    }
    this.lastKeyTime = now;

    this.keyCombo.push(key);
    if (this.keyCombo.length > 2) this.keyCombo.shift();

    const combo = this.keyCombo.join('+');
    const trick = this.trickMap[combo] || this.trickMap[key];

    if (trick) {
      this.keyCombo = [];
      return trick;
    }
    return null;
  }

  getTrickName(trickKey) {
    const names = {
      'tailwhip': 'Tailwhip',
      'barspin': 'Barspin',
      'superman': 'Superman',
      'backflip': 'Backflip',
      '360': '360 Spin',
      'invert': 'Invert',
      'doubletailwhip': 'Double Tailwhip',
      'tucknohander': 'Tuck No-Hander',
      'whiplash': 'Whiplash',
      'flipwhip': 'Flipwhip',
    };
    return names[trickKey] || trickKey;
  }

  getTrickDescription(trickKey) {
    const desc = {
      'tailwhip': 'Spin the bike frame beneath you!',
      'barspin': 'Spin the handlebars 360!',
      'superman': 'Extend like Superman mid-air!',
      'backflip': 'Full backward rotation!',
      '360': 'Complete 360 spin!',
      'invert': 'Invert your body while airborne!',
      'doubletailwhip': 'Two tailwhips in one jump!',
      'tucknohander': 'Tuck in and let go!',
      'whiplash': 'The ultimate combo trick!',
      'flipwhip': 'Backflip + tailwhip combo!',
    };
    return desc[trickKey] || '';
  }

  getDifficulty(trickKey) {
    const difficulties = {
      'barspin': 'easy',
      'tailwhip': 'easy',
      'superman': 'medium',
      'backflip': 'hard',
      '360': 'medium',
      'invert': 'hard',
      'doubletailwhip': 'hard',
      'tucknohander': 'medium',
      'whiplash': 'extreme',
      'flipwhip': 'extreme',
    };
    return difficulties[trickKey] || 'easy';
  }

  getDifficultyMultiplier(difficulty) {
    return this.difficulties[difficulty] || 1.0;
  }
}

const trickSystem = new TrickSystem();
