import React from 'react';

/**
 * PulseIndicator
 * Subtle live/active clinical status indicator with gentle breathing animation.
 */
export const PulseIndicator = ({
  label = 'Live',
  variant = 'live', // 'live' | 'active' | 'monitoring' | 'neutral'
  className = ''
}) => {
  const colorMap = {
    live: {
      dot: 'bg-emerald-500',
      ring: 'bg-emerald-400/40',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
    },
    active: {
      dot: 'bg-blue-600',
      ring: 'bg-blue-400/40',
      badge: 'bg-blue-50 text-blue-700 border-blue-200/60'
    },
    monitoring: {
      dot: 'bg-sky-500',
      ring: 'bg-sky-400/40',
      badge: 'bg-sky-50 text-sky-700 border-sky-200/60'
    },
    neutral: {
      dot: 'bg-slate-400',
      ring: 'bg-slate-300/40',
      badge: 'bg-slate-100 text-slate-600 border-slate-200'
    }
  };

  const style = colorMap[variant] || colorMap.live;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style.badge} ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${style.ring}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${style.dot}`} />
      </span>
      <span>{label}</span>
    </span>
  );
};

export default PulseIndicator;
