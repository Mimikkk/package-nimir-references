export const isNil = <T>(value: Nil<T>): value is Extract<T, null | undefined> => value === undefined || value === null;

export type Fn = (...args: any[]) => any;
export type FnAwait<TFn extends Fn> = Awaited<ReturnType<TFn>>;

export type Nil<T> = T | undefined | null;
export type NilOf<T> = Extract<T, undefined | null>;
export type Awaitable<T> = T | Promise<T>;
