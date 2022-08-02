// gui.js

class GUI {

  constructor() {
    this.modal = new Modal();
  }

  init(dataMgr) {
    this.dataMgr = dataMgr;
    this.propList = new PropertyList(this);
    this.nav = new Navigator(this);
    this.editors = {};
    this.activeEditor = null;
  }

  select(path) {
    this.propList.select(path);
    this.nav.select(path);
    this.showEditor(path);
  }

  showEditor(path) {

    if (!path) return;
    const definition = this.dataMgr.getDefinition(path);
    let editor = null;
    if (definition.editor) {
      editor = this.getEditor(definition.editor);
    // } else if (definition.type === 'graphics') {
    //   editor = this.getEditor('GraphicsView');
    // } else if (definition.type === 'tilemap') {
    //   editor = this.getEditor('TilemapView');
    }
    if (!editor) return;

    // check if the editor is already active
    const editDiv = document.getElementById('edit-div');
    if (!editDiv.contains(editor.div)) {
      // hide the active editor
      this.hideEditor();

      // show the new editor
      this.activeEditor = editor;
      editDiv.innerHTML = '';
      editDiv.appendChild(editor.div);
      editor.show();
    }

    editor.select(path);
  }

  hideEditor() {
    if (this.activeEditor && this.activeEditor.hide) {
      this.activeEditor.hide();
    }
  }

  getEditor(key) {
    if (this.editors[key]) return this.editors[key];

    const editorClass = eval(key);
    if (!editorClass) return null;
    const editor = new editorClass(this);
    this.editors[key] = editor;
    return editor;
  }

  gammaCorrectedPalette(pal) {
    return pal;
  }

  tintCanvas(canvas, rect, color) {
    if (!rect) rect = new Rect(0, canvas.width, 0, canvas.height);
    // create an offscreen canvas filled with the color
    const tintCanvas = document.createElement('canvas');
    tintCanvas.width = rect.w;
    tintCanvas.height = rect.h;
    const tintContext = tintCanvas.getContext('2d');
    tintContext.fillStyle = color || 'hsla(210, 100%, 50%, 0.5)';
    tintContext.fillRect(0, 0, rect.w, rect.h);

    const context = canvas.getContext('2d');
    context.globalCompositeOperation = 'source-atop';
    context.drawImage(tintCanvas, rect.l, rect.t);
  }

  transparentCanvas(canvas, rect) {
    if (!rect) rect = new Rect(0, canvas.width, 0, canvas.height);
    // create an offscreen canvas filled with the color
    const transparentCanvas = document.createElement('canvas');
    transparentCanvas.width = rect.w;
    transparentCanvas.height = rect.h;
    const transparentContext = transparentCanvas.getContext('2d');
    transparentContext.fillStyle = 'rgba(255, 255, 255, 0.5)';
    transparentContext.fillRect(0, 0, rect.w, rect.h);

    const context = canvas.getContext('2d');
    context.globalCompositeOperation = 'destination-out';
    context.drawImage(transparentCanvas, rect.l, rect.t);
  }
}
