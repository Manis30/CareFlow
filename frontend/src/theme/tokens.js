/**
 * CareFlow Central Design Token System
 * DomoApp-First + Medix Healthcare Foundation
 */

export const TOKENS = {
  colors: {
    // Primary Brand Identity (DomoApp Blue)
    primaryBlue: '#2563EB',
    primaryBlueHover: '#1D4ED8',
    primaryBlueLight: '#EFF6FF',
    clinicalBlue: '#0284C7',
    skyAccent: '#38BDF8',
    deepBlue: '#173B57',

    // Surface & Background Colors (Main content is strictly pure white)
    white: '#FFFFFF',
    canvas: '#FFFFFF',
    surfaceSlate: '#F8FAFC',
    stripSlate: '#F1F5F9',

    // Text Hierarchy (DomoApp Slate)
    textPrimary: '#0F172A',   // slate-900
    textSecondary: '#334155', // slate-700
    textMuted: '#64748B',     // slate-500
    textDisabled: '#94A3B8',  // slate-400

    // Structural Borders & Dividers
    border: '#E2E8F0',        // slate-200
    borderSubtle: '#F1F5F9',  // slate-100

    // Semantic Functional Colors (Green strictly semantic)
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    emergency: '#DC2626',     // Reserved exclusively for medical emergency escalation
    aiAccent: '#6366F1',
    aiBg: '#EEF2FF'
  },

  typography: {
    fontSans: "'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },

  radii: {
    xs: '6px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    full: '9999px'
  },

  shadows: {
    '2xs': '0 1px 2px 0 rgba(15, 23, 42, 0.03)',
    xs: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
    sm: '0 2px 4px 0 rgba(15, 23, 42, 0.05)',
    md: '0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
    lg: '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)'
  }
};

export default TOKENS;
