class TrackEditor {
  constructor() {
    this.pieces = [];
    this.selectedPiece = null;
    this.previewCanvas = null;
    this.previewCtx = null;
    this.trackName = 'Untitled Track';
    this.savedTracks = JSON.parse(localStorage.getItem('rideglobal_tracks') || '[]');
  }

  // Connector piece definitions - each piece has entry and exit "sockets"
  // that define how pieces connect together
  static PIECE_TYPES = {
    straight: { name: 'Straight', length: 300, height: 0, color: '#2a2a4e', icon: '─' },
    start_line: { name: 'Start Line', length: 150, height: 0, color: '#00d4ff', icon: '⚑' },
    finish_line: { name: 'Finish Line', length: 200, height: 0, color: '#ff006e', icon: '🏁' },
    small_ramp: { name: 'Small Ramp', length: 100, height: -60, color: '#3a3a6e', icon: '╱' },
    big_ramp: { name: 'Big Ramp', length: 150, height: -100, color: '#4a4a7e', icon: '╱' },
    kicker: { name: 'Kicker', length: 80, height: -80, color: '#5a5a8e', icon: '∧' },
    quarter_pipe: { name: 'Quarter Pipe', length: 120, height: -120, color: '#6a6a9e', icon: '∩' },
    gap: { name: 'Gap', length: 200, height: 0, gap: true, color: '#ff6600', icon: ' ' },
    downhill: { name: 'Downhill', length: 250, height: 50, color: '#1a3a5e', icon: '╲' },
    uphill: { name: 'Uphill', length: 250, height: -50, color: '#3a1a5e', icon: '╱' },
    loop: { name: 'Loop', length: 300, height: -150, loop: true, color: '#ff00ff', icon: '○' },
  };

  static getPieceDef(type) {
    return TrackEditor.PIECE_TYPES[type] || TrackEditor.PIECE_TYPES.straight;
  }

  // Calculate the cumulative position and height of each piece
  // This is the "connector" logic - each piece's start position is the
  // previous piece's end position
  buildConnectorChain() {
    let currentX = 0;
    let currentY = 0;
    const chain = [];

    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];
      const def = TrackEditor.getPieceDef(piece.type);

      const startX = currentX;
      const startY = currentY;
      const endX = currentX + def.length;
      const endY = currentY + def.height;

      chain.push({
        index: i,
        type: piece.type,
        def: def,
        startX, startY, endX, endY,
        // Socket positions for connector logic
        entrySocket: { x: startX, y: startY },
        exitSocket: { x: endX, y: endY }
      });

      currentX = endX;
      currentY = endY;

      // Add gap after pieces that have gaps
      if (def.gap) {
        currentX += 100;
      }
    }

    return chain;
  }

  addPiece(type) {
    const def = TrackEditor.getPieceDef(type);
    this.pieces.push({ type, id: `piece_${Date.now()}_${Math.floor(Math.random() * 1000)}` });
  }

  removePiece(index) {
    this.pieces.splice(index, 1);
  }

  movePiece(fromIndex, toIndex) {
    const piece = this.pieces.splice(fromIndex, 1)[0];
    this.pieces.splice(toIndex, 0, piece);
  }

  clear() {
    this.pieces = [];
  }

  getTrackData() {
    const chain = this.buildConnectorChain();
    const totalLength = chain.length > 0 ? chain[chain.length - 1].endX : 0;
    const ramps = chain.map(c => ({
      x: c.startX,
      width: c.def.length,
      height: c.def.height,
      type: c.type === 'quarter_pipe' ? 'quarter' : c.type === 'kicker' ? 'kicker' : c.type === 'finish_line' ? 'finish' : 'straight'
    })).filter(r => r.type !== 'straight');

    return {
      name: this.trackName,
      length: totalLength,
      pieces: this.pieces,
      ramps: ramps
    };
  }

  loadTrackData(data) {
    if (data.pieces) this.pieces = data.pieces;
    if (data.name) this.trackName = data.name;
  }

  saveToLocalStorage() {
    const data = this.getTrackData();
    const existing = this.savedTracks.findIndex(t => t.name === data.name);
    if (existing >= 0) this.savedTracks[existing] = data;
    else this.savedTracks.push(data);
    localStorage.setItem('rideglobal_tracks', JSON.stringify(this.savedTracks.slice(-20)));
  }

  deleteFromLocalStorage(name) {
    this.savedTracks = this.savedTracks.filter(t => t.name !== name);
    localStorage.setItem('rideglobal_tracks', JSON.stringify(this.savedTracks));
  }

  renderPreview(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const chain = this.buildConnectorChain();

    if (chain.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Add pieces to build your track', canvas.width / 2, canvas.height / 2);
      return;
    }

    const totalLength = chain[chain.length - 1].endX;
    const minY = Math.min(...chain.map(c => c.startY, c.endY)) - 50;
    const maxY = Math.max(...chain.map(c => c.startY, c.endY)) + 50;
    const heightRange = maxY - minY || 100;

    const scaleX = (canvas.width - 40) / Math.max(totalLength, 100);
    const scaleY = (canvas.height - 60) / heightRange;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = 20;
    const offsetY = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw ground line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, offsetY);
    ctx.lineTo(canvas.width, offsetY);
    ctx.stroke();

    // Draw connector chain
    for (let i = 0; i < chain.length; i++) {
      const c = chain[i];
      const x1 = offsetX + c.startX * scale;
      const y1 = offsetY - c.startY * scale;
      const x2 = offsetX + c.endX * scale;
      const y2 = offsetY - c.endY * scale;

      // Piece body
      ctx.fillStyle = c.def.color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, offsetY + 20);
      ctx.lineTo(x1, offsetY + 20);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Connector line
      ctx.strokeStyle = c.def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Socket markers
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x1, y1, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2, y2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Piece label
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 - 10;
      ctx.fillText(c.def.icon, midX, midY);

      // Selection highlight
      if (this.selectedPiece === i) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x1 - 2, Math.min(y1, y2) - 5, (x2 - x1) + 4, Math.abs(y2 - y1) + 30);
      }
    }

    // Show track length
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Length: ${Math.round(totalLength)}m | Pieces: ${chain.length}`, 10, 20);
  }

  // Export track for gameplay
  exportToPhysics(physics) {
    const data = this.getTrackData();
    physics.trackLength = data.length;
    physics.ramps = data.ramps.map(r => ({
      x: r.x,
      width: r.width,
      height: r.height,
      type: r.type
    }));
    return data;
  }
}

class TrackConnectorUI {
  constructor(editor) {
    this.editor = editor;
    this.container = null;
    this.previewCanvas = null;
  }

  createUI() {
    const container = document.createElement('div');
    container.id = 'track-editor-ui';
    container.innerHTML = `
      <div class="ui-screen" style="min-width: 500px; max-width: 95vw;">
        <h2>Track Editor</h2>
        <p style="font-size:0.8rem;color:#888;">Build tracks by connecting pieces end-to-end</p>
        <div style="width:100%;display:flex;gap:8px;align-items:center;">
          <input type="text" class="input" id="track-name" placeholder="Track name" value="${this.editor.trackName}" style="flex:1;" />
          <button class="btn btn-primary" onclick="trackEditorUI.saveTrack()">Save</button>
        </div>
        <canvas id="track-preview" width="600" height="200" style="width:100%;max-width:600px;height:200px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid rgba(255,255,255,0.1);"></canvas>
        <div style="width:100%;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;" id="piece-palette"></div>
        <div id="piece-list" style="width:100%;max-height:200px;overflow-y:auto;background:rgba(255,255,255,0.03);border-radius:8px;padding:8px;"></div>
        <div style="display:flex;gap:8px;width:100%;flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="trackEditorUI.clearTrack()">Clear</button>
          <button class="btn btn-primary" onclick="trackEditorUI.testTrack()">Test Ride</button>
          <button class="btn btn-secondary" onclick="trackEditorUI.showSavedTracks()">My Tracks</button>
          <button class="btn btn-danger" onclick="trackEditorUI.close()">Close</button>
        </div>
      </div>
    `;
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.display = 'none';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.zIndex = '100';
    document.getElementById('app').appendChild(container);
    this.container = container;

    this.populatePalette();
    this.updatePieceList();
    this.previewCanvas = document.getElementById('track-preview');

    // Auto-render on changes
    this.renderInterval = setInterval(() => {
      if (this.container.style.display !== 'none') {
        this.editor.renderPreview(this.previewCanvas);
      }
    }, 100);
  }

  populatePalette() {
    const palette = document.getElementById('piece-palette');
    if (!palette) return;
    Object.entries(TrackEditor.PIECE_TYPES).forEach(([type, def]) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.minWidth = 'auto';
      btn.style.padding = '8px 12px';
      btn.style.fontSize = '0.8rem';
      btn.textContent = `${def.icon} ${def.name}`;
      btn.onclick = () => {
        this.editor.addPiece(type);
        this.updatePieceList();
        this.editor.renderPreview(this.previewCanvas);
      };
      palette.appendChild(btn);
    });
  }

  updatePieceList() {
    const list = document.getElementById('piece-list');
    if (!list) return;
    if (this.editor.pieces.length === 0) {
      list.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No pieces added yet. Use the palette above.</p>';
      return;
    }
    list.innerHTML = this.editor.pieces.map((p, i) => {
      const def = TrackEditor.getPieceDef(p.type);
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;" onclick="trackEditorUI.selectPiece(${i})">
        <span style="color:${def.color};">${def.icon}</span>
        <span style="flex:1;">${def.name}</span>
        <button class="btn btn-secondary" style="min-width:auto;padding:4px 8px;font-size:0.7rem;" onclick="event.stopPropagation();trackEditorUI.movePieceUp(${i})">▲</button>
        <button class="btn btn-secondary" style="min-width:auto;padding:4px 8px;font-size:0.7rem;" onclick="event.stopPropagation();trackEditorUI.movePieceDown(${i})">▼</button>
        <button class="btn btn-danger" style="min-width:auto;padding:4px 8px;font-size:0.7rem;" onclick="event.stopPropagation();trackEditorUI.removePiece(${i})">×</button>
      </div>`;
    }).join('');
  }

  selectPiece(index) {
    this.editor.selectedPiece = index;
    this.editor.renderPreview(this.previewCanvas);
  }

  removePiece(index) {
    this.editor.removePiece(index);
    this.editor.selectedPiece = null;
    this.updatePieceList();
    this.editor.renderPreview(this.previewCanvas);
  }

  movePieceUp(index) {
    if (index > 0) {
      this.editor.movePiece(index, index - 1);
      this.updatePieceList();
      this.editor.renderPreview(this.previewCanvas);
    }
  }

  movePieceDown(index) {
    if (index < this.editor.pieces.length - 1) {
      this.editor.movePiece(index, index + 1);
      this.updatePieceList();
      this.editor.renderPreview(this.previewCanvas);
    }
  }

  clearTrack() {
    this.editor.clear();
    this.updatePieceList();
    this.editor.renderPreview(this.previewCanvas);
  }

  saveTrack() {
    const nameInput = document.getElementById('track-name');
    if (nameInput) this.editor.trackName = nameInput.value || 'Untitled Track';
    this.editor.saveToLocalStorage();
    this.ui.showNotification('Track saved!', 'success');
  }

  testTrack() {
    if (this.editor.pieces.length === 0) {
      this.ui.showNotification('Add some pieces first!', 'warning');
      return;
    }
    this.close();
    game.loadCustomTrack(this.editor.getTrackData());
  }

  showSavedTracks() {
    const tracks = this.editor.savedTracks;
    const modal = document.createElement('div');
    modal.className = 'ui-screen';
    modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:200;min-width:350px;max-width:90vw;';
    modal.innerHTML = `
      <h3>Saved Tracks</h3>
      <div style="width:100%;max-height:300px;overflow-y:auto;">
        ${tracks.length === 0 ? '<p style="color:#666;">No saved tracks yet.</p>' : tracks.map((t, i) => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);">
            <span style="flex:1;">${t.name}</span>
            <span style="color:#666;font-size:0.8rem;">${t.pieces.length} pieces</span>
            <button class="btn btn-primary" style="min-width:auto;padding:6px 12px;font-size:0.75rem;" onclick="trackEditorUI.loadSavedTrack(${i})">Load</button>
            <button class="btn btn-danger" style="min-width:auto;padding:6px 12px;font-size:0.75rem;" onclick="trackEditorUI.deleteSavedTrack('${t.name}');this.closest('.ui-screen').remove();">Del</button>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-secondary" onclick="this.closest('.ui-screen').remove();">Close</button>
    `;
    document.body.appendChild(modal);
  }

  loadSavedTrack(index) {
    const track = this.editor.savedTracks[index];
    if (track) {
      this.editor.loadTrackData(track);
      const nameInput = document.getElementById('track-name');
      if (nameInput) nameInput.value = track.name;
      this.updatePieceList();
      this.editor.renderPreview(this.previewCanvas);
      document.querySelectorAll('.ui-screen').forEach(el => {
        if (el.parentElement === document.body) el.remove();
      });
    }
  }

  deleteSavedTrack(name) {
    this.editor.deleteFromLocalStorage(name);
  }

  show() {
    this.container.style.display = 'flex';
    this.editor.renderPreview(this.previewCanvas);
  }

  close() {
    this.container.style.display = 'none';
    game.ui.showScreen('title');
    game.state = 'title';
  }
}

const trackEditor = new TrackEditor();
let trackEditorUI = null;
