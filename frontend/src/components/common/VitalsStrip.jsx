import React from 'react';
import { Activity } from 'lucide-react';
import CareFlowLivePulse from './CareFlowLivePulse';

/**
 * VitalsStrip
 * 
 * Signature clinical vitals monitor container that wraps the top KPI row.
 * Runs a continuous subtle horizontal ECG baseline behind/under the cards,
 * unifying them into a single patient vitals monitor strip rather than
 * detached individual cards.
 */
export function VitalsStrip({
  children,
  title = 'Platform Clinical Vitals',
  subtitle = 'Continuous telemetry across network healthcare operations',
  isLive = true,
  className = ''
}) {
  return (
    <div className={`relative rounded-2xl bg-white border border-slate-200/80 p-2 sm:p-2.5 shadow-xs overflow-hidden ${className}`}>
      {/* Background Continuous ECG Monitor Baseline Waveform (~8% Opacity) */}
      <div className="absolute inset-x-0 bottom-2 sm:bottom-3 h-8 pointer-events-none opacity-8 select-none z-0">
        <svg
          className="w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 1200 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 0,24 L 80,24 Q 90,20 100,24 L 140,24 L 148,16 L 156,40 L 164,8 L 172,28 L 180,24 L 230,24 Q 242,21 254,24 L 320,24 
               L 380,24 Q 390,20 400,24 L 440,24 L 448,14 L 456,42 L 464,6 L 472,30 L 480,24 L 530,24 Q 542,21 554,24 L 620,24 
               L 680,24 Q 690,20 700,24 L 740,24 L 748,16 L 756,40 L 764,8 L 772,28 L 780,24 L 830,24 Q 842,21 854,24 L 920,24 
               L 980,24 Q 990,20 1000,24 L 1040,24 L 1048,15 L 1056,41 L 1064,7 L 1072,29 L 1080,24 L 1130,24 L 1200,24"
            stroke="#2563EB"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Vitals Strip Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 mb-1.5 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-4.5 h-4.5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
            <Activity className="w-2.5 h-2.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-900 font-sans">
                {title}
              </span>
              {isLive && (
                <CareFlowLivePulse color="#10B981" label="Live Stream" />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 font-sans">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Nominal Clinical Telemetry</span>
        </div>
      </div>

      {/* Grid of KPI Children positioned on top of the shared vitals trace */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        {children}
      </div>
    </div>
  );
}

export default VitalsStrip;
