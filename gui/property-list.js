// property-list.js

class PropertyList {

  constructor(gui) {
    this.gui = gui;
    this.dataMgr = gui.dataMgr;
    this.observer = new ROMObserver(this.dataMgr);
    this.selection = {
      current: null,
      previous: [],
      next: []
    };
    this.currentProperties = [];
    this.editors = {};
  }

  select(path) {

    if (path === this.selection.current) return;
    if (this.selection.current) {
      this.selection.previous.push(this.selection.current);
    }

    if (!path) {
      this.selection.current = null;
    } else {
      this.selection.current = path;
      const definition = this.dataMgr.getDefinition(path);
      if (!definition) return;
      const object = this.dataMgr.getObject(path);
      if (!object) return;
    }

    this.update();
  }

  // copy() {
  //   if (!this.selection.current) return;
  //   const obj = this.dataMgr.serialize(this.selection.current);
  //   const json = JSON.stringify(obj, null, 2);
  //   this.dataMgr.clipboard = json;
  //   if (!navigator.permissions) return;
  //   navigator.permissions.query({name: "clipboard-write"}).then(function(result) {
  //     if (result.state == "granted" || result.state == "prompt") {
  //       navigator.clipboard.writeText(json);
  //     }
  //   });
  // }
  //
  // paste() {
  //   if (!this.selection.current) return;
  //   const path = this.selection.current;
  //
  //   if (!navigator.permissions && isString(this.dataMgr.clipboard)) {
  //     const obj = JSON.parse(this.dataMgr.clipboard);
  //     this.dataMgr.deserialize(path, obj);
  //     return;
  //   }
  //   const self = this;
  //   navigator.permissions.query({name: "clipboard-read"}).then(function(result) {
  //     if (result.state == "granted" || result.state == "prompt") {
  //       navigator.clipboard.readText().then(function(json) {
  //         const obj = JSON.parse(json);
  //         self.dataMgr.deserialize(path, obj);
  //       });
  //     } else if (isString(self.dataMgr.clipboard)) {
  //       const obj = JSON.parse(self.dataMgr.clipboard);
  //       self.dataMgr.deserialize(path, obj);
  //     }
  //   });
  // }

  update() {
    this.observer.reset();
    const properties = document.getElementById('properties');
    properties.innerHTML = '';

    const path = this.selection.current;
    if (!path) return;
    const definition = this.dataMgr.getDefinition(path);
    if (!definition) return;

    // show heading
    if (definition.name) {
      const headingDiv = document.createElement('div');
      properties.appendChild(headingDiv);
      headingDiv.classList.add('property-heading');

      // object name
      const heading = document.createElement('p');
      headingDiv.appendChild(heading);
      const index = this.dataMgr.getIndex(path);
      const name = definition.name.replace(/%i/g, index);
      heading.appendChild(document.createTextNode(name));

      // // add heading buttons
      // const self = this;
      // const buttonDiv = document.createElement('div');
      // buttonDiv.classList.add('property-heading-button-div');
      // heading.appendChild(buttonDiv);
      //
      // const copyButton = document.createElement('i');
      // copyButton.classList.add('fas', 'fa-copy', 'property-heading-button');
      // copyButton.onclick = function() { self.copy(); };
      // buttonDiv.appendChild(copyButton);
      //
      // const pasteButton = document.createElement('i');
      // pasteButton.classList.add('fas', 'fa-paste', 'property-heading-button');
      // pasteButton.onclick = function() { self.paste(); };
      // buttonDiv.appendChild(pasteButton);
      //
      // const exportButton = document.createElement('i');
      // exportButton.classList.add('fas', 'fa-download', 'property-heading-button');
      // exportButton.onclick = function() { self.export(); };
      // buttonDiv.appendChild(exportButton);
      //
      // const importButton = document.createElement('i');
      // importButton.classList.add('fas', 'fa-upload', 'property-heading-button');
      // importButton.onclick = function() { self.import(); };
      // buttonDiv.appendChild(importButton);
    }

    if (definition.type === 'assembly') {
      // object with sub-assemblies
      const assemblyHTML = this.assemblyHTML(path);
      for (const html of assemblyHTML) properties.appendChild(html);

    } else if (definition.type === 'property') {
      const propertyHTML = this.propertyHTML(path, { name: 'Value' });
      if (!propertyHTML) return;
      properties.appendChild(propertyHTML);

    } else if (definition.type === 'text') {
      const propertyHTML = this.propertyHTML(path, { name: 'Text' });
      if (!propertyHTML) return;
      properties.appendChild(propertyHTML);
    }

    // update labels
    const labels = document.getElementsByClassName('property-label');
    let w = 0;

    // reset all labels to their default size
    for (let label of labels) label.style.width = 'auto';

    // find the widest label
    for (let label of labels) w = Math.max(w, label.clientWidth);

    // make all labels the same width
    for (let label of labels) label.style.width = `${w}px`;

    // make all text controls the same height as the text
    const text = document.getElementsByClassName('property-textarea');
    for (const input of text) {
      input.style.height = `${input.scrollHeight}px`;
    }
  }

  validateProperties() {

    // check if the currently displayed properties are all still valid
    // and all non-displayed properties are still invalid
    const path = this.selection.current;
    const definition = this.dataMgr.getDefinition(path);
    if (!path || !definition) return;
    if (definition.type !== 'assembly') return;
    const index = this.dataMgr.getIndex(path);
    const assemblyObj = this.dataMgr.getObject(path);
    let obj;  // the object for eval statements

    for (const key in definition.assembly) {

      let subPath = `${path}.${key}`;
      let subDefinition = definition.assembly[key];
      if (!subDefinition || isString(subDefinition)) continue;
      let isValid = true;

      if (subDefinition.invalid) {
        // check if property is invalid
        obj = assemblyObj;
        if (eval(subDefinition.invalid)) isValid = false;
      }

      if (subDefinition.external) {
        // get external property
        subPath = subDefinition.external.replace(/%i/g, index);
        subDefinition = this.dataMgr.getDefinition(subPath);
        if (!subDefinition) continue;
        if (subDefinition.invalid) {
          // check if external property is invalid
          obj = this.dataMgr.getParentObject(subPath);
          if (eval(subDefinition.invalid)) isValid = false;
        }
      }

      if (this.currentProperties.includes(subPath) !== isValid) {
        this.update();
        return;
      }
    }
  }

  assemblyHTML(path) {

    const definition = this.dataMgr.getDefinition(path);
    this.currentProperties = [];

    // return an array of html divs
    const divs = [];
    if (!definition.assembly) return divs;
    const index = this.dataMgr.getIndex(path);
    let obj;  // the object for eval statements

    for (const key in definition.assembly) {

      let subPath = `${path}.${key}`;
      let subDefinition = definition.assembly[key];
      if (!subDefinition) continue;

      let options = {};

      if (subDefinition.invalid) {
        // skip if property is invalid
        obj = this.dataMgr.getObject(path);
        if (eval(subDefinition.invalid)) continue;
      }
      if (subDefinition.hidden) {
        // skip if property is hidden
        obj = this.dataMgr.getObject(path);
        if (eval(subDefinition.hidden)) continue;
      }

      if (subDefinition.external) {
        // get external property
        options.name = subDefinition.name;
        subPath = subDefinition.external.replace(/%i/g, index);
        subDefinition = this.dataMgr.getDefinition(subPath);
        if (!subDefinition) continue;
        if (subDefinition.invalid) {
          // skip if external property is invalid
          obj = this.dataMgr.getParentObject(subPath);
          if (eval(subDefinition.invalid)) continue;
        }
        if (subDefinition.hidden) {
          // skip if external property is hidden
          obj = this.dataMgr.getParentObject(subPath);
          if (eval(subDefinition.hidden)) continue;
        }
      }

      // category name
      if (isString(subDefinition)) {
        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('property-category');
        divs.push(categoryDiv);

        const category = document.createElement('p');
        category.innerHTML = subDefinition;
        categoryDiv.appendChild(category);
        continue;
      }

      this.currentProperties.push(subPath);

      // if (subDefinition.type === 'array') {
      //   // array of properties
      //   const arrayHTML = this.arrayHTML(assembly, {
      //     name: object.assembly[key].name,
      //     index: options.index,
      //     key: key,
      //     disabled: options.disabled
      //   });
      //   if (!arrayHTML) continue;
      //   divs.push(...arrayHTML);
      //   // this.observer.startObserving(assembly, this.showProperties);
      //
      // } else if (subDefinition.type = 'assembly' subDefinition.type = 'command') {
      //   // object with sub-assemblies
      //   const assemblyHTML = this.assemblyHTML(assembly, {
      //     name: object.assembly[key].name,
      //     index: options.index,
      //     key: key,
      //     disabled: options.disabled
      //   });
      //   if (!assemblyHTML) continue;
      //   divs.push(...assemblyHTML);
      //   this.observer.startObserving(assembly, this.showProperties);
      //
      // } else {
        // single property
        const propertyHTML = this.propertyHTML(subPath, options);
        if (!propertyHTML) continue;
        divs.push(propertyHTML);
      // }
    }

    // // create properties for each special value
    // const specialHTML = this.propertyHTML(object, {
    //     controlID: object.key, index: options.index
    // });
    // if (specialHTML) divs.push(specialHTML);

    return divs;
  }

  propertyHTML(path, options) {

    const definition = this.dataMgr.getDefinition(path);

    if (!definition) {
      console.log(`Invalid property: ${path}`);
      return null;
    }

    options.name = options.name || definition.name;
    options.propertyID = `property-${path}`;
    options.controlID = `property-control-${path}`;
    options.labelID = `property-label-${path}`;

    // create a label for the control
    let label;
    if (definition.type == 'property' && definition.link) {
      // create a label with a link
      const value = this.dataMgr.getProperty(path);
      const linkPath = definition.link.replace(/%i/g, value);
      label = document.createElement('a');
      label.href = `javascript:gui.select('${linkPath}');`;

    // } else if (object instanceof ROMProperty && object.script) {
    //     // create a label with a script link
    //     const script = object.parsePath(object.script);
    //     if (!script) return null;
    //     const command = script.ref[object.value] || script.command[0];
    //     label = document.createElement('a');
    //     const link = object.parseSubscripts(object.parseIndex(object.script));
    //     label.href = `javascript:propList.select('${link}');` +
    //         `scriptList.deselectAll();` +
    //         `scriptList.selectRef(${command.ref});`;
    //
    // } else if (object.target instanceof ROMAssembly) {
    //     // create a label with a link to the pointer target
    //     const target = object.target;
    //     label = document.createElement('a');
    //     if (target.parent instanceof ROMArray) {
    //         label.href = `javascript:propList.select('${target.parent.path}[${target.i}]');`;
    //     } else {
    //         label.href = `javascript:propList.select('${target.path}');`;
    //     }
    //
    // } else if (object instanceof ROMString && object.language) {
    //     label = document.createElement('a');
    //     label.href = `javascript:propList.select('stringTable.${object.parent.key}[${object.i}]');`;
    //
    } else {
      // create a normal label
      label = document.createElement('label');
      label.htmlFor = options.controlID;
    }

    label.classList.add('property-label');
    label.id = options.labelID;
    if (options.name) label.innerHTML = `${options.name}:`;
    options.label = label;

    // create a div for the control(s)
    let controlDiv;
    if (definition.type === 'property' && definition.bool) {
      controlDiv = this.boolControlHTML(path, options);

    } else if (definition.type === 'property' && definition.flag) {
      controlDiv = this.flagControlHTML(path, options);

    } else if (definition.type === 'property' && definition.stringTable) {
      controlDiv = this.listControlHTML(path, options);

    // } else if (definition.type === 'property' && object.script) {
    //     controlDiv = this.scriptControlHTML(object, options);
    //
    // } else if (definition.type === 'property' && object.pointerTo) {
    //     controlDiv = this.pointerControlHTML(object, options);

    } else if (definition.type === 'property') {
      controlDiv = this.numberControlHTML(path, options);

    } else if (definition.type === 'text') {
      controlDiv = this.textControlHTML(path, options);

    // } else if (object instanceof ROMString) {
    //     controlDiv = this.stringControlHTML(object, options);

    // } else if (definition.type === 'array') {
    //     controlDiv = this.arrayLengthControlHTML(object, options);

    // } else if (definition.type === 'assembly' || definition.type === 'command') {
    //     controlDiv = this.specialControlHTML(object, options);
    //     label.innerHTML = '';
    //     if (!controlDiv) return null;

    // } else if (definition.type === 'data') {
    //     controlDiv = this.dataLengthControlHTML(object, options);

    } else {
      return null;
    }

    // create a div for the property
    const propertyDiv = document.createElement('div');
    propertyDiv.classList.add('property-div');
    propertyDiv.id = options.propertyID;
    propertyDiv.appendChild(label);
    propertyDiv.appendChild(controlDiv);

    return propertyDiv;
  }

  boolControlHTML(path, options) {

    // create a div for the control
    const controlDiv = document.createElement('div');
    controlDiv.classList.add('property-control-div');

    // property with a single boolean checkbox
    const dataMgr = this.dataMgr;
    const propList = this;
    const input = document.createElement('input');
    controlDiv.appendChild(input);
    input.id = options.controlID;
    input.type = 'checkbox';
    input.checked = dataMgr.getProperty(path);
    input.classList.add('property-check');
    input.onchange = function() {
      const value = this.checked;
      propList.observer.sleep();
      dataMgr.setProperty(path, value);
      propList.observer.wake();
      propList.validateProperties();
      document.getElementById(input.id).focus();
    };

    if (options.label) {
      // move the label to the right of the check box
      options.label.innerHTML = '';
      const label = document.createElement('label');
      label.classList.add('property-check-label');
      label.htmlFor = input.id;
      label.innerHTML = options.name || '';
      controlDiv.appendChild(label);
    }

    this.observer.startObserving(path, {
      callback: function() {
        input.checked = dataMgr.getProperty(path);
        propList.validateProperties();
        document.getElementById(input.id).focus();
      }
    });

    return controlDiv;
  }

  flagControlHTML(path, options) {
    // create a div for the control
    const controlDiv = document.createElement('div');
    controlDiv.classList.add('property-control-div');
    const dataMgr = this.dataMgr;
    const propList = this;
    const definition = dataMgr.getDefinition(path);
    let flagValue = dataMgr.getProperty(path);

    // property with boolean flags
    let mask = Number(definition.mask) || 0xFF;
    while (!(mask & 1)) mask = mask >> 1;

    let stringTable = {};
    if (definition.stringTable) {
      stringTable = dataMgr.getStringTableForObject(path);
    }

    const flagChecks = [];
    for (let i = 0; i < 32; i++) {

      let bit = 1 << i;
      if (!(bit & mask)) continue;
      if (definition.reverseBits) {
        // bit order is reversed in each byte
        if (i < 8) {
          bit = 1 << (7 - i);
        } else if (i < 16) {
          bit = 0x0100 << (15 - i);
        } else if (i < 24) {
          bit = 0x010000 << (23 - i);
        } else if (i < 32) {
          bit = 0x01000000 << (31 - i);
        }
      }

      // create the check box
      const check = document.createElement('input');
      check.classList.add('property-check');
      check.value = bit;
      check.type = 'checkbox';
      check.checked = flagValue & bit;
      check.id = `${options.controlID}-${i}`;
      check.onchange = function() {
        let value = dataMgr.getProperty(path);
        const bit = Number(check.value);
        if (this.checked) {
          // set bit
          value |= this.value;
        } else {
          // clear bit
          value &= ~this.value;
        }
        propList.observer.sleep();
        dataMgr.setProperty(path, value);
        propList.observer.wake();
        propList.validateProperties();
        document.getElementById(check.id).focus();
      }

      // create a label for the check box
      const label = document.createElement('label');
      label.classList.add('property-check-label');
      label.htmlFor = check.id;
      if (stringTable[i]) {
        label.innerHTML += stringTable[i];
      } else {
        label.innerHTML = i;
      }

      // create a div to hold the label and control
      const flagDiv = document.createElement('div');
      flagDiv.classList.add('property-check-div');
      flagDiv.appendChild(check);
      flagDiv.appendChild(label);
      flagChecks.push(check);
      controlDiv.appendChild(flagDiv);
    }

    // // add check boxes for special values
    // const specialValues = Object.keys(object.special);
    // for (let i = 0; i < specialValues.length; i++) {
    //   const special = document.createElement('input');
    //   special.classList.add('property-check');
    //   special.id = `${options.controlID}-special-${i}`;
    //   special.disabled = object.disabled || options.disabled;
    //   special.type = 'checkbox';
    //   special.checked = false;
    //
    //   const key = specialValues[i];
    //   const value = Number(key);
    //   special.value = value;
    //   if (Number(object.value) === value) {
    //     flagChecks.forEach(function(div) {
    //       div.disabled = true;
    //     });
    //     special.checked = true;
    //   }
    //   special.onchange = function() {
    //     if (this.checked) {
    //       object.setValue(Number(this.value));
    //     } else {
    //       object.setValue(object.min);
    //     }
    //     document.getElementById(this.id).focus();
    //   };
      //
      // // create a label for the check box
      // const label = document.createElement('label');
      // label.classList.add('property-check-label');
      // label.htmlFor = special.id;
      // label.innerHTML = definition.special[key];

    //   // create a div to hold the label and control
    //   const specialDiv = document.createElement('div');
    //   specialDiv.classList.add('property-check-div');
    //   specialDiv.appendChild(special);
    //   specialDiv.appendChild(label);
    //   controlDiv.appendChild(specialDiv);
    // }

    this.observer.startObserving(path, {
      callback: function() {
        const value = dataMgr.getProperty(path);
        for (let check of flagChecks) {
          const bit = Number(check.value);
          const isChecked = (value & check.value) !== 0;
          if (isChecked ^ check.checked) {
            check.checked = isChecked;
            document.getElementById(check.id).focus();
          }
        }
        propList.validateProperties();
      }
    });

    return controlDiv;
  }

  listControlHTML(path, options) {
    // create a div for the control
    const controlDiv = document.createElement('div');
    controlDiv.classList.add('property-control-div');

    const definition = this.dataMgr.getDefinition(path);

    // property with a drop down list of strings
    const dataMgr = this.dataMgr;
    const propList = this;
    const input = document.createElement('select');
    controlDiv.appendChild(input);
    input.id = options.controlID;
    input.classList.add('property-control');
    input.onchange = function() {
      const value = Number(this.value);
      propList.observer.sleep();
      dataMgr.setProperty(path, value);
      propList.observer.wake();
      propList.validateProperties();
      document.getElementById(input.id).focus();
    };

    // create an option for each valid string in the table
    const stringTable = this.dataMgr.getStringTableForObject(path);
    let min = definition.min || 0;
    let max = definition.max;
    if (!max) {
      max = definition.mask || 0xFF;
      while (!(max & 1)) max >>= 1;
    }
    const multiplier = definition.multiplier || 1;
    const offset = definition.offset || 0;
    min = min * multiplier + offset;
    max = max * multiplier + offset;

    const indexList = [];
    for (let key in stringTable) {
      const index = Number(key);
      if (!isNumber(index)) continue;
      if (index > max || index < min) continue;
      indexList.push(index);
    }

    const specialStrings = {};
    if (definition.special) {
      for (let key in definition.special) {
        const index = Number(key);
        if (!isNumber(index) || indexList.includes(index)) continue;
        indexList.push(index);
        specialStrings[index] = definition.special[key];
      }
    }

    // sort the list from low to high
    indexList.sort(function(a, b) { return a - b; });

    for (const index of indexList) {
      let optionString = '';
      // if (!stringTable.hideIndex) {
      //   optionString += `${rom.numToString(index)}: `;
      // }
      if (specialStrings[index]) {
        optionString += specialStrings[index];
      } else if (stringTable[index]) {
        let string = stringTable[index];
        if (string.length > 40) string = string.substring(0, 40) + '…';
        optionString += string;
      } else {
        continue;
      }

      const option = document.createElement('option');
      option.value = index;
      option.innerHTML = optionString;
      input.appendChild(option);
    }
    input.value = dataMgr.getProperty(path);

    this.observer.startObserving(path, {
      callback: function() {
        input.value = dataMgr.getProperty(path);
        propList.validateProperties();
        document.getElementById(input.id).focus();
      }
    });

    return controlDiv;
  }

  numberControlHTML(path, options) {
    // create a div for the control
    const controlDiv = document.createElement('div');
    controlDiv.classList.add('property-control-div');

    const definition = this.dataMgr.getDefinition(path);

    // property with a number only
    const input = document.createElement('input');
    controlDiv.appendChild(input);
    input.id = options.controlID;
    input.type = 'number';
    input.classList.add('property-control');
    input.value = this.dataMgr.getProperty(path);
    const min = definition.min || 0;
    let max = definition.max;
    if (!max) {
      max = definition.mask || 0xFF;
      while (!(max & 1)) max >>= 1;
    }
    const multiplier = definition.multiplier || 1;
    const offset = definition.offset || 0;
    input.step = multiplier;
    input.min = min * multiplier + offset;
    input.max = max * multiplier + offset;

    const dataMgr = this.dataMgr;
    const propList = this;
    input.onchange = function() {
      let value = Number(this.value);
      value = Math.min(Math.max(input.min, value), input.max);
      propList.observer.sleep();
      dataMgr.setProperty(path, value);
      propList.observer.wake();
      propList.validateProperties();
      input.value = dataMgr.getProperty(path);
      document.getElementById(input.id).focus();
    };

    this.observer.startObserving(path, {
      callback: function() {
        input.value = dataMgr.getProperty(path);
        propList.validateProperties();
        document.getElementById(input.id).focus();
      }
    });

    // // add check boxes for special values
    // for (const key in object.special) {
    //     const value = (Number(key) + object.offset) * input.step;
    //     const specialDiv = document.createElement('div');
    //     specialDiv.classList.add('property-check-div');
    //     controlDiv.appendChild(specialDiv);
    //     const special = document.createElement('input');
    //     specialDiv.appendChild(special);
    //     special.classList.add('property-check');
    //     special.id = `${input.id}-special-${value}`;
    //     special.disabled = object.disabled || options.disabled;
    //     special.type = 'checkbox';
    //     special.checked = false;
    //
    //     if (Number(object.value) === value) {
    //         input.disabled = true;
    //         special.checked = true;
    //     }
    //     special.onchange = function() {
    //         if (this.checked) {
    //             object.setValue(value);
    //         } else {
    //             object.setValue(object.min);
    //         }
    //         document.getElementById(this.id).focus();
    //     };
    //
    //     // create a label for the check box
    //     const label = document.createElement('label');
    //     specialDiv.appendChild(label);
    //     label.classList.add('property-check-label');
    //     label.htmlFor = special.id;
    //     label.innerHTML = object.special[key];
    // }

    return controlDiv;
  }

  textControlHTML(path, options) {
    // create a div for the control
    const controlDiv = document.createElement('div');
    controlDiv.classList.add('property-control-div');

    // create a text box
    const definition = this.dataMgr.getDefinition(path);
    const input = document.createElement(definition.multiLine ? 'textarea' : 'input');
    controlDiv.appendChild(input);
    input.id = options.controlID;
    input.value = this.dataMgr.getObject(path);
    input.classList.add('property-control');
    input.classList.add(definition.multiLine ? 'property-textarea' : 'property-text');

    const dataMgr = this.dataMgr;
    const propList = this;
    input.onchange = function() {
      propList.observer.sleep();
      dataMgr.setObject(path, this.value);
      propList.observer.wake();
      propList.validateProperties();
      document.getElementById(this.id).focus();
      this.value = dataMgr.getObject(path);
    };

    this.observer.startObserving(path, {
      callback: function() {
        input.value = dataMgr.getObject(path);
        propList.validateProperties();
        document.getElementById(input.id).focus();
      }
    });

    return controlDiv;
  }
}
