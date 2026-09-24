import React from 'react';
import { motion } from 'framer-motion';

/**
 * CareFlowLivePulse
 * Real-time operational status indicator badge.
 * Displays a solid core dot with expanding, fading concentric rings.
 * 
 * @param {'brand'|'success'|'warning'|'danger'|string} color - Semantic color or token hex
 * @param {string} label - Optional text label (e.g. "LIVE", "Active")
 * @param {string} className - Optional className
 */
export function CareFlowLivePulse({
  color = '#2563EB',
  label = null,
  className = ''
}) {
  let resolvedColor = '#2563EB'; // Primary brand blue
  if (color === 'success' || color === '#10B981') resolvedColor = '#10B981';
  else if (color === 'brand' || color === '#2563EB') resolvedColor = '#2563EB';
  else if (color === 'warning' || color === '#F59E0B') resolvedColor = '#F59E0B';
  else if (color === 'danger' || color === '#EF4444') resolvedColor = '#EF4444';
  else if (typeof color === 'string' && color.startsWith('#')) resolvedColor = color;

  return (
    <span className={`inline-flex items-center gap-1.5 align-middle select-none ${className}`}>
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {/* Expanding Ring 1 */}
        <motion.span
          animate={{
            scale: [1, 2.2],
            opacity: [0.75, 0]
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: 'easeOut'
          }}
          className="absolute inline-flex h-full w-full rounded-full"
          style={{ backgroundColor: resolvedColor }}
        />
        {/* Core Dot */}
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: resolvedColor }}
        />
      </span>
      {label && (
        <span
          className="text-[10px] font-semibold uppercase tracking-wider font-sans"
          style={{ color: resolvedColor }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

export default CareFlowLivePulse;
