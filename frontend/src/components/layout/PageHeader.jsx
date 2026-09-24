import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Button from '../common/Button';

export const PageHeader = ({
  title,
  subtitle,
  badge = null,
  actions = null,
  backButton = null,
  showTitle = false,
  className = ''
}) => {
  if (!subtitle && !actions && !badge && !backButton && (!showTitle || !title)) {
    return null;
  }

  const renderBack = () => {
    if (!backButton) return null;
    if (React.isValidElement(backButton)) return backButton;
    if (typeof backButton === 'object' && backButton.onClick) {
      return (
        <Button
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          onClick={backButton.onClick}
        >
          {backButton.label || 'Back'}
        </Button>
      );
    }
    return null;
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80 ${className}`}>
      <div className="space-y-0.5 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          {renderBack()}
          {showTitle && title && (
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {title}
            </h2>
          )}
          {badge && <div>{badge}</div>}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed font-medium">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
