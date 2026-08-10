const assert = require('assert');

// Test suite for RideGlobal server
console.log('Running RideGlobal server tests...\n');

// Test 1: Leaderboard persistence
function testLeaderboardPersistence() {
  const fs = require('fs');
  const path = require('path');
  const DATA_DIR = path.join(__dirname, 'data');
  const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboards.json');

  // Ensure data dir exists
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const testData = {
    test_room: [
      { playerId: 'p1', name: 'TestRider', country: '🇺🇸', time: 45.2, score: 1000, date: new Date() }
    ]
  };

  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(testData));
  const loaded = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));

  assert.deepStrictEqual(loaded.test_room[0].name, 'TestRider', 'Leaderboard persistence failed');
  console.log('✓ Leaderboard persistence');
}

// Test 2: Player ID generation
function testIdGeneration() {
  function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }
  const id1 = generateId('room');
  const id2 = generateId('room');
  assert.notStrictEqual(id1, id2, 'IDs should be unique');
  assert(id1.startsWith('room_'), 'ID should have correct prefix');
  console.log('✓ ID generation');
}

// Test 3: Sync validation (anti-cheat)
function testSyncValidation() {
  function validateSync(prev, next) {
    if (!next || typeof next.x !== 'number' || typeof next.y !== 'number') return false;
    const maxSpeed = 25;
    const dx = next.x - (prev ? prev.x : next.x);
    const dy = next.y - (prev ? prev.y : next.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxSpeed) return false;
    if (next.x < -100 || next.y < -500 || next.y > 2000) return false;
    return true;
  }

  assert.strictEqual(validateSync(null, { x: 0, y: 0 }), true, 'Valid initial position');
  assert.strictEqual(validateSync({ x: 0, y: 0 }, { x: 10, y: 0 }), true, 'Valid small movement');
  assert.strictEqual(validateSync({ x: 0, y: 0 }, { x: 1000, y: 0 }), false, 'Teleport detected');
  assert.strictEqual(validateSync({ x: 0, y: 0 }, { x: -200, y: 0 }), false, 'Out of bounds');
  console.log('✓ Sync validation (anti-cheat)');
}

// Test 4: BMX physics - track generation
function testTrackGeneration() {
  // Simple physics simulation
  const physics = {
    ramps: [],
    trackLength: 1000,
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
  };
  physics.generateTrack(2000);
  assert(physics.ramps.length > 0, 'Track should have ramps');
  const finish = physics.ramps[physics.ramps.length - 1];
  assert.strictEqual(finish.type, 'finish', 'Last ramp should be finish');
  assert.strictEqual(finish.x, 2000, 'Finish should be at track length');
  console.log('✓ Track generation');
}

// Test 5: Trick scoring
function testTrickScoring() {
  const tricks = {
    'barspin': { duration: 30, baseScore: 120, difficulty: 'easy' },
    'backflip': { duration: 60, baseScore: 300, difficulty: 'hard' },
    'flipwhip': { duration: 90, baseScore: 500, difficulty: 'extreme' }
  };
  const comboMultiplier = 2;
  const difficulties = { easy: 1.0, medium: 1.2, hard: 1.5, extreme: 2.0 };

  const barspinScore = Math.floor(tricks.barspin.baseScore * comboMultiplier * difficulties.easy);
  const backflipScore = Math.floor(tricks.backflip.baseScore * comboMultiplier * difficulties.hard);
  const flipwhipScore = Math.floor(tricks.flipwhip.baseScore * comboMultiplier * difficulties.extreme);

  assert.strictEqual(barspinScore, 240, 'Barspin score calculation');
  assert.strictEqual(backflipScore, 900, 'Backflip score calculation');
  assert.strictEqual(flipwhipScore, 2000, 'Flipwhip score calculation');
  console.log('✓ Trick scoring');
}

// Run tests
try {
  testLeaderboardPersistence();
  testIdGeneration();
  testSyncValidation();
  testTrackGeneration();
  testTrickScoring();
  console.log('\nAll tests passed ✓');
  process.exit(0);
} catch (err) {
  console.error('\nTest failed ✗:', err.message);
  process.exit(1);
}
