import React from 'react';

/**
 * ClinicalPulse
 * Subtle ECG waveform motif for live appointment status, online consultation, system health, and monitoring.
 * Visual: Understated, clean clinical SVG.
 */
export const ClinicalPulse = ({
  width = 64,
  height = 18,
  color = '#2563EB',
  animated = false,
  className = ''
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`inline-block shrink-0 ${animated ? 'animate-clinical-pulse' : ''} ${className}`}
    >
      <path
        d="M0 9H18L22 3L26 15L30 6L33 11L36 9H64"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default ClinicalPulse;
