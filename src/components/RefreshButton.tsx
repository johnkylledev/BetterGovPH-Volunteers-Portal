import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

/** Refresh action whose icon makes one full turn per tap — feedback, never a loop. */
export const RefreshButton: React.FC<{ onRefresh: () => void; loading?: boolean }> = ({ onRefresh, loading }) => {
  const [turns, setTurns] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setTurns((t) => t + 1);
        onRefresh();
      }}
      disabled={loading}
      className="s-btn s-btn-plain h-9 shrink-0 px-2.5 text-[13px] sm:px-3"
    >
      <RefreshCw
        size={14}
        strokeWidth={1.75}
        className="transition-transform duration-[600ms] ease-[cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none"
        style={{ transform: `rotate(${turns * 360}deg)` }}
        aria-hidden
      />
      {/* Icon only on phones, so it fits beside the tabs */}
      <span className="sr-only sm:not-sr-only">{loading ? 'Refreshing…' : 'Refresh'}</span>
    </button>
  );
};
