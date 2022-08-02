// observer.js

class ROMObserver {
  constructor(dataMgr) {
    this.dataMgr = dataMgr;
    this.observees = {};
    this.isAsleep = false;
  }

  sleep() {
    this.isAsleep = true;
  }

  wake() {
    this.isAsleep = false;
  }

  startObserving(path, options) {
    if (this.observees[path]) return;
    this.dataMgr.addObserver(this, path);
    this.observees[path] = options;
  }

  startObservingAssembly(path, options) {
    const definition = this.dataMgr.getDefinition(path);
    if (!definition || definition.type !== 'assembly') {
      console.log(`Can't observe object: ${path}`);
      return;
    }

    const obj = this.dataMgr.getObject(path);
    for (const key in obj) {
      this.startObserving(`${path}.${key}`, options);
    }
  }

  reset() {
    for (let path in this.observees) {
      this.dataMgr.removeObserver(this, path);
    }
    this.observees = {};
  }

  notify(path) {
    if (this.isAsleep) return;
    const options = this.observees[path];
    if (!options) {
      console.log(`Invalid observer path: ${path}`);
      return;
    }
    options.callback.call(options.target, options.args);
  }
}
