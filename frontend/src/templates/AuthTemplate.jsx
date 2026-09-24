import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { HeartPulse, ShieldCheck, CheckCircle2, Stethoscope, Sparkles } from 'lucide-react';
import ClinicalPulse from '../components/clinical/ClinicalPulse';

export const AuthTemplate = () => {
  const location = useLocation();
  const isRegister = location.pathname === '/register';

  return (
    <div className="min-h-screen bg-slate-50/70 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans antialiased text-slate-800">
      <div
        className={`w-full ${
          isRegister ? 'max-w-5xl' : 'max-w-4xl'
        } bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[560px]`}
      >
        {/* Left Branding Column (Desktop) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-8 sm:p-10 text-white flex flex-col justify-between hidden lg:flex relative overflow-hidden">
          {/* Subtle Ambient Background Glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-blue-400/20 blur-2xl pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-xs">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                CareFlow
              </span>
            </Link>

            <div className="space-y-2.5 pt-6">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white text-[11px] font-semibold border border-white/20">
                <Sparkles className="w-3 h-3 text-blue-200" /> Clinical Intelligence
              </span>
              <h2 className="text-2xl font-bold tracking-tight leading-snug text-white">
                Private healthcare precision, connected.
              </h2>
              <p className="text-xs text-blue-100/90 leading-relaxed">
                Seamless consultations, clinical notes, active prescriptions, and encrypted health records with hospital-grade security.
              </p>
            </div>

            <div className="pt-2">
              <ClinicalPulse width={56} height={16} color="#FFFFFF" />
            </div>

            {/* Value Points */}
            <div className="space-y-3 pt-6 border-t border-white/15 text-xs text-blue-50">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0" />
                <span>Verified healthcare professionals & clinics</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0" />
                <span>Encrypted medical document vault</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0" />
                <span>Real-time clinical consultation workspace</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/15 flex items-center gap-2 text-xs text-blue-100 relative z-10">
            <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>Strict Tenant Isolation & Data Governance</span>
          </div>
        </div>

        {/* Right Form Container */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white">
          <div className={`w-full ${isRegister ? 'max-w-xl' : 'max-w-md'} mx-auto space-y-6`}>
            {/* Mobile Header Logo */}
            <div className="flex items-center gap-2.5 lg:hidden mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">CareFlow</span>
            </div>

            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthTemplate;
