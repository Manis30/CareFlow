import React from 'react';
import ClinicalMetricCard from './ClinicalMetricCard';

/**
 * StatTile
 * 
 * Re-exports the unified CareFlow KPI component for backward compatibility across
 * Organization Admin, Doctor, and Patient dashboards.
 */
export const StatTile = ({
  title,
  label,
  value,
  subtitle,
  subtext,
  trend,
  change,
  icon,
  color = 'blue',
  iconBg,
  sparklineData,
  sparklineColor,
  isLive,
  liveLabel,
  badge,
  badgeColor,
  onClick,
  className = '',
  index = 0
}) => {
  return (
    <ClinicalMetricCard
      title={label || title}
      value={value}
      subtext={subtext || subtitle}
      trend={trend}
      change={change}
      icon={icon}
      color={color}
      iconBg={iconBg}
      sparklineData={sparklineData}
      sparklineColor={sparklineColor}
      isLive={isLive}
      liveLabel={liveLabel}
      badge={badge}
      onClick={onClick}
      className={className}
      delay={index}
    />
  );
};

export default StatTile;
