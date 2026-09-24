import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'accent' | 'secondary' | 'outline' | 'success' | 'danger' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  icon: Icon,
  type = 'button',
  className = '',
  onClick,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none active:scale-[0.99] touch-manipulation';

  const variants = {
    primary:
      'bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-600 font-semibold',
    accent:
      'bg-sky-600 hover:bg-sky-700 text-white shadow-xs border border-sky-600 font-semibold',
    secondary:
      'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 font-semibold',
    outline:
      'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium shadow-2xs',
    success:
      'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600 font-semibold',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-600 font-semibold',
    ghost:
      'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8 sm:h-8 min-h-[32px]',
    md: 'text-xs px-4 py-2 gap-2 h-9 sm:h-9 min-h-[36px]',
    lg: 'text-sm px-5 py-2.5 gap-2.5 h-11 min-h-[44px]'
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">{children}</span>
    </button>
  );
};

export default Button;
