import React from 'react';
import { User, HeartPulse, Calendar, Phone, Mail, FileText } from 'lucide-react';
import { resolveProfileImage } from '../../utils/resolveProfileImage';

export const PatientSummary = ({
  patient,
  className = ''
}) => {
  if (!patient) return null;

  const user = patient.userId || patient;
  const name = user.name || 'Patient';
  const email = user.email || null;
  const phone = patient.phone || user.phone || null;
  const bloodGroup = patient.bloodGroup || null;
  const age = patient.age || (patient.dateOfBirth ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} yrs` : null);
  const gender = patient.gender || null;
  const photoUrl = resolveProfileImage(user);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 p-4.5 shadow-xs space-y-3.5 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 font-bold text-sm flex items-center justify-center shrink-0 border border-blue-100 overflow-hidden">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-slate-900 truncate">{name}</h4>
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            {gender && <span className="capitalize">{gender}</span>}
            {age && <span>· {age}</span>}
            {bloodGroup && (
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-100">
                {bloodGroup}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 gap-1.5 text-xs text-slate-500">
        {email && (
          <div className="flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{email}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2 truncate">
            <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{phone}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientSummary;
