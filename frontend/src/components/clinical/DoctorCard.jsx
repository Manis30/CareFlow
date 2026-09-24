import React from 'react';
import { Stethoscope, Building2, Video, MapPin } from 'lucide-react';
import Button from '../common/Button';
import { formatCurrency } from '../../utils/formatters';
import { resolveProfileImage } from '../../utils/resolveProfileImage';

export const DoctorCard = ({
  doctor,
  onBook,
  onViewDetails,
  className = ''
}) => {
  if (!doctor) return null;

  const doctorName = doctor.userId?.name || doctor.name || 'Doctor';
  const specialty = doctor.specialization || doctor.specialty || 'General Medicine';
  const clinicName = doctor.organizationId?.name || doctor.clinicName || 'CareFlow Clinic';
  const experience = doctor.experienceYears || doctor.experience || null;
  const fee = doctor.consultationFee || doctor.fee || 0;
  const modes = Array.isArray(doctor.consultationModes) ? doctor.consultationModes : ['online', 'offline'];
  const photoUrl = resolveProfileImage(doctor.userId || doctor);

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 p-5 shadow-xs transition-all duration-150 flex flex-col justify-between space-y-4 group ${className}`}
    >
      {/* Top Clinician Header */}
      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-blue-50 shrink-0 border border-blue-100 flex items-center justify-center font-bold text-sm text-blue-700 shadow-2xs">
          {photoUrl ? (
            <img src={photoUrl} alt={doctorName} className="w-full h-full object-cover" />
          ) : (
            <span>{doctorName.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
            {doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`}
          </h3>

          <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold mt-0.5">
            <Stethoscope className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{specialty}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{clinicName}</span>
          </div>
        </div>
      </div>

      {/* Badges / Consultation Details */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {modes.map((mode, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold flex items-center gap-1"
            >
              {mode === 'online' ? <Video className="w-3 h-3 text-blue-600" /> : <MapPin className="w-3 h-3 text-slate-500" />}
              <span className="capitalize">{mode}</span>
            </span>
          ))}
          {experience && (
            <span className="text-[11px] text-slate-500 font-medium">
              {experience} yrs exp
            </span>
          )}
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Fee</span>
          <span className="text-sm font-bold text-slate-900">
            {formatCurrency(fee)}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 flex items-center gap-2">
        {onViewDetails && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="flex-1 text-xs"
          >
            Profile
          </Button>
        )}
        {onBook && (
          <Button
            variant="primary"
            size="sm"
            onClick={onBook}
            className="flex-1 text-xs"
          >
            Book Visit
          </Button>
        )}
      </div>
    </div>
  );
};

export default DoctorCard;
