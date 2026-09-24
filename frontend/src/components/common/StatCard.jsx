import React from 'react';
import ClinicalMetricCard from './ClinicalMetricCard';

/**
 * StatCard
 * 
 * Legacy wrapper forwarding to the unified ClinicalMetricCard
 */
export const StatCard = ({
  label,
  title,
  value,
  subtext,
  subtitle,
  icon,
  trend,
  change,
  onClick,
  className = ''
}) => {
  return (
    <ClinicalMetricCard
      title={label || title}
      value={value}
      subtext={subtext || subtitle}
      icon={icon}
      trend={trend}
      change={change}
      onClick={onClick}
      className={className}
    />
  );
};

export default StatCard;
