//
// ff4-battle-vram.js
// created 9/7/2020
//

class FF4BattleVRAM extends ROMToolbox {
  constructor(gui, battleEditor) {
    super(gui);
    this.battleEditor = battleEditor;
    this.dataMgr = gui.dataMgr;
    this.name = 'FF4BattleVRAM';

    // off-screen canvas
    this.vramCanvas = document.createElement('canvas');
    this.vramCanvas.width = 256;
    this.vramCanvas.height = 512;

    // on-screen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('tileset-canvas');
    this.canvas.classList.add('background-gradient');

    this.ppu = new GFX.PPU();
    this.zoom = 2.0;

    // vram slots
    this.vramSlots = [];

    // add message handlers
    const self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e) };
  }

  show() {
    this.div.innerHTML = '';
    this.div.appendChild(this.canvas);
    super.show(false);
  }

  resize() {
    // hide vram if not shown
    if (!this.battleEditor.showVRAM) {
      this.setHeight(0);
      return;
    }

    // calculate zoom assuming no scrollbars
    this.zoom = Math.min(this.div.offsetWidth / this.ppu.width, 4.0);

    // adjust the pane dimensions
    this.setHeight(Math.floor(this.ppu.height * this.zoom));

    // recalculate zoom with possible scrollbar
    this.zoom = Math.min(this.div.clientWidth / this.ppu.width, 4.0);
  }

  mouseDown(e) {
    const x = Math.floor(e.offsetX / this.zoom);
    const y = Math.floor(e.offsetY / this.zoom);

    const clickedSlot = this.slotAtPoint(x, y);
    if (!clickedSlot) return;

    const monster = this.battleEditor.firstMonsterInVRAMSlot(clickedSlot.s);
    if (!monster) return;

    this.battleEditor.selectedMonster = monster;
    this.gui.select(`monsterProperties[${monster.m}]`);

    this.battleEditor.drawBattle();
  }

  slotAtPoint(x, y) {
    for (const slot of this.vramSlots) {
      if (slot.rect.containsPoint(x, y)) return slot;
    }
    return null;
  }

  loadVRAM() {
    // load vram properties
    const v = this.battleEditor.battlePropObj.vramMap;
    this.bossTileCount = FF4BattleVRAM.bossTileCount[v];
    this.vramOffset = FF4BattleVRAM.monsterVRAMPtrs[v];
    this.monsterTileFlags = FF4BattleVRAM.monsterTileFlags[v];
    this.monsterTileLoByte = FF4BattleVRAM.monsterTileLoByte[v];

    const palette = new Uint32Array(0x100);
    const graphics = new Uint8Array(0x8000);
    const tiles = new Uint16Array(16 * 32);
    tiles.fill(0x01FF);
    let height = 64;
    this.vramSlots = [];

    // load the 3 monster types
    for (let s = 1; s <= 3; s++) {

      // load slot
      const slot = this.loadSlot(s);
      this.vramSlots.push(slot);

      // increase the vram height
      height = Math.max(height, slot.rect.b);

      // load palette, graphics, and tiles
      if (slot.palette) palette.set(slot.palette, slot.paletteOffset);
      if (slot.graphics) graphics.set(slot.graphics, slot.graphicsOffset);
      if (slot.tiles) tiles.set(slot.tiles, slot.tileOffset);
    }
    const tileDataObj = {
      src: tiles
    };
    GFX.tileFormat.snes4bppTile.decode(tileDataObj);
    const decodedTiles = new Uint32Array(tileDataObj.dest.buffer);

    // init ppu
    this.ppu.pal = this.gui.gammaCorrectedPalette(palette);
    this.ppu.width = 128;
    this.ppu.height = height;
    this.ppu.layers[0].cols = 16;
    this.ppu.layers[0].rows = height >> 3;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = graphics;
    this.ppu.layers[0].tiles = decodedTiles;
    this.ppu.layers[0].main = true;

    this.resize();
    this.redraw();
  }

  loadSlot(s) {
    const slot = {};
    slot.key = `monster${s}`;
    slot.s = s;
    slot.m = this.battleEditor.battlePropObj[slot.key];

    // get vram slot properties
    slot.gfxPath = `monsterGraphicsProperties[${slot.m}]`;
    slot.vramOffset = this.vramOffset[s - 1];
    slot.tileCount = this.bossTileCount[s - 1];
    slot.graphicsOffset = 0;
    if (slot.vramOffset) {
      slot.graphicsOffset = (slot.vramOffset - 0x2000) * 4;
    }
    slot.tileOffset = slot.graphicsOffset >> 6;
    slot.paletteOffset = (s + 2) * 16;

    const monsterTileFlags = this.monsterTileFlags[s - 1];
    const monsterTileLoByte = this.monsterTileLoByte[s - 1];
    slot.tileFlags = (monsterTileFlags << 8) | monsterTileLoByte;

    // get vram rect
    if (slot.vramOffset === 0) {
      slot.rect = new Rect();
    } else {
      const t = slot.graphicsOffset >> 7;
      const h = (slot.tileCount + 1) >> 1;
      slot.rect = new Rect(0, 128, t, t + h);

      // set tiles
      slot.tiles = new Uint16Array(slot.tileCount);
      for (let t = 0; t < slot.tileCount; t++) {
        slot.tiles[t] = t | slot.tileFlags;
      }
    }

    // return if there is no monster in the slot
    if (slot.m === 255) return slot;

    const gfxObj = this.dataMgr.getObject(slot.gfxPath);

    if (gfxObj.isCharacter) {

      // load palette
      const p = gfxObj.paletteChar;
      slot.palette = new Uint32Array(16);
      const pal8 = new Uint8Array(slot.palette.buffer);
      pal8.set(this.dataMgr.getData(`characterPalette[${p}]`));

      // load graphics
      const c = gfxObj.characterIndex;
      slot.graphics = this.dataMgr.getData(`characterGraphics[${c}]`);
      return slot;
    }

    // load palette
    let p = gfxObj.palette;
    if (gfxObj.isBoss) {
      const b = gfxObj.bossProperties;
      p = this.dataMgr.getProperty(`monsterBossProperties[${b}].palette`);
    }
    slot.palette = new Uint32Array(16);
    const pal8 = new Uint8Array(slot.palette.buffer);
    pal8.set(this.dataMgr.getData(`monsterPalette[${p}]`));
    if (!gfxObj.is3bpp) {
      pal8.set(this.dataMgr.getData(`monsterPalette[${p + 1}]`), 32);
    }

    // decode the graphics
    if (slot.vramOffset !== 0) {
      const gfxBank = gfxObj.graphicsBank;
      const gfxPath = `monsterGraphics${gfxBank + 1}`;
      const gfxPtrKey = `graphicsIndex${gfxBank + 1}`
      const gfxIndex = gfxObj[gfxPtrKey];
      slot.graphics = this.dataMgr.getData(`${gfxPath}[${gfxIndex}]`)
    }

    return slot;
  }

  redraw() {
    this.drawVRAM();
    for (const slot of this.vramSlots) {
      this.drawSlot(slot);
    }
  }

  drawVRAM() {

    if (!this.battleEditor.showVRAM) return;

    // update the off-screen canvas size
    this.vramCanvas.width = this.ppu.width;
    this.vramCanvas.height = this.ppu.height;

    // draw the monsters to the off-screen canvas
    const vramContext = this.vramCanvas.getContext('2d');
    const imageData = vramContext.createImageData(this.ppu.width, this.ppu.height);
    this.ppu.renderPPU(imageData.data);
    vramContext.putImageData(imageData, 0, 0);

    for (const slot of this.vramSlots) {

      if (slot.rect.isEmpty()) continue;

      // make hidden monsters transparent
      if (this.battleEditor.typeHidden(slot.s)) {
        this.gui.transparentCanvas(this.vramCanvas, slot.rect);
      }

      // tint the selected monster
      const selectedMonster = this.battleEditor.selectedMonster;
      if (selectedMonster && slot.s === selectedMonster.vramSlot) {
        this.gui.tintCanvas(this.vramCanvas, slot.rect);
      }
    }

    // update the on-screen canvas size
    const w = this.ppu.width * this.zoom;
    const h = this.ppu.height * this.zoom;
    this.canvas.width = w;
    this.canvas.height = h;

    // copy the monsters to the on-screen canvas
    const context = this.canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.globalCompositeOperation = 'source-over';
    context.drawImage(this.vramCanvas, 0, 0, w, h);
  }

  drawSlot(slot) {
    if (slot.rect.isEmpty()) return;

    const context = this.canvas.getContext('2d');
    context.font = `bold ${24 * this.zoom}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // get the on-screen vram rect
    const slotRect = slot.rect.scale(this.zoom);

    // draw the slot border
    const l = Math.floor(slotRect.l) + 0.5;
    const r = Math.ceil(slotRect.r) - 0.5;
    const t = Math.floor(slotRect.t) + 0.5;
    const b = Math.ceil(slotRect.b) - 0.5;
    context.rect(l, t, r - l, b - t);
    context.lineWidth = 1;
    context.strokeStyle = 'gray';
    context.stroke();

    // draw the slot number
    const selectedMonster = this.battleEditor.selectedMonster;
    if (selectedMonster && slot.s === selectedMonster.vramSlot) {
      context.fillStyle = 'hsla(210, 100%, 50%, 0.5)';
    } else {
      context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    }
    context.fillText(`${slot.s}`, slotRect.centerX, slotRect.centerY);
    context.strokeStyle = 'white';
    context.strokeText(`${slot.s}`, slotRect.centerX, slotRect.centerY);
  }
}

// number of tiles for boss graphics (16/FBAC)
FF4BattleVRAM.bossTileCount = [
  [0x00ff,0x0000,0x0000,0x0000],
  [0x00ff,0x00ff,0x0000,0x0000],
  [0x007f,0x007f,0x007f,0x007f],
  [0x00ff,0x007f,0x007f,0x0000],
  [0x007f,0x007f,0x00ff,0x0000],
  [0x007f,0x00ff,0x007f,0x0000]
];

// monster graphics vram locations for each mold (16/FBDC)
FF4BattleVRAM.monsterVRAMPtrs = [
  [0x2000,0x0000,0x0000,0x0000],
  [0x2000,0x3000,0x0000,0x0000],
  [0x2000,0x2800,0x3000,0x3800],
  [0x2000,0x3000,0x3800,0x0000],
  [0x2000,0x2800,0x3000,0x0000],
  [0x2000,0x2800,0x3800,0x0000]
];

// monster palette, msb for tilemap (16/FC0C)
FF4BattleVRAM.monsterTileFlags = [
  [0x2c,0x20,0x20,0x20],
  [0x2c,0x31,0x20,0x20],
  [0x2c,0x30,0x35,0x39],
  [0x2c,0x31,0x35,0x20],
  [0x2c,0x30,0x35,0x20],
  [0x2c,0x30,0x35,0x20]
];

// monster lo byte of tilemap (16/FC24)
FF4BattleVRAM.monsterTileLoByte = [
  [0x00,0x00,0x00,0x00],
  [0x00,0x00,0x00,0x00],
  [0x00,0x80,0x00,0x80],
  [0x00,0x00,0x80,0x00],
  [0x00,0x80,0x00,0x00],
  [0x00,0x80,0x80,0x00]
];
