import { memo } from 'react';
import { references } from '../configs/references';

interface ActionButtonsProps {
  onShuffle: () => void;
  onReResolve: () => void;
  onRemount: () => void;
}

export const ActionButtons = memo<ActionButtonsProps>(function ActionButtons({ onShuffle, onReResolve, onRemount }) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm mb-4">
      <div className="card-body gap-3">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm btn-primary" onClick={onShuffle}>
            Shuffle refs
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              references.invalidate('users');
              onReResolve();
            }}
          >
            Invalidate users (all) + re-resolve
          </button>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              references.invalidate('users', ['u1']);
              onReResolve();
            }}
          >
            Invalidate users u1 + re-resolve
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              references.clear().then(() => onReResolve());
            }}
          >
            Clear all stores + re-resolve
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onRemount}>
            Remount app
          </button>
        </div>
      </div>
    </div>
  );
});
