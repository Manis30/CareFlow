import React from 'react';
import { Building2, MapPin, Stethoscope, Users, ArrowRight } from 'lucide-react';
import OrganizationLogo from '../common/OrganizationLogo';
import StatusBadge from '../common/StatusBadge';

export const ClinicCard = ({
  organization,
  onSelect,
  className = ''
}) => {
  if (!organization) return null;

  const {
    name,
    address,
    city,
    state,
    status = 'approved',
    doctorCount = 0,
    patientCount = 0
  } = organization;

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-2xl border border-slate-200/80 hover:border-blue-400 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group cursor-pointer ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <OrganizationLogo organization={organization} size="md" />
          <div className="truncate">
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              {name}
            </h3>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{city || address || 'Clinic Location'}</span>
            </div>
          </div>
        </div>

        <StatusBadge status={status} />
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
            <strong className="text-slate-900 font-semibold">{doctorCount}</strong> Doctors
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <strong className="text-slate-900 font-semibold">{patientCount}</strong> Patients
          </span>
        </div>

        <span className="text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 font-semibold text-xs">
          Inspect <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
};

export default ClinicCard;
