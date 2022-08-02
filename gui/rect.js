// rect.js

class Rect {
  constructor(l, r, t, b) {

    l = Number(l) || 0;
    r = Number(r) || 0;
    t = Number(t) || 0;
    b = Number(b) || 0;
    if (r <= l) {
      l = 0;
      r = 0;
    }
    if (b <= t) {
      t = 0;
      b = 0;
    }

    this.l = l;
    this.r = r;
    this.t = t;
    this.b = b;
  }

  isEmpty() {
    return (this.r <= this.l) || (this.b <= this.t);
  }

  isEqual(rect) {
    return (rect.l === this.l) && (rect.r === this.r) && (rect.t === this.t) && (rect.b === this.b);
  }

  intersect(rect) {
    return new Rect(Math.max(this.l, rect.l),
    Math.min(this.r, rect.r),
    Math.max(this.t, rect.t),
    Math.min(this.b, rect.b));
  }

  contains(rect) {
    return this.intersect(rect).isEqual(rect);
  }

  containsPoint(x, y) {
    return (x >= this.l) && (x < this.r) && (y >= this.t) && (y < this.b);
  }

  scale(x, y) {
    x = Number(x);
    y = Number(y) || x;

    return new Rect((this.l * x) || 0, (this.r * x) || 0, (this.t * y) || 0, (this.b * y) || 0);
  }

  offset(x, y) {
    x = Number(x);
    y = Number(y);

    return new Rect(this.l + x, this.r + x, this.t + y, this.b + y);
  }

  inflate(l, r, t, b) {
    l = Number(l);
    r = Number(r);
    t = Number(t);
    b = Number(b);

    return new Rect(this.l - l, this.r - r, this.t + t, this.b + b);
  }
}

Object.defineProperty(Rect.prototype, "w", {
    get: function() { return this.r - this.l; },
    set: function(w) { this.r = this.l + w; }
});

Object.defineProperty(Rect.prototype, "h", {
    get: function() { return this.b - this.t; },
    set: function(h) { this.b = this.t + h; }
});

Object.defineProperty(Rect.prototype, "centerX", {
    get: function() { return (this.r + this.l) / 2; }
});

Object.defineProperty(Rect.prototype, "centerY", {
    get: function() { return (this.b + this.t) / 2; }
});
