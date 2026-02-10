export interface AdapterCache<TValue> {
  get(key: string): Promise<TValue | undefined>;
  getMany(keys: string[]): Promise<(TValue | undefined)[]>;
  entries(): Promise<[string, TValue][]>;
  values(): Promise<TValue[]>;
  keys(): Promise<string[]>;
  set(key: string, item: TValue): Promise<void>;
  setMany(entries: [key: string, item: TValue][]): Promise<void>;
  del(key: string): Promise<void>;
  delMany(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}
