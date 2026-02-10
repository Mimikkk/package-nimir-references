class s {
  constructor(e) {
    this.items = e;
  }
  static from() {
    return new s(/* @__PURE__ */ new Map());
  }
  async entries() {
    return Array.from(this.items.entries());
  }
  async getMany(e) {
    return e.map((t) => this.items.get(t));
  }
  async setMany(e) {
    for (const [t, r] of e)
      this.items.set(t, r);
  }
  async delMany(e) {
    for (const t of e)
      this.items.delete(t);
  }
  async clear() {
    this.items.clear();
  }
}
const n = s.from;
export {
  n as createMemoryCache
};
