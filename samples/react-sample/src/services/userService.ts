export interface User {
  id: string;
  handle: string;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export const users = new Map<string, User>([
  ['u1', { id: 'u1', handle: 'megumin' }],
  ['u2', { id: 'u2', handle: 'yunyun' }],
  ['u3', { id: 'u3', handle: 'wiz' }],
]);

export async function fetchByIds(ids: string[]): Promise<User[]> {
  await sleep(Math.random() * 250);

  return ids.map(id => users.get(id)!).filter(Boolean);
}

export const userService = {
  fetchByIds,
};
