import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { ChartContainer, CareFlowTooltip, CHART_COLORS, PALETTE } from './CareFlowChart';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const AreaLineChart = ({
  data = [],
  xKey = 'date',
  series = [{ key: 'value', name: 'Value', color: CHART_COLORS.blue }],
  height = 240,
  title,
  subtitle,
  badge,
  headerAction,
  valueFormatter = (val) => val,
  emptyMessage = 'No historical trend data available.',
  className = '',
  index = 0
}) => {
  const prefersReduced = useReducedMotion();

  if (!data || data.length === 0) {
    return (
      <ChartContainer
        title={title}
        subtitle={subtitle}
        badge={badge}
        headerAction={headerAction}
        className={className}
        index={index}
      >
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs font-medium"
        >
          {emptyMessage}
        </div>
      </ChartContainer>
    );
  }

  const animationDuration = prefersReduced ? 0 : 450;

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      badge={badge}
      headerAction={headerAction}
      className={className}
      index={index}
    >
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
            <defs>
              {series.map((s, idx) => {
                const color = s.color || PALETTE[idx % PALETTE.length];
                const gradId = `area-grad-${s.key}-${idx}`;
                return (
                  <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                  </linearGradient>
                );
              })}
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />

            <XAxis
              dataKey={xKey}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'var(--font-sans)' }}
              dy={6}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'var(--font-sans)' }}
              tickFormatter={(val) => {
                if (typeof val === 'number') {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                }
                return val;
              }}
            />

            <Tooltip
              content={<CareFlowTooltip valueFormatter={valueFormatter} />}
              cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '2 2' }}
            />

            {series.map((s, idx) => {
              const color = s.color || PALETTE[idx % PALETTE.length];
              const gradId = `area-grad-${s.key}-${idx}`;
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name || s.key}
                  stroke={color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#${gradId})`}
                  isAnimationActive={!prefersReduced}
                  animationDuration={animationDuration}
                  activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#FFFFFF', fill: color }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
};

export default AreaLineChart;
