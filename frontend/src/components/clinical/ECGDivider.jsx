import React from 'react';
import ClinicalPulse from './ClinicalPulse';

/**
 * ECGDivider
 * Understated divider incorporating a quiet, single-period waveform motif between key clinical sections.
 */
export const ECGDivider = ({
  label = null,
  color = '#E2E8F0',
  pulseColor = '#2563EB',
  className = ''
}) => {
  return (
    <div className={`relative flex items-center justify-center my-6 ${className}`} role="separator">
      <div className="flex-1 border-t border-slate-200" />

      {label && (
        <div className="px-3 flex items-center gap-2 bg-white shrink-0">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            {label}
          </span>
        </div>
      )}

      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
};

export default ECGDivider;
