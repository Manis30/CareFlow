import React, { useEffect, useState, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Parses any raw KPI value (e.g. 1500, "₹12,450", "98.5%", "$500", "0")
 * into prefix, numeric value, suffix, and decimal precision.
 */
function parseNumericValue(val) {
  if (typeof val === 'number') {
    const isFloat = val % 1 !== 0;
    return {
      prefix: '',
      number: val,
      suffix: '',
      decimals: isFloat ? 2 : 0,
      isNumeric: !isNaN(val)
    };
  }

  if (typeof val !== 'string') {
    return { prefix: '', number: 0, suffix: '', decimals: 0, isNumeric: false };
  }

  const trimmed = val.trim();
  // Match prefix, numeric portion (including commas and decimal), and suffix
  const match = trimmed.match(/^([^0-9.-]*)([0-9,.]+)([^0-9.]*)$/);
  if (!match) {
    return { prefix: '', number: 0, suffix: trimmed, decimals: 0, isNumeric: false };
  }

  const prefix = match[1] || '';
  const numStr = match[2].replace(/,/g, '');
  const suffix = match[3] || '';
  const parsedNum = parseFloat(numStr);

  if (isNaN(parsedNum)) {
    return { prefix: '', number: 0, suffix: trimmed, decimals: 0, isNumeric: false };
  }

  const decimalPart = numStr.includes('.') ? numStr.split('.')[1] : '';
  const decimals = decimalPart.length;

  return {
    prefix,
    number: parsedNum,
    suffix,
    decimals,
    isNumeric: true
  };
}

/**
 * AnimatedNumber
 * - Animates smoothly from 0 or previous value to target value (~800ms ease-out cubic)
 * - Tabular figures prevent layout shift during digit count changes
 * - Respects prefers-reduced-motion
 */
export const AnimatedNumber = ({
  value,
  duration = 800,
  className = '',
  formatter = null
}) => {
  const prefersReduced = useReducedMotion();
  const parsed = parseNumericValue(value);

  // If value is not a parsable number, render directly
  if (!parsed.isNumeric) {
    return <span className={`tabular-nums ${className}`}>{value}</span>;
  }

  const [displayValue, setDisplayValue] = useState(() => (prefersReduced ? parsed.number : 0));
  const prevValueRef = useRef(prefersReduced ? parsed.number : 0);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (prefersReduced) {
      setDisplayValue(parsed.number);
      prevValueRef.current = parsed.number;
      return;
    }

    const startValue = prevValueRef.current;
    const endValue = parsed.number;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    const startTime = performance.now();

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: 1 - (1 - t)^3
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = startValue + (endValue - startValue) * easeProgress;

      setDisplayValue(currentVal);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(update);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    animFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [parsed.number, duration, prefersReduced]);

  // Format with commas and appropriate decimal places
  const formattedNumber = displayValue.toLocaleString('en-IN', {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals
  });

  const output = formatter
    ? formatter(displayValue)
    : `${parsed.prefix}${formattedNumber}${parsed.suffix}`;

  return <span className={`tabular-nums inline-block ${className}`}>{output}</span>;
};

export default AnimatedNumber;
