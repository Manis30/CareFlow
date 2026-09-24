import React, { useState } from 'react';
import { Droplet, ChevronDown } from 'lucide-react';

export const PatientBloodGroupMix = ({
  data = [],
  selectedGroup = 'ALL',
  onGroupClick = null,
  loading = false,
  className = ''
}) => {
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Compute maximum percentage for relative progress bar fill
  const maxPercent = Math.max(...data.map((d) => d.percentage || 1), 25);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between font-sans relative ${className}`}>
      {/* 1. Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100/70 shadow-xs">
              <Droplet className="w-4 h-4 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Patient Mix by Blood Group
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Distribution of patients across blood groups
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Horizontal Ranked Bars */}
      <div
        className="relative w-full flex-1 min-h-[300px] flex flex-col justify-center py-2 space-y-2.5 select-none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            containerWidth: rect.width,
            containerHeight: rect.height
          });
        }}
        onMouseLeave={() => setHoveredGroup(null)}
      >
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-xs rounded-xl">
            <div className="h-6 w-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data.map((item) => {
          const isSelected = selectedGroup === item.group;
          const isHovered = hoveredGroup?.group === item.group;
          const isDimmed = (selectedGroup !== 'ALL' && !isSelected) || (hoveredGroup && !isHovered && selectedGroup === 'ALL');

          // Width proportional to maximum percentage so the top bar extends ~85-90%
          const barWidth = Math.max(8, Math.round((item.percentage / maxPercent) * 88));

          return (
            <div
              key={item.group}
              onClick={() => {
                if (onGroupClick) {
                  onGroupClick(isSelected ? 'ALL' : item.group);
                }
              }}
              onMouseEnter={() => setHoveredGroup(item)}
              className={`group flex items-center gap-3 py-1 px-2 rounded-xl cursor-pointer transition-all duration-150 ${
                isSelected
                  ? 'bg-blue-50/90 ring-1.5 ring-blue-500/50 shadow-xs'
                  : isHovered
                  ? 'bg-slate-50'
                  : ''
              } ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
            >
              {/* Category Label */}
              <div className="w-7 text-xs font-bold text-slate-700 shrink-0">
                {item.group}
              </div>

              {/* Horizontal Bar Track */}
              <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>

              {/* Count & Percentage Value */}
              <div className="w-24 text-right text-xs font-bold text-slate-800 shrink-0">
                <span>{item.count.toLocaleString()}</span>{' '}
                <span className="text-slate-400 font-medium">({item.percentage.toFixed(1)}%)</span>
              </div>
            </div>
          );
        })}

        {/* 3. Floating Tooltip matching reference design */}
        {hoveredGroup && (
          <div
            className="absolute z-40 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              left: Math.max(
                10,
                Math.min(
                  (mousePos.containerWidth || 400) - 170,
                  mousePos.x - 70
                )
              ),
              top: Math.max(10, mousePos.y - 85)
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl p-2.5 border border-slate-700/60 min-w-[150px] font-sans">
              <div className="flex items-center gap-1.5 pb-1 mb-1 border-b border-slate-800">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: hoveredGroup.color }}
                />
                <span className="text-xs font-bold text-white">{hoveredGroup.group}</span>
              </div>
              <div className="space-y-0.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Patients</span>
                  <span className="font-bold text-white">{hoveredGroup.count.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Percentage</span>
                  <span className="font-bold text-white">{hoveredGroup.percentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Filter note footer */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Click any blood group to filter the patient roster</span>
        {selectedGroup !== 'ALL' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onGroupClick) onGroupClick('ALL');
            }}
            className="text-blue-600 font-semibold hover:underline cursor-pointer"
          >
            Clear Filter
          </button>
        )}
      </div>
    </div>
  );
};

export default PatientBloodGroupMix;
