import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatDoctorName } from '../../utils/formatName';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ArrowRight,
  Edit3,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Stethoscope,
  Phone,
  DollarSign
} from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import Button from '../common/Button';
import PatientAvatar from '../common/PatientAvatar';
import OrganizationLogo from '../common/OrganizationLogo';
import WeeklyAvailabilitySchedule from './WeeklyAvailabilitySchedule';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';

const DoctorDetailsContent = ({
  doctor,
  appointments = [],
  stats = { total: 0, completed: 0, pending: 0, cancelled: 0 },
  backRoute = '/admin/doctors',
  onViewAllAppointments
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const getDoctorName = (doc) => {
    if (!doc) return 'Dr. Practitioner';
    const name = doc?.userId?.name || doc?.name;
    return formatDoctorName(name);
  };

  const getDoctorInitials = (doc) => {
    const rawName = doc?.userId?.name || doc?.name || '';
    if (!rawName) return 'DR';
    const clean = rawName.replace(/^Dr\.\s*/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase() || 'DR';
  };

  const getProfileImageUrl = (doc) => {
    if (imgError) return null;
    const img =
      doc?.userId?.profileImage?.url ||
      doc?.userId?.profileImage ||
      doc?.profileImage?.url ||
      doc?.profileImage ||
      doc?.image ||
      doc?.avatar ||
      doc?.photo;

    if (typeof img === 'string' && img.trim() !== '') {
      return img;
    }
    return null;
  };

  const getAssignedDepartments = (doc) => {
    if (!doc) return [];
    if (Array.isArray(doc.departmentIds) && doc.departmentIds.length > 0) {
      const names = doc.departmentIds
        .map((d) => (typeof d === 'object' && d?.name ? d.name : d))
        .filter(Boolean);
      if (names.length > 0) return names;
    }
    if (Array.isArray(doc.departments) && doc.departments.length > 0) {
      return doc.departments.filter(Boolean);
    }
    if (typeof doc?.departmentId === 'object' && doc?.departmentId?.name) {
      return [doc.departmentId.name];
    }
    if (typeof doc?.departmentId === 'string' && doc.departmentId.trim()) return [doc.departmentId.trim()];
    return [];
  };

  const getOrganizationName = (doc) => {
    if (typeof doc?.organizationId === 'object' && doc?.organizationId?.name) {
      return doc.organizationId.name;
    }
    if (typeof doc?.organizationId === 'string') return doc.organizationId;
    return doc?.organization || 'CarePlus Medical';
  };

  const profileImgUrl = doctor ? getProfileImageUrl(doctor) : null;
  const departmentList = getAssignedDepartments(doctor);

  // Recent appointments sorted desc
  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(b.appointmentDate || b.createdAt) - new Date(a.appointmentDate || a.createdAt)
  );

  const visibleAppointments = sortedAppointments.slice(0, 4);
  const docId = doctor?._id || doctor?.id;

  return (
    <div className="space-y-6 font-sans text-slate-800 antialiased">
      {/* 1. TOP ACTION AREA */}
      <div className="flex items-center justify-end gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(backRoute)}
          icon={ArrowLeft}
        >
          Back to Doctors
        </Button>

        {!isSuperAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/admin/doctors/${docId}/edit`)}
            icon={Edit3}
          >
            Edit Clinician
          </Button>
        )}
      </div>

      {/* 2. DOCTOR HERO CARD */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-xs relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Side: Avatar & Doctor Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 min-w-0 flex-1">
            {/* Circular Doctor Avatar with DomoApp Blue accents */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-50 text-blue-700 font-bold text-2xl sm:text-3xl flex items-center justify-center border-4 border-white shadow-md overflow-hidden ring-1 ring-slate-200">
                {profileImgUrl ? (
                  <img
                    src={profileImgUrl}
                    alt={getDoctorName(doctor)}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getDoctorInitials(doctor)}</span>
                )}
              </div>
            </div>

            {/* Doctor Info */}
            <div className="space-y-2 text-center sm:text-left min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {getDoctorName(doctor)}
                </h2>
              </div>

              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                <span className="text-blue-600 font-bold">{doctor?.specialization || 'General Physician'}</span>
                {doctor?.qualification && (
                  <span className="text-slate-500 font-normal"> • {doctor.qualification}</span>
                )}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                <span>Consultation Fee: <strong className="text-slate-900 font-bold">₹{doctor?.consultationFee || 0}</strong></span>
                <span>•</span>
                <span>Gender: <strong className="text-slate-800 font-semibold">{doctor?.gender || doctor?.userId?.gender || 'Not specified'}</strong></span>
                {doctor?.userId?.phone && (
                  <>
                    <span>•</span>
                    <span>Phone: <strong className="text-slate-800 font-semibold">{doctor.userId.phone}</strong></span>
                  </>
                )}
              </div>

              {/* Department Chips */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                {departmentList.length > 0 ? (
                  departmentList.map((dept, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs"
                    >
                      {dept}
                    </span>
                  ))
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100">
                    General Department
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Organization Identity */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-center lg:items-end text-center lg:text-right gap-2.5 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
            <OrganizationLogo
              organization={doctor?.organizationId || doctor?.organization}
              logo={doctor?.organizationLogo || doctor?.organizationLogoUrl}
              size="md"
              className="rounded-xl border border-slate-200 shadow-2xs"
            />

            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">{getOrganizationName(doctor)}</h4>
              <p className="text-[11px] font-medium text-slate-400">Associated Clinic</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. APPOINTMENTS OVERVIEW */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Consultation Volume & Distribution
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Overview of this clinician's appointment ledger
            </p>
          </div>
        </div>

        {/* 4 Stat Cards in 1 Horizontal Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 leading-none block font-sans">{stats.total}</span>
              <span className="text-xs font-semibold text-slate-500 block mt-1">Total Visits</span>
            </div>
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-emerald-800 leading-none block font-sans">{stats.completed}</span>
              <span className="text-xs font-semibold text-emerald-700 block mt-1">Completed</span>
            </div>
          </div>

          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-blue-800 leading-none block font-sans">{stats.pending}</span>
              <span className="text-xs font-semibold text-blue-700 block mt-1">Booked / Pending</span>
            </div>
          </div>

          <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200/80 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <XCircle className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-2xl font-bold text-rose-800 leading-none block font-sans">{stats.cancelled}</span>
              <span className="text-xs font-semibold text-rose-700 block mt-1">Cancelled</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. RECENT APPOINTMENTS SECTION */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Recent Appointments
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Latest patient consultations and booking activity
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onViewAllAppointments || (() => navigate(isSuperAdmin ? '/super-admin/appointments' : '/admin/appointments'))}
            icon={ArrowRight}
          >
            View All
          </Button>
        </div>

        {visibleAppointments.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {visibleAppointments.map((appt) => {
              const patObj = appt?.patientId?.userId || appt?.patientId || {};
              const patientName = patObj?.name || appt?.patientName || 'Patient';
              const detailsRoute = isSuperAdmin
                ? `/super-admin/appointments`
                : `/admin/appointments/${appt._id}`;

              return (
                <div
                  key={appt._id}
                  onClick={() => navigate(detailsRoute)}
                  className="py-3 px-2.5 hover:bg-slate-50 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PatientAvatar patient={patObj} name={patientName} size="md" />
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {patientName}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        {appt?.consultationType || 'Consultation'} • {formatDate(appt?.appointmentDate)} • {formatTime(appt?.startTime)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <StatusBadge status={appt?.status} className="text-[10px] px-2.5 py-0.5" />
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 font-medium italic">
            No recent appointments found for this doctor yet.
          </div>
        )}
      </div>

      {/* 5. REUSABLE WEEKLY AVAILABILITY SCHEDULE */}
      <WeeklyAvailabilitySchedule doctor={doctor} />
    </div>
  );
};

export default DoctorDetailsContent;
