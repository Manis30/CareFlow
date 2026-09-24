import React from 'react';
import { ShieldAlert, PhoneCall } from 'lucide-react';

export const AIEmergency = ({ escalationMessage, className = '' }) => {
  return (
    <div
      role="alert"
      className={`bg-[#C62828] text-white p-5 rounded-xl shadow-lg border border-red-900 space-y-3.5 my-2.5 ${className}`}
    >
      <div className="flex items-center gap-2.5 border-b border-white/20 pb-2.5">
        <ShieldAlert className="w-5 h-5 shrink-0 text-white" />
        <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
          Emergency Clinical Escalation
        </h4>
      </div>

      <p className="text-xs sm:text-sm leading-relaxed font-semibold text-white/95 whitespace-pre-line">
        {escalationMessage || "Urgent medical warning: Symptoms indicate potential acute medical emergency. Please contact emergency services or proceed immediately to the nearest hospital."}
      </p>

      <div className="bg-black/20 p-3 rounded-lg border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-white shrink-0" />
          <span>Emergency Helplines: <strong>108 / 112 / 911</strong></span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-white text-[#C62828] text-[10px] font-extrabold uppercase self-start sm:self-auto">
          Immediate Medical Attention
        </span>
      </div>
    </div>
  );
};

export default AIEmergency;
