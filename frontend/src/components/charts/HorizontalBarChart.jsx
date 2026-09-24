import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import { ChartContainer, CareFlowTooltip, CHART_COLORS, PALETTE } from './CareFlowChart';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const HorizontalBarChart = ({
  data = [],
  nameKey = 'name',
  dataKey = 'value',
  color = CHART_COLORS.blue,
  height = 240,
  title,
  subtitle,
  badge,
  headerAction,
  valueFormatter = (val) => val,
  emptyMessage = 'No ranking data available.',
  onBarClick = null,
  className = '',
  index = 0
}) => {
  const prefersReduced = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = useState(null);

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

  // Calculate dynamic height if many items
  const dynamicHeight = Math.max(height, data.length * 36 + 40);
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
      <div style={{ width: '100%', height: dynamicHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 8, right: 24, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />

            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'var(--font-sans)' }}
            />

            <YAxis
              type="category"
              dataKey={nameKey}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#334155', fontWeight: 600, fontFamily: 'var(--font-sans)' }}
              width={110}
              tickFormatter={(val) => {
                if (typeof val === 'string' && val.length > 14) {
                  return `${val.substring(0, 13)}…`;
                }
                return val;
              }}
            />

            <Tooltip
              content={<CareFlowTooltip valueFormatter={valueFormatter} />}
              cursor={{ fill: '#F8FAFC' }}
            />

            <Bar
              dataKey={dataKey}
              name={title || 'Volume'}
              radius={[0, 6, 6, 0]}
              barSize={16}
              isAnimationActive={!prefersReduced}
              animationDuration={animationDuration}
              onClick={onBarClick ? (entry) => onBarClick(entry) : undefined}
              cursor={onBarClick ? 'pointer' : 'default'}
            >
              {data.map((_, idx) => {
                const isHovered = hoveredIdx === idx;
                const barColor = color || PALETTE[idx % PALETTE.length];
                return (
                  <Cell
                    key={`cell-${idx}`}
                    fill={barColor}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{
                      transition: 'opacity 0.15s',
                      opacity: hoveredIdx === null || isHovered ? 1 : 0.65
                    }}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
};

export default HorizontalBarChart;
