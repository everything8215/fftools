//
// ff4-battle.js
// created 7/7/2018
//

class FF4BattleEditor extends ROMEditor {
  constructor(gui) {
    super(gui);

    this.name = 'FF4BattleEditor';
    this.vram = new FF4BattleVRAM(gui, this);

    this.div.classList.add('battle-edit');

    // off-screen canvas for drawing the battle
    this.battleCanvas = document.createElement('canvas');
    this.battleCanvas.width = 256;
    this.battleCanvas.height = 256;

    // off-screen canvas for drawing individual monsters
    this.monsterCanvas = document.createElement('canvas');

    // on-screen canvas
    this.canvas = document.createElement('canvas');
    this.div.appendChild(this.canvas);

    this.battleRect = new Rect(8, 249, 1, 141);
    this.zoom = 1.0;

    this.b = 0;  // battle index
    this.bg = 0;  // battle background index
    this.battlePropPath = null;
    this.battlePropObj = null;
    this.selectedMonster = null;
    this.monsterPoint = null;
    this.clickPoint = null;
    this.monsterSlot = [];

    this.showMonsters = true;
    this.altPalette = false; // use alternate background palette
    this.backAttack = false;
    this.showVRAM = false;

    // add message handlers
    const self = this;
    this.canvas.onmousedown = function(e) { self.mouseDown(e); };
    this.canvas.onmousemove = function(e) { self.mouseMove(e); };
    this.canvas.onmouseup = function(e) { self.mouseUp(e); };
    this.canvas.onmouseleave = function(e) { self.mouseLeave(e); };
    this.resizeSensor = null;
  }

  mouseDown(e) {
    this.closeList();

    const x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    const y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;
    this.selectedMonster = this.monsterAtPoint(x, y);

    if (this.selectedMonster) {
      this.clickPoint = { x: x, y: y };
      this.monsterPoint = {
        x: this.selectedMonster.x,
        y: this.selectedMonster.y
      };
      this.gui.select(this.selectedMonster.path);
    } else {
      this.gui.select(this.battlePropPath);
    }

    this.drawBattle();
  }

  mouseMove(e) {
    this.closeList();
    if (!this.selectedMonster || !this.clickPoint) return;

    const x = Math.floor(e.offsetX / this.zoom) + this.battleRect.l;
    const y = Math.floor(e.offsetY / this.zoom) + this.battleRect.t;

    let dx = x - this.clickPoint.x;
    let dy = y - this.clickPoint.y;

    // move backward enemies in the opposite direction
    if (this.backAttack) dx = -dx;

    if (dx < 0) dx += 7;
    if (dy < 0) dy += 7;

    const monsterX = this.selectedMonster.x;
    const monsterY = this.selectedMonster.y;
    let newX = (this.monsterPoint.x + dx) & ~7;
    let newY = (this.monsterPoint.y + dy) & ~7;
    newX = Math.min(Math.max(16, newX), 136);
    newY = Math.min(Math.max(0, newY), 120);

    if (newX === monsterX && newY === monsterY) return;

    this.selectedMonster.x = newX;
    this.selectedMonster.y = newY;
    this.drawBattle();
  }

  mouseUp(e) {

    if (!this.selectedMonster || !this.monsterPoint) return;

    // get the new monster's position properties
    const newPoint = {
      x: this.selectedMonster.x,
      y: this.selectedMonster.y
    };
    const oldPoint = this.monsterPoint;

    this.clickPoint = null;
    this.monsterPoint = null;

    // return if the monster didn't move
    if (oldPoint.x === newPoint.x && oldPoint.y === newPoint.y) return;

    const newX = Math.floor((newPoint.x - 16) / 8);
    const newY = Math.floor(newPoint.y / 8);

    this.observer.sleep();
    this.dataMgr.beginAction();
    this.dataMgr.setProperty(`${this.selectedMonster.posPath}.x`, newX);
    this.dataMgr.setProperty(`${this.selectedMonster.posPath}.y`, newY);
    this.dataMgr.endAction();
    this.observer.wake();
  }

  mouseLeave(e) {
    this.mouseUp(e);
  }

  show() {
    this.showControls();
    this.closeList();

    // show the VRAM
    this.vram.show();

    // notify on resize
    const self = this;
    const editTop = document.getElementById('edit-top');
    if (!this.resizeSensor) {
      this.resizeSensor = new ResizeSensor(editTop, function() {
        self.drawBattle();
      });
    }
  }

  hide() {
    this.battlePropPath = null;
    if (this.resizeSensor) {
      const editTop = document.getElementById('edit-top');
      this.resizeSensor.detach(editTop);
      this.resizeSensor = null;
    }
    this.vram.hide()
  }

  select(path) {

    if (this.battlePropPath === path) return;

    this.battlePropPath = path;
    this.battlePropObj = this.dataMgr.getObject(path);
    this.b = this.dataMgr.getIndex(path);
    this.loadBattle();
  }

  resetControls() {
    super.resetControls();

    // add a control to show/hide monsters
    this.addTwoState('showMonsters', function(checked) {
      this.showMonsters = checked;
      this.drawBattle();
    }, 'Monsters', this.showMonsters);

    // add a control to select the battle background
    const bgStringTable = this.dataMgr.getStringTable('battleBackgroundProperties');

    // need to convert to an array
    const bgNames = [];
    for (let key in bgStringTable) {
      bgNames.push(bgStringTable[key]);
    }
    function onChangeBG(bg) {
      this.bg = bg;
      this.drawBattle();
    }
    function bgSelected(bg) {
      return this.bg === bg;
    }
    this.addList('showBackground', 'Background', bgNames, onChangeBG, bgSelected);

    // add a control to use the alternate battle background palette
    this.addTwoState('useAltPalette', function(checked) {
      this.altPalette = checked;
      this.drawBattle();
    }, 'Alt. Palette', this.altPalette);

    // add a control to show a back attack formation
    this.addTwoState('backAttack', function(checked) {
      this.backAttack = checked;
      this.drawBattle();
    }, 'Back Attack', this.backAttack);

    // add a control to show/hide VRAM
    this.addTwoState('showVRAM', function(checked) {
      this.showVRAM = checked;
      this.vram.resize();
      this.vram.redraw();
    }, 'VRAM', this.showVRAM);
  }

  loadBattle() {
    this.resetControls();
    this.backAttack = false;
    if (this.battlePropObj.flags1 & 0x01) {
      this.backAttack = true;
    }

    this.observer.reset();
    this.observer.startObservingAssembly(this.battlePropPath, {
      callback: this.loadBattle,
      target: this
    });

    this.selectedMonster = null;
    this.monsterSlot = [];
    for (let slot = 1; slot <= 8; slot++) {
      const monster = this.loadMonster(slot);
      if (monster) this.monsterSlot.push(monster);
    }

    // draw vram
    this.vram.loadVRAM();
    this.vram.resize();
    this.vram.redraw();
    this.drawBattle();
  }

  loadMonster(slot) {

    const monster = {
      slot: slot
    };

    // get vram slot
    monster.vramSlot = 1;
    const monsterCount = [
      0,
      this.battlePropObj.monster1Count,
      this.battlePropObj.monster2Count,
      this.battlePropObj.monster3Count
    ];

    let i = 0;
    while (i < slot) {
      if (monsterCount[monster.vramSlot]) {
        monsterCount[monster.vramSlot]--;
        i++;
        continue;
      }
      monster.vramSlot++;
      if (monster.vramSlot > 3) return null;
    }

    // get monster index
    monster.key = `monster${monster.vramSlot}`;
    monster.m = this.battlePropObj[monster.key];
    if (monster.m === 0xFF) return null; // slot is empty
    monster.path = `monsterProperties[${monster.m}]`;

    // determine if monster should be hidden
    monster.hidden = this.typeHidden(monster.vramSlot);

    // get monster graphics properties
    monster.gfxPath = `monsterGraphicsProperties[${monster.m}]`;
    this.observer.startObservingAssembly(monster.gfxPath, {
      callback: this.loadBattle,
      target: this
    });

    if (this.dataMgr.getProperty(`${monster.gfxPath}.isBoss`)) {
      // load boss position and size
      const b = this.dataMgr.getProperty(`${monster.gfxPath}.bossProperties`);
      monster.bossPath = `monsterBossProperties[${b}]`;
      monster.posPath = monster.bossPath;
      const s = this.dataMgr.getProperty(`${monster.bossPath}.size`);
      monster.sizePath = `monsterSize[${s}]`;

    } else {
      // load monster position and size
      const p = this.battlePropObj.monsterPosition;
      const s = this.dataMgr.getProperty(`${monster.gfxPath}.size`);
      monster.posPath = `monsterPosition[${p}][${slot - 1}]`;
      monster.sizePath = `monsterSize[${s}]`;
    }

    monster.width = this.dataMgr.getProperty(`${monster.sizePath}.width`) || 8;
    monster.height = this.dataMgr.getProperty(`${monster.sizePath}.height`) || 8;
    monster.x = this.dataMgr.getProperty(`${monster.posPath}.x`) * 8 + 16;
    monster.y = this.dataMgr.getProperty(`${monster.posPath}.y`) * 8;

    this.observer.startObservingAssembly(monster.posPath, {
      callback: this.loadBattle,
      target: this
    });
    this.observer.startObservingAssembly(monster.sizePath, {
      callback: this.loadBattle,
      target: this
    });

    return monster;
  }

  typeHidden(type) {
    const h = this.battlePropObj.hiddenMonsters;
    if (h === 1) {
      return (type === 2);
    } else if (h === 2) {
      return (type === 2 || type === 3);
    } else if (h === 3) {
      return type === 3;
    }
    return false;
  }

  rectForMonster(monster) {

    const rect = new Rect(
      monster.x,
      monster.x + monster.width * 8,
      monster.y,
      monster.y + monster.height * 8
    );

    if (this.dataMgr.getProperty(`${monster.gfxPath}.isCharacter`)) {
      // characters are a fixed size
      rect.w = 16;
      rect.h = 24;
    }

    if (this.backAttack) {
      rect.l = 256 - (monster.x + monster.width * 8);
      rect.r = 256 - monster.x;
    }

    return rect;
  }

  monsterAtPoint(x, y) {
    for (const monster of this.monsterSlot) {
      if (this.rectForMonster(monster).containsPoint(x, y)) {
        return monster;
      }
    }
    return null;
  }

  firstMonsterInVRAMSlot(vramSlot) {
    for (const monster of this.monsterSlot) {
      if (monster.vramSlot === vramSlot) return monster;
    }
    return null;
  }

  drawBattle() {
    this.vram.redraw();

    this.drawBackground();

    if (this.showMonsters) {
      for (const monster of this.monsterSlot) {
        this.drawMonster(monster);
      }
    }

    for (let c = 4; c >= 0; c--) {
      this.drawCharacter(c);
    }

    const zx = this.div.clientWidth / this.battleRect.w;
    const zy = this.div.clientHeight / this.battleRect.h;
    this.zoom = Math.max(Math.min(zx, zy, 4.0), 1.0);

    this.canvas.width = Math.floor(this.battleRect.w * this.zoom);
    this.canvas.height = Math.floor(this.battleRect.h * this.zoom);

    const context = this.canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.globalCompositeOperation = 'copy';
    context.drawImage(this.battleCanvas,
      this.battleRect.l, this.battleRect.t, this.battleRect.w, this.battleRect.h,
      0, 0, this.canvas.width, this.canvas.height
    );
  }

  drawMonster(monster) {

    // get graphics properties
    const gfxProp = this.dataMgr.getObject(`${monster.gfxPath}`);

    let f1 = this.vram.monsterTileFlags[monster.vramSlot - 1];
    f1 &= 0xE3;
    f1 |= (monster.vramSlot + 2) << 2; // palette
    let f2 = this.vram.monsterTileLoByte[monster.vramSlot - 1];
    let tileFlags = (f1 << 8) | f2;

    let w = 1;
    let h = 1;
    let tiles;
    if (gfxProp.isCharacter) {

      w = 2;
      h = 3;
      if (this.battlePropObj.flags2 & 0x10) {
        // enemy character
        tiles = new Uint16Array([
          0x4001, 0x4000,
          0x4003, 0x4002,
          0x4005, 0x4004
        ]);
      } else {
        tiles = new Uint16Array([
          0x0000, 0x0001,
          0x0002, 0x0003,
          0x0004, 0x0005
        ]);
      }
      for (let t = 0; t < tiles.length; t++) {
        tiles[t] |= tileFlags;
      }

    } else if (gfxProp.isBoss && monster.bossPath) {
      const bossObj = this.dataMgr.getObject(monster.bossPath);
      w = monster.width;
      h = monster.height;
      tiles = new Uint16Array(w * h);
      tiles.fill(0x0200);

      let mapIndex = bossObj.map;
      if (gfxProp.bossProperties === 63) {
        // use zeromus map
        mapIndex = 55;
      }
      const map = this.dataMgr.getData(`monsterBossMap[${mapIndex}]`);

      if (bossObj.tileIndexMSB) tileFlags |= 0x0100;
      for (let t = 0, i = 0; i < map.length; i++) {
        const mapValue = map[i];
        if (mapValue === 0xFF) {
          // blank tile
          t++;

        } else if (mapValue === 0xFE) {
          // multiple blank tiles
          t += map[++i];

        } else {
          // tile index
          tiles[t++] = mapValue + tileFlags;
        }
      }

    } else {
      w = monster.width;
      h = monster.height;
      tiles = new Uint16Array(w * h);
      for (let t = 0; t < tiles.length; t++) {
        tiles[t] = t + tileFlags;
      }
    }
    const tileDataObj = {
      src: tiles
    };
    GFX.tileFormat.snes4bppTile.decode(tileDataObj);
    const decodedTiles = new Uint32Array(tileDataObj.dest.buffer);

    // set up the ppu
    const ppu = new GFX.PPU();
    ppu.pal = this.gui.gammaCorrectedPalette(this.vram.ppu.pal);
    ppu.width = w * 8;
    ppu.height = h * 8;

    // layer 1
    ppu.layers[0].cols = w;
    ppu.layers[0].rows = h;
    ppu.layers[0].z[0] = GFX.Z.snes1L;
    ppu.layers[0].z[1] = GFX.Z.snes1H;
    ppu.layers[0].gfx = this.vram.ppu.layers[0].gfx;
    ppu.layers[0].tiles = decodedTiles;
    ppu.layers[0].main = true;

    // draw the monster
    this.monsterCanvas.width = ppu.width;
    this.monsterCanvas.height = ppu.height;
    const monsterContext = this.monsterCanvas.getContext('2d');
    const imageData = monsterContext.createImageData(ppu.width, ppu.height);
    ppu.renderPPU(imageData.data);
    monsterContext.putImageData(imageData, 0, 0);

    // make hidden monsters transparent
    if (monster.hidden || (this.battlePropObj.flags2 & 0x80)) {
      this.gui.transparentCanvas(this.monsterCanvas);
    }

    // tint the selected monster
    if (this.selectedMonster === monster) {
      this.gui.tintCanvas(this.monsterCanvas);
    }

    const rect = this.rectForMonster(monster);

    const context = this.battleCanvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.globalCompositeOperation = 'source-over';
    if (!this.backAttack) {
      context.drawImage(this.monsterCanvas,
        0, 0, rect.w, rect.h,
        rect.l, rect.t, rect.w, rect.h
      );
    } else {
      // flip monster horizontally
      context.scale(-1, 1);
      context.drawImage(this.monsterCanvas,
        0, 0, rect.w, rect.h,
        -rect.l, rect.t, -rect.w, rect.h
      );
      context.setTransform(1,0,0,1,0,0);
    }
  }

  drawCharacter(c) {

    const gfxTable = [1,5,9,11,12];
    const g = gfxTable[c];

    // load palette
    const palette = new Uint32Array(16);
    const pal8 = new Uint8Array(palette.buffer);
    pal8.set(this.dataMgr.getData(`characterPalette[${g}]`));

    // load graphics
    const graphics = this.dataMgr.getData(`characterGraphics[${g}]`);

    // draw the monster
    this.monsterCanvas.width = 16;
    this.monsterCanvas.height = 24;
    const monsterContext = this.monsterCanvas.getContext('2d');
    const imageData = monsterContext.createImageData(16, 24);
    GFX.render(imageData.data, graphics, palette, 16);
    monsterContext.putImageData(imageData, 0, 0);

    const l = 208;
    const t = 37 + c * 20;
    const rect = new Rect(l, l + 16, t, t + 24);
    let rowOffset = (c & 1) ? 16 : 0;

    const context = this.battleCanvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.globalCompositeOperation = 'source-over';
    if (!this.backAttack) {
      context.drawImage(this.monsterCanvas,
        0, 0, rect.w, rect.h,
        rect.l + rowOffset, rect.t, rect.w, rect.h
      );
    } else {
      // flip horizontally
      rowOffset = 16 - rowOffset;
      rect.l = 256 - (l + 24);
      rect.r = 256 - l;
      context.scale(-1, 1);
      context.drawImage(this.monsterCanvas,
        0, 0, rect.w, rect.h,
        -rect.l + rowOffset, rect.t, -rect.w, rect.h
      );
      context.setTransform(1,0,0,1,0,0);
    }
  }

  drawBackground() {

    // load graphics
    const bg = (this.b === 439) ? 16 : this.bg;
    const gfx = new Uint8Array(0x10000);
    const gfx1 = this.dataMgr.getData(`battleBackgroundGraphics[${bg}]`);
    gfx.set(gfx1);
    if (bg !== 16) {
      // this is necessary for the cave bg because it shares one tile with the moon bg
      const gfx2 = this.dataMgr.getData(`battleBackgroundGraphics[${bg + 1}]`);
      gfx.set(gfx2, gfx1.length);
    }

    const bgPropObj = this.dataMgr.getObject(`battleBackgroundProperties[${bg}]`);

    // load tile properties
    const top = bgPropObj.top;
    const middle = bgPropObj.middle;
    const bottom = bgPropObj.bottom;

    const topTiles8 = this.dataMgr.getData(`battleBackgroundLayoutUpper[${top}]`);
    const middleTiles8 = this.dataMgr.getData(`battleBackgroundLayoutUpper[${middle}]`);
    const bottomTiles8 = this.dataMgr.getData(`battleBackgroundLayoutLower[${bottom}]`);
    const topTiles = new Uint32Array(topTiles8.buffer);
    const middleTiles = new Uint32Array(middleTiles8.buffer);
    const bottomTiles = new Uint32Array(bottomTiles8.buffer);

    const offset = bgPropObj.offset;
    if (offset) {
      // set tile offset (bottom tiles only)
      for (let i = 0; i < bottomTiles.length; i++) bottomTiles[i] += offset;
    }

    const tiles = new Uint32Array(0x240);
    tiles.set(topTiles);
    if (middle) {
      tiles.set(middleTiles, 0x100);
    } else {
      tiles.set(bottomTiles, 0x100);
      tiles.set(bottomTiles, 0x140);
      tiles.set(bottomTiles, 0x180);
      tiles.set(bottomTiles, 0x1C0);
    }
    tiles.set(bottomTiles, 0x200);

    const pal = new Uint32Array(0x80);
    const pal8 = new Uint8Array(pal.buffer);
    let p = bg;
    if (this.altPalette && FF4BattleEditor.altPalette[p]) {
      p = FF4BattleEditor.altPalette[p];
    }
    pal8.set(this.dataMgr.getData(`battleBackgroundPalette[${p}]`));
    pal[0] = 0xFF000000;

    // set up the ppu
    const ppu = new GFX.PPU();
    ppu.pal = this.gui.gammaCorrectedPalette(pal);
    ppu.width = 256;
    ppu.height = 144;
    ppu.back = true;

    // layer 2
    ppu.layers[1].cols = 32;
    ppu.layers[1].rows = 18;
    ppu.layers[1].z[0] = GFX.Z.snes2L;
    ppu.layers[1].z[1] = GFX.Z.snes2H;
    ppu.layers[1].gfx = gfx;
    ppu.layers[1].tiles = tiles;
    ppu.layers[1].main = true;

    const context = this.battleCanvas.getContext('2d');
    const imageData = context.createImageData(256, 192);
    ppu.renderPPU(imageData.data, 0, 0, 256, 192);
    context.putImageData(imageData, 0, 0);
  }
}

// from 03/F7BC
FF4BattleEditor.altPalette = [
  0x16,  // grass
  0x00,
  0x00,
  0x00,
  0x11,  // cave
  0x00,
  0x00,
  0x12,  // cave w/ water
  0x14,  // sealed cave
  0x00,
  0x00,
  0x13,  // underground cave
  0x15,  // tower
  0x00,
  0x00,
  0x00,
  0x00
];
