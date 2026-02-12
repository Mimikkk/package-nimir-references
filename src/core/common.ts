export type Fn = (...args: any[]) => any;
export type Nil<T> = T | undefined | null;
export type Awaitable<T> = T | Promise<T>;
export const isNil = <T>(value: Nil<T>): value is Extract<T, null | undefined> => value === undefined || value === null;
