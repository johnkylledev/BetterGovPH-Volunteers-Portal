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
      className="s-btn s-btn-plain h-9 px-3 text-[13px]"
    >
      <RefreshCw
        size={14}
        strokeWidth={1.75}
        className="transition-transform duration-[600ms] ease-[cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none"
        style={{ transform: `rotate(${turns * 360}deg)` }}
        aria-hidden
      />
      {loading ? 'Refreshing…' : 'Refresh'}
    </button>
  );
};
