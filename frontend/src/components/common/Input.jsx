import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = ({
  label,
  type = 'text',
  error,
  icon: Icon,
  required = false,
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === 'password';
  const inputType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-xs font-semibold text-slate-800">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          type={inputType}
          className={`w-full text-xs sm:text-sm font-medium text-slate-900 bg-white rounded-xl border border-slate-200/80 py-2.5 ${
            Icon ? 'pl-10' : 'pl-3.5'
          } ${
            isPasswordType ? 'pr-10' : 'pr-3.5'
          } placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all ${
            error ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : 'hover:border-slate-300'
          } ${className}`}
          {...props}
        />
        {isPasswordType && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
    </div>
  );
};

export default Input;
