import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { ChartContainer, CareFlowTooltip, CHART_COLORS, PALETTE } from './CareFlowChart';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const GroupedBarChart = ({
  data = [],
  xKey = 'category',
  series = [
    { key: 'online', name: 'Online', color: CHART_COLORS.blue },
    { key: 'inPerson', name: 'In-Clinic', color: CHART_COLORS.green }
  ],
  height = 240,
  stacked = false,
  title,
  subtitle,
  badge,
  headerAction,
  valueFormatter = (val) => val,
  emptyMessage = 'No comparison data available.',
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
          <BarChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 4 }}>
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
            />

            <Tooltip
              content={<CareFlowTooltip valueFormatter={valueFormatter} />}
              cursor={{ fill: '#F8FAFC' }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ paddingBottom: '8px', fontSize: '11px', fontFamily: 'var(--font-sans)' }}
            />

            {series.map((s, idx) => {
              const color = s.color || PALETTE[idx % PALETTE.length];
              const radius = stacked
                ? idx === series.length - 1
                  ? [4, 4, 0, 0]
                  : [0, 0, 0, 0]
                : [4, 4, 0, 0];

              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.name || s.key}
                  fill={color}
                  stackId={stacked ? 'stack' : undefined}
                  radius={radius}
                  barSize={stacked ? 20 : 14}
                  isAnimationActive={!prefersReduced}
                  animationDuration={animationDuration}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
};

export default GroupedBarChart;
