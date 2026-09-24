import React from 'react';
import {
  Calendar,
  Clock,
  ArrowRight,
  Video,
  Building2,
  CheckCircle2,
  XCircle,
  MessageCircle
} from 'lucide-react';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';

const getDayOfWeek = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
};

const getDurationStr = (start, end) => {
  if (!start || !end) return '30 mins';
  const parseMin = (str) => {
    const s = String(str).trim().toUpperCase();
    const isPM = s.includes('PM');
    const isAM = s.includes('AM');
    const clean = s.replace(/AM|PM/g, '').trim();
    const parts = clean.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
    let h = parts[0];
    let m = parts[1];
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
  };
  const startMins = parseMin(start);
  const endMins = parseMin(end);
  const diff = endMins - startMins;
  if (diff > 0 && diff < 300) {
    return `${diff} mins`;
  }
  return '30 mins';
};

const getGenderInfo = (g) => {
  const clean = String(g || '').toLowerCase().trim();
  if (clean.startsWith('m')) return { symbol: '♂', label: 'Male' };
  if (clean.startsWith('f')) return { symbol: '♀', label: 'Female' };
  return { symbol: '👤', label: g || 'Patient' };
};

const getStatusBadgeConfig = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') {
    return {
      badgeBg: 'bg-blue-50/90 text-blue-700 border-blue-200/80',
      lineGradient: 'from-blue-500 to-indigo-500',
      icon: CheckCircle2,
      label: 'Completed'
    };
  }
  if (s === 'cancelled') {
    return {
      badgeBg: 'bg-rose-50/90 text-rose-700 border-rose-200/80',
      lineGradient: 'from-rose-500 to-red-500',
      icon: XCircle,
      label: 'Cancelled'
    };
  }
  if (s === 'in-progress' || s === 'in_progress' || s === 'active') {
    return {
      badgeBg: 'bg-teal-50/90 text-teal-700 border-teal-200/80',
      lineGradient: 'from-teal-500 to-emerald-500',
      icon: Video,
      label: 'In Progress'
    };
  }
  // Default: Booked / Scheduled
  return {
    badgeBg: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80',
    lineGradient: 'from-teal-500 to-emerald-500',
    icon: CheckCircle2,
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Booked'
  };
};

const AppointmentCard = ({
  appointment,
  userRole = 'doctor',
  onClick,
  className = ''
}) => {
  if (!appointment) return null;

  const isPatientView = userRole === 'patient';
  
  const patientObj = appointment.patientId || {};
  const doctorObj = appointment.doctorId || {};
  const docUserObj = doctorObj.userId || {};

  const patientName = appointment.patientName || patientObj.userId?.name || patientObj.name || 'Patient';
  const doctorName = appointment.doctorName || docUserObj.name || doctorObj.name || 'Doctor';
  const rawGender = patientObj.gender || patientObj.userId?.gender || 'Male';
  const specialization = doctorObj.specialization || 'General Practice';

  const avatarName = isPatientView ? doctorName : patientName;
  const avatarUrl = isPatientView
    ? (docUserObj.profileImage?.url || doctorObj.profileImage?.url)
    : (patientObj.userId?.profileImage?.url || patientObj.profileImage?.url);

  const genderInfo = getGenderInfo(rawGender);
  const consultationTypeLabel = appointment.consultationType === 'online' ? 'Online Video' : 'In-Person Visit';
  const statusConfig = getStatusBadgeConfig(appointment.status);
  const StatusIcon = statusConfig.icon;

  const formattedDateStr = formatDate(appointment.appointmentDate);
  const dayOfWeekStr = getDayOfWeek(appointment.appointmentDate) || 'Scheduled Day';
  const timeRangeStr = `${formatTime(appointment.startTime)} – ${formatTime(appointment.endTime)}`;
  const durationStr = getDurationStr(appointment.startTime, appointment.endTime);
  const reasonText = appointment.reason || 'General Health Checkup';

  const getInitials = (name) => {
    if (!name) return 'PT';
    const parts = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300/90 transition-all duration-300 cursor-pointer flex flex-col justify-between group font-sans text-slate-800 ${className}`}
    >
      {/* Dynamic Animated Left Accent Line (Driven by Status Color, Expands Top-to-Bottom on Hover) */}
      <div
        className={`absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b ${statusConfig.lineGradient} rounded-l-2xl h-0 group-hover:h-full transition-all duration-300 ease-out pointer-events-none`}
      />

      <div className="space-y-3.5">
        {/* Top Header: Avatar, Name, Gender Badge & Top-Right Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with Ring */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-teal-50 text-teal-800 font-bold text-lg flex items-center justify-center border-2 border-slate-200/90 p-0.5 shadow-2xs overflow-hidden group-hover:border-teal-300 transition-colors">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={avatarName} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span>{getInitials(avatarName)}</span>
                )}
              </div>
            </div>

            {/* Identity & Subtitle */}
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-teal-950 transition-colors truncate tracking-tight">
                {avatarName}
              </h3>
              
              {isPatientView ? (
                <p className="text-xs font-semibold text-teal-700 truncate mt-0.5">
                  {specialization}
                </p>
              ) : (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100/90 text-slate-600 text-[11px] font-semibold mt-0.5">
                  <span className="text-teal-600 font-bold">{genderInfo.symbol}</span>
                  <span>{genderInfo.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Badge with Semantic Color */}
          <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border shadow-2xs shrink-0 ${statusConfig.badgeBg}`}>
            <StatusIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{statusConfig.label}</span>
          </div>
        </div>

        {/* Middle Metadata Box */}
        <div className="p-3 sm:p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-2.5">
          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-2.5 items-center divide-x divide-slate-200/80">
            {/* Date Block */}
            <div className="flex items-center gap-2.5 pr-2">
              <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-600 border border-teal-100/80 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DATE</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block truncate mt-0.5">{formattedDateStr}</span>
                <span className="text-[11px] font-medium text-slate-500 block truncate">{dayOfWeekStr}</span>
              </div>
            </div>

            {/* Time Block */}
            <div className="flex items-center gap-2.5 pl-2.5">
              <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-600 border border-teal-100/80 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TIME</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block truncate mt-0.5">{timeRangeStr}</span>
                <span className="text-[11px] font-medium text-slate-500 block truncate">{durationStr}</span>
              </div>
            </div>
          </div>

          {/* Reason Block */}
          <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
              <MessageCircle className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">REASON</span>
              <span className="font-semibold text-slate-800 truncate">{reasonText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 mt-3">
        {/* Consultation Type Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-teal-50/90 text-teal-800 border border-teal-200/80 shadow-2xs">
          {appointment.consultationType === 'online' ? (
            <Video className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          ) : (
            <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          )}
          <span>{consultationTypeLabel}</span>
        </div>

        {/* View Details Action */}
        <div className="text-xs sm:text-sm font-bold text-teal-700 group-hover:text-teal-800 flex items-center gap-1.5 transition-colors">
          <span>Details & Actions</span>
          <ArrowRight className="w-3.5 h-3.5 text-teal-700 group-hover:translate-x-1 transition-transform duration-300" />
        </div>
      </div>
    </div>
  );
};

export default AppointmentCard;
