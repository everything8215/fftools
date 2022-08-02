//
// navigator.js
// created 9/1/2019
//

class Navigator {

  constructor(gui) {
    this.gui = gui;
    this.dataMgr = dataMgr;
    this.hierarchy = dataMgr.data.hierarchy;
    this.observer = new ROMObserver(this.dataMgr);
    this.resetList();
  }

  resetList() {
    this.observer.reset();

    const leftPane = document.getElementById('left-pane');
    leftPane.innerHTML = '';

    // create the navigator root list
    const navRoot = document.createElement('ul');
    navRoot.classList.add('nav-list');
    leftPane.appendChild(navRoot);
    navRoot.tabIndex = 1;

    const nav = this;
    document.addEventListener('keydown', function(e) {
      if (!e.target.classList.contains('nav-list')) return;
      if (!nav.selectedNode) return;

      let newNode;
      if (e.which === 38) {
        // move up
        newNode = nav.selectedNode.previousSibling;
      } else if (e.which === 40) {
        // move down
        newNode = nav.selectedNode.nextSibling;
      } else {
        return;
      }
      if (!newNode) return;
      const newPath = newNode.getAttribute('data-path');
      if (!newPath) return;
      nav.gui.select(newPath);
      newNode.scrollIntoView({
        block: 'nearest'
      });
      e.preventDefault();
    });

    // add top-level categories
    for (let category of this.hierarchy) {
      const li = this.liForCategory(category);
      if (li) navRoot.appendChild(li);
    }

    // reset the node and selection
    this.node = {};
    this.selectedNode = null;
  }

  liForCategory(category) {
    const self = this;
    const li = document.createElement('li');
    let isLoaded = false;
    li.classList.add('nav-category');

    const p = document.createElement('p');
    p.onclick = function(e) {
      e.stopPropagation();
      li.classList.toggle('shown');

      if (isLoaded) return;

      const ul = document.createElement('ul');
      ul.classList.add('nav-list');
      li.appendChild(ul);

      for (const options of category.list) {
        const path = options.path;
        if (!path) continue;

        const definition = self.dataMgr.getDefinition(path);
        if (!definition) {
          console.log(`Invalid path in hierarchy: ${path}`);
          continue;
        }

        let li;
        if (definition.type === 'array') {
          li = self.liForArray(path, options);
        } else if (definition.type === 'stringTable') {
          li = self.liForStringTable(path, options);
        } else {
          li = self.liForObject(path, options);
        }

        if (li) ul.appendChild(li);
      }
      isLoaded = true;
    }
    let name = category.name;
    if (!isString(name)) name = 'Unnamed Category';
    if (!/\S/.test(name)) name = '&nbsp;';
    p.innerHTML = name;
    li.appendChild(p);

    return li;
  }

  liForObject(path, options) {

    const li = document.createElement('li');
    li.classList.add('nav-object');
    li.setAttribute('data-path', path);
    li.onclick = function(e) {
      e.stopPropagation();
      gui.select(path);
    }
    if (!this.node[path]) this.node[path] = li;

    const definition = this.dataMgr.getDefinition(path);
    const p = document.createElement('p');
    let name = options.name;
    if (!isString(name)) name = definition.name;
    // if (!isString(name) && object instanceof ROMText) name = object.htmlText;
    if (!isString(name)) name = 'Unnamed Object';
    // if (!/\S/.test(name)) name = '&nbsp;';
    p.innerHTML = name;
    li.appendChild(p);

    return li;
  }

  liForArray(path, options) {
    const li = document.createElement('li');
    li.classList.add('nav-array');

    const definition = this.dataMgr.getDefinition(path);

    const p = document.createElement('p');
    p.onclick = function(e) {
      e.stopPropagation();
      li.classList.toggle('shown');
    }
    let name = options.name;
    if (!isString(name)) name = definition.name;
    if (!isString(name)) name = 'Unnamed Array';
    if (!/\S/.test(name)) name = '&nbsp;';
    p.innerHTML = name;
    li.appendChild(p);

    const buttonDiv = document.createElement('div');
    buttonDiv.classList.add('property-heading-button-div');
    p.appendChild(buttonDiv);

    // const eyeButton = document.createElement('i');
    // eyeButton.classList.add('fas', 'fa-eye', 'property-heading-button');
    // eyeButton.onclick = function(e) {
    //   e.stopPropagation();
    //   propList.select(array);
    // };
    // buttonDiv.appendChild(eyeButton);

    const ul = document.createElement('ul');
    ul.classList.add('nav-list');
    if (!this.node[path]) this.node[path] = ul;

    let pad = 2;
    let maxIndex = definition.arrayLength - 1;
    while (maxIndex > 0xFF) {
      pad += 2;
      maxIndex >>= 8;
    }

    const stringTable = this.dataMgr.getStringTableForObject(path);

    for (let i = 0; i < definition.arrayLength; i++) {
      const itemPath = `${path}[${i}]`;
      const itemOptions = { index: i, pad: pad };
      if (isString(stringTable[i])) {
        itemOptions.name = stringTable[i];
      }
      const liItem = this.liForArrayItem(itemPath, itemOptions);
      if (liItem) ul.appendChild(liItem);
    }
    li.appendChild(ul);

    // const self = this;
    // this.observer.startObserving(array, function() {
    //   self.resetList();
    // });

    return li;
  }

  liForArrayItem(path, options) {

    const definition = this.dataMgr.getDefinition(path);
    if (!isString(options.name)) {
      options.name = definition.name || 'Unnamed Object';
      options.name = options.name.replace(/%i/g, options.index);
    }

    if (definition.multiLine) {
      options.name = options.name.replace(/\\n/g, '<br/>');
    } else if (options.name.length > 40) {
      options.name = options.name.substring(0, 40) + '…';
    }

    const li = this.liForObject(path, options);
    const span = document.createElement('span');
    // if (rom.numberBase === 16) span.classList.add(`hex${options.pad}`);
    span.classList.add('nav-object-index');
    span.innerHTML = options.index;
    // span.innerHTML = rom.numToString(i, pad);
    li.insertBefore(span, li.firstChild);

    return li;
  }

  // liForStringTable(stringTable, options) {
  //   const li = document.createElement('li');
  //   li.classList.add('nav-array');
  //
  //   const p = document.createElement('p');
  //   p.onclick = function(e) {
  //     e.stopPropagation();
  //     li.classList.toggle('shown');
  //   }
  //   let name = options.name;
  //   if (!isString(name)) name = stringTable.name;
  //   if (!isString(name)) name = 'Unnamed String Table';
  //   if (!/\S/.test(name)) name = '&nbsp;';
  //   p.innerHTML = name;
  //   li.appendChild(p);
  //
  //   const ul = document.createElement('ul');
  //   ul.classList.add('nav-list');
  //   const path = `stringTable.${stringTable.key}`;
  //   if (!this.node[path]) this.node[path] = ul;
  //
  //   let pad = 2;
  //   let maxIndex = stringTable.string.length - 1;
  //   while (maxIndex > 0xFF) {
  //     pad += 2;
  //     maxIndex >>= 8;
  //   }
  //
  //   for (let i = 0; i < stringTable.string.length; i++) {
  //     const item = this.liForString(stringTable, i, pad);
  //     if (item) ul.appendChild(item);
  //   }
  //   li.appendChild(ul);
  //
  //   return li;
  // }

  // liForString(stringTable, i, pad) {
  //
  //   if (!stringTable.string[i]) return null;
  //
  //   const li = document.createElement('li');
  //   const span = document.createElement('span');
  //   span.innerHTML = rom.numToString(i, pad);
  //   span.classList.add('nav-object-index');
  //   if (rom.numberBase === 16) span.classList.add(`hex${pad}`);
  //   li.appendChild(span);
  //
  //   li.classList.add('nav-object');
  //   li.onclick = function(e) {
  //     e.stopPropagation();
  //     propList.select(stringTable.string[i]);
  //   }
  //
  //   const p = document.createElement('p');
  //   p.innerHTML = stringTable.string[i].htmlString();
  //   li.appendChild(p);
  //
  //   return li;
  // }

  select(path) {

    if (!path) return;

    // check if a node exists for the object
    const li = this.node[path];
    if (!li) return;

    if (this.selectedNode) {
      this.selectedNode.classList.remove('selected');
    }
    this.selectedNode = li;
    this.selectedNode.classList.add('selected');
  }
}
