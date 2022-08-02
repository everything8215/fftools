//
// ff4-map.js
// created 3/17/2018
//

// Jap translations: http://ff4.wikidot.com/weapons

class FF4Map extends ROMEditor {
  constructor(gui) {
    super(gui);

    this.dataMgr = gui.dataMgr;

    this.name = 'FF4Map';
    this.tileset = new FF4MapTileset(gui, this);

    this.div.classList.add('map-edit');
    this.div.tabIndex = 1;

    this.scrollDiv = document.createElement('div');
    this.scrollDiv.classList.add('no-select');
    this.div.appendChild(this.scrollDiv);

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'map';
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.scrollDiv.appendChild(this.canvas);

    this.cursorCanvas = document.createElement('canvas');
    this.cursorCanvas.id = 'map-cursor';
    this.cursorCanvas.width = 16;
    this.cursorCanvas.height = 16;
    this.scrollDiv.appendChild(this.cursorCanvas);

    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = 256;
    this.mapCanvas.height = 256;
    this.mapSectors = [];
    this.dirtyRect = null;
    this.mapRect = new Rect(0, 0, 256, 256);
    this.npcCanvas = document.createElement('canvas');

    this.mpPath = null;
    this.mpObj = null;
    this.tpPath = null;
    this.tpArray = null;
    this.m = null; // map index
    this.w = 0; // world index
    this.l = 0; // selected layer
    this.zoom = 1.0; // zoom multiplier
    this.selection = {
      x: 0, y: 0, w: 1, h: 1,
      tilemap: new Uint8Array(1)
    };
    this.clickPoint = null;
    this.isDragging = false;
    this.layer = [
      new FF4MapLayer(gui, FF4MapLayer.Type.layer1),
      new FF4MapLayer(gui, FF4MapLayer.Type.layer2)
    ];
    this.selectedLayer = this.layer[0];
    this.triggers = [];
    this.showCursor = false;
    this.showLayer1 = true;
    this.showLayer2 = true;
    this.showTriggers = true;
    this.showScreen = false;
    this.selectedTrigger = null;
    this.isWorld = false;
    this.ppu = new GFX.PPU();

    // separate observer for triggers
    this.triggerObserver = new ROMObserver(this.dataMgr);

    // mask layer stuff
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.id = 'map-screen';
    this.screenCanvas.width = 256;
    this.screenCanvas.width = 256;
    this.scrollDiv.appendChild(this.screenCanvas);

    const self = this;
    this.div.onscroll = function() { self.scroll(); };
    this.scrollDiv.onmousedown = function(e) { self.mouseDown(e); };
    this.scrollDiv.onmouseup = function(e) { self.mouseUp(e); };
    this.scrollDiv.onmousemove = function(e) { self.mouseMove(e); };
    this.scrollDiv.onmouseenter = function(e) { self.mouseEnter(e); };
    this.scrollDiv.onmouseleave = function(e) { self.mouseLeave(e); };
    this.scrollDiv.oncontextmenu = function(e) { self.openMenu(e); return false; };
    this.resizeSensor = null;

    document.addEventListener('keydown', function(e) {
      if (!e.target.classList.contains('map-edit')) return;
      if (this.l === 3);

      if (e.which === 8 || e.which === 46) {
        // backspace or delete button
        self.deleteTrigger();
        e.preventDefault();
      }
    });

    // this.initBattleGroups();
    // this.updateTilesets();
  }

  // initBattleGroups() {
  //
  //   // set the battle offset for underground and moon maps
  //   for (let m = 256; m < 512; m++) {
  //     const b = this.rom.mapBattle.item(m).battleGroup.value;
  //     if (b === 0) continue;
  //     const battleGroup = this.rom.battleGroup.item(b);
  //     for (let i = 1; i <= 8; i++) {
  //       const battle = battleGroup[`battle${i}`];
  //       if (battle.offset === 256) continue;
  //       battle.offset = 256;
  //       battle.value += 256;
  //     }
  //   }
  //
  //   for (let m = 64; m < 84; m++) {
  //     const b = this.rom.worldBattle.item(m).battleGroup.value;
  //     if (b === 0) continue;
  //     const battleGroup = this.rom.battleGroupWorld.item(b);
  //     for (let i = 1; i <= 8; i++) {
  //       const battle = battleGroup[`battle${i}`];
  //       if (battle.offset === 256) continue;
  //       battle.offset = 256;
  //       battle.value += 256;
  //     }
  //   }
  // }

  // updateTilesets() {
  //
  //   for (let t = 0; t < this.rom.mapTilesets.arrayLength; t++) {
  //     const tileset = this.rom.mapTilesets.item(t);
  //     const graphics = this.rom.mapGraphics.item(t);
  //
  //     if (t === 0 || t === 15) {
  //       graphics.format = 'snes4bpp';
  //       graphics.disassemble(graphics.parent.data);
  //       tileset.graphics = `mapGraphics[${t}]`;
  //       continue;
  //     } else if (t === 14) {
  //       tileset.graphics = `mapGraphics[${t}]`;
  //       continue;
  //     }
  //
  //     tileset.graphics = [`mapGraphics[${t}]`];
  //     const length1 = graphics.data.length;
  //     const length2 = 0x6000 - graphics.data.length;
  //     if (length2 <= 0) continue;
  //     tileset.graphics.push({
  //       path: `mapGraphics[${t + 1}]`,
  //       offset: length1,
  //       range: `0-${length2}`
  //     });
  //   }
  //
  //   for (let m = 0; m < this.rom.mapProperties.arrayLength; m++) {
  //     const mapProperties = this.rom.mapProperties.item(m);
  //     const g = mapProperties.graphics.value;
  //     const p = mapProperties.palette.value;
  //
  //     const tileset = this.rom.mapTilesets.item(g);
  //
  //     const paletteDefinition = [
  //       {
  //         path: `mapPalettes[${p}]`,
  //         range: '0-8',
  //         offset: 16
  //       }, {
  //         path: `mapPalettes[${p}]`,
  //         range: '8-16',
  //         offset: 32
  //       }, {
  //         path: `mapPalettes[${p}]`,
  //         range: '16-24',
  //         offset: 48
  //       }, {
  //         path: `mapPalettes[${p}]`,
  //         range: '24-32',
  //         offset: 64
  //       }, {
  //         path: `mapPalettes[${p}]`,
  //         range: '32-40',
  //         offset: 80
  //       }, {
  //         path: `mapPalettes[${p}]`,
  //         range: '40-48',
  //         offset: 96
  //       }, {
  //         path: `mapPalettes[${p}]`,
  //         range: '48-56',
  //         offset: 112
  //       }
  //     ];
  //
  //     if (g === 0 || g === 15) {
  //       paletteDefinition.push(
  //         {
  //           path: `mapPalettes[${p + 1}]`,
  //           range: '0-8',
  //           offset: 24
  //         }, {
  //           path: `mapPalettes[${p + 1}]`,
  //           range: '8-16',
  //           offset: 40
  //         }, {
  //           path: `mapPalettes[${p + 1}]`,
  //           range: '16-24',
  //           offset: 56
  //         }, {
  //           path: `mapPalettes[${p + 1}]`,
  //           range: '24-32',
  //           offset: 72
  //         }, {
  //           path: `mapPalettes[${p + 1}]`,
  //           range: '32-40',
  //           offset: 88
  //         }, {
  //           path: `mapPalettes[${p + 1}]`,
  //           range: '40-48',
  //           offset: 104
  //         }, {
  //           path: `mapPalettes[${p + 1}]`,
  //           range: '48-56',
  //           offset: 120
  //         }
  //       );
  //     }
  //     tileset.palette = [paletteDefinition];
  //   }
  // }

  show() {
    this.showControls();
    this.tileset.show();

    // notify on resize
    const self = this;
    const editTop = document.getElementById('edit-top');
    if (!this.resizeSensor) {
      this.resizeSensor = new ResizeSensor(editTop, function() {
        self.scroll();
      });
    }
  }

  hide() {
    this.mpPath = null;
    this.observer.reset();
    this.triggerObserver.reset();
    if (this.resizeSensor) {
      const editTop = document.getElementById('edit-top');
      this.resizeSensor.detach(editTop);
      this.resizeSensor = null;
    }
    this.tileset.hide();
  }

  select(path) {

    if (this.mpPath === path) return;

    this.mpPath = path;
    this.m = this.dataMgr.getIndex(this.mpPath);

    if ([0xFB, 0xFC, 0xFD].includes(this.m & 0xFF)) {
      // world map
      this.m &= 0xFF;
      this.w = this.m - 0xFB;
      this.isWorld = true;
      this.loadWorldMap();
      this.gui.select(null);
    } else {
      // normal map
      this.w = 0;
      this.isWorld = false;
      this.loadMap();
    }
  }

  resetControls() {

    super.resetControls();

    // add layer toggle buttons
    this.addTwoState('showLayer1', function() {
      this.changeLayer('showLayer1');
    }, 'Layer 1', this.showLayer1);
    this.addTwoState('showLayer2', function() {
      this.changeLayer('showLayer2');
    }, 'Layer 2', this.showLayer2);
    this.addTwoState('showTriggers', function() {
      this.changeLayer('showTriggers');
    }, 'Triggers', this.showTriggers);

    // add tile mask button
    const maskArray = this.isWorld ? FF4Map.WorldTileMasks : FF4Map.TileMasks
    const maskKeys = Object.keys(maskArray);
    const maskNames = [];
    for (let i = 0; i < maskKeys.length; i++) {
      maskNames[i] = maskArray[maskKeys[i]];
    }
    if (!maskNames.includes(this.tileMask)) {
      this.tileMask = FF4Map.TileMasks.none;
    }
    function onChangeMask(mask) {
      this.tileMask = maskArray[maskKeys[mask]];
      this.drawMap();
      this.tileset.selectLayer(this.l);
    };
    function maskSelected(mask) {
      return this.tileMask === maskArray[maskKeys[mask]];
    };
    this.addList('showMask', 'Mask', maskNames, onChangeMask, maskSelected);

    // add screen mask button
    this.addTwoState('showScreen', function() {
      this.changeLayer('showScreen');
    }, 'Screen', this.showScreen);
    this.addZoom(this.zoom, function() {
      this.changeZoom();
    });
  }

  changeZoom() {

    // save the old scroll location
    const l = this.div.scrollLeft;
    const t = this.div.scrollTop;
    const w = this.div.clientWidth;
    const h = this.div.clientHeight;
    const oldRect = new Rect(l, l + w, t, t + h);
    const oldZoom = this.zoom;

    // update zoom
    this.zoom = Math.pow(2, Number(document.getElementById('zoom').value));
    const zoomValue = document.getElementById('zoom-value');
    zoomValue.innerHTML = `${this.zoom * 100}%`;

    // update the scroll div size
    const parentWidth = this.ppu.width * this.zoom;
    const parentHeight = this.ppu.height * this.zoom;
    this.scrollDiv.style.width = `${parentWidth}px`;
    this.scrollDiv.style.height = `${parentHeight}px`;

    // calculate the new scroll location
    const x = Math.round(oldRect.centerX / oldZoom) * this.zoom;
    const y = Math.round(oldRect.centerY / oldZoom) * this.zoom;
    let newRect = new Rect(x - w / 2, x + w / 2, y - h / 2, y + h / 2);
    if (newRect.r > parentWidth) newRect = newRect.offset(parentWidth - newRect.r, 0);
    if (newRect.b > parentHeight) newRect = newRect.offset(0, parentHeight - newRect.b);
    if (newRect.l < 0) newRect = newRect.offset(-newRect.l, 0);
    if (newRect.t < 0) newRect = newRect.offset(0, -newRect.t);

    // set the new scroll location and redraw
    this.div.scrollLeft = newRect.l;
    this.div.scrollTop = newRect.t;
    this.scroll();
  }

  scroll() {

    // get the visible dimensions
    const x = this.div.scrollLeft;
    const y = this.div.scrollTop;
    const w = this.div.clientWidth;
    const h = this.div.clientHeight;

    const margin = Math.max(w, h) >> 2;
    this.mapRect.r = Math.min(x + w + margin, this.ppu.width * this.zoom);
    this.mapRect.l = Math.max(0, Math.min(x - margin, this.mapRect.r - w));
    this.mapRect.b = Math.min(y + h + margin, this.ppu.height * this.zoom);
    this.mapRect.t = Math.max(0, Math.min(y - margin, this.mapRect.b - h));

    this.canvas.style.left = `${this.mapRect.l}px`;
    this.canvas.style.top = `${this.mapRect.t}px`;
    this.canvas.width = this.mapRect.w;
    this.canvas.height = this.mapRect.h;

    this.drawMap();
  }

  getEventPoint(e) {
    // convert screen coordinates to ppu coordinates
    const x = e.offsetX / this.zoom + this.ppu.layers[this.l].x;
    const y = e.offsetY / this.zoom + this.ppu.layers[this.l].y;

    // get the tile (x,y) position on the selected layer
    let col = x >> 4;
    let row = y >> 4;
    if (this.l !== 3) {
      col %= this.ppu.layers[this.l].cols;
      row %= this.ppu.layers[this.l].rows;
      while (col < 0) col += this.ppu.layers[this.l].cols;
      while (row < 0) row += this.ppu.layers[this.l].rows;
    }

    return {
      x: col, y: row,
      button: e.button
    }
  }

  mouseDown(e) {

    this.clickPoint = this.getEventPoint(e);

    // update the selection position
    this.selection.x = this.clickPoint.x;
    this.selection.y = this.clickPoint.y;
    this.isDragging = true;

    if (this.l === 3) {
      // right click handled by context menu
      if (this.clickPoint.button === 2) return;

      const triggers = this.triggersAt(e.offsetX, e.offsetY);

      if (e.detail === 2) {
        // double click, select trigger script
        this.selectTrigger(this.selectedTrigger);
        const triggerObj = this.dataMgr.getObject(this.selectedTrigger.path);
        if (this.selectedTrigger.type === 'event') {
          // event trigger
          const triggerEvent = triggerObj.event;
          // propertyList.select(triggerEvent.parsePath(triggerEvent.link));

        } else if (this.selectedTrigger.type === 'npc') {
          // npc
          const npcSwitch = triggerObj.switch0;
          if (this.selectedTrigger.npcMSB) {
            npcSwitch = triggerObj.switch1 + 256;
          }
          // propertyList.select(this.rom.npcScript.item(npcSwitch.value));
        }

      } else if (triggers.length) {
        // select the first trigger, or the next trigger in a stack
        let index = triggers.indexOf(this.selectedTrigger);
        index = (index + 1) % triggers.length;
        this.selectTrigger(triggers[index]);

      } else {
        // clear trigger selection
        this.selectTrigger(null);
        this.isDragging = false;
        if (this.isWorld) {
          // select world map battle
          this.selectWorldBattle(this.clickPoint.x, this.clickPoint.y);
        } else {
          // select map properties
          this.gui.select(this.mpPath);
        }
      }

    } else if (this.clickPoint.button === 2) {
      // right mouse button down - select tiles
      this.selectTiles();

    } else {
      // left mouse button down - draw tiles
      this.setTiles();
    }

    this.drawScreen();
    this.drawCursor();
  }

  mouseMove(e) {

    const point = this.getEventPoint(e);

    // update the displayed coordinates
    const coordinates = document.getElementById('coordinates');
    coordinates.innerHTML = `(${point.x}, ${point.y})`;

    // return if the cursor position didn't change
    if (this.selection.x === point.x && this.selection.y === point.y) return;

    // update the selection position
    this.selection.x = point.x;
    this.selection.y = point.y;

    if (!this.isDragging) {
      // update the cursor
      this.drawScreen();
      this.drawCursor();
      return;
    }

    if (this.l === 3 && this.selectedTrigger) {

      if (this.selectedTrigger.x !== point.x || this.selectedTrigger.y !== point.y) {
        this.selectedTrigger.x = point.x;
        this.selectedTrigger.y = point.y;
        this.invalidateMap(this.rectForTrigger(this.selectedTrigger).scale(1 / this.zoom));
        this.drawMap();
      }
    } else if (this.clickPoint.button === 2) {
      this.selectTiles();
    } else {
      this.setTiles();
    }

    // update the cursor
    this.drawScreen();
    this.drawCursor();
  }

  mouseUp(e) {

    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.l === 3 && this.selectedTrigger) {
      // get the new trigger position
      const x = this.selectedTrigger.x;
      const y = this.selectedTrigger.y;

      // check if the trigger moved
      if (x === this.clickPoint.x || y === this.clickPoint.y) return;

      // set the new trigger position (and trigger undo)
      this.triggerObserver.sleep();
      this.dataMgr.beginAction();
      this.dataMgr.setProperty(`${this.selectedTrigger.path}.x`, x);
      this.dataMgr.setProperty(`${this.selectedTrigger.path}.y`, y);
      this.dataMgr.endAction();
      this.triggerObserver.wake();

    } else if (this.l !== 3 && this.clickPoint.button !== 2) {

      // set the tilemap
      this.selectedLayer.setLayout();
    }
  }

  mouseEnter(e) {

    // show the cursor
    this.showCursor = true;
    this.drawScreen();
    this.drawCursor();

    this.mouseUp(e);
  }

  mouseLeave(e) {

    // hide the cursor
    this.showCursor = (this.l === 3);
    this.drawCursor();

    this.mouseUp(e);
  }

  openMenu(e) {
    if (this.l !== 3) return; // no menu unless editing triggers

    this.clickPoint = this.getEventPoint(e);

    // update the selection position
    this.selection.x = this.clickPoint.x;
    this.selection.y = this.clickPoint.y;

    const triggers = this.triggersAt(e.offsetX, e.offsetY);
    if (triggers.length) {
      // open a menu for the selected trigger
      let index = triggers.indexOf(this.selectedTrigger);
      if (index === -1) index = 0;
      this.selectTrigger(triggers[index]);
    } else {
      // clear trigger selection
      this.selectTrigger(null);
    }
    this.drawScreen();
    this.drawCursor();

    this.menu = new Menu();

    const self = this;
    this.menu.createMenuItem(this.menu.topMenu, {
      name: 'Insert Entrance Trigger',
      onclick: function() {
        self.closeMenu();
        self.insertTrigger('entrance');
      }
    });

    this.menu.createMenuItem(this.menu.topMenu, {
      name: 'Insert Event Trigger',
      onclick: function() {
        self.closeMenu();
        self.insertTrigger('event');
      }
    });

    this.menu.createMenuItem(this.menu.topMenu, {
      name: 'Insert Treasure',
      disabled: this.isWorld,
      onclick: function() {
        self.closeMenu();
        self.insertTrigger('treasure');
      }
    });

    this.menu.createMenuItem(this.menu.topMenu, {
      name: 'Insert NPC',
      disabled: this.isWorld,
      onclick: function() {
        self.closeMenu();
        self.insertNPC();
      }
    });

    this.menu.createMenuItem(this.menu.topMenu, {
      name: 'Delete Trigger',
      disabled: this.selectedTrigger === null,
      onclick: function() {
        self.closeMenu();
        self.deleteTrigger();
      }
    });

    this.menu.open(e.x, e.y);
  }

  closeMenu() {
    if (this.menu) this.menu.close();
  }

  setTiles() {
    // return if not dragging
    if (!this.clickPoint) return;

    const x = this.selection.x;
    const y = this.selection.y;
    const w = this.selection.w;
    const h = this.selection.h;

    const l = ((x << 4) - this.ppu.layers[this.l].x) % this.ppu.width;
    const r = l + (w << 4);
    const t = ((y << 4) - this.ppu.layers[this.l].y) % this.ppu.height;
    const b = t + (h << 4);
    const rect = new Rect(l, r, t, b);

    this.selectedLayer.setSelection(this.selection);
    this.invalidateMap(rect);
    this.drawMap();
  }

  selectTiles() {
    // return if not dragging
    if (!this.clickPoint) return;

    const x = Math.min(this.selection.x, this.clickPoint.x);
    const y = Math.min(this.selection.y, this.clickPoint.y);
    const w = Math.abs(this.selection.x - this.clickPoint.x) + 1;
    const h = Math.abs(this.selection.y - this.clickPoint.y) + 1;

    this.selection = this.selectedLayer.getSelection(x, y, w, h);

    if (w === 1 && h === 1) {
      // select a single tile in the tileset view
      const tile = this.selection.tilemap[0];
      this.tileset.selection = {
        x: tile & 0x0F,
        y: tile >> 4,
        w: 1, h: 1,
        tilemap: new Uint8Array([tile])
      };
      if (this.l === 0) {
        this.selectTileProperties(tile);
      }
    } else {
      this.tileset.selection = null;
    }
    this.tileset.drawCursor();
  }

  selectWorldBattle(x, y) {

    x >>= 5;
    y >>= 5;

    let sector = 0;
    let offset = 0;
    if (this.w === 0) {
      // overworld
      x &= 7;
      y &= 7;
      sector = x + (y << 3);
    } else if (this.w === 1) {
      // underground
      offset = 64;
      x &= 3;
      y &= 3;
      sector = x + (y << 2) + 64;
    } else if (this.w === 2) {
      // moon
      offset = 80;
      x &= 1;
      y &= 1;
      sector = x + (y << 1) + 80;
    }

    // this.gui.select(`worldBattle[${sector}]`);
  }

  selectTileProperties(t) {
    // select tile properties
    this.gui.select(`${this.tpPath}[${t}]`);
  }

  selectLayer(l) {
    // set the selected layer
    l = Number(l);
    if (isNumber(l)) this.l = l;

    if (this.isWorld) {
      this.selectedLayer = this.layer[0]
    } else {
      this.selectedLayer = this.layer[this.l]
    }

    this.showCursor = (this.l === 3);
    this.drawScreen();
    this.drawCursor();
  }

  changeLayer(id) {
    this[id] = document.getElementById(id).checked;
    this.ppu.layers[0].main = this.showLayer1;
    if (!this.isWorld) {
      this.ppu.layers[0].sub = this.showLayer1 && this.mpObj.addition;
      this.ppu.layers[1].main = this.showLayer2;
    }
    this.invalidateMap();
    this.drawMap();
  }

  loadMap() {

    this.resetControls();
    this.observer.reset();
    this.mpObj = this.dataMgr.getObject(this.mpPath);

    this.observer.startObservingAssembly(this.mpPath, {
      callback: this.loadMap,
      target: this
    });

    // observe tile properties (redraw map and tileset, don't reload)
    const g = this.mpObj.graphics;
    this.tpPath = `mapTileProperties[${g}]`;
    this.tpArray = this.dataMgr.getObject(this.tpPath);
    for (let t = 0; t < this.tpArray.length; t++) {
      this.observer.startObservingAssembly(`${this.tpPath}[${t}]`, {
        callback: function() {
          this.drawMap();
          this.tileset.redraw();
        },
        target: this
      });
    }

    // set the battle background
    const battleEditor = this.gui.getEditor('FF4BattleEditor');
    battleEditor.bg = this.mpObj.battleBackground;
    battleEditor.altPalette = this.mpObj.battleBackgroundPalette;

    // graphics adjacent in ROM are loaded sequentially
    const gfxTable = [
      [0],
      [1],
      [2,4],
      [3],
      [4,5],
      [5,6],
      [6,7],
      [7,1],
      [8],
      [9,8],
      [8],
      [8],
      [1],
      [13,14],
      [14],
      [0]
    ];

    // load graphics
    const gfx = new Uint8Array(0x10000);
    let offset = 0;
    for (let gfxID of gfxTable[g]) {
      const graphicsPath = `mapGraphics${gfxID}`;
      const graphicsData = this.dataMgr.getData(graphicsPath);
      gfx.set(graphicsData, offset);
      offset += graphicsData.length;
    }

    // load animation graphics (from 15/CB55)
    const animTable = [0, 0, 0, 2, 3, 6, 7, 10, 10, 10, 10, 10, 13, 13, 13, 16];
    const animGfxData = this.dataMgr.getData('mapAnimationGraphics');
    for (let i = 0; i < 4; i++) {
      const a = animTable[g] + i;
      const start = a * 0x0400;
      const end = start + 0x0100;
      gfx.set(animGfxData.subarray(start, end), 0x4800 + i * 0x0100);
    }

    // load palette
    const pal32 = new Uint32Array(128);
    const pal8 = new Uint8Array(pal32.buffer);
    if ((g === 0) || (g === 15)) {
      // 4bpp graphics
      const palData1 = this.dataMgr.getData(`mapPalettes[${this.mpObj.palette}]`);
      const palData2 = this.dataMgr.getData(`mapPalettes[${this.mpObj.palette + 1}]`);
      // this.observer.startObserving(pal1, this.loadMap);
      // this.observer.startObserving(pal2, this.loadMap);
      for (let p = 1; p < 8; p++) {
        const start = p * 32;
        const end = start + 32;
        pal8.set(palData1.subarray(start, end), p * 64);
        pal8.set(palData2.subarray(start, end), p * 64 + 32);
      }
    } else {
      // 3bpp graphics
      const palData = this.dataMgr.getData(`mapPalettes[${this.mpObj.palette}]`);
      // this.observer.startObserving(pal1, this.loadMap);
      for (let p = 1; p < 8; p++) {
        const start = p * 32;
        const end = start + 32;
        pal8.set(palData.subarray(start, end), p * 64);
      }
    }
    pal32[0] = 0xFF000000;  // set background color to black

    const tilesetData8 = this.dataMgr.getData(`mapTilesets[${g}]`);
    const tilesetData = new Uint32Array(tilesetData8.buffer);
    // this.observer.startObserving(tileset, this.loadMap);

    let layoutPath;
    if (this.mpObj.layoutMSB || this.m >= 256) {
      layoutPath = 'mapLayouts2';
    } else {
      layoutPath = 'mapLayouts1';
    }

    // load and de-interlace tile layouts
    const l1 = this.mpObj.layout1;
    this.layer[0].type = FF4MapLayer.Type.layer1;
    this.layer[0].loadLayout({
      layoutPath: `${layoutPath}[${l1}]`,
      tileset: tilesetData,
      w: 32, h: 32
    });
    this.observer.startObserving(this.layer[0].layoutPath, {
      callback: function() {
        this.layer[0].getLayout();
        this.layer[0].decodeLayout();
        this.invalidateMap();
        this.drawMap();
      },
      target: this
    });

    const l2 = this.mpObj.layout2;
    this.layer[1].loadLayout({
      layoutPath: `${layoutPath}[${l2}]`,
      tileset: tilesetData,
      w: 32, h: 32
    });
    this.observer.startObserving(this.layer[1].layoutPath, {
      callback: function() {
        this.layer[1].getLayout();
        this.layer[1].decodeLayout();
        this.invalidateMap();
        this.drawMap();
      },
      target: this
    });

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = this.gui.gammaCorrectedPalette(pal32);
    this.ppu.height = 32 * 16;
    this.ppu.width = 32 * 16;
    this.ppu.back = true;
    this.ppu.subtract = false;
    this.ppu.half = this.mpObj.addition;

    // layer 1
    this.ppu.layers[0].cols = this.layer[0].w * 2;
    this.ppu.layers[0].rows = this.layer[0].h * 2;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = gfx;
    this.ppu.layers[0].tiles = this.layer[0].tiles;
    this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen
    this.ppu.layers[0].sub = this.showLayer1 && this.mpObj.addition;
    this.ppu.layers[0].math = this.mpObj.addition;

    // layer 2
    this.ppu.layers[1].cols = this.layer[1].w * 2;
    this.ppu.layers[1].rows = this.layer[1].h * 2;
    this.ppu.layers[1].z[0] = GFX.Z.snes2L;
    this.ppu.layers[1].z[1] = GFX.Z.snes2H;
    this.ppu.layers[1].gfx = gfx;
    this.ppu.layers[1].tiles = this.layer[1].tiles;
    this.ppu.layers[1].main = this.showLayer2;
    this.ppu.layers[1].sub = false;
    this.ppu.layers[1].math = this.mpObj.addition;

    this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
    this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
    this.mapCanvas.width = this.ppu.width;
    this.mapCanvas.height = this.ppu.height;

    this.invalidateMap();
    this.selectedTrigger = null;
    this.loadTriggers();
    this.scroll();

    this.tileset.loadMap();
  }

  loadWorldMap(m) {

    this.mpObj = null;
    this.resetControls();
    this.observer.reset();

    const graphics = this.dataMgr.getData(`worldGraphics[${this.w}]`);
    const pal8 = this.dataMgr.getData(`worldPalettes[${this.w}]`);
    const palette = new Uint32Array(pal8.buffer);
    const tilePalPath = `worldPaletteAssignments[${this.w}]`;
    const tileset8 = this.dataMgr.getData(`worldTilesets[${this.w}]`);
    const tileset = new Uint32Array(tileset8.buffer);

    // observe tile properties
    this.tpPath = `worldTileProperties[${this.w}]`;
    this.tpArray = this.dataMgr.getObject(this.tpPath);
    for (let t = 0; t < this.tpArray.length; t++) {
      this.observer.startObservingAssembly(`${this.tpPath}[${t}]`, {
        callback: function() {
          this.drawMap();
          this.tileset.redraw();
        },
        target: this
      });
    }

    // const self = this;
    // this.observer.startObserving([
    //   graphics,
    //   palette,
    //   paletteAssignment,
    //   tileset
    // ], this.loadMap);

    const size = (this.w === 2) ? 64 : 256;
    this.layer[0].type = FF4MapLayer.Type.world;
    this.layer[0].loadLayout({
      layoutPath: `worldLayout${this.w + 1}`,
      tilePalPath: tilePalPath,
      tileset: tileset,
      w: size, h: size
    });
    this.observer.startObserving(this.layer[0].layoutPath, {
      callback: function() {
        this.layer[0].getLayout();
        this.layer[0].decodeLayout();
        this.invalidateMap();
        this.drawMap();
      },
      target: this
    });

    // set up the ppu
    this.ppu = new GFX.PPU();
    this.ppu.pal = this.gui.gammaCorrectedPalette(palette);
    this.ppu.width = size * 16;
    this.ppu.height = size * 16;
    this.ppu.back = true;

    // layer 1
    this.ppu.layers[0].cols = size * 2;
    this.ppu.layers[0].rows = size * 2;
    this.ppu.layers[0].z[0] = GFX.Z.snes1L;
    this.ppu.layers[0].z[1] = GFX.Z.snes1H;
    this.ppu.layers[0].gfx = graphics;
    this.ppu.layers[0].tiles = this.layer[0].tiles;
    this.ppu.layers[0].main = this.showLayer1; // layer 1 always in main screen

    this.scrollDiv.style.width = `${this.ppu.width * this.zoom}px`;
    this.scrollDiv.style.height = `${this.ppu.height * this.zoom}px`;
    this.mapCanvas.width = this.ppu.width;
    this.mapCanvas.height = this.ppu.height;

    this.invalidateMap();
    this.selectedTrigger = null;
    this.loadTriggers();
    this.scroll();

    this.tileset.loadMap(m);
  }

  invalidateMap(rect) {
    const clipX = Math.ceil(this.ppu.width / 256);
    const clipY = Math.ceil(this.ppu.height / 256);
    if (!rect) {
      // invalidate all sectors
      const sectorCount = clipX * clipY;
      this.mapSectors = new Array(sectorCount);
      this.dirtyRect = null;
    } else if (this.dirtyRect) {
      // combine dirty areas
      const left = Math.min(this.dirtyRect.l, rect.l);
      const top = Math.min(this.dirtyRect.t, rect.t);
      const right = Math.max(this.dirtyRect.r, rect.r);
      const bottom = Math.max(this.dirtyRect.b, rect.b);
      this.dirtyRect = new Rect(left, right, top, bottom);
    } else {
      // set a new dirty area
      this.dirtyRect = rect;
    }
  }

  drawMap() {

    // update the map canvas
    const mapContext = this.mapCanvas.getContext('2d');
    const clip = Math.ceil(this.ppu.width / 256);

    // draw all visible sectors
    for (let s = 0; s < this.mapSectors.length; s++) {
      // continue if this sector is already drawn
      if (this.mapSectors[s]) continue;

      // continue if this sector is not visible
      const col = s % clip;
      const row = Math.floor(s / clip);
      const l = col * 256;
      const r = l + 256;
      const t = row * 256;
      const b = t + 256;
      const sectorRect = new Rect(l, r, t, b);
      if (this.mapRect.intersect(sectorRect.scale(this.zoom)).isEmpty()) continue;

      // draw the sector (256 x 256 pixels)
      const imageData = mapContext.createImageData(256, 256);
      this.ppu.renderPPU(imageData.data, sectorRect.l, sectorRect.t, 256, 256);
      mapContext.putImageData(imageData, sectorRect.l, sectorRect.t);

      // validate the sector
      this.mapSectors[s] = true;
    }

    // redraw dirty portions of the map
    if (this.dirtyRect) {

      const rect = this.dirtyRect;
      this.dirtyRect = null;

      // render the image on the map canvas
      const imageData = mapContext.createImageData(rect.w, rect.h);
      this.ppu.renderPPU(imageData.data, rect.l, rect.t, rect.w, rect.h);
      mapContext.putImageData(imageData, rect.l, rect.t);
    }

    const context = this.canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.globalCompositeOperation = 'copy';
    const scaledRect = this.mapRect.scale(1 / this.zoom);
    context.drawImage(this.mapCanvas,
      scaledRect.l, scaledRect.t, scaledRect.w, scaledRect.h,
      0, 0, this.mapRect.w, this.mapRect.h
    );

    this.drawMask();
    this.drawTriggers();
    this.drawNPCs();
    this.drawScreen();
    this.drawCursor();
  }

  drawMask() {

    if (this.tileMask === FF4Map.TileMasks.none) return;

    const context = this.canvas.getContext('2d');
    context.globalCompositeOperation = 'source-over';

    // calculate coordinates on the map rect
    const xStart = (this.mapRect.l / this.zoom) >> 4;
    const xEnd = (this.mapRect.r / this.zoom) >> 4;
    const yStart = (this.mapRect.t / this.zoom) >> 4;
    const yEnd = (this.mapRect.b / this.zoom) >> 4;
    const xOffset = (this.mapRect.l / this.zoom) % 16;
    const yOffset = (this.mapRect.t / this.zoom) % 16;
    const w = this.layer[0].w;
    const h = this.layer[0].h;

    // draw the mask at each tile
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {

        const t = (x % w) + (y % h) * w;
        const tile = this.layer[0].layout[t];
        const color = this.maskColorAtTile(tile);
        if (!color) continue;
        context.fillStyle = color;

        const left = (((x - xStart) << 4) - xOffset) * this.zoom;
        const top = (((y - yStart) << 4) - yOffset) * this.zoom;
        const size = 16 * this.zoom;

        context.fillRect(left, top, size, size);
      }
    }
  }

  maskColorAtTile(t) {
    const tpObj = this.tpArray[t];
    const tp = tpObj.byte1 | tpObj.byte2 << 8;

    if (this.isWorld) {
      if (this.tileMask === FF4Map.WorldTileMasks.zUpper) {
        if (!(tp & 0x40)) {
          return 'rgba(0, 0, 255, 0.5)';
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.zLower) {
        if (!(tp & 1)) {
          return 'rgba(0, 0, 255, 0.5)';
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.triggers) {
        if (tp & 0x1000) {
          return 'rgba(0, 255, 255, 0.5)'; // trigger (cyan)
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.battle) {
        if (tp & 0x0800) {
          return 'rgba(255, 0, 0, 0.5)';
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.forest) {
        if (tp & 0x0100) {
          return 'rgba(255, 255, 0, 0.5)'; // bottom half hidden (yellow)
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.chocoboNoLava) {
        if (tp & 0x02) {
          return 'rgba(255, 255, 0, 0.5)'; // chocobo/no lava (yellow)
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.blackChocoboFly) {
        if (tp & 0x04) {
          return 'rgba(255, 255, 0, 0.5)'; // yellow
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.blackChocoboLand) {
        if (tp & 0x08) {
          return 'rgba(255, 255, 0, 0.5)'; // yellow
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.hovercraft) {
        if (tp & 0x10) {
          return 'rgba(255, 255, 0, 0.5)'; // yellow
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.airshipFly) {
        if (tp & 0x20) {
          return 'rgba(255, 255, 0, 0.5)'; // yellow
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.airshipLand) {
        if (tp & 0x0200) {
          return 'rgba(255, 255, 0, 0.5)'; // yellow
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.lunarWhale) {
        if (tp & 0x80) {
          return 'rgba(255, 255, 0, 0.5)'; // yellow
        }
      } else if (this.tileMask === FF4Map.WorldTileMasks.unknown) {
        if (tp & 0x0400) {
          return 'rgba(255, 255, 0, 0.5)'; // yellow
        }
      }
    } else {
      if (this.tileMask === FF4Map.TileMasks.zUpper) {
        if (tp & 0x04) {
          return 'rgba(0, 255, 255, 0.5)'; // bridge
        } else if (!(tp & 0x01)) {
          return 'rgba(0, 0, 255, 0.5)';
        }
      } else if (this.tileMask === FF4Map.TileMasks.zLower) {
        if (tp & 0x04) {
          return 'rgba(0, 255, 255, 0.5)'; // bridge
        } else if (!(tp & 0x02)) {
          return 'rgba(0, 0, 255, 0.5)';
        }
      } else if (this.tileMask === FF4Map.TileMasks.triggers) {
        if (tp & 0x0008) {
          return 'rgba(0, 255, 0, 0.5)'; // save point (green)
        } else if (tp & 0x0010) {
          return 'rgba(0, 0, 255, 0.5)'; // door (blue)
        } else if (tp & 0x1000) {
          return 'rgba(255, 255, 0, 0.5)'; // exit (yellow)
        } else if (tp & 0x2000) {
          return 'rgba(255, 0, 255, 0.5)'; // through-tile (magenta)
        } else if (tp & 0x8000) {
          return 'rgba(0, 255, 255, 0.5)'; // trigger (cyan)
        } else if (tp & 0x0100) {
          return 'rgba(255, 0, 0, 0.5)'; // damage (red)
        } else if (tp & 0x0200) {
          return 'rgba(0, 255, 255, 0.5)'; // unknown (white)
        }
      } else if (this.tileMask === FF4Map.TileMasks.battle) {
        if (tp & 0x4000) {
          return 'rgba(255, 0, 0, 0.5)';
        }
      } else if (this.tileMask === FF4Map.TileMasks.spriteVisibility) {
        if (tp & 0x0400) {
          return 'rgba(0, 0, 255, 0.5)'; // entire sprite hidden (blue)
        } else if (tp & 0x0800) {
          return 'rgba(255, 255, 0, 0.5)'; // bottom half hidden (yellow)
        }
      }
    }

    return null;
  }

  drawScreen() {

    this.screenCanvas.style.display = 'none';
    if (!this.showScreen) return;

    // calculate the screen rect
    const x = ((this.selection.x * 16) - this.ppu.layers[this.l].x) % this.ppu.width;
    const y = ((this.selection.y * 16) - this.ppu.layers[this.l].y) % this.ppu.height;
    let screenRect = new Rect(x - 7 * 16 + 1, x + 9 * 16 - 1, y - 7 * 16 + 1, y + 7 * 16 + 1);

    screenRect.l = Math.max(0, screenRect.l);
    screenRect.r = Math.min(this.ppu.width, screenRect.r);
    screenRect.t = Math.max(0, screenRect.t);
    screenRect.b = Math.min(this.ppu.height, screenRect.b);

    // scale and offset to match the map rect
    screenRect = screenRect.scale(this.zoom).offset(-this.mapRect.l, -this.mapRect.t);

    // draw the screen mask
    this.screenCanvas.width = this.mapRect.w;
    this.screenCanvas.height = this.mapRect.h;
    this.screenCanvas.style.left = `${this.mapRect.l}px`;
    this.screenCanvas.style.top = `${this.mapRect.t}px`;
    this.screenCanvas.style.display = 'block';
    const ctx = this.screenCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
    ctx.fillRect(screenRect.l, screenRect.t, screenRect.w, screenRect.h);
  }

  drawCursor() {

    this.cursorCanvas.style.display = 'none';
    if (!this.showCursor) return;

    const col = this.selection.x;
    const row = this.selection.y;

    // get the cursor geometry and color
    let x = ((col << 4) - this.ppu.layers[this.l].x) % this.ppu.width;
    x *= this.zoom;
    let y = ((row << 4) - this.ppu.layers[this.l].y) % this.ppu.height;
    y *= this.zoom;
    let w = this.selection.w * 16;
    w *= this.zoom;
    let h = this.selection.h * 16;
    h *= this.zoom;
    const colors = ['green', 'blue', 'red', 'white'];
    let c = colors[this.l];

    // draw the cursor around the selected trigger
    if (this.l === 3) {
      if (!this.selectedTrigger || this.triggers.indexOf(this.selectedTrigger) === -1) return;
      x = this.selectedTrigger.x * 16 * this.zoom;
      y = this.selectedTrigger.y * 16 * this.zoom;
      w = 16 * this.zoom;
      h = 16 * this.zoom;

      if (this.selectedTrigger.type === 'event') {
        c = 'rgba(0, 0, 255, 1.0)';
      } else if (this.selectedTrigger.type === 'entrance') {
        c = 'rgba(255, 0, 0, 1.0)';
      } else if (this.selectedTrigger.type === 'treasure') {
        c = 'rgba(255, 255, 0, 1.0)';
      } else if (this.selectedTrigger.type === 'npc') {
        c = 'rgba(128, 128, 128, 1.0)';
      }
    }

    // draw the cursor
    w = Math.min(this.ppu.width * this.zoom - x, w);
    h = Math.min(this.ppu.height * this.zoom - y, h);
    if (w <= 0 || h <= 0) return;

    // set up the cursor canvas
    this.cursorCanvas.width = w;
    this.cursorCanvas.height = h;
    this.cursorCanvas.style.left = `${x}px`;
    this.cursorCanvas.style.top = `${y}px`;
    this.cursorCanvas.style.display = 'block';
    const context = this.cursorCanvas.getContext('2d');

    // convert the selection to screen coordinates
    context.lineWidth = 1;
    context.strokeStyle = 'black';
    x = 0.5; y = 0.5; w--; h--;
    context.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    context.strokeStyle = c;
    context.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    context.strokeStyle = 'white';
    context.strokeRect(x, y, w, h);
    x++; y++; w -= 2; h -= 2;
    context.strokeStyle = 'black';
    context.strokeRect(x, y, w, h);
  }

  reloadTriggers() {
    this.loadTriggers();
    this.drawMap();
  }

  loadTriggers() {

    this.triggers = [];
    this.triggerObserver.reset();

    // load triggers
    let triggerArrayPath;
    if (this.isWorld) {
      triggerArrayPath = `worldTriggers${this.w + 1}`;
    } else if (this.m < 256) {
      triggerArrayPath = `mapTriggers1[${this.m}]`;
    } else {
      triggerArrayPath = `mapTriggers2[${this.m - 256}]`;
    }
    this.triggerObserver.startObserving(triggerArrayPath, {
      callback: this.reloadTriggers,
      target: this
    });
    const triggerArray = this.dataMgr.getObject(triggerArrayPath);
    for (let i = 0; i < triggerArray.length; i++) {
      const triggerObj = triggerArray[i];
      const trigger = {
        path: `${triggerArrayPath}[${i}]`,
        x: triggerObj.x,
        y: triggerObj.y
      };
      this.triggers.push(trigger);
      if (triggerObj.map === 0xFE) {
        trigger.type = 'treasure';
      } else if (triggerObj.map === 0xFF) {
        trigger.type = 'event';
      } else {
        trigger.type = 'entrance';
      }
      this.triggerObserver.startObserving(`${trigger.path}.x`, {
        callback: function() {
          trigger.x = this.dataMgr.getProperty(`${trigger.path}.x`);
          this.drawMap();
        },
        target: this
      });
      this.triggerObserver.startObserving(`${trigger.path}.y`, {
        callback: function() {
          trigger.y = this.dataMgr.getProperty(`${trigger.path}.y`);
          this.drawMap();
        },
        target: this
      });
    }

    // load npcs
    if (this.isWorld) return;
    let npcIndex = this.mpObj.npc;
    if (npcIndex === 0 && this.m !== 0) return;
    let npcMSB = false;
    if (this.mpObj.npcMSB || this.m >= 256) {
      npcIndex += 256;
      npcMSB = true;
    }
    const npcArrayPath = `npcProperties[${npcIndex}]`;
    const npcProperties = this.dataMgr.getObject(npcArrayPath);

    // reload if an npc is added or removed
    this.triggerObserver.startObserving(npcArrayPath, {
      callback: this.reloadTriggers,
      target: this
    });

    for (let i = 0; i < npcProperties.length; i++) {
      const npcObj = npcProperties[i];
      npcObj.npcMSB = npcMSB;
      const npc = {
        path: `${npcArrayPath}[${i}]`,
        x: npcObj.x,
        y: npcObj.y,
        type: 'npc'
      };
      this.triggers.push(npc);

      // redraw if npc position changes
      this.triggerObserver.startObserving(`${npc.path}.x`, {
        callback: function() {
          npc.x = this.dataMgr.getProperty(`${npc.path}.x`);
          this.drawMap();
        },
        target: this
      });
      this.triggerObserver.startObserving(`${npc.path}.y`, {
        callback: function() {
          npc.y = this.dataMgr.getProperty(`${npc.path}.y`);
          this.drawMap();
        },
        target: this
      });

      // reload if switch changes in order to observe the new graphics index
      this.triggerObserver.startObserving(`${npc.path}.switch0`, {
        callback: this.reloadTriggers,
        target: this
      });
      this.triggerObserver.startObserving(`${npc.path}.switch1`, {
        callback: this.reloadTriggers,
        target: this
      });

      // redraw if palette or facing direction changes
      this.triggerObserver.startObserving(`${npc.path}.palette`, {
        callback: this.drawMap,
        target: this
      });
      this.triggerObserver.startObserving(`${npc.path}.direction`, {
        callback: this.drawMap,
        target: this
      });

      // redraw if graphics index changes
      let graphicsIndex = npcObj.switch0;
      if (npcObj.npcMSB) {
        graphicsIndex = npcObj.switch1 + 256;
      }
      const graphicsPath = `npcGraphicsProperties[${graphicsIndex}]`;
      this.triggerObserver.startObserving(graphicsPath, {
        callback: this.drawMap,
        target: this
      });
    }
  }

  selectTrigger(trigger) {
    this.selectedTrigger = trigger;
    if (!trigger) return;
    this.gui.select(trigger.path);
  }

  insertTrigger(type) {

    let triggerArrayPath;
    if (this.isWorld) {
      triggerArrayPath = `worldTriggers${this.w + 1}`;
    } else if (this.m < 256) {
      triggerArrayPath = `mapTriggers1[${this.m}]`;
    } else {
      triggerArrayPath = `mapTriggers2[${this.m - 256}]`;
    }

    // put the new trigger at the end
    const triggerArray = this.dataMgr.getObject(triggerArrayPath);
    let i = triggerArray.length;
    if (type === 'treasure') {
      // treasures have to come first, find the last one in the array
      for (i = 0; i < triggerArray.length; i++) {
        if (triggerArray[i].map !== 0xFE) break;
      }
    }

    // create the new trigger
    this.triggerObserver.sleep();
    const triggerPath = this.dataMgr.arrayInsert(triggerArrayPath, i);
    this.triggerObserver.wake();

    // set the new trigger's properties
    const triggerObj = this.dataMgr.getObject(triggerPath);
    triggerObj.x = this.clickPoint.x;
    triggerObj.y = this.clickPoint.y;
    if (type === 'treasure') {
      triggerObj.map = 0xFE;
    } else if (type === 'event') {
      triggerObj.map = 0xFF;
    }

    this.reloadTriggers();
    this.selectTrigger(this.triggers[i]);

    // focus on this div to get keypress events
    this.div.focus();
  }

  insertNPC() {

    // get the npc properties
    if (this.isWorld) return;
    let npcIndex = this.mpObj.npc;
    if (npcIndex === 0 && this.m !== 0) return;
    let npcMSB = false;
    if (this.mpObj.npcMSB || this.m >= 256) {
      npcIndex += 256;
      npcMSB = true;
    }
    const npcArrayPath = `npcProperties[${npcIndex}]`;

    // create the new npc
    this.triggerObserver.sleep();
    const npcPath = this.dataMgr.arrayInsert(npcArrayPath);
    this.triggerObserver.wake();

    // set the npc's properties
    const npcObj = this.dataMgr.getObject(npcPath);
    npcObj.x = this.clickPoint.x;
    npcObj.y = this.clickPoint.y;

    // the new npc will be the last trigger
    this.reloadTriggers();
    const i = this.triggers.length - 1;
    this.selectTrigger(this.triggers[i]);
  }

  deleteTrigger() {

    const trigger = this.selectedTrigger;
    if (!trigger) return;
    const triggerArrayPath = this.dataMgr.getParentPath(trigger.path);
    const index = this.dataMgr.getIndex(trigger.path);

    this.triggerObserver.sleep();
    this.dataMgr.arrayRemove(triggerArrayPath, index);
    this.triggerObserver.wake();

    this.reloadTriggers();
    this.selectTrigger(null);
  }

  drawTriggerRect(x, y, color, context) {

    // function for drawing trigger rectangles with rounded corners
    const r = this.zoom * 2;
    const s = this.zoom * 16 - 4 + 1;

    context.lineWidth = 1;
    context.strokeStyle = 'white';
    context.fillStyle = color;

    context.beginPath();
    context.moveTo(x, y + r);
    context.arcTo(x, y, x + r, y, r);
    context.lineTo(x + s - r, y);
    context.arcTo(x + s, y, x + s, y + r, r);
    context.lineTo(x + s, y + s - r);
    context.arcTo(x + s, y + s, x + s - r, y + s, r);
    context.lineTo(x + r, y + s);
    context.arcTo(x, y + s, x, y + s - r, r);
    context.closePath();
    context.fill();
    context.stroke();
  }

  drawTriggers() {

    if (!this.showTriggers) return;

    const xClient = this.mapRect.l;
    const yClient = this.mapRect.t;
    const context = this.canvas.getContext('2d');
    context.globalCompositeOperation = 'source-over';

    for (const trigger of this.triggers) {
      const triggerRect = this.rectForTrigger(trigger);
      if (this.mapRect.intersect(triggerRect).isEmpty()) continue;
      let color = 'purple';
      if (trigger.type === 'event') {
        color = 'rgba(0, 0, 255, 0.5)';  // event
      } else if (trigger.type === 'treasure') {
        color = 'rgba(255, 255, 0, 0.5)';  // treasure
      } else if (trigger.type === 'npc') {
        color = 'rgba(128, 128, 128, 0.5)';  // npc
      } else if (trigger.type === 'entrance') {
        color = 'rgba(255, 0, 0, 0.5)';  // entrance
      }
      const x = trigger.x * this.zoom * 16 + 2 - 0.5 - xClient;
      const y = trigger.y * this.zoom * 16 + 2 - 0.5 - yClient;
      this.drawTriggerRect(x, y, color, context);
    }
  }

  drawNPCs() {
    if (!this.showTriggers) return;

    // draw npcs
    for (let trigger of this.triggers) {
      if (trigger.type !== 'npc') continue;
      this.drawNPC(trigger);
    }
  }

  triggerAt(x, y) {

    const triggers = this.triggersAt(x, y);
    if (triggers.length === 0) return null;
    return triggers[0];
  }

  triggersAt(x, y) {
    const triggers = [];

    for (const trigger of this.triggers) {
      const rect = this.rectForTrigger(trigger);
      if (rect.containsPoint(x, y)) triggers.push(trigger);
    }
    return triggers;
  }

  rectForTrigger(trigger) {
    const l = trigger.x * 16 * this.zoom;
    const r = l + 16 * this.zoom;
    const t = trigger.y * 16 * this.zoom;
    const b = t + 16 * this.zoom;
    return new Rect(l, r, t, b);
  }

  drawNPC(npc) {

    const x = npc.x * 16;
    const y = npc.y * 16;
    const w = 16;
    const h = 16;

    const npcObj = this.dataMgr.getObject(npc.path);
    let index = npcObj.switch0;
    if (npcObj.npcMSB) {
      index = npcObj.switch1 + 256;
    }
    const g = this.dataMgr.getProperty(`npcGraphicsProperties[${index}]`);
    const direction = npcObj.direction;
    let p = npcObj.palette;

    // decode palette
    const pal = new Uint32Array(0x80);
    const pal8 = new Uint8Array(pal.buffer);
    const p1 = this.mpObj.npcPalette1 * 2 + 13;
    const p2 = this.mpObj.npcPalette2 * 2 + 13;
    pal8.set(this.dataMgr.getData(`npcPalettes[0]`), 0x00);
    pal8.set(this.dataMgr.getData(`npcPalettes[1]`), 0x40);
    pal8.set(this.dataMgr.getData(`npcPalettes[2]`), 0x80);
    pal8.set(this.dataMgr.getData(`npcPalettes[3]`), 0xC0);
    pal8.set(this.dataMgr.getData(`npcPalettes[${p1}]`), 0x0100);
    pal8.set(this.dataMgr.getData(`npcPalettes[${p1 + 1}]`), 0x0140);
    pal8.set(this.dataMgr.getData(`npcPalettes[${p2}]`), 0x0180);
    pal8.set(this.dataMgr.getData(`npcPalettes[${p2 + 1}]`), 0x01C0);
    if (g < 14) {
      // character palette (from 15/B2FA)
      const characterPalettes = [0, 0, 1, 2, 2, 2, 0, 1, 1, 3, 0, 1, 0, 0, 0, 0, 0, 0];
      p = characterPalettes[g] << 20;
    } else {
      // npc palette
      p += 4;
      p <<= 20;
    }

    const spriteGraphics = this.dataMgr.getData(`mapSpriteGraphics[${g}]`);
    const tileCount = spriteGraphics.length >> 6;
    let offset = 0;
    let tileData = new Uint32Array([0 | p, 1 | p, 2 | p, 3 | p]);
    if (direction === 0 && tileCount > 1) {
      // up
      offset = 0x100;
    } else if (direction === 1 && tileCount > 2) {
      // right
      offset = 0x200;
      p |= 0x10000000;
      tileData = new Uint32Array([1 | p, 0 | p, 3 | p, 2 | p]);
    } else if (direction === 2) {
      // down
      offset = 0;
    } else if (direction === 3 && tileCount > 2) {
      // left
      offset = 0x200;
    }

    const gfx = spriteGraphics.subarray(offset, offset + 0x100);

    // sprite are shifted up by 2 pixels
    let npcRect = new Rect(x, x + w, y - 2, y + h - 2);
    npcRect = npcRect.scale(this.zoom);
    if (this.mapRect.intersect(npcRect).isEmpty()) return;

    // set up the ppu
    const ppu = new GFX.PPU();
    ppu.pal = this.gui.gammaCorrectedPalette(pal);
    ppu.width = w;
    ppu.height = h;

    // layer 1
    ppu.layers[0].cols = w >> 3;
    ppu.layers[0].rows = h >> 3;
    ppu.layers[0].z[0] = GFX.Z.snesS0;
    ppu.layers[0].z[1] = GFX.Z.snesS1;
    ppu.layers[0].z[2] = GFX.Z.snesS2;
    ppu.layers[0].z[3] = GFX.Z.snesS3;
    ppu.layers[0].gfx = gfx;
    ppu.layers[0].tiles = tileData;
    ppu.layers[0].main = true;

    // draw the npc
    this.npcCanvas.width = w;
    this.npcCanvas.height = h;
    const npcContext = this.npcCanvas.getContext('2d');
    const imageData = npcContext.createImageData(w, h);
    ppu.renderPPU(imageData.data);
    npcContext.putImageData(imageData, 0, 0);

    const ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    npcRect = npcRect.offset(-this.mapRect.l, -this.mapRect.t);
    ctx.drawImage(this.npcCanvas,
      0, 0, w, h,
      npcRect.l, npcRect.t, npcRect.w, npcRect.h
    );
  }
}

FF4Map.TileMasks = {
  none: 'None',
  zUpper: 'Passable on Upper Z-Level',
  zLower: 'Passable on Lower Z-Level',
  triggers: 'Trigger Tiles',
  battle: 'Enable Random Battles',
  spriteVisibility: 'Sprite Visibility'
}

FF4Map.WorldTileMasks = {
  none: 'None',
  zUpper: 'Passable on Upper Z-Level',
  zLower: 'Passable on Lower Z-Level',
  triggers: 'Trigger Tiles',
  chocoboNoLava: 'Chocobo Can Move/Lava',
  blackChocoboFly: 'Black Chocobo Can Fly',
  blackChocoboLand: 'Black Chocobo Can Land',
  hovercraft: 'Hovercraft Can Move',
  airshipFly: 'Airship Can Fly (No Lava)',
  airshipLand: 'Airship Can Land',
  lunarWhale: 'Lunar Whale Can Fly',
  battle: 'Enable Random Battles',
  forest: 'Hide Bottom of Sprite',
  unknown: 'Unknown 1.2'
}
