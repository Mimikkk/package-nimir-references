import { memo } from 'react';

interface NavbarProps {
  status: string;
  fetchStatus: string;
  warmupEnabled: boolean;
  onWarmupToggle: (v: boolean) => void;
}

export const Navbar = memo<NavbarProps>(function Navbar({ status, fetchStatus, warmupEnabled, onWarmupToggle }) {
  return (
    <div className="navbar bg-base-100/80 backdrop-blur border-b border-base-300">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="text-lg font-semibold">@nimir/references React adapter sample</div>
            <div className="text-sm opacity-70">
              Resolves <code className="kbd kbd-sm">assigneeId</code>, <code className="kbd kbd-sm">watcherIds</code>,{' '}
              <code className="kbd kbd-sm">meta.lastEditedById</code> from a mocked{' '}
              <code className="kbd kbd-sm">users</code> source.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="label cursor-pointer gap-2">
              <span className="label-text text-sm">Warmup</span>
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={warmupEnabled}
                onChange={e => onWarmupToggle(e.target.checked)}
              />
            </label>
            <div className="badge badge-outline">
              status: <span className="ml-1 font-mono">{status}</span>
            </div>
            <div className="badge badge-outline">
              fetch: <span className="ml-1 font-mono">{fetchStatus}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
