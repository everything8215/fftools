//
// editor.js
// created 10/22/2020
//

class ROMEditor {
  constructor(gui) {
    this.gui = gui;
    this.dataMgr = gui.dataMgr;
    this.div = document.createElement('div');
    this.editControls = document.getElementById('edit-controls');
    this.editTop = document.getElementById('edit-top');
    this.menu = null;
    this.list = [];
    this.observer = new ROMObserver(gui.dataMgr);
    this.resizeSensor = null;
  }

  show() {
    // notify on resize
    const self = this;
    if (!this.resizeSensor) {
      this.resizeSensor = new ResizeSensor(this.editTop, function() {
        self.resize();
        self.redraw();
      });
    }
  }

  hide() {
    // stop observing
    this.observer.reset();

    // detach resize sensor
    if (this.resizeSensor) {
      this.resizeSensor.detach(this.editTop);
      this.resizeSensor = null;
    }
  }

  hideControls() {
    this.editControls.classList.add('hidden');
  }

  showControls() {
    this.editControls.classList.remove('hidden');
  }

  resetControls() {
    this.editControls.innerHTML = '';
    this.list = [];
  }

  resize() {}

  redraw() {}

  addTwoState(id, onclick, labelText, checked) {

    const editor = this;
    const label = document.createElement('label');
    this.editControls.appendChild(label);
    label.classList.add('two-state');
    if (checked) label.classList.add('checked');
    label.style.display = 'inline-block';

    const button = document.createElement('input');
    label.appendChild(button);
    button.id = id;
    button.type = 'checkbox';
    button.checked = checked;
    button.onclick = function() {
      if (button.checked) {
        label.classList.add('checked');
      } else {
        label.classList.remove('checked');
      }
      if (onclick) onclick.call(editor, button.checked);
    };

    const p = document.createElement('p');
    p.innerHTML = labelText;
    label.appendChild(p);
  }

  addZoom(zoom, onchange, min = -2, max = 2, step = 1) {
    const zoomValue = document.createElement('div');
    zoomValue.id = 'zoom-value';
    zoomValue.innerHTML = `${zoom * 100}%`;
    this.editControls.appendChild(zoomValue);

    const editor = this;
    const zoomRange = document.createElement('input');
    zoomRange.type = 'range';
    zoomRange.id = 'zoom';
    zoomRange.min = min;
    zoomRange.max = max;
    zoomRange.step = step;
    zoomRange.value = Math.log2(zoom);
    zoomRange.onchange = function() {
      onchange.call(editor);
    };
    this.editControls.appendChild(zoomRange);

    const zoomCoordinates = document.createElement('div');
    zoomCoordinates.id = 'coordinates';
    zoomCoordinates.innerHTML = '(0,0)';
    this.editControls.appendChild(zoomCoordinates);
  }

  addList(id, labelText, listNames, onchange, selected) {
    this.list[id] = {
      names: listNames,
      onchange: onchange,
      selected: selected
    };

    const label = document.createElement('label');
    label.classList.add('two-state');
    label.classList.add('checked');
    label.style.display = 'inline-block';
    this.editControls.appendChild(label);

    const editor = this;
    const button = document.createElement('input');
    button.id = id;
    button.type = 'button';
    button.onclick = function(e) {
      editor.openList(e, id);
    };
    label.appendChild(button);

    const p = document.createElement('p');
    p.innerHTML = labelText;
    label.appendChild(p);
  }

  openList(e, id) {

    const list = this.list[id];
    if (!list || !isArray(list.names)) return;

    // build the menu for the list of options
    this.menu = new Menu();
    const editor = this;
    for (const [i, name] of list.names.entries()) {
      const li = this.menu.createMenuItem(this.menu.topMenu, {
        name: name || '&nbsp;',
        value: i,
        selected: list.selected.call(editor, i),
        onclick: function() {
          editor.closeList();
          list.onchange.call(editor, this.value);
        }
      });
    }
    this.menu.open(e.x, e.y);
  }

  closeList() {
    if (this.menu) this.menu.close();
  }
}
