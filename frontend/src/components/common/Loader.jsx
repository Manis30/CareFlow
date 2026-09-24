import React from 'react';

const Loader = ({
  size = 'md',
  color = 'teal',
  text = 'Loading...',
  inline = false,
  minHeight = 'min-h-[350px]',
  className = ''
}) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  const colors = {
    teal: 'border-teal-600 border-t-transparent',
    white: 'border-white border-t-transparent',
    slate: 'border-slate-600 border-t-transparent'
  };

  const spinner = (
    <div
      className={`animate-spin rounded-full ${sizes[size] || sizes.md} ${colors[color] || colors.teal} ${className}`}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );

  if (inline) {
    return spinner;
  }

  return (
    <div className={`w-full ${minHeight} flex flex-col items-center justify-center text-center py-12 px-4 space-y-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs`}>
      {spinner}
      {text && (
        <p className="text-xs font-semibold text-slate-500 tracking-wide animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

export default Loader;
