import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Stethoscope,
  Building2,
  Award,
  CalendarDays,
  Video,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { getDoctorByIdApi } from '../../api/doctor';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import Button from '../../components/common/Button';
import ContentContainer from '../../components/layout/ContentContainer';
import PageHeader from '../../components/layout/PageHeader';
import { formatCurrency, formatDoctorName } from '../../utils/formatters';
import { resolveProfileImage } from '../../utils/resolveProfileImage';

export const PatientDoctorDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDoctor();
  }, [id]);

  const fetchDoctor = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getDoctorByIdApi(id);
      if (res.data) setDoctor(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load clinician details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ContentContainer maxWidth="5xl">
        <div className="space-y-6">
          <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <CardSkeleton count={1} />
            </div>
            <div className="lg:col-span-5">
              <CardSkeleton count={1} />
            </div>
          </div>
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer maxWidth="5xl">
        <div className="py-12">
          <ErrorState message={error} onRetry={fetchDoctor} />
        </div>
      </ContentContainer>
    );
  }

  if (!doctor) return null;

  const rawDoctorName = doctor.userId?.name || doctor.name || 'Doctor';
  const doctorName = formatDoctorName(rawDoctorName, 'Doctor');
  const specialty = doctor.specialization || doctor.specialty || 'General Medicine';
  const clinicName = doctor.organizationId?.name || doctor.clinicName || 'CareFlow Clinic';
  const qualification = doctor.qualification || 'MBBS, MD';
  const experience = doctor.experienceYears || doctor.experience || '5+';
  const fee = doctor.consultationFee || 0;
  const modes = doctor.consultationModes || ['online', 'offline'];
  const photoUrl = resolveProfileImage(doctor.userId || doctor);

  return (
    <ContentContainer maxWidth="5xl" className="space-y-6 pb-12">
      <PageHeader
        title={doctorName}
        subtitle={`${specialty} · ${clinicName}`}
        badge={
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-extrabold text-[11px] tracking-wide border border-blue-100">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            VERIFIED CLINICIAN
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/patient/doctors')}
              icon={ArrowLeft}
              className="text-xs rounded-xl"
            >
              Back to Catalog
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/patient/book-appointment?doctorId=${doctor._id}`)}
              icon={CalendarDays}
              className="text-xs rounded-xl shadow-xs font-bold"
            >
              Book Consultation
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Clinician Dossier (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
            {/* Header Card */}
            <div className="flex items-start gap-4 pb-5 border-b border-slate-100">
              <div className="w-16 h-16 rounded-xl bg-blue-50 text-blue-700 font-black text-xl flex items-center justify-center shrink-0 border border-blue-100 overflow-hidden shadow-2xs">
                {photoUrl ? (
                  <img src={photoUrl} alt={doctorName} className="w-full h-full object-cover" />
                ) : (
                  <span>{doctorName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="space-y-1 min-w-0">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {doctorName}
                </h2>
                <p className="text-xs font-bold text-blue-600">{specialty}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{clinicName}</span>
                </p>
              </div>
            </div>

            {/* Clinical Bio / Notes */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                Professional Background
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {doctor.bio ||
                  `${doctorName} is an accredited physician specializing in ${specialty} at ${clinicName}, providing diagnostic and patient consultation care adhering to hospital clinical protocols.`}
              </p>
            </div>

            {/* Credentials Matrix */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Qualifications
                </span>
                <span className="font-bold text-slate-900 block pt-0.5">{qualification}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Clinical Experience
                </span>
                <span className="font-bold text-slate-900 block pt-0.5">
                  {experience} years in clinical practice
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Consultation Booking Card (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3">
              Consultation Arrangements
            </h3>

            <div className="space-y-3 text-xs font-medium">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Consultation Fee</span>
                <span className="text-lg font-black text-slate-900">{formatCurrency(fee)}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Department</span>
                <span className="font-bold text-slate-900">
                  {doctor.departmentId?.name || specialty}
                </span>
              </div>

              <div className="py-1.5 space-y-2">
                <span className="text-slate-500 block font-semibold">Available Modalities:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {modes.map((mode, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center gap-1.5 border border-blue-100"
                    >
                      {mode === 'online' ? (
                        <Video className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span className="capitalize">{mode} Consultation</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <Button
                variant="primary"
                size="md"
                className="w-full text-xs sm:text-sm rounded-xl font-bold shadow-xs"
                icon={CalendarDays}
                onClick={() => navigate(`/patient/book-appointment?doctorId=${doctor._id}`)}
              >
                Schedule Consultation
              </Button>
              <p className="text-[11px] text-slate-400 text-center font-medium">
                Instant slot reservation · Encrypted health data privacy
              </p>
            </div>
          </div>
        </div>
      </div>
    </ContentContainer>
  );
};

export default PatientDoctorDetails;
