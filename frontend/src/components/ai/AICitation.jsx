import React from 'react';
import { FileHeart } from 'lucide-react';

export const AICitation = ({ citations = [] }) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
        Clinical Evidence:
      </span>
      {citations.map((cite, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200/80"
        >
          <FileHeart className="w-3 h-3 text-blue-600 shrink-0" />
          <span>Record · {cite}</span>
        </span>
      ))}
    </div>
  );
};

export default AICitation;
