// data-manager.js

class ROMDataManager {
  constructor(data) {

    this.data = data;

    this.stringTableCache = {};
    this.clipboard = null;

    this.undoStack = [];
    this.redoStack = [];
    this.currAction = [];
    this.actionDepth = 0;

    this.observers = {};
  }

  markDirty() {

    // mark everything in the undo and redo stacks as dirty
    for (let actionArray of this.undoStack.concat(this.redoStack)) {
      for (let action of actionArray) {
        const match = action.path.match(/^[^.\[]*/);
        if (!match) continue;
        const key = match[0];
        if (!this.data.assembly[key]) continue;
        this.data.assembly[key].isDirty = true;
      }
    }
  }

  parsePath(path) {

    let pathComponents = [];

    // split objects by "."
    for (let token of path.split('.')) {

      let subStart = token.indexOf('[');
      if (subStart === -1) {
        // no subscripts
        pathComponents.push(token);
        continue;
      }

      pathComponents.push(token.substring(0, subStart));

      // get array subscripts
      const matches = token.match(/\[([^\]]+)]/g);
      if (!matches) {
        console.log(`Invalid subscripts in path: ${path}`);
        return pathComponents;
      }
      for (let match of matches) {
        const subString = match.substring(1, match.length - 1);
        const subNum = Number(eval(subString));
        if (!isNumber(subNum)) {
          console.log(`Invalid subscripts in path: ${path}`);
          return pathComponents;
        }

        pathComponents.push(subNum);
      }
    }
    return pathComponents;
  }

  getParentPath(path) {
    if (path.endsWith(']')) {
      // path ends with a subscript
      const subStart = path.lastIndexOf('[');
      if (subStart === -1) {
        console.log(`Invalid subscripts in path: ${path}`);
      }
      return path.substring(0, subStart);
    }

    const lastDot = path.lastIndexOf('.');
    if (lastDot !== -1) {
      return path.substring(0, lastDot);
    }

    console.log(`No parent for path: ${path}`);
    return null;
  }

  getIndex(path) {
    if (!path.endsWith(']')) return 0;
    const subStart = path.lastIndexOf('[');
    if (subStart === -1) {
      console.log(`Invalid subscripts in path: ${path}`);
    }
    const subString = path.substring(subStart + 1, path.length - 1);
    const subNum = Number(eval(subString));
    if (!isNumber(subNum)) {
      console.log(`Invalid subscripts in path: ${path}`);
      return 0;
    }
    return subNum;
  }

  getParentObject(path) {
    const parentPath = this.getParentPath(path);
    return this.getObject(parentPath);
  }

  getParentDefinition(path) {
    const parentPath = this.getParentPath(path);
    return this.getDefinition(parentPath);
  }

  getDefinition(path) {
    const pathComponents = this.parsePath(path);

    let definition = this.data;
    for (let key of pathComponents) {
      if (!definition.assembly) {
        console.log(`No definition for path: ${path}`);
        return null;
      }
      if (isNumber(key) && definition.type === 'array') {
        // array subscript
        definition = definition.assembly;

      } else if (!definition.assembly[key]) {
        console.log(`No definition for path: ${path}`);
        return null;

      } else {
        definition = definition.assembly[key]
      }
    }
    return definition;
  }

  getObject(path) {
    const pathComponents = this.parsePath(path);

    let object = this.data.obj;
    for (let key of pathComponents) {
      if (object[key] === undefined) {
        console.log(`No object for path: ${path}`);
        return null;
      }
      object = object[key];
    }
    return object;
  }

  getData(path) {
    const object = this.getObject(path);
    if (isString(object)) {
      return base64js.toByteArray(object);
    }
    console.log(`Invalid data path: ${path}`);
    return new Uint8Array(0);
  }

  setData(path, data) {

    // determine differences in the data
    const oldData = this.getData(path);
    const xorLength = data.length ^ oldData.length;
    const diffList = [];
    const length = Math.max(data.length, oldData.length);
    let currDiff = null;
    let start = 0;

    // go one byte past the end of the data to capture the last diff
    for (let i = 0; i <= length; i++) {
      let newValue = 0;
      if (i < data.length) newValue = data[i];

      let oldValue = 0;
      if (i < oldData.length) oldValue = oldData[i];

      if (newValue === oldValue) {
        if (!currDiff) continue;
        // end of a diff segment
        diffList.push({
          start: start,
          data: new Uint8Array(currDiff)
        });
        currDiff = null;
      } else {
        if (!currDiff) {
          start = i;
          currDiff = [];
        }
        currDiff.push(newValue ^ oldValue);
      }
    }

    // return if data is the same
    if (diffList.length === 0) return;

    function applyDiff() {
      const oldData = this.getData(path);
      const newLength = oldData.length ^ xorLength;
      const newData = new Uint8Array(Math.max(newLength, oldData.length));
      newData.set(oldData);
      for (let diff of diffList) {
        for (let i = 0; i < diff.data.length; i++) {
          newData[i + diff.start] ^= diff.data[i];
        }
      }
      const trimmedData = newData.subarray(0, newLength);
      this.setObjectNoAction(path, base64js.fromByteArray(trimmedData));
    }

    this.doAction({
      path: path,
      forwardCallback: applyDiff,
      reverseCallback: applyDiff,
      target: this
    });
  }

  getProperty(path) {

    // get raw value
    let value = this.getObject(path);

    const definition = this.getDefinition(path);
    if (definition.bool) {
      return value;
    }
    if (definition.msb) {
      const parentPath = this.getParentPath(path);
      const msbPath = definition.msb.replace('%p', parentPath);
      let msbValue = this.getProperty(msbPath);

      let mask = Number(definition.mask) || 0xFF;
      while (!(mask & 1)) mask >>= 1;
      let shift = 0;
      while (mask >> shift) shift++;

      value += msbValue << shift;
    }
    if (definition.multiplier) {
      value *= Number(definition.multiplier) || 1;
    }
    if (definition.offset) {
      value += Number(definition.offset) || 0;
    }

    return value;
  }

  setProperty(path, value) {

    const definition = this.getDefinition(path);
    let oldValue = this.getProperty(path);
    if (value === oldValue) return;

    this.beginAction();
    if (definition.offset) {
      const offset = Number(definition.offset) || 0
      value -= offset;
      oldValue -= offset;
    }
    if (definition.multiplier) {
      const multiplier = Number(definition.multiplier) || 1
      value = Math.floor(value / multiplier);
      oldValue = Math.floor(oldValue / multiplier);
    }
    if (definition.msb) {
      const parentPath = this.getParentPath(path);
      const msbPath = definition.msb.replace('%p', parentPath);

      let mask = Number(definition.mask) || 0xFF;
      while (!(mask & 1)) mask >>= 1;
      let shift = 0;
      while (mask >> shift) shift++;

      const msbValue = value >> shift;
      this.setProperty(msbPath, msbValue);
      value &= mask;
      oldValue &= mask;
    }

    this.doAction({
      path: path,
      newValue: value,
      oldValue: oldValue
    });
    this.endAction();
  }

  arrayInsert(path, index) {
    const arrayDef = this.getDefinition(path);
    if (!arrayDef || arrayDef.type !== 'array') {
      console.log(`Can't insert into array: ${path}`);
      return;
    }
    const arrayObj = this.getObject(path);
    if (!arrayObj || !isArray(arrayObj)) {
      console.log(`Can't insert into array: ${path}`);
      return;
    }

    if (!isNumber(index)) index = arrayObj.length;
    if (index > arrayObj.length) {
      console.log(`Can't insert into array: ${path}[${index}]`);
      return;
    }

    // create a new object from the array definition
    const itemPath = `${path}[${index}]`;
    const newItem = this.createObject(itemPath);

    function insertItem() {
      arrayObj.splice(index, 0, newItem);
      arrayDef.arrayLength = arrayObj.length;
    }

    function removeItem() {
      arrayObj.splice(index, 1);
      arrayDef.arrayLength = arrayObj.length;
    }

    this.doAction({
      path: path,
      forwardCallback: insertItem,
      reverseCallback: removeItem,
      target: this
    });

    return `${path}[${index}]`;
  }

  arrayRemove(path, index) {
    const arrayDef = this.getDefinition(path);
    if (!arrayDef || arrayDef.type !== 'array') {
      console.log(`Can't remove from array: ${path}`);
      return;
    }
    const arrayObj = this.getObject(path);
    if (!arrayObj || !isArray(arrayObj) || !arrayObj.length) {
      console.log(`Can't remove from array: ${path}`);
      return;
    }

    if (!isNumber(index)) {
      index = arrayObj.length - 1
    } else if (index >= arrayObj.length) {
      console.log(`Can't remove from array: ${path}[${index}]`);
      return;
    }

    const itemObj = arrayObj[index];

    function insertItem() {
      arrayObj.splice(index, 0, itemObj);
      arrayDef.arrayLength = arrayObj.length;
    }

    function removeItem() {
      arrayObj.splice(index, 1);
      arrayDef.arrayLength = arrayObj.length;
    }

    this.doAction({
      path: path,
      forwardCallback: removeItem,
      reverseCallback: insertItem,
      target: this
    });

    return `${path}[${index}]`;
  }

  createObject(path) {
    const definition = this.getDefinition(path);
    if (!definition || !definition.type) {
      console.log(`Unable to create object: ${path}`);
      return null;
    }
    if (definition.type === 'array') {
      return [];
    } else if (definition.type === 'property') {
      if (definition.bool) return false;
      return definition.min || 0;
    } else if (definition.type === 'text') {
      return '';
    } else if (definition.type === 'data') {
      return '';
    } else if (definition.type === 'assembly') {
      const obj = {};
      for (let key in definition.assembly) {
        if (isString(definition[key])) continue;
        obj[key] = this.createObject(`${path}.${key}`);
      }
      return obj;
    } else {
      console.log(`Unable to create object: ${path}`);
      return null;
    }
  }

  setObjectNoAction(path, value) {
    let pathComponents = this.parsePath(path);
    const key = pathComponents.pop();

    let obj = this.data.obj;
    for (let key of pathComponents) {
      if (obj[key] === undefined) {
        console.log(`No object for path: ${path}`);
      }
      obj = obj[key];
    }

    obj[key] = value;
  }

  setObject(path, value) {
    const oldValue = this.getObject(path);
    if (value === oldValue) return;
    this.beginAction();
    this.doAction({
      path: path,
      newValue: value,
      oldValue: oldValue
    });
    this.endAction();
  }

  // serialize(path) {
  //   const definition = this.getDefinition(path);
  //   if (definition.type === 'assembly') {
  //     let serializedObj = {};
  //     const index = this.getIndex(path);
  //     for (let key in definition.assembly) {
  //       let subPath = `${path}.${key}`;
  //       let subDefinition = definition.assembly[key];
  //       if (!subDefinition || isString(subDefinition)) continue;
  //
  //       // if (subDefinition.invalid) {
  //       //   // skip if property is invalid
  //       //   obj = this.dataMgr.getObject(path);
  //       //   if (eval(subDefinition.invalid)) continue;
  //       // }
  //
  //       if (subDefinition.external) {
  //         // get external property
  //         subPath = subDefinition.external.replace(/%i/g, index);
  //         subDefinition = this.getDefinition(subPath);
  //         if (!subDefinition) continue;
  //         // if (subDefinition.invalid) {
  //         //   // skip if external property is invalid
  //         //   obj = this.dataMgr.getParentObject(subPath);
  //         //   if (eval(subDefinition.invalid)) continue;
  //         // }
  //       }
  //       serializedObj[key] = this.serialize(subPath);
  //     }
  //     return serializedObj;
  //
  //   } else if (definition.type === 'property') {
  //     return this.getProperty(path);
  //
  //   } else {
  //     return this.getObject(path);
  //   }
  // }
  //
  // deserialize(path, obj) {
  //   const definition = this.getDefinition(path);
  //   if (definition.type === 'assembly') {
  //
  //   } else if (definition.type === 'property') {
  //     const value = Number(obj);
  //     if (!isNumber(value)) {
  //       console.log(`Can't deserialize value ${obj} for object ${path}`);
  //       return;
  //     }
  //     this.setProperty(path, value);
  //
  //   } else if (definition.type === 'text') {
  //     if (!isString(obj)) {
  //       console.log(`Can't deserialize value ${obj} for object ${path}`);
  //       return;
  //     }
  //     this.setObject(path, obj);
  //
  //   } else {
  //     return this.getObject(path);
  //   }
  // }

  beginAction() {
    this.actionDepth++;
  }

  endAction() {
    this.actionDepth--;
    if (this.actionDepth > 0) return;

    // end of action, push to undo stack
    this.actionDepth = 0;
    if (this.currAction.length) {

      // don't use an iterator here because observers may add more actions
      for (let a = 0; a < this.currAction.length; a++) {
        const action = this.currAction[a];
        if (action.path) this.notifyObservers(action.path);
      }
      this.currAction.reverse();
      this.undoStack.push(this.currAction);
      this.currAction = [];
    }
  }

  pushAction(action) {
    // add an action to the current action list without executing it
    this.currAction.push(action);
  }

  doAction(action, type) {

    // default action type is normal
    type = type || ROMDataManager.ActionType.normal;

    // clear the redo stack if it's a normal action
    if (type === ROMDataManager.ActionType.normal) {
      this.redoStack = [];
    }

    this.beginAction();
    let value = action.newValue;
    let callback = action.forwardCallback;

    // set to old value if undo
    if (type === ROMDataManager.ActionType.undo) {
      value = action.oldValue;
      callback = action.reverseCallback;
    }

    // execute the action
    if (action.path && value !== undefined) {
      this.setObjectNoAction(action.path, value);
    }
    if (callback && action.target) {
      callback.apply(action.target, action.args || []);
    }
    this.pushAction(action);
    this.endAction();
  }

  undo() {
    if (!this.undoStack.length) return;
    const actionList = this.undoStack.pop();
    this.beginAction();
    for (let action of actionList) {
      this.doAction(action, ROMDataManager.ActionType.undo);
    }
    this.endAction();

    // move the undone action to the redo stack
    this.redoStack.push(this.undoStack.pop());
  }

  redo() {
    if (!this.redoStack.length) return;
    const actionList = this.redoStack.pop();
    this.beginAction();
    for (let action of actionList) {
      this.doAction(action, ROMDataManager.ActionType.redo);
    }
    this.endAction();
  }

  addObserver(observer, path) {
    const observerList = this.observers[path] || [];
    if (observerList.find(oldObs => observer === oldObs)) {
      console.log(`Already observing object: ${path}`);
      return;
    }
    observerList.push(observer);
    this.observers[path] = observerList;
  }

  removeObserver(observer, path) {
    const oldList = this.observers[path] || [];
    const newList = oldList.filter(oldObs => observer !== oldObs);
    if (newList.length !== 0) {
      this.observers[path] = newList;
    } else {
      // no observers left for this path
      delete this.observers[path];
    }
  }

  notifyObservers(path) {
    const observerList = this.observers[path] || [];
    for (let observer of observerList) {
      observer.notify(path);
    }
  }

  getStringTableForObject(path) {

    const objDefinition = this.getDefinition(path);
    if (!objDefinition.stringTable) {
      // object has no string table
      return {};

    } else if (isString(objDefinition.stringTable)) {
      // object has a link to another string table
      return this.getStringTable(objDefinition.stringTable);

    } else {
      // object has its own defined string table
      if (!this.stringTableCache[path]) {
        this.stringTableCache[path] = this.parseStringTable(objDefinition.stringTable);
      }
      return this.stringTableCache[path];
    }
  }

  getStringTable(path) {

    if (this.stringTableCache[path]) {
      return this.stringTableCache[path];
    }

    // check if this is a path to a valid object
    const objDefinition = this.getDefinition(path);
    if (!objDefinition) {
      console.log(`String table not found: ${path}`);
      return {};
    }
    const stringTableDef = objDefinition.stringTable;
    if (!stringTableDef) {
      console.log(`String table not found: ${path}`);
      return {};
    }
    this.stringTableCache[path] = this.parseStringTable(stringTableDef);

    return this.stringTableCache[path];
  }

  parseStringTable(definition) {

    let stringList = {};
    for (let key in definition.string) {
      const range = new ROMRange(key);
      const stringBase = definition.string[key];
      for (let i = range.begin; i <= range.end; i++) {
        const string = stringBase.replace(/%i/g, i);
        stringList[i] = this.parseString(string);
      }
    }

    const length = definition.length || 0;
    const defaultString = definition.default || 'String %i';
    for (let i = 0; i < length; i++) {
      if (stringList[i] !== undefined) continue;
      const string = defaultString.replace(/%i/g, i);
      stringList[i] = this.parseString(string);
    }

    return stringList;
  }

  getString(definition, index) {

    // find the correct string
    for (let key in definition.string) {
      const range = new ROMRange(key);
      const stringBase = definition.string[key];
      if (range.contains(index)) {
        const string = stringBase.replace(/%i/g, index);
        return this.parseString(string);
      }
    }

    const defaultString = definition.default || 'String %i';
    const string = defaultString.replace(/%i/g, index);
    return this.parseString(string);
  }

  parseString(string) {
    // text links are enclosed in angle brackets <...>
    const textLinks = string.match(/<([^>]+)>/g) || [];

    // string links are enclosed in backticks `...`
    const stringLinks = string.match(/`([^`]+)`/g) || [];

    // replace links to text
    for (let link of textLinks) {
      const path = link.substring(1, link.length - 1);

      // check if the link is text
      const definition = this.getDefinition(path);
      if (!definition || definition.type != 'text') {
        console.log(`Invalid link: ${string}`);
        string = string.replace(link, 'Invalid Link');
        continue;
      }

      const text = this.getObject(path);
      string = string.replace(link, text);
    }

    // replace links to other strings
    for (let link of stringLinks) {
      const path = link.substring(1, link.length - 1);

      // check if the link is a string
      const parentDef = this.getParentDefinition(path);
      if (!parentDef || !parentDef.stringTable) {
        console.log(`Invalid link: ${string}`);
        string = string.replace(link, 'Invalid Link');
        continue;
      }

      const index = this.getIndex(path);
      const linkedString = this.getString(parentDef.stringTable, index);
      string = string.replace(link, linkedString);
    }

    return string;
  }
}

ROMDataManager.ActionType = {
  normal: "normal",
  undo: "undo",
  redo: "redo"
}
