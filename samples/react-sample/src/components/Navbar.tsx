import { ChangeEventHandler, memo, useCallback, useEffect, useState } from 'react';
import { references } from '../configs/references';

interface NavbarProps {
  status: string;
  fetchStatus: string;
}

const RestoreKey = 'use-restore';
function useRestoreControl() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(RestoreKey) === '1');

  const set = useCallback((v: boolean) => {
    setEnabled(v);
    localStorage.setItem(RestoreKey, v ? '1' : '0');
  }, []);

  return [enabled, set] as const;
}

const RestoreControl = memo(function RestoreControl() {
  const [shouldRestore, setShouldRestore] = useRestoreControl();

  const handleRestoreToggle = useCallback<ChangeEventHandler<HTMLInputElement>>(event => {
    setShouldRestore(event.target.checked);
  }, []);

  useEffect(() => {
    if (shouldRestore) references.restore();
  }, [shouldRestore]);

  return (
    <label className="label cursor-pointer gap-2">
      <span className="label-text text-sm">Restore</span>
      <input type="checkbox" className="toggle toggle-sm" checked={shouldRestore} onChange={handleRestoreToggle} />
    </label>
  );
});

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  return (
    <div className="badge badge-outline">
      status: <span className="ml-1 font-mono">{status}</span>
    </div>
  );
});

export const Navbar = memo<NavbarProps>(function Navbar({ status, fetchStatus }) {
  return (
    <div className="navbar bg-base-100/80 backdrop-blur border-b border-base-300">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="text-lg font-semibold">@nimir/references - React</div>
            <div className="text-sm opacity-70 flex items-center gap-1">
              <span>Resolves</span>
              <code className="kbd kbd-sm">assigneeId</code>
              <span>,</span>
              <code className="kbd kbd-sm">watcherIds</code>
              <span>,</span>
              <code className="kbd kbd-sm">meta.lastEditedById</code>
              <span>from a mocked</span>
              <code className="kbd kbd-sm">users</code>
              <span>source.</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RestoreControl />
            <StatusBadge status={status} />
            <StatusBadge status={fetchStatus} />
          </div>
        </div>
      </div>
    </div>
  );
});
