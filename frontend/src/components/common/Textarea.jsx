import React from 'react';

const Textarea = ({
  label,
  error,
  id,
  name,
  value,
  onChange,
  placeholder,
  rows = 4,
  required = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const textareaId = id || name;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors ${
          error
            ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
            : 'border-slate-300 focus:border-teal-500 focus:ring-teal-100'
        } ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-600 mt-0.5">{error}</p>}
    </div>
  );
};

export default Textarea;
