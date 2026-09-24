import React from 'react';
import { Calendar, Clock, User, Building2, CheckCircle2, XCircle } from 'lucide-react';
import Button from '../common/Button';

export const AIBookingRecommendation = ({
  payload,
  onConfirm,
  onCancel,
  disabled = false,
  className = ''
}) => {
  if (!payload) return null;

  const cleanDoctorName = (name) => {
    if (!name) return 'Dr. Specialist';
    const stripped = String(name).replace(/^(?:Dr\.?\s*)+/i, '').trim();
    return `Dr. ${stripped}`;
  };

  const doctorName = cleanDoctorName(payload.doctorName || payload.doctor);
  const specialty = payload.specialty || payload.departmentName || 'Clinical Care';
  const clinicName = payload.clinicName || payload.organizationName || 'CareFlow Clinic';
  const dateStr = payload.appointmentDate || payload.date || 'Preferred Date';
  const timeStr = payload.startTime ? `${payload.startTime} - ${payload.endTime || ''}` : 'Scheduled Slot';
  const typeStr = payload.consultationType || 'online';
  const reasonStr = payload.reason || payload.symptoms || null;

  return (
    <div
      className={`bg-white rounded-2xl border border-blue-200/80 p-4 shadow-xs space-y-3.5 my-2 text-slate-800 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          Recommended Clinical Appointment
        </span>
        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] uppercase border border-blue-100">
          Available
        </span>
      </div>

      {/* Doctor Identity & Slot */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0 border border-blue-100">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {doctorName}
            </h4>
            <p className="text-xs text-slate-500 truncate">{specialty}</p>
          </div>
        </div>

        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 space-y-1.5 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate font-medium">{clinicName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              <strong className="text-slate-900">{dateStr}</strong> · {timeStr}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="capitalize">Mode: <strong className="text-slate-900">{typeStr} consultation</strong></span>
          </div>
          {reasonStr && (
            <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
              Matched symptom: "{reasonStr}"
            </p>
          )}
        </div>
      </div>

      <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
        Explicit confirmation is required before this appointment is written to the clinical schedule.
      </p>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirm}
          disabled={disabled}
          icon={CheckCircle2}
          className="flex-1 text-xs"
        >
          Confirm Booking
        </Button>
        {onCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={disabled}
            icon={XCircle}
            className="text-xs"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

export default AIBookingRecommendation;
