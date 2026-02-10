export interface AdapterCache<TValue> {
  entries(): Promise<[string, TValue][]>;
  getMany(keys: string[]): Promise<(TValue | undefined)[]>;
  setMany(entries: [key: string, item: TValue][]): Promise<void>;
  delMany(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}
