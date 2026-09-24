import * as am5 from '@amcharts/amcharts5';

export const CLINICAL_TOKENS = {
  canvas: '#F7F9FC',
  cardSurface: '#FFFFFF',
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  primaryText: '#0F172A',
  secondaryText: '#64748B',
  mutedText: '#94A3B8',
  border: '#E2E8F0'
};

export const CLINICAL_COLORS = {
  primary: CLINICAL_TOKENS.primary,
  brand: CLINICAL_TOKENS.primary,
  hover: CLINICAL_TOKENS.primaryHover,
  success: CLINICAL_TOKENS.success,
  emerald: CLINICAL_TOKENS.success,
  green: CLINICAL_TOKENS.success,
  warning: CLINICAL_TOKENS.warning,
  amber: CLINICAL_TOKENS.warning,
  danger: CLINICAL_TOKENS.danger,
  rose: CLINICAL_TOKENS.danger,
  red: CLINICAL_TOKENS.danger,
  navy: CLINICAL_TOKENS.primaryText,
  slate: CLINICAL_TOKENS.secondaryText,
  lightSlate: CLINICAL_TOKENS.mutedText,
  border: CLINICAL_TOKENS.border,
  canvas: CLINICAL_TOKENS.canvas,
  surface: CLINICAL_TOKENS.cardSurface,
  teal: CLINICAL_TOKENS.primaryHover,
  indigo: CLINICAL_TOKENS.primary,
  cyan: CLINICAL_TOKENS.primary,
  blue: CLINICAL_TOKENS.primary,
  primaryDark: CLINICAL_TOKENS.primaryHover
};

export const CHART_COLORS = CLINICAL_COLORS;

export const CLINICAL_PALETTE = [
  am5.color(0x2563EB), // Primary Brand Blue
  am5.color(0x10B981), // Success Green
  am5.color(0xF59E0B), // Warning Amber
  am5.color(0xEF4444), // Danger Red
  am5.color(0x64748B), // Secondary Slate
  am5.color(0x0F172A)  // Deep Text Navy
];

export const isReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const createTooltip = (root) => {
  const tooltip = am5.Tooltip.new(root, {
    getFillFromSprite: false,
    autoTextColor: false
  });

  tooltip.get('background').setAll({
    fill: am5.color(0x0F172A),
    fillOpacity: 0.95,
    stroke: am5.color(0x334155),
    strokeWidth: 1,
    cornerRadius: 8,
    shadowColor: am5.color(0x000000),
    shadowBlur: 10,
    shadowOpacity: 0.15,
    shadowOffsetX: 0,
    shadowOffsetY: 4
  });

  tooltip.label.setAll({
    fill: am5.color(0xFFFFFF),
    fontSize: 12,
    fontFamily: 'Poppins, system-ui, sans-serif',
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 10
  });

  return tooltip;
};
