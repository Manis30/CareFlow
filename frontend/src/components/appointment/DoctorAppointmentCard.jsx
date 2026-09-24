import React from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Video,
  MapPin
} from 'lucide-react';
import JoinConsultationButton from './JoinConsultationButton';
import PulseIndicator from '../clinical/PulseIndicator';
import Button from '../common/Button';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';

/**
 * Maps appointment status to subtle clinical status-aware accents
 */
const getStatusConfig = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') {
    return {
      dotColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-50/90 border-emerald-200/70',
      cardBg: 'bg-gradient-to-r from-emerald-50/25 via-white to-white',
      borderColor: 'border-slate-200/80 hover:border-emerald-300/80',
      accentBar: 'bg-emerald-500',
      avatarBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      label: 'Completed'
    };
  }
  if (s === 'cancelled') {
    return {
      dotColor: 'bg-rose-500',
      textColor: 'text-rose-700',
      badgeBg: 'bg-rose-50/90 border-rose-200/70',
      cardBg: 'bg-gradient-to-r from-rose-50/20 via-white to-white',
      borderColor: 'border-slate-200/80 hover:border-rose-300/80',
      accentBar: 'bg-rose-500',
      avatarBg: 'bg-rose-50 text-rose-700 border-rose-100',
      label: 'Cancelled'
    };
  }
  if (s === 'in_progress' || s === 'in-progress' || s === 'active') {
    return {
      dotColor: 'bg-teal-500 animate-pulse',
      textColor: 'text-teal-700',
      badgeBg: 'bg-teal-50/90 border-teal-200/70',
      cardBg: 'bg-gradient-to-r from-teal-50/30 via-white to-white',
      borderColor: 'border-teal-300/90 ring-1 ring-teal-200/60 shadow-xs',
      accentBar: 'bg-teal-500',
      avatarBg: 'bg-teal-50 text-teal-700 border-teal-200',
      label: 'In Progress'
    };
  }
  // Upcoming / Scheduled / Booked
  return {
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-700',
    badgeBg: 'bg-blue-50/90 border-blue-200/70',
    cardBg: 'bg-gradient-to-r from-blue-50/20 via-white to-white',
    borderColor: 'border-slate-200/80 hover:border-blue-300/80',
    accentBar: 'bg-blue-500',
    avatarBg: 'bg-blue-50 text-blue-700 border-blue-100',
    label: s === 'booked' ? 'Booked' : 'Upcoming'
  };
};

/**
 * Extracts 1-2 initials from a patient name
 */
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'PT';
  const clean = name.replace(/^(mr|mrs|ms|dr|master)\.?\s+/i, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || 'PT';
};

/**
 * DoctorAppointmentCard
 * 
 * Production CareFlow clinical appointment surface:
 *  - 10-14px radius (rounded-2xl)
 *  - Subtle status-aware wash & left indicator strip
 *  - Strong patient identity with polished 44px avatar
 *  - Clear date, time, consultation mode, and duration metadata
 *  - Compact dot-status badge
 *  - Premium secondary action button
 *  - 180-220ms smooth hover micro-interaction
 *  - Entrance animation via Framer Motion without replaying on hover
 */
export const DoctorAppointmentCard = ({
  appointment,
  index = 0,
  onOpenConsultation
}) => {
  if (!appointment) return null;

  const patient = appointment.patientId;
  const patientUser = patient?.userId;
  const patientName =
    patientUser?.name || patient?.name || appointment.patientName || 'Patient';

  const avatarUrl = patient?.avatar || patientUser?.avatar || patient?.photo;
  const isOnline = appointment.consultationType === 'online';
  const isLive = appointment.status === 'in_progress';
  const isDone = appointment.status === 'completed';
  const isCancelled = appointment.status === 'cancelled';

  const statusConfig = getStatusConfig(appointment.status);
  const initials = getInitials(patientName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.28), ease: [0.25, 0.1, 0.25, 1] }}
      className={`group relative rounded-2xl border ${statusConfig.borderColor} ${statusConfig.cardBg} p-4 sm:p-4.5 shadow-xs transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans overflow-hidden`}
    >
      {/* Subtle Status-Aware Left Indicator Strip (3px) */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${statusConfig.accentBar} opacity-60 group-hover:opacity-100 transition-opacity`}
      />

      {/* Main Clinical Section: Avatar + Patient Identity + Metadata */}
      <div className="flex items-start gap-3.5 min-w-0 flex-1 pl-1">
        {/* Patient Avatar (44px, subtle border, smooth hover scale) */}
        <div className="shrink-0 pt-0.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={patientName}
              className="w-11 h-11 rounded-xl object-cover border border-slate-200/80 shadow-2xs group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border shadow-2xs group-hover:scale-105 transition-all duration-200 ${statusConfig.avatarBg}`}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Content Column */}
        <div className="space-y-1.5 min-w-0 flex-1">
          {/* Row 1: Strong Patient Name & Live Pulse */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight font-sans truncate group-hover:text-blue-600 transition-colors">
              {patientName}
            </h3>
            {isLive && <PulseIndicator label="Live Session" />}
            {patient?.bloodGroup && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                {patient.bloodGroup}
              </span>
            )}
          </div>

          {/* Row 2: Compact Horizontal Metadata (Date, Time, Mode, Duration) */}
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap font-medium">
            <span className="text-slate-800 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              {formatDate(appointment.appointmentDate)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-700 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
              {isOnline ? (
                <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100/60">
                  <Video className="w-3 h-3 text-blue-600" />
                  Online Video
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  In-Clinic Visit
                </span>
              )}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium text-[11px]">
              {appointment.duration || 30} mins
            </span>
          </div>

          {/* Row 3: Reason / Clinical Context (Visually Secondary) */}
          {appointment.reason && (
            <div className="pt-0.5">
              <p className="text-xs text-slate-600 font-medium truncate max-w-xl inline-flex items-center gap-1.5 bg-slate-50/80 px-2.5 py-0.5 rounded-md border border-slate-100">
                <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">
                  Reason:
                </span>
                <span className="text-slate-700 italic truncate">
                  "{appointment.reason}"
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Status Indicator (Top) & Action Area (Bottom) */}
      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-between gap-3 shrink-0 self-stretch border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-100">
        {/* Compact Dot + Text Status Badge */}
        <div className="flex items-center justify-end">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs ${statusConfig.badgeBg} ${statusConfig.textColor}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
            {statusConfig.label}
          </span>
        </div>

        {/* Action Button(s) */}
        <div className="flex items-center gap-2">
          {isOnline && appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
            <JoinConsultationButton
              appointment={appointment}
              compact={true}
              className="text-xs py-1.5 px-3 rounded-xl shadow-xs"
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenConsultation(appointment._id)}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-xl border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs group-hover:border-blue-300 group-hover:text-blue-700 transition-colors cursor-pointer"
          >
            {isDone ? 'View Consultation' : isCancelled ? 'View Record' : 'Open Consultation'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default DoctorAppointmentCard;
