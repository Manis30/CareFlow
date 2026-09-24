import React from 'react';
import { motion } from 'framer-motion';

/**
 * CareFlowECGSparkline
 * 
 * Signature clinical vitals heartbeat-style ECG sparkline.
 * Generates a realistic P-QRS-T cardiac waveform with a sharp deflection
 * proportional to trend change, terminating in a live pulsing dot.
 * 
 * @param {Array<number>} data - Trailing numeric values (e.g. 7d, 30d, 90d)
 * @param {'improving'|'degrading'|'neutral'|boolean} trend - Trend direction or boolean positive
 * @param {string} color - Optional explicit hex color (must be from design system)
 * @param {number} width - Viewbox width (default: 84)
 * @param {number} height - Viewbox height (default: 28)
 */
export function CareFlowECGSparkline({
  data = [],
  trend = 'neutral',
  color = null,
  width = 84,
  height = 28,
  className = ''
}) {
  // Determine semantic color token
  let strokeColor = '#94A3B8'; // Neutral muted slate
  let glowColor = 'rgba(148, 163, 184, 0.2)';

  if (color) {
    strokeColor = color;
    if (color === '#10B981') glowColor = 'rgba(16, 185, 129, 0.25)';
    else if (color === '#EF4444') glowColor = 'rgba(239, 68, 68, 0.25)';
    else if (color === '#2563EB') glowColor = 'rgba(37, 99, 235, 0.25)';
    else if (color === '#F59E0B') glowColor = 'rgba(245, 158, 11, 0.25)';
    else glowColor = 'rgba(148, 163, 184, 0.2)';
  } else if (trend === 'improving' || trend === true) {
    strokeColor = '#10B981'; // Success emerald
    glowColor = 'rgba(16, 185, 129, 0.25)';
  } else if (trend === 'degrading' || trend === false) {
    strokeColor = '#EF4444'; // Danger red
    glowColor = 'rgba(239, 68, 68, 0.25)';
  }

  // Calculate delta percentage for QRS spike magnitude
  let deltaPct = 0;
  if (Array.isArray(data) && data.length >= 2) {
    const first = data[0];
    const last = data[data.length - 1];
    if (first !== 0) {
      deltaPct = ((last - first) / Math.abs(first)) * 100;
    }
  }

  // Baseline Y
  const midY = height / 2;
  const spikeHeight = Math.min(height * 0.42, Math.max(height * 0.2, (Math.abs(deltaPct) / 100) * (height * 0.42)));
  const spikeDirection = deltaPct >= 0 ? -1 : 1; // -1 is up in SVG coords

  // Generate continuous medical ECG path:
  // Baseline -> P-wave -> Q dip -> R sharp spike -> S dip -> T wave -> Terminal segment
  const p1 = `M 0,${midY}`;
  const p2 = `L 14,${midY}`;
  // P-wave (subtle bump)
  const pWave = `Q 18,${midY + 1.5 * spikeDirection} 22,${midY}`;
  // PR segment
  const pr = `L 30,${midY}`;
  // QRS complex (the signature heartbeat spike)
  const qrs = `L 33,${midY - 2 * spikeDirection} L 37,${midY + spikeHeight * spikeDirection} L 41,${midY - 4 * spikeDirection} L 44,${midY}`;
  // ST segment
  const st = `L 52,${midY}`;
  // T-wave (rounded recovery curve)
  const tWave = `Q 58,${midY + 2.5 * spikeDirection} 64,${midY}`;
  // Final segment to terminal point
  const endX = width - 4;
  const terminal = `L ${endX},${midY}`;

  const pathD = `${p1} ${p2} ${pWave} ${pr} ${qrs} ${st} ${tWave} ${terminal}`;

  return (
    <div className={`relative inline-flex items-center select-none ${className}`} style={{ width, height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id={`ecg-glow-${strokeColor.replace('#', '')}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor={glowColor} />
          </filter>
        </defs>

        {/* ECG Cardiac Waveform Path */}
        <path
          d={pathD}
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#ecg-glow-${strokeColor.replace('#', '')})`}
        />

        {/* Static connection base dot */}
        <circle cx={endX} cy={midY} r="2" fill={strokeColor} />
      </svg>

      {/* Framer Motion Live Pulsing Dot at terminal end */}
      <div
        className="absolute pointer-events-none flex items-center justify-center"
        style={{ right: 2, top: midY - 6, width: 12, height: 12 }}
      >
        <motion.div
          animate={{
            scale: [1, 1.6, 1],
            opacity: [0.9, 0.25, 0.9]
          }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: strokeColor }}
        />
        <div
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: strokeColor }}
        />
      </div>
    </div>
  );
}

export default CareFlowECGSparkline;
