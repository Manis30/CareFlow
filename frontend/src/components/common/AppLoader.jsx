import React from 'react';
import { Activity } from 'lucide-react';

const AppLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
      <div className="flex flex-col items-center gap-5 p-8 text-center">
        {/* Static Brand Icon */}
        <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-xl shadow-teal-500/20">
          <Activity className="w-9 h-9" />
        </div>

        {/* Brand Text */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">CareFlow</h1>
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            Restoring secure workspace session...
          </p>
        </div>

        {/* Loader Spinner */}
        <div className="pt-2">
          <div
            className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"
            role="status"
          >
            <span className="sr-only">Initializing CareFlow...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLoader;
