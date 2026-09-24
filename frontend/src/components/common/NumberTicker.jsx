import React, { useEffect, useState, useRef } from 'react';

/**
 * Animated Number Ticker component that counts up when mounted or value changes.
 * Uses requestAnimationFrame with cubic ease-out interpolation.
 */
export function NumberTicker({
  value,
  prefix = '',
  suffix = '',
  formatter,
  duration = 600,
  className = ''
}) {
  const [displayVal, setDisplayVal] = useState(0);
  const prevValRef = useRef(0);

  useEffect(() => {
    const startVal = prevValRef.current;
    let endVal = 0;

    if (typeof value === 'number') {
      endVal = value;
    } else if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.-]/g, '');
      endVal = parseFloat(cleaned) || 0;
    }

    if (startVal === endVal) return;

    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;
      setDisplayVal(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        setDisplayVal(endVal);
        prevValRef.current = endVal;
      }
    }

    const animFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrame);
  }, [value, duration]);

  const formatted = formatter
    ? formatter(displayVal)
    : Number.isInteger(displayVal)
    ? Math.round(displayVal).toLocaleString()
    : displayVal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <span className={`tabular-nums font-bold tracking-tight ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default NumberTicker;
