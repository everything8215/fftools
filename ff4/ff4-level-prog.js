//
// ff4-level.js
// created 2/5/2020
//

class FF4LevelProgression extends ROMEditor {
  constructor(gui) {
    super(gui);

    this.name = 'FF4LevelProgression';

    this.div.classList.add('chart-edit');

    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.div.appendChild(this.canvas);

    this.tooltip = document.createElement('span');
    this.tooltip.setAttribute('data-balloon-pos', 'up');
    this.tooltip.style.position = 'absolute';
    this.div.appendChild(this.tooltip);

    this.showStat = [true, false, false, false, false, false, false, false];
    this.showRange = false;
    this.showLegend = true;

    this.chartData = [];
    this.c = 0;
    this.charPropPath = null;
    this.selectedPoint = null;
    this.mousePoint = null;

    const self = this;
    this.div.onmousedown = function(e) { self.mouseDown(e); };
    this.div.onmouseleave = function(e) { self.mouseLeave(e); };
    this.div.onmousemove = function(e) { self.mouseMove(e); };

    // // create an extra observer to watch character starting levels
    // this.levelObserver = new ROMObserver(this.dataMgr);

    // // saved levels for undo
    // this.undoLevels = [];

    // const levelProgData = this.data.Mgr.;
    // const levelProgPointers = this.rom.characterLevelPointer;
    //
    // for (const char of this.rom.characterStats.iterator()) {
    //   // start observing each character's starting level
    //   this.levelObserver.startObserving(char.level, this.changeStartingLevel, [char.i]);
    //   const level = char.level.value;
    //   const id = char.properties.value;
    //   const levelStats = levelProgData.item(char.i);
    //   if (!levelStats) continue;
    //
    //   const pointer = levelProgPointers.item(id);
    //   let begin = pointer.value;
    //   begin += (level - 1) * 5;
    //   begin -= this.rom.unmapAddress(levelProgData.range.begin) & 0xFFFF;
    //
    //   // set the range for the level stats and disassemble
    //   levelStats.range.begin = begin;
    //   levelStats.range.end = begin + (70 - level) * 5 + 8;
    //   levelStats.arrayLength = 70 - level;
    //   levelStats.disassemble(levelProgData.data);
    //
    //   // create the high level random stats
    //   const lastLevelStats = levelStats.item(69 - level);
    //   lastLevelStats.addAssembly(FF4LevelProgression.highLevelStatsDefiniton);
    //   lastLevelStats.range.end += 8;
    //   lastLevelStats.disassemble(levelStats.data);
    // }
    //
    // // observe characters added and removed from the party
    // for (const charAdd of this.rom.characterPartyAdd.iterator()) {
    //   this.levelObserver.startObservingSub(charAdd, this.updateLevelProgPointers);
    // }
    // for (const charRemove of this.rom.characterPartyRemove.iterator()) {
    //   this.levelObserver.startObservingSub(charRemove, this.updateLevelProgPointers);
    // }
  }

  // changeStartingLevel(c) {
  //
  //   const charProp = this.dataMgr.getObject(`CharProp[${c}]`);
  //   const levelUpProp = this.dataMgr.getObject(`LevelUpProp[${c}]`);
  //   const targetLength = 70 - charProp.obj.level;
  //
  //   if (levelUpProp.length !== targetLength) {
  //
  //     const undoLevels = this.undoLevels[c] || [];
  //
  //     // add new elements if the starting level decreased
  //     while (levelUpProp.arrayLength < targetLength) {
  //       const newLevel = undoLevels.shift() || levelUpProp.blankAssembly();
  //       levelUpProp.array.unshift(newLevel);
  //       levelUpProp.updateArray();
  //     }
  //
  //     // remove elements if the starting level increased
  //     while (levelUpProp.arrayLength > targetLength) {
  //       undoLevels.unshift(levelUpProp.array.shift());
  //       levelUpProp.updateArray();
  //     }
  //     levelUpProp.markAsDirty();
  //     levelUpProp.notifyObservers();
  //
  //     this.undoLevels[c] = undoLevels;
  //   }
  //
  //   // redraw only if this character is selected
  //   if (charProp.path === this.charProp.path) this.updateStats();
  // }

  mouseDown(e) {
    this.closeList();
    if (!this.selectedPoint) return;
    this.gui.select(this.selectedPoint.path);
  }

  mouseLeave(e) {
    this.mousePoint = null;
    this.selectedPoint = null;
    this.redraw();
  }

  mouseMove(e) {
    this.mousePoint = this.canvasToPoint(e.offsetX, e.offsetY);
    this.redraw();
  }

  show() {
    this.showControls();
    this.closeList();
    this.resize();
    super.show();
  }

  hide() {
    super.hide();
    this.charPropPath = null;
  }

  select(path) {

    if (this.charPropPath === path) return;

    this.tooltip.removeAttribute('data-balloon-visible');
    const index = this.dataMgr.getIndex(path);
    this.charPropPath = path;
    if (index < this.dataMgr.getObject('LevelUpPropLow').length) {
      this.lowLevelPath = `LevelUpPropLow[${index}]`;
      this.highLevelPath = `LevelUpPropHigh[${index}]`;
    } else {
      this.lowLevelPath = null;
      this.highLevelPath = null;
    }
    this.selectedPoint = null;
    this.mousePoint = null;
    this.loadCharacter();
  }

  resetControls() {
    super.resetControls();

    // add buttons to show/hide each stat
    function statFunction(s) {
      return function(checked) {
        this.showStat[s] = checked;
        this.redraw();
      }
    }

    for (const stat of FF4LevelProgression.stats) {
      const statButton = this.addTwoState(`showStat${stat.index}`,
        statFunction(stat.index), stat.name, this.showStat[stat.index]);
    }

    // add a button to show/hide the min/max range of each stat
    const rangeButton = this.addTwoState('showRange', function(checked) {
      this.showRange = checked;
      this.redraw();
    }, 'Min/Max', this.showRange);

    // add a button to show/hide the legend
    const legendButton = this.addTwoState('showLegend', function(checked) {
      this.showLegend = checked;
      this.redraw();
    }, 'Legend', this.showLegend);
  }

  loadCharacter() {

    this.resetControls();
    this.observer.reset();

    // update stats and redraw if stats change
    this.observer.startObservingAssembly(this.charPropPath, {
      callback: this.updateStats,
      target: this
    });

    // start observing all stats
    const startingLevel = this.dataMgr.getProperty(`${this.charPropPath}.level`);
    if (this.lowLevelPath) {
      for (let level = startingLevel + 1; level <= 70; level++) {
        this.observer.startObservingAssembly(this.getStatsPath(level), {
          callback: this.updateStats,
          target: this
        });
      }
      const highLevelPath = this.getHighLevelStatsPath();
      for (let i = 0; i < 8; i++) {
        this.observer.startObservingAssembly(`${highLevelPath}[${i}]`, {
          callback: this.updateStats,
          target: this
        });
      }
    }
    this.updateStats();
  }

  getStatsPath(level) {
    const charProp = this.dataMgr.getObject(this.charPropPath);
    const charIndex = this.dataMgr.getIndex(this.charPropPath);
    const lowLevelPath = `LevelUpPropLow[${charIndex}]`;
    const levelProgLow = this.dataMgr.getObject(lowLevelPath);
    const startingLevel = charProp.level;
    const maxIndex = levelProgLow.length - 1;
    const levelIndex = Math.min(level - startingLevel - 1, maxIndex);
    return `${lowLevelPath}[${levelIndex}]`;
  }

  getHighLevelStatsPath() {
    const charIndex = this.dataMgr.getIndex(this.charPropPath);
    return `LevelUpPropHigh[${charIndex}]`;
  }

  updateStats() {

    const charProp = this.dataMgr.getObject(this.charPropPath);
    let currentStats = {
      path: this.charPropPath,
      level: charProp.level
    };

    // get initial stats
    for (const stat of FF4LevelProgression.stats) {
      let value = 0;
      if (stat.key === 'exp') {
        value = charProp.expLastLevel;
      } else {
        value = charProp[stat.key];
      }
      currentStats[stat.key] = {
        min: value,
        max: value,
        avg: value
      }
    }
    this.chartData = [currentStats];

    if (!this.lowLevelPath) {
      this.redraw();
      return;
    }

    // get stats for levels 2 through 69
    while (currentStats.level < 70) {
      const previousStats = currentStats;
      currentStats = {
        level: previousStats.level + 1
      };

      const statsPath = this.getStatsPath(currentStats.level);
      const levelUpProp = this.dataMgr.getObject(statsPath);
      currentStats.path = statsPath;

      for (const stat of FF4LevelProgression.stats) {

        // copy the previous stat value
        const value = {};
        Object.assign(value, previousStats[stat.key]);

        if (stat.key === 'exp') {
          let expValue = this.dataMgr.getProperty(`${statsPath}.exp`);
          // expValue += levelUpProp.expMSB << 16;
          value.min += expValue;
          value.max += expValue;
          value.avg += expValue;
        } else if (stat.key === 'hp' || stat.key === 'mp') {
          const statValue = levelUpProp[stat.key];
          value.min += statValue;
          value.max += Math.floor(statValue * 9 / 8);
          value.avg += Math.floor(statValue * 17 / 8) / 2;
        } else {
          let mod = levelUpProp.statMod;
          if (mod === 7) mod = -1;
          if (levelUpProp.stats & stat.mask) {
            // stat bonus
            value.min += mod;
            value.max += mod;
            value.avg += mod;
          }
        }

        value.min = Math.max(Math.min(value.min, stat.max), 0);
        value.max = Math.max(Math.min(value.max, stat.max), 0);
        value.avg = Math.max(Math.min(value.avg, stat.max), 0);
        currentStats[stat.key] = value;
      }
      this.chartData.push(currentStats);
    }

    // calculate stats for levels 70-99
    const lastLevelPath = this.getStatsPath(70);
    const lastLevelProp = this.dataMgr.getObject(lastLevelPath);
    const statMod = {};
    const highLevelPath = this.getHighLevelStatsPath();
    const highLevelStats = this.dataMgr.getObject(highLevelPath);
    for (const stat of FF4LevelProgression.stats) {
      statMod[stat.key] = {};
      if (stat.key === 'exp') {
        // let expValue = lastLevelProp.exp;
        let expValue = this.dataMgr.getProperty(`${lastLevelPath}.exp`);
        // expValue += lastLevelProp.expMSB << 16;
        statMod[stat.key].min = expValue;
        statMod[stat.key].max = expValue;
        statMod[stat.key].avg = expValue;
      } else if (stat.key === 'hp' || stat.key === 'mp') {
        statMod[stat.key].min = lastLevelProp[stat.key];
        statMod[stat.key].max = Math.floor(lastLevelProp[stat.key] * 9 / 8);
        statMod[stat.key].avg = Math.floor(lastLevelProp[stat.key] * 17 / 8) / 2;
      } else {
        statMod[stat.key].min = 0;
        statMod[stat.key].max = 0;
        statMod[stat.key].avg = 0;
        for (let randomStats of highLevelStats) {
          let mod = randomStats.statMod;
          if (mod === 7) mod = -1;
          if (randomStats.stats & stat.mask) {
            statMod[stat.key].min = Math.min(statMod[stat.key].min, mod);
            statMod[stat.key].max = Math.max(statMod[stat.key].max, mod);
            statMod[stat.key].avg += mod / 8;
          }
        }
      }
    }

    while (currentStats.level < 99) {
      const previousStats = currentStats;
      currentStats = {
        level: previousStats.level + 1
      };

      if (currentStats.level === 70) {
        currentStats.path = lastLevelPath;
      } else if (currentStats.level < 79) {
        currentStats.path = `${highLevelPath}[${currentStats.level - 71}]`;
      } else {
        currentStats.path = this.charPropPath;
      }

      for (const stat of FF4LevelProgression.stats) {

        // copy the previous stat value
        const value = {};
        Object.assign(value, previousStats[stat.key]);

        value.min += statMod[stat.key].min;
        value.max += statMod[stat.key].max;
        value.avg += statMod[stat.key].avg;

        value.min = Math.max(Math.min(value.min, stat.max), 0);
        value.max = Math.max(Math.min(value.max, stat.max), 0);
        value.avg = Math.max(Math.min(value.avg, stat.max), 0);
        currentStats[stat.key] = value;
      }
      this.chartData.push(currentStats);
    }

    this.redraw();
  }

  resize() {
    if (!this.div.parentElement) return;
    const parentElement = this.div.parentElement;
    parentElement.style.overflow = 'hidden';
    this.div.style.width = `${Math.floor(parentElement.clientWidth)}px`;
    this.div.style.height = `${Math.floor(parentElement.clientHeight)}px`;
    parentElement.style.overflow = '';

    const l = 50;
    const r = this.div.clientWidth - 20;
    const t = 20;
    const b = this.div.clientHeight - 60;
    this.chartRect = new Rect(l, r, t, b);
  }

  redraw() {

    // update the selected point
    if (!this.mousePoint) {
      // mouse point not valid
      this.selectedPoint = null;

    } else if (this.chartData[0] && this.mousePoint.x < this.chartData[0].level) {
      // mouse is to the left of starting level
      this.selectedPoint = this.chartData[0];

    } else {
      // get closest level
      this.selectedPoint = null;
      for (const dataPoint of this.chartData) {
        if (dataPoint.level !== this.mousePoint.x) continue;
        this.selectedPoint = dataPoint;
        break;
      }
    }

    // update the canvas size
    this.canvas.width = this.div.clientWidth;
    this.canvas.height = this.div.clientHeight;
    const ctx = this.canvas.getContext('2d');

    // draw the chart
    this.drawChart(ctx);

    // update the tooltip
    this.updateTooltip();

    // draw stat ranges
    if (this.showRange) {
      for (const stat of FF4LevelProgression.stats) {
        if (this.showStat[stat.index]) this.drawStatRange(stat, ctx);
      }
    }

    // draw stats
    for (const stat of FF4LevelProgression.stats) {
      if (this.showStat[stat.index]) this.drawStat(stat, ctx);
    }

    // draw legend
    if (this.showLegend) {
      this.drawLegend(ctx);
    }
  }

  drawChart(ctx) {
    // draw the chart area
    ctx.fillStyle = 'white';
    ctx.fillRect(this.chartRect.l, this.chartRect.t, this.chartRect.w, this.chartRect.h);

    // draw the axes
    ctx.beginPath();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1.0;
    ctx.moveTo(this.chartRect.l - 0.5, this.chartRect.t - 0.5);
    ctx.lineTo(this.chartRect.l - 0.5, this.chartRect.b + 0.5);
    ctx.lineTo(this.chartRect.r + 0.5, this.chartRect.b + 0.5);
    ctx.lineTo(this.chartRect.r + 0.5, this.chartRect.t - 0.5);
    ctx.closePath();
    ctx.stroke();

    // draw gridlines and labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '12px sans-serif';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= 100; x += 10) {
      // vertical gridlines
      const startPoint = this.pointToCanvas(x, 0);
      const endPoint = this.pointToCanvas(x, 100);
      ctx.fillStyle = 'black';
      ctx.fillText(x.toString(), startPoint.x, startPoint.y + 20);
      if (x === 0 || x === 100) continue;
      ctx.strokeStyle = 'gray';
      ctx.beginPath();
      ctx.moveTo(startPoint.x + 0.5, startPoint.y);
      ctx.lineTo(endPoint.x + 0.5, endPoint.y);
      ctx.stroke();
    }
    const labelPoint = this.pointToCanvas(50, 0);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'black';
    ctx.fillText('Level', labelPoint.x, labelPoint.y + 45);

    ctx.textAlign = 'right';
    ctx.font = '12px sans-serif';
    for (let y = 0; y <= 100; y += 10) {
      // horizontal gridlines
      const startPoint = this.pointToCanvas(0, y);
      const endPoint = this.pointToCanvas(100, y);
      ctx.fillStyle = 'black';
      ctx.fillText(y.toString(), startPoint.x - 20, startPoint.y);
      if (y === 0 || y === 100) continue;
      ctx.strokeStyle = 'gray';
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y + 0.5);
      ctx.lineTo(endPoint.x, endPoint.y + 0.5);
      ctx.stroke();
    }
  }

  drawStatRange(stat, ctx) {

    if (!this.chartData.length) return;

    // draw the data
    const y = this.chartData[0][stat.key].min / stat.multiplier;
    const startPoint = this.pointToCanvas(this.chartData[0].level, y);

    ctx.fillStyle = stat.fillColor;
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y)

    for (const dataValue of this.chartData.slice(1)) {
      const y = dataValue[stat.key].min / stat.multiplier;
      const point = this.pointToCanvas(dataValue.level, y);
      ctx.lineTo(point.x, point.y);
    }
    for (const dataValue of this.chartData.slice().reverse()) {
      const y = dataValue[stat.key].max / stat.multiplier;
      const point = this.pointToCanvas(dataValue.level, y);
      ctx.lineTo(point.x, point.y);
    }
    ctx.fill();
  }

  drawStat(stat, ctx) {

    if (!this.chartData.length) return;

    // draw the data
    const y = this.chartData[0][stat.key].avg / stat.multiplier;
    const startPoint = this.pointToCanvas(this.chartData[0].level, y);

    ctx.strokeStyle = stat.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y)

    for (const dataValue of this.chartData) {
      const y = dataValue[stat.key].avg / stat.multiplier;
      const point = this.pointToCanvas(dataValue.level, y);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    // draw the selected point
    if (this.selectedPoint) {
      const y = this.selectedPoint[stat.key].avg / stat.multiplier;
      const point = this.pointToCanvas(this.selectedPoint.level, y);
      ctx.beginPath();
      ctx.fillStyle = stat.color;
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  drawLegend(ctx) {

    // find the legend height and widest stat
    let width = 0;
    let height = 10;
    const lineHeight = 15;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (const stat of FF4LevelProgression.stats) {
      if (!this.showStat[stat.index]) continue;
      const name = stat.axis || stat.name;
      const size = ctx.measureText(name);
      width = Math.max(Math.round(size.width) + 15, width);
      height += lineHeight;
    }
    if (width === 0) return;

    // calculate the legend rectangle
    const l = this.chartRect.l + 10;
    const t = this.chartRect.t + 10;
    const r = l + width + 20;
    const b = t + height;
    const rect = new Rect(l, r, t, b);

    // draw the legend box
    ctx.fillStyle = 'white';
    ctx.fillRect(rect.l, rect.t, rect.w, rect.h);

    // ctx.beginPath();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1.0;
    ctx.strokeRect(rect.l - 0.5, rect.t - 0.5, rect.w + 1, rect.h + 1);

    // draw stat names and color blobs
    let x = l + 8;
    let y = t + 8;
    for (const stat of FF4LevelProgression.stats) {
      if (!this.showStat[stat.index]) continue;

      ctx.fillStyle = stat.color;
      ctx.fillRect(x, y, 9, 9);
      ctx.strokeStyle = 'black';
      ctx.strokeRect(x - 0.5, y - 0.5, 10, 10);

      ctx.fillStyle = 'black';
      const name = stat.axis || stat.name;
      ctx.fillText(name, x + 15, y + 9);
      y += lineHeight;
    }
  }

  updateTooltip() {

    this.tooltip.removeAttribute('data-balloon-visible');
    if (!this.selectedPoint) return;

    // generate the tooltip string
    const level = this.selectedPoint.level;
    let statLabel = `Level: ${level}`;

    // find the closest stat
    let closestValue;
    for (const stat of FF4LevelProgression.stats) {
      if (!this.showStat[stat.index]) continue;

      const avgValue = Math.round(this.selectedPoint[stat.key].avg);
      const minValue = this.selectedPoint[stat.key].min;
      const maxValue = this.selectedPoint[stat.key].max;

      // add a comma separate to numbers larger than 10000
      if (avgValue >= 10000) {
        statLabel += `\n${stat.name}: ${addCommaSep(avgValue)}`;
      } else {
        statLabel += `\n${stat.name}: ${avgValue}`;
      }

      // show stat range
      if (minValue !== maxValue) {
        statLabel += ` (${minValue}–${maxValue})`;
      }

      // check if this is the closest value
      const oldDistance = Math.abs(closestValue - this.mousePoint.y);
      const newDistance = Math.abs(avgValue / stat.multiplier - this.mousePoint.y);
      if (closestValue === undefined || newDistance < oldDistance) {
        closestValue = avgValue / stat.multiplier;
      }
    }

    // show the tooltip
    this.tooltip.setAttribute('aria-label', statLabel);
    const statPoint = this.pointToCanvas(level, closestValue);
    this.tooltip.style.display = 'inline-block';
    this.tooltip.setAttribute('data-balloon-visible', '');
    if (closestValue > 70 && level > 80) {
      statPoint.x += 17;
      statPoint.y += 15;
      this.tooltip.setAttribute('data-balloon-pos', 'down-right');
    } else if (closestValue > 70) {
      statPoint.y += 15;
      this.tooltip.setAttribute('data-balloon-pos', 'down');
    } else if (closestValue < 10 && level > 80) {
      statPoint.x += 17;
      statPoint.y -= this.tooltip.clientHeight + 15;
      this.tooltip.setAttribute('data-balloon-pos', 'up-right');
    } else if (level > 80) {
      statPoint.x -= 15;
      statPoint.y -= this.tooltip.clientHeight;
      this.tooltip.setAttribute('data-balloon-pos', 'left');
    } else {
      statPoint.y -= this.tooltip.clientHeight + 15;
      this.tooltip.setAttribute('data-balloon-pos', 'up');
    }
    this.tooltip.style.left = `${statPoint.x}px`;
    this.tooltip.style.top = `${statPoint.y}px`;
  }

  pointToCanvas(x, y) {
    return {
      x: x / 100 * this.chartRect.w + this.chartRect.l,
      y: (1 - y / 100) * this.chartRect.h + this.chartRect.t
    };
  }

  canvasToPoint(x, y) {
    if (!this.chartRect.containsPoint(x, y)) return null;
    return {
      x: Math.round((x - this.chartRect.l) / this.chartRect.w * 100),
      y: Math.round((1 - (y - this.chartRect.t) / this.chartRect.h) * 100)
    };
  }
}

FF4LevelProgression.stats = [
  {
    name: 'Experience',
    index: 0,
    axis: 'Experience (×100,000)',
    key: 'exp',
    color: 'hsla(0, 0%, 0%, 1.0)',
    fillColor: 'hsla(0, 0%, 0%, 0.25)',
    multiplier: 100000,
    max: 9999999
  }, {
    name: 'HP',
    index: 1,
    axis: 'HP (×100)',
    key: 'hp',
    color: 'hsla(100, 100%, 30%, 1.0)',
    fillColor: 'hsla(100, 100%, 30%, 0.25)',
    multiplier: 100,
    max: 9999
  }, {
    name: 'MP',
    index: 2,
    axis: 'MP (×10)',
    key: 'mp',
    color: 'hsla(220, 100%, 35%, 1.0)',
    fillColor: 'hsla(220, 100%, 60%, 0.25)',
    multiplier: 10,
    max: 999
  }, {
    name: 'Strength',
    index: 3,
    key: 'strength',
    color: 'hsla(0, 100%, 40%, 1.0)',
    fillColor: 'hsla(0, 100%, 40%, 0.25)',
    multiplier: 1,
    max: 99,
    mask: '0x10'
  }, {
    name: 'Agility',
    index: 4,
    key: 'agility',
    color: 'hsla(50, 100%, 35%, 1.0)',
    fillColor: 'hsla(50, 100%, 35%, 0.25)',
    multiplier: 1,
    max: 99,
    mask: '0x08'
  }, {
    name: 'Stamina',
    index: 5,
    key: 'stamina',
    color: 'hsla(170, 100%, 35%, 1.0)',
    fillColor: 'hsla(170, 100%, 35%, 0.25)',
    multiplier: 1,
    max: 99,
    mask: '0x04'
  }, {
    name: 'Intellect',
    index: 6,
    key: 'intellect',
    color: 'hsla(270, 100%, 35%, 1.0)',
    fillColor: 'hsla(270, 100%, 35%, 0.25)',
    multiplier: 1,
    max: 99,
    mask: '0x02'
  }, {
    name: 'Spirit',
    index: 7,
    key: 'spirit',
    color: 'hsla(320, 100%, 35%, 1.0)',
    fillColor: 'hsla(320, 100%, 35%, 0.25)',
    multiplier: 1,
    max: 99,
    mask: '0x01'
  }
]
