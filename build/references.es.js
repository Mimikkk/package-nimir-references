const I = (o) => typeof o == "string", D = (o) => typeof o == "object" && o !== null && "source" in o && "fields" in o, N = (o) => typeof o == "object" && o !== null && !D(o);
function S(o, t, e) {
  let s = o.get(t);
  s || (s = /* @__PURE__ */ new Set(), o.set(t, s));
  for (const i of e)
    typeof i == "string" && s.add(i);
}
class w {
  constructor(t) {
    this.sources = t;
  }
  /**
   * Creates a resolver from a map of named sources.
   *
   * Most users should not instantiate this directly; use `defineReferences(...)`.
   */
  static from(t) {
    return new w(t);
  }
  /**
   * Resolves references described by `fields` on `item`.
   *
   * Behavior:
   * - Returns a clone (does not mutate `item`).
   * - Adds `T` / `Ts` properties next to reference ID fields.
   * - Missing IDs (not returned by the source) resolve to `null`.
   * - `null` / `undefined` IDs resolve to `null` in the corresponding `T`/`Ts` slot.
   * - Unknown source names are skipped (no throw).
   *
   * Depth:
   * - Resolution is bounded by `maxDepth` to avoid infinite loops on circular configs.
   */
  async resolve(t, e) {
    if (t == null)
      return t;
    const s = structuredClone(t), i = e, n = Array.isArray(s) ? s.map((r) => ({ target: r, fields: i })) : [{ target: s, fields: i }];
    let a = 0;
    for (; n.length > 0 && !(++a > 10); ) {
      const r = n.splice(0, n.length), c = /* @__PURE__ */ new Map(), h = [];
      for (const l of r)
        this.collect(l.target, l.fields, c, h);
      if (h.length === 0) break;
      const B = /* @__PURE__ */ new Map();
      await Promise.all(
        Array.from(c.entries()).map(async ([l, p]) => {
          const v = this.sources.get(l);
          if (!v) return;
          const u = await v.resolve(Array.from(p));
          B.set(l, u);
        })
      );
      for (const l of h) {
        const p = B.get(l.source);
        if (!p) continue;
        if (l.isArray) {
          const k = (l.target[l.property] ?? []).map((y) => y ? p.get(y) ?? null : null);
          if (l.target[`${l.property}Ts`] = k, l.fields)
            for (const y of k)
              y && typeof y == "object" && n.push({ target: y, fields: l.fields });
          continue;
        }
        const v = l.target[l.property], u = v ? p.get(v) ?? null : null;
        l.target[`${l.property}T`] = u, l.fields && u && typeof u == "object" && n.push({ target: u, fields: l.fields });
      }
    }
    return s;
  }
  collect(t, e, s, i) {
    for (const [n, a] of Object.entries(e)) {
      const r = t[n];
      if (r != null) {
        if (I(a)) {
          const c = Array.isArray(r) ? r : [r];
          S(s, a, c), i.push({ target: t, property: n, source: a, isArray: Array.isArray(r) });
          continue;
        }
        if (D(a)) {
          const c = Array.isArray(r) ? r : [r];
          S(s, a.source, c), i.push({
            target: t,
            property: n,
            source: a.source,
            isArray: Array.isArray(r),
            fields: a.fields
          });
          continue;
        }
        if (N(a))
          if (Array.isArray(r))
            for (const c of r)
              c && typeof c == "object" && this.collect(c, a, s, i);
          else typeof r == "object" && this.collect(r, a, s, i);
      }
    }
  }
}
const f = () => {
};
class m {
  constructor(t, e, s, i) {
    this.cache = t, this.keyBy = e, this.ttlMs = s, this.fetchAll = i;
  }
  warmup = null;
  timestampMs = 0;
  positives = /* @__PURE__ */ new Map();
  negatives = /* @__PURE__ */ new Map();
  static new(t) {
    return new m(t.cache, t.keyBy, t.ttlMs, t.fetchAll);
  }
  async resolve(t) {
    return await this.ensureWarmUp(), this.timestampMs > 0 && Date.now() - this.timestampMs > this.ttlMs && (this.warmup = null, this.ensureWarmUp().catch(f)), new Map(t.map((e) => [e, this.positives.get(e) ?? null]));
  }
  async invalidate(t) {
    if (t) {
      for (const e of t)
        this.positives.delete(e), this.negatives.delete(e);
      await this.cache?.removeByIds(t).catch(f);
      return;
    }
    this.positives.clear(), this.negatives.clear(), this.warmup = null, this.timestampMs = 0, await this.cache?.clear().catch(f);
  }
  async clearAll() {
    this.positives.clear(), this.negatives.clear(), this.warmup = null, this.timestampMs = 0, await this.cache?.clear();
  }
  ensureWarmUp() {
    return this.warmup ??= this.doWarmUp().catch((t) => {
      throw this.warmup = null, t;
    }), this.warmup;
  }
  async doWarmUp() {
    if (this.cache) {
      const { positive: s, negative: i } = await this.cache.all(this.ttlMs);
      if (s.size > 0) {
        for (const [n, a] of s) this.positives.set(n, a);
        for (const [n, a] of i) this.negatives.set(n, a);
        this.timestampMs = Date.now();
        return;
      }
    }
    const t = await this.fetchAll();
    this.positives.clear(), this.negatives.clear();
    const e = [];
    for (const s of t) {
      const i = this.keyBy(s);
      this.positives.set(i, s), e.push([i, s]);
    }
    this.cache?.storePositives(e).catch(f), this.timestampMs = Date.now();
  }
}
class M {
  constructor(t, e, s, i, n) {
    this.cache = t, this.keyBy = e, this.ttlMs = s, this.batchSize = i, this.fetchByIds = n;
  }
  positives = /* @__PURE__ */ new Map();
  negatives = /* @__PURE__ */ new Map();
  inflight = /* @__PURE__ */ new Map();
  static new(t) {
    return new M(t.cache, t.keyBy, t.ttlMs, t.batchSize, t.fetchByIds);
  }
  async resolve(t) {
    const e = /* @__PURE__ */ new Map(), s = [], i = [];
    for (const n of t) {
      const a = this.positives.get(n);
      if (a !== void 0) {
        e.set(n, a);
        continue;
      }
      const r = this.negatives.get(n);
      if (r) {
        if (Date.now() < r.expiry) {
          e.set(n, null);
          continue;
        }
        this.negatives.delete(n);
      }
      const c = this.inflight.get(n);
      if (c) {
        s.push(c.then((h) => {
          e.set(n, h);
        }));
        continue;
      }
      i.push(n);
    }
    if (i.length > 0) {
      const n = await this.fetchAndCache(i);
      for (const [a, r] of n)
        e.set(a, r);
    }
    return s.length > 0 && await Promise.all(s), e;
  }
  async invalidate(t) {
    if (t) {
      for (const e of t)
        this.positives.delete(e), this.negatives.delete(e);
      await this.cache?.removeByIds(t).catch(f);
      return;
    }
    this.positives.clear(), this.negatives.clear(), await this.cache?.clear().catch(f);
  }
  async clearAll() {
    this.positives.clear(), this.negatives.clear(), this.inflight.clear(), await this.cache?.clear();
  }
  async fetchAndCache(t) {
    const e = /* @__PURE__ */ new Map();
    for (const i of t)
      this.inflight.set(i, new Promise((n) => e.set(i, n)));
    const s = /* @__PURE__ */ new Map();
    try {
      let i = t;
      this.cache && (i = await this.drainFromCache(i, s, e)), i.length > 0 && await this.fetchFromNetwork(i, s, e);
    } catch (i) {
      this.handleFetchError(i, t, s, e);
    } finally {
      for (const i of t)
        this.inflight.delete(i);
    }
    return s;
  }
  async drainFromCache(t, e, s) {
    const i = await this.cache.positives(t, this.ttlMs), n = [];
    for (const c of t) {
      const h = i.get(c);
      h !== void 0 ? (this.positives.set(c, h), e.set(c, h), s.get(c)?.(h)) : n.push(c);
    }
    if (n.length === 0) return [];
    const a = await this.cache.negatives(n), r = [];
    for (const c of n) {
      const h = a.get(c);
      h ? (this.negatives.set(c, h), e.set(c, null), s.get(c)?.(null)) : r.push(c);
    }
    return r;
  }
  async fetchFromNetwork(t, e, s) {
    const i = await this.batchFetch(t), n = /* @__PURE__ */ new Set(), a = [];
    for (const c of i) {
      const h = this.keyBy(c);
      n.add(h), this.positives.set(h, c), e.set(h, c), s.get(h)?.(c), a.push([h, c]);
    }
    this.cache && a.length > 0 && this.cache.storePositives(a).catch(f);
    const r = t.filter((c) => !n.has(c));
    this.applyNegative(r, "missing", e, s);
  }
  applyNegative(t, e, s, i) {
    if (t.length === 0) return;
    const n = Date.now() + this.ttlMs;
    for (const a of t)
      this.negatives.set(a, { reason: e, expiry: n }), s.set(a, null), i.get(a)?.(null);
    this.cache?.storeNegatives(t, e, this.ttlMs).catch(f);
  }
  handleFetchError(t, e, s, i) {
    const n = e.filter((c) => !s.has(c)), a = j(t);
    if (!a) {
      for (const c of n)
        i.get(c)?.(null);
      throw t;
    }
    const r = z(a);
    this.applyNegative(n, r, s, i);
  }
  async batchFetch(t) {
    if (!this.batchSize || t.length <= this.batchSize)
      return this.fetchByIds(t);
    const e = [];
    for (let i = 0; i < t.length; i += this.batchSize)
      e.push(t.slice(i, i + this.batchSize));
    return (await Promise.all(e.map((i) => this.fetchByIds(i)))).flat();
  }
}
function j(o) {
  if (!o || typeof o != "object") return;
  const t = o.status;
  if (typeof t == "number") return t;
  const e = o.response;
  if (typeof e != "object" || e === null) return;
  const s = e.status;
  return typeof s == "number" ? s : void 0;
}
function z(o) {
  return o === 401 || o === 403 ? "unauthorized" : o === 404 ? "not-found" : o >= 500 ? "internal-server-error" : "missing";
}
const F = 14400 * 1e3, P = F, R = 200, C = (o) => o.id;
class A {
  constructor(t) {
    this.strategy = t;
  }
  /**
   * Creates a store from either `fetchAll` or `fetchByIds` options.
   */
  static from(t) {
    const e = t.cache ?? null, s = t.keyBy ?? C, i = t.ttlMs ?? P, n = "fetchAll" in t ? m.new({
      cache: e,
      keyBy: s,
      ttlMs: i,
      fetchAll: t.fetchAll
    }) : M.new({
      cache: e,
      keyBy: s,
      ttlMs: i,
      batchSize: t.batchSize ?? R,
      fetchByIds: t.fetchByIds
    });
    return new A(n);
  }
  resolve(t) {
    return this.strategy.resolve(t);
  }
  invalidate(t) {
    return this.strategy.invalidate(t);
  }
  clearAll() {
    return this.strategy.clearAll();
  }
}
class b {
  constructor(t, e) {
    this.stores = t, this.resolver = e;
  }
  static from(t, e) {
    return new b(t, e);
  }
  //@ts-expect-error
  async inline(t, e) {
    const s = await this.resolver.resolve(t, e.fields);
    return s == null ? s : e.transform?.(s) ?? s;
  }
  fn(t, e) {
    return async (...s) => {
      const i = await t(...s);
      if (i == null) return i;
      const n = await this.resolver.resolve(i, e.fields);
      return n == null ? n : e.transform?.(n) ?? n;
    };
  }
  invalidate(t, e) {
    this.stores.get(t)?.invalidate(e);
  }
  async clear() {
    await Promise.all(Array.from(this.stores.values()).map((t) => t.invalidate()));
  }
}
const W = {
  source(o) {
    return A.from(o);
  }
};
function T(o) {
  const t = new Map(Object.entries(o(W))), e = w.from(t);
  return b.from(t, e);
}
const g = "neg:", d = (o) => `${g}${o}`;
class x {
  constructor(t) {
    this.cache = t;
  }
  /**
   * Wraps an adapter implementation into a cache used by stores.
   */
  static new(t) {
    return new x(t);
  }
  /**
   * Loads the whole cache (adapter `entries()`), partitions into positive/negative and filters by TTL.
   *
   * This is primarily used by the `fetchAll` strategy to warm up quickly.
   */
  async all(t) {
    const e = await this.cache.entries(), s = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), n = Date.now();
    for (const [a, r] of e) {
      if (a.startsWith(g)) {
        const h = r;
        n < h.expiry && i.set(a.slice(g.length), h);
        continue;
      }
      const c = r;
      n - c.updatedAt <= t && s.set(a, c.resource);
    }
    return { positive: s, negative: i };
  }
  async positives(t, e) {
    if (t.length === 0) return /* @__PURE__ */ new Map();
    const s = Date.now(), i = [], n = await this.cache.getMany(t), a = /* @__PURE__ */ new Map();
    for (let r = 0; r < t.length; ++r) {
      const c = n[r];
      if (c) {
        if (s - c.updatedAt > e) {
          i.push(t[r]);
          continue;
        }
        a.set(t[r], c.resource);
      }
    }
    return i.length > 0 && await this.cache.delMany(i), a;
  }
  async negatives(t) {
    if (t.length === 0) return /* @__PURE__ */ new Map();
    const e = Date.now(), s = [], i = t.map(d), n = await this.cache.getMany(i), a = /* @__PURE__ */ new Map();
    for (let r = 0; r < t.length; r++) {
      const c = n[r];
      c && (e >= c.expiry ? s.push(i[r]) : a.set(t[r], c));
    }
    return s.length > 0 && await this.cache.delMany(s), a;
  }
  /**
   * Stores resources as positive entries, with a shared `updatedAt` timestamp.
   */
  async storePositives(t) {
    if (t.length === 0) return;
    const e = Date.now();
    await this.cache.setMany(
      t.map(([s, i]) => [s, { resource: i, updatedAt: e }])
    );
  }
  /**
   * Stores negative entries for IDs (all share the same expiry).
   */
  async storeNegatives(t, e, s) {
    if (t.length === 0) return;
    const i = Date.now() + s, n = { reason: e, expiry: i };
    await this.cache.setMany(t.map((a) => [d(a), n]));
  }
  /**
   * Removes both positive and negative entries for the given IDs.
   */
  async removeByIds(t) {
    await this.cache.delMany(t.concat(t.map(d)));
  }
  /**
   * Clears all cache entries.
   */
  async clear() {
    await this.cache.clear();
  }
}
export {
  w as ReferenceResolver,
  x as ResourceCache,
  A as ResourceStore,
  T as defineReferences
};
