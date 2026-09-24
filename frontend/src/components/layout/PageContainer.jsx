import React from 'react';

/**
 * PageContainer — Standardized Layout Container for CareFlow Authenticated Pages.
 * 
 * Provides unified responsive horizontal gutters (16px mobile, 24px tablet, 32px desktop),
 * top spacing below navbar (24-28px), bottom padding, and overflow protection.
 * 
 * Variants:
 * - 'wide': max-w-7xl (Dashboards, KPI grids)
 * - 'full': w-full max-w-full (Data tables, directories, ledgers)
 * - 'default': max-w-6xl (Standard forms, detail views)
 * - 'compact': max-w-4xl (Profiles, settings, single-column views)
 */
export const PageContainer = ({
  children,
  variant = 'wide',
  className = ''
}) => {
  const variantClasses = {
    wide: 'max-w-7xl mx-auto',
    full: 'w-full max-w-full',
    default: 'max-w-6xl mx-auto',
    compact: 'max-w-4xl mx-auto'
  };

  return (
    <div
      className={`w-full min-w-0 overflow-x-hidden px-4 sm:px-6 md:px-8 pt-6 sm:pt-7 pb-10 sm:pb-12 space-y-6 ${
        variantClasses[variant] || variantClasses.wide
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default PageContainer;
