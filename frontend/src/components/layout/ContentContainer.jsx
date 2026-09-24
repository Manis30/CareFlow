import React, { useState, useEffect } from 'react';
import PageContainer from './PageContainer';

export const ContentContainer = ({
  children,
  maxWidth = '7xl', // '4xl' | '5xl' | '6xl' | '7xl' | 'full'
  variant = null,
  className = ''
}) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('careflow_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleToggle = (e) => {
      if (e?.detail?.isCollapsed !== undefined) {
        setIsCollapsed(e.detail.isCollapsed);
      } else {
        setIsCollapsed(localStorage.getItem('careflow_sidebar_collapsed') === 'true');
      }
    };

    window.addEventListener('careflow:sidebar-toggle', handleToggle);
    return () => window.removeEventListener('careflow:sidebar-toggle', handleToggle);
  }, []);

  const maxWidthClasses = {
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': isCollapsed ? 'max-w-[1640px]' : 'max-w-7xl 2xl:max-w-[1520px]',
    'full': 'w-full'
  };

  const activeWidth = variant
    ? (variant === 'wide' ? '7xl' : variant === 'compact' ? '4xl' : variant === 'default' ? '6xl' : 'full')
    : maxWidth;

  // Gutter: 20-24px (px-5 sm:px-6) when collapsed; 28-32px (px-7 sm:px-8) when expanded
  const gutterClasses = isCollapsed
    ? 'px-4 sm:px-5 md:px-6'
    : 'px-5 sm:px-7 md:px-8';

  return (
    <div
      className={`mx-auto w-full min-w-0 overflow-x-hidden ${gutterClasses} pt-5 sm:pt-6 pb-6 sm:pb-8 space-y-5 sm:space-y-6 transition-all duration-200 ${
        maxWidthClasses[activeWidth] || 'max-w-7xl'
      } ${className}`}
    >
      {children}
    </div>
  );
};

export { PageContainer };
export default ContentContainer;
