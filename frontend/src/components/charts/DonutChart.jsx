import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';
import { ChartContainer, CareFlowTooltip, PALETTE } from './CareFlowChart';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const DonutChart = ({
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  height = 240,
  innerRadius = 55,
  outerRadius = 78,
  centerLabel = null,
  centerSubtext = 'Total',
  title,
  subtitle,
  badge,
  headerAction,
  valueFormatter = (val) => val,
  emptyMessage = 'No distribution data recorded.',
  onSectorClick = null,
  className = '',
  index = 0
}) => {
  const prefersReduced = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(null);

  const validData = (data || []).filter((d) => (Number(d[dataKey]) || 0) > 0);
  const totalValue = validData.reduce((acc, curr) => acc + (Number(curr[dataKey]) || 0), 0);
  const displayedCenterLabel = centerLabel !== null ? centerLabel : totalValue;

  if (!validData || validData.length === 0) {
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

  const animationDuration = prefersReduced ? 0 : 500;

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      badge={badge}
      headerAction={headerAction}
      className={className}
      index={index}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4" style={{ minHeight: height }}>
        {/* Donut Chart with Center Metric */}
        <div className="relative flex items-center justify-center shrink-0" style={{ width: '180px', height: '180px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CareFlowTooltip valueFormatter={valueFormatter} />} />
              <Pie
                data={validData}
                dataKey={dataKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={2.5}
                isAnimationActive={!prefersReduced}
                animationDuration={animationDuration}
                onClick={onSectorClick ? (entry) => onSectorClick(entry) : undefined}
                onMouseEnter={(_, idx) => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                cursor={onSectorClick ? 'pointer' : 'default'}
              >
                {validData.map((entry, idx) => {
                  const color = entry.color || PALETTE[idx % PALETTE.length];
                  const isHovered = activeIndex === idx;
                  return (
                    <Cell
                      key={`cell-${idx}`}
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      style={{
                        outline: 'none',
                        transition: 'opacity 0.2s, transform 0.2s',
                        opacity: activeIndex === null || isHovered ? 1 : 0.55
                      }}
                    />
                  );
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Statistic */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {displayedCenterLabel}
            </span>
            {centerSubtext && (
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">
                {centerSubtext}
              </span>
            )}
          </div>
        </div>

        {/* Legend List with Value Breakdown */}
        <div className="flex-1 w-full space-y-1.5 min-w-0 pr-1">
          {validData.map((entry, idx) => {
            const color = entry.color || PALETTE[idx % PALETTE.length];
            const val = Number(entry[dataKey]) || 0;
            const percentage = totalValue > 0 ? Math.round((val / totalValue) * 100) : 0;
            const isHovered = activeIndex === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={onSectorClick ? () => onSectorClick(entry) : undefined}
                className={`flex items-center justify-between gap-2 p-1.5 rounded-lg transition-colors text-xs ${
                  isHovered ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                } ${onSectorClick ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-slate-700 font-medium truncate text-xs">
                    {entry[nameKey]}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-sans">
                  <span className="text-slate-900 font-bold text-xs">
                    {valueFormatter(val)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium w-8 text-right">
                    {percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartContainer>
  );
};

export default DonutChart;
