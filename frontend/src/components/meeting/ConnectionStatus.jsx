import React from 'react';
import { Radio, AlertCircle, Clock } from 'lucide-react';

export const ConnectionStatus = ({ connectionState, formattedTime }) => {
  const getBadgeColor = () => {
    switch (connectionState) {
      case 'CONNECTED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'CONNECTING':
      case 'NEGOTIATING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'WAITING_FOR_OTHER_PARTICIPANT':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md ${getBadgeColor()}`}>
        <Radio className={`w-3.5 h-3.5 ${connectionState === 'CONNECTED' ? 'animate-pulse text-emerald-400' : ''}`} />
        <span>{connectionState.replace(/_/g, ' ')}</span>
      </div>
      {formattedTime && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300">
          <Clock className="w-3.5 h-3.5 text-teal-400" />
          <span>{formattedTime}</span>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
