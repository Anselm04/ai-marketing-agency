class TrickSystem {
  constructor() {
    this.keyCombo = [];
    this.comboWindow = 500;
    this.lastKeyTime = 0;
    this.trickMap = this.buildTrickMap();
    this.onTrick = null;
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
    };
    return desc[trickKey] || '';
  }
}

const trickSystem = new TrickSystem();
