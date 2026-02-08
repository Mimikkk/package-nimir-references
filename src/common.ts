export const identity = <T>(value: T): T => value;

export type Fn = (...args: any[]) => any;
export type Nil<T> = T | undefined | null;
export type Nullable<T> = T | undefined | null;
export type Status = 'idle' | 'loading' | 'success' | 'error';
export const FcNoop = () => {};

export const Time = {
  hour4: 4 * 60 * 60 * 1000,
};
