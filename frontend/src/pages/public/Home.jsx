import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  FileText,
  MessageSquare,
  Building2,
  Stethoscope,
  Users,
  ArrowRight,
  Sparkles,
  Server
} from 'lucide-react';
import Button from '../../components/common/Button';
import PulseIndicator from '../../components/clinical/PulseIndicator';
import ClinicalPulse from '../../components/clinical/ClinicalPulse';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-24 pb-20 font-sans text-slate-900">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-white pt-16 sm:pt-20 pb-20 border-b border-slate-100">
        {/* Subtle Ambient Blue Wash */}
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/4 w-[500px] h-[500px] bg-indigo-50/40 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-7">
            {/* Live System Telemetry Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-xs">
              <PulseIndicator status="online" pulseColor="#2563EB" />
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                Clinical Operating Platform
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-[11px] font-bold text-blue-600">4 Verified Roles</span>
            </div>

            {/* Display Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
              The Modern Operating System for <span className="text-blue-600">Clinical Healthcare</span>
            </h1>

            {/* Editorial Lead Paragraph */}
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto font-normal">
              Empowering healthcare facilities, certified practitioners, and patients with synchronized consultation scheduling, digital prescriptions, secure diagnostic vaults, and WebRTC telemetry.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto shadow-sm font-semibold text-sm px-7 py-3"
              >
                Register as Patient <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto text-sm px-7 py-3 font-semibold hover:border-blue-300 hover:text-blue-600"
              >
                Access Portal Login
              </Button>
            </div>

            {/* Live Waveform Indicator */}
            <div className="pt-6 flex items-center justify-center gap-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Platform Operations Status
              </span>
              <ClinicalPulse color="#2563EB" width={160} height={24} bpm={72} />
              <span className="text-[11px] font-bold text-blue-600">Active</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CORE CLINICAL CAPABILITIES */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Architecture & Infrastructure
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Integrated Healthcare Architecture
          </h2>
          <p className="text-sm text-slate-500">
            Engineered with strict tenant isolation, role-based authorization, and verified medical data privacy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Capability 1 */}
          <div className="p-7 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-4 hover:border-blue-400 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Consultation Governance
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Real-time slot allocation with conflict mitigation, in-person and secure online WebRTC consultations, plus integrated Razorpay and cash settlements.
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600">
              <span>Schedule timeline tracks</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Capability 2 */}
          <div className="p-7 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-4 hover:border-blue-400 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Encrypted Socket.IO Chat
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Direct WebSocket communication channels between certified practitioners, patients, and clinic administrators with clinical attachments.
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600">
              <span>Real-time delivery confirmation</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Capability 3 */}
          <div className="p-7 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-4 hover:border-blue-400 hover:shadow-md transition-all group">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Health Vault & Prescriptions
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cloudinary diagnostic scan repository with explicit doctor authorization controls, plus structured digital prescription authoring.
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600">
              <span>Standardized clinical slips</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW CAREFLOW WORKS (CHRONOLOGICAL CLINICAL TIMELINE) */}
      <section id="how-it-works" className="bg-slate-900 text-white py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Care Pathway
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              The End-to-End Clinical Flow
            </h2>
            <p className="text-sm text-slate-400">
              Synchronized medical operations designed for precision, velocity, and patient safety.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="space-y-3 text-center md:text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-base flex items-center justify-center mx-auto md:mx-0 shadow-sm">
                1
              </div>
              <h4 className="text-base font-bold text-white">Select Clinician & Slot</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Filter certified specialists by department, review consultation fees, and pick an active time slot.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3 text-center md:text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-base flex items-center justify-center mx-auto md:mx-0 shadow-sm">
                2
              </div>
              <h4 className="text-base font-bold text-white">Direct Clinical Session</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Attend in-clinic visits or join verified WebRTC consultation rooms with instant live chat and telemetry.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-3 text-center md:text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-base flex items-center justify-center mx-auto md:mx-0 shadow-sm">
                3
              </div>
              <h4 className="text-base font-bold text-white">Prescription Generation</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Receive structured digital prescriptions complete with medication dosage, duration, and doctor signature.
              </p>
            </div>

            {/* Step 4 */}
            <div className="space-y-3 text-center md:text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-base flex items-center justify-center mx-auto md:mx-0 shadow-sm">
                4
              </div>
              <h4 className="text-base font-bold text-white">Encrypted Diagnostic Vault</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Store diagnostic imaging and lab reports with granular permission revocation whenever needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FOUR DISTINCT PLATFORM PORTALS */}
      <section id="portals" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Permission Scopes
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Strict Role-Governed Access
          </h2>
          <p className="text-sm text-slate-500">
            Four dedicated operational portals configured for clinical governance and tenant privacy.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Super Admin */}
          <div className="p-6 bg-white rounded-xl border border-slate-200/80 space-y-3 shadow-xs hover:border-blue-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Super Admin</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Global platform command center, tenant provisioning, multi-tenant analytics, and settlement ledgers.
            </p>
          </div>

          {/* Clinic Admin */}
          <div className="p-6 bg-white rounded-xl border border-slate-200/80 space-y-3 shadow-xs hover:border-blue-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Clinic Admin</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Clinic operations center, clinician onboarding, department mapping, operating schedules, and revenue ledgers.
            </p>
          </div>

          {/* Doctor */}
          <div className="p-6 bg-white rounded-xl border border-slate-200/80 space-y-3 shadow-xs hover:border-blue-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Medical Doctor</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Consultation workspace, weekly availability schedules, digital prescription authoring, and authorized record inspection.
            </p>
          </div>

          {/* Patient */}
          <div className="p-6 bg-white rounded-xl border border-slate-200/80 space-y-3 shadow-xs hover:border-blue-300 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Patient Portal</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Doctor discovery, booking wizard, Razorpay checkout, live consultation chat, and personal medical records vault.
            </p>
          </div>
        </div>
      </section>

      {/* 5. CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 rounded-xl p-10 sm:p-16 text-center text-white space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-200" /> Private Healthcare Platform
            </span>

            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Ready to Advance Your Clinical Practice?
            </h2>

            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-normal">
              Log in to access your authorized clinical workspace or register as a patient to book your next consultation.
            </p>

            <div className="pt-3 flex flex-col sm:flex-row justify-center items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto font-semibold bg-white text-blue-600 hover:bg-blue-50 border-0 shadow-md"
              >
                Sign In to Account
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto text-white border-white/40 hover:bg-white/10"
              >
                Register Patient Profile
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
