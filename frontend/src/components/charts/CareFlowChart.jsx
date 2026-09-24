import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const CHART_COLORS = {
  blue: '#2563EB',
  green: '#10B981',
  indigo: '#6366F1',
  amber: '#F59E0B',
  sky: '#0284C7',
  rose: '#EF4444',
  purple: '#8B5CF6',
  slate: '#64748B'
};

export const PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.indigo,
  CHART_COLORS.amber,
  CHART_COLORS.sky,
  CHART_COLORS.purple,
  CHART_COLORS.rose
];

/**
 * Custom clinical tooltip for Recharts
 */
export const CareFlowTooltip = ({
  active,
  payload,
  label,
  valueFormatter = (val) => val,
  labelFormatter = (lbl) => lbl
}) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg border border-slate-800 font-sans min-w-[120px] pointer-events-none z-50">
      {label && (
        <div className="text-[11px] font-semibold text-slate-300 pb-1 mb-1 border-b border-slate-800">
          {labelFormatter(label)}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const color = entry.color || entry.fill || CHART_COLORS.blue;
          const name = entry.name || 'Value';
          const val = entry.value;

          return (
            <div key={index} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-slate-300 font-medium truncate">{name}</span>
              </div>
              <span className="font-bold text-white shrink-0">
                {valueFormatter(val, name)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Standardized Clinical Chart Wrapper Container
 */
export const ChartContainer = ({
  title,
  subtitle = null,
  badge = null,
  headerAction = null,
  children,
  className = '',
  index = 0
}) => {
  const prefersReduced = useReducedMotion();
  const Container = prefersReduced ? 'div' : motion.div;
  const motionProps = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3, delay: index * 0.05 }
      };

  return (
    <Container
      {...motionProps}
      className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between ${className}`}
    >
      {/* Chart Header */}
      {(title || subtitle || headerAction || badge) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 mb-2 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {title && (
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate">
                  {title}
                </h3>
              )}
              {badge && (
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      {/* Main Chart Body */}
      <div className="w-full flex-1 min-h-0">
        {children}
      </div>
    </Container>
  );
};

export default {
  CHART_COLORS,
  PALETTE,
  CareFlowTooltip,
  ChartContainer
};
