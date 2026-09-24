import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

export const PRESET_RANGES = [
  { key: '7D', label: 'Last 7 Days', days: 7 },
  { key: '30D', label: 'Last 30 Days', days: 30 },
  { key: '90D', label: 'Last 90 Days', days: 90 },
  { key: '6M', label: 'Last 6 Months', days: 180 },
  { key: '12M', label: 'Last 12 Months', days: 365 },
  { key: 'ALL', label: 'All Time', days: null }
];

export const calculateDateRange = (key) => {
  const now = new Date();
  if (key === 'ALL') {
    return { startDate: null, endDate: null, key, label: 'All Time' };
  }
  const preset = PRESET_RANGES.find((p) => p.key === key) || PRESET_RANGES[1];
  const startDate = new Date(now.getTime() - preset.days * 24 * 60 * 60 * 1000);
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
    key: preset.key,
    label: preset.label
  };
};

export const DateRangePicker = ({
  value = '30D',
  onChange = () => {},
  className = '',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState(typeof value === 'string' ? value : value?.key || '30D');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLabel = isCustomMode
    ? `${customStart || 'Start'} – ${customEnd || 'End'}`
    : PRESET_RANGES.find((p) => p.key === selectedKey)?.label || 'Last 30 Days';

  const handleSelectPreset = (preset) => {
    setSelectedKey(preset.key);
    setIsCustomMode(false);
    setIsOpen(false);
    const range = calculateDateRange(preset.key);
    onChange(range);
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!customStart) return;
    setIsCustomMode(true);
    setSelectedKey('CUSTOM');
    setIsOpen(false);
    onChange({
      startDate: customStart,
      endDate: customEnd || new Date().toISOString().split('T')[0],
      key: 'CUSTOM',
      label: `${customStart} to ${customEnd || 'Present'}`
    });
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="truncate max-w-[140px]">{currentLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white border border-slate-200 shadow-lg z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Analytics Timeframe
            </span>
          </div>

          {/* Presets List */}
          <div className="space-y-0.5">
            {PRESET_RANGES.map((preset) => {
              const isSelected = !isCustomMode && selectedKey === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{preset.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              );
            })}
          </div>

          {/* Custom Date Form */}
          <div className="border-t border-slate-100 pt-2 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Custom Period
            </span>
            <form onSubmit={handleApplyCustom} className="space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div>
                  <label className="text-slate-400 block text-[9px] uppercase font-bold">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-2 py-1 rounded-md border border-slate-200 text-[11px] bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[9px] uppercase font-bold">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-2 py-1 rounded-md border border-slate-200 text-[11px] bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!customStart}
                className="w-full mt-1.5 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Apply Range
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
