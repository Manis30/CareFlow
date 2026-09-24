import React from 'react';
import { ChevronDown } from 'lucide-react';

export const Select = ({
  label,
  options = [],
  groups = [],
  children,
  error,
  id,
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  placeholder = 'Select an option',
  ...props
}) => {
  const selectId = id || name;

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-800">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <select
          id={selectId}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`w-full text-xs sm:text-sm font-medium text-slate-900 bg-white rounded-xl border border-slate-200/80 py-2.5 pl-3.5 pr-9 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all ${
            error
              ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
              : 'hover:border-slate-300'
          } ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'cursor-pointer'}`}
          {...props}
        >
          {children ? (
            children
          ) : (
            <>
              <option value="" disabled>
                {placeholder}
              </option>
              {groups && groups.length > 0 ? (
                groups.map((grp) => (
                  <optgroup key={grp.label} label={grp.label} className="font-bold text-slate-800">
                    {grp.options.map((opt) => {
                      const val = typeof opt === 'object' ? opt.value : opt;
                      const lbl = typeof opt === 'object' ? opt.label : opt;
                      return (
                        <option key={val} value={val} className="font-normal text-slate-900">
                          {lbl}
                        </option>
                      );
                    })}
                  </optgroup>
                ))
              ) : (
                options.map((opt) => {
                  const val = typeof opt === 'object' ? opt.value : opt;
                  const lbl = typeof opt === 'object' ? opt.label : opt;
                  return (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  );
                })
              )}
            </>
          )}
        </select>
        <div className="absolute right-3.5 text-slate-400 pointer-events-none">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
    </div>
  );
};

export default Select;
