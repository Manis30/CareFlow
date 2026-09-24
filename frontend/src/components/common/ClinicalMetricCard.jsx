import React from 'react';
import { motion } from 'framer-motion';

/**
 * Compact Smooth SVG Sparkline (Catmull-Rom cubic bezier smoothing)
 */
export const MiniSparkline = ({ data = [], color = '#0066FF', width = 68, height = 24 }) => {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="overflow-visible shrink-0 opacity-30">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => ({
    x: (idx / (data.length - 1)) * width,
    y: height - ((val - min) / range) * (height - 8) - 4
  }));

  let pathD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    pathD += ` L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  } else {
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      pathD += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
  }

  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;
  const cleanColor = String(color).replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `spark-grad-${cleanColor}`;

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const COLOR_MAP = {
  blue: { bg: 'bg-blue-50 text-blue-600', spark: '#0066FF' },
  emerald: { bg: 'bg-emerald-50 text-emerald-600', spark: '#10B981' },
  green: { bg: 'bg-emerald-50 text-emerald-600', spark: '#10B981' },
  purple: { bg: 'bg-purple-50 text-purple-600', spark: '#A855F7' },
  indigo: { bg: 'bg-indigo-50 text-indigo-600', spark: '#6366F1' },
  amber: { bg: 'bg-amber-50 text-amber-600', spark: '#F59E0B' },
  teal: { bg: 'bg-teal-50 text-teal-600', spark: '#0D9488' },
  rose: { bg: 'bg-rose-50 text-rose-600', spark: '#EF4444' },
  red: { bg: 'bg-rose-50 text-rose-600', spark: '#EF4444' },
  slate: { bg: 'bg-slate-50 text-slate-600', spark: '#64748B' }
};

/**
 * ClinicalMetricCard
 * 
 * Unified CareFlow KPI card:
 *  - Compact 88-105px desktop height
 *  - Row 1: Small Lucide icon in soft tinted container + uppercase/semibold title + optional badge
 *  - Row 2: Large primary value (bold font-sans) + MiniSparkline
 *  - Row 3: Trend indicator (↑ / ↓ x%) + descriptive subtext
 */
export const ClinicalMetricCard = ({
  title,
  label,
  value,
  prefix = '',
  suffix = '',
  unit = '',
  icon: Icon,
  color = 'blue',
  iconBg,
  trend = null,
  change,
  subtitle,
  subtext,
  secondaryValue,
  badge = null,
  sparklineData = null,
  sparklineColor = null,
  isLive = false,
  liveLabel = null,
  isActive = false,
  onClick = null,
  delay = 0,
  className = ''
}) => {
  const displayTitle = label || title || '';
  const displaySubtext = subtext || subtitle || secondaryValue || 'vs previous 6 months';

  // Resolved Icon container & Sparkline color
  const palette = COLOR_MAP[color] || COLOR_MAP.blue;
  let resolvedIconBg = iconBg || palette.bg;
  let resolvedSparkColor = sparklineColor || palette.spark;

  // Infer spark color from iconBg if custom class provided
  if (!sparklineColor && iconBg) {
    if (iconBg.includes('emerald') || iconBg.includes('green')) resolvedSparkColor = '#10B981';
    else if (iconBg.includes('purple')) resolvedSparkColor = '#A855F7';
    else if (iconBg.includes('amber')) resolvedSparkColor = '#F59E0B';
    else if (iconBg.includes('rose') || iconBg.includes('red')) resolvedSparkColor = '#EF4444';
    else if (iconBg.includes('teal')) resolvedSparkColor = '#0D9488';
    else if (iconBg.includes('indigo')) resolvedSparkColor = '#6366F1';
    else if (iconBg.includes('blue')) resolvedSparkColor = '#0066FF';
  }

  // Determine trend / change
  let hasChange = false;
  let isPositive = true;
  let displayChangeText = '';

  if (change !== undefined && change !== null) {
    hasChange = true;
    isPositive = Number(change) >= 0;
    const absVal = Math.abs(Number(change));
    displayChangeText = `${absVal}%`;
  } else if (trend) {
    hasChange = true;
    isPositive = trend.positive !== false;
    displayChangeText = String(trend.value || '').trim();
  }

  // Format value display
  let formattedValue = value;
  if (typeof value === 'number') {
    formattedValue = value.toLocaleString();
  }

  // Resolve badge text and style
  let badgeText = null;
  let resolvedBadgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-200/70';

  if (badge) {
    if (typeof badge === 'string') {
      badgeText = badge;
      const bLower = badge.toLowerCase();
      if (bLower.includes('pending') || bLower.includes('free') || bLower.includes('warn') || bLower.includes('capacity')) {
        resolvedBadgeStyle = 'bg-amber-50 text-amber-700 border border-amber-200/70';
      } else if (bLower.includes('susp') || bLower.includes('fail') || bLower.includes('canc')) {
        resolvedBadgeStyle = 'bg-rose-50 text-rose-700 border border-rose-200/70';
      }
    } else if (typeof badge === 'object') {
      badgeText = badge.text;
      if (badge.color === 'amber') {
        resolvedBadgeStyle = 'bg-amber-50 text-amber-700 border border-amber-200/70';
      } else if (badge.color === 'rose' || badge.color === 'red') {
        resolvedBadgeStyle = 'bg-rose-50 text-rose-700 border border-rose-200/70';
      } else if (badge.color === 'blue' || badge.color === 'indigo') {
        resolvedBadgeStyle = 'bg-blue-50 text-blue-700 border border-blue-200/70';
      }
    }
  }

  const isInteractive = typeof onClick === 'function';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: (delay || 0) * 0.04 }}
      onClick={isInteractive ? onClick : undefined}
      className={`h-[105px] p-3.5 bg-white rounded-2xl border shadow-xs flex flex-col justify-between transition-all duration-200 font-sans ${
        isActive
          ? 'border-blue-500 shadow-sm ring-2 ring-blue-100 bg-blue-50/10'
          : 'border-slate-200/80 hover:shadow-sm'
      } ${isInteractive ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${className}`}
    >
      {/* Row 1: Icon + Title on left, optional Badge or Live Pulse on right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${resolvedIconBg}`}>
              <Icon className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
          )}
          <span className="text-xs font-semibold text-slate-500 tracking-tight truncate">
            {displayTitle}
          </span>
        </div>
        {badgeText && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none shrink-0 ${resolvedBadgeStyle}`}>
            {badgeText}
          </span>
        )}
      </div>

      {/* Row 2: Large Primary Value on left, MiniSparkline on right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none font-sans truncate">
            {prefix && <span>{prefix}</span>}
            {formattedValue}
            {suffix && <span className="text-xl font-bold">{suffix}</span>}
          </span>
          {unit && (
            <span className="text-xs font-medium text-slate-400 font-sans">
              {unit}
            </span>
          )}
        </div>

        {sparklineData && (
          <MiniSparkline
            data={sparklineData}
            color={resolvedSparkColor}
            width={68}
            height={24}
          />
        )}
      </div>

      {/* Row 3: Indicator & Subtext */}
      <div className="flex items-center text-[11px] leading-none truncate">
        {hasChange ? (
          <>
            <span
              className={`font-bold inline-flex items-center gap-0.5 shrink-0 ${
                isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {isPositive ? '↑' : '↓'} {displayChangeText}
            </span>
            <span className="text-slate-400 font-medium ml-1.5 truncate">
              {displaySubtext}
            </span>
          </>
        ) : (
          <span className="text-slate-400 font-medium truncate">
            {displaySubtext}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default ClinicalMetricCard;
