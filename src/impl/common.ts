export type Fn = (...args: any[]) => any;
export type Nil<T> = T | undefined | null;
export type Nullable<T> = T | undefined | null;
export type Status = 'idle' | 'loading' | 'success' | 'error';
export type Awaitable<T> = T | Promise<T>;
