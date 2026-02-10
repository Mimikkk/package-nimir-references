function o(t) {
  return new Promise((e, n) => {
    t.oncomplete = t.onsuccess = () => e(t.result), t.onabort = t.onerror = () => n(t.error);
  });
}
function f(t, e) {
  let n;
  const r = () => {
    if (n)
      return n;
    const a = indexedDB.open(t);
    return a.onupgradeneeded = () => a.result.createObjectStore(e), n = o(a), n.then((i) => {
      i.onclose = () => n = void 0;
    }, () => {
    }), n;
  };
  return (a, i) => r().then((c) => i(c.transaction(e, a).objectStore(e)));
}
let s;
function u() {
  return s || (s = f("keyval-store", "keyval")), s;
}
function d(t, e = u()) {
  return e("readwrite", (n) => (t.forEach((r) => n.put(r[1], r[0])), o(n.transaction)));
}
function y(t, e = u()) {
  return e("readonly", (n) => Promise.all(t.map((r) => o(n.get(r)))));
}
function h(t, e = u()) {
  return e("readwrite", (n) => (t.forEach((r) => n.delete(r)), o(n.transaction)));
}
function p(t = u()) {
  return t("readwrite", (e) => (e.clear(), o(e.transaction)));
}
function w(t, e) {
  return t.openCursor().onsuccess = function() {
    this.result && (e(this.result), this.result.continue());
  }, o(t.transaction);
}
function g(t = u()) {
  return t("readonly", (e) => {
    if (e.getAll && e.getAllKeys)
      return Promise.all([
        o(e.getAllKeys()),
        o(e.getAll())
      ]).then(([r, a]) => r.map((i, c) => [i, a[c]]));
    const n = [];
    return t("readonly", (r) => w(r, (a) => n.push([a.key, a.value])).then(() => n));
  });
}
class l {
  constructor(e) {
    this.store = e;
  }
  static from({ database: e, table: n }) {
    return new l(f(e, n));
  }
  async entries() {
    return await g(this.store);
  }
  async getMany(e) {
    return await y(e, this.store);
  }
  async setMany(e) {
    return await d(e, this.store);
  }
  async delMany(e) {
    return await h(e, this.store);
  }
  async clear() {
    return await p(this.store);
  }
}
const m = l.from;
export {
  m as createIdbKeyvalCache
};
