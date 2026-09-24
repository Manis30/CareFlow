import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CalendarDays,
  Search,
  FileHeart,
  Pill,
  ArrowRight,
  Clock,
  Video,
  MapPin,
  Stethoscope,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  User
} from 'lucide-react';
import { getMyAppointmentsApi } from '../../api/appointment';
import { getMyPatientProfileApi } from '../../api/patient';
import { getMyPrescriptionsApi } from '../../api/prescription';
import { getMyMedicalRecordsApi } from '../../api/medicalRecord';
import { useAuth } from '../../context/AuthContext';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import ContentContainer from '../../components/layout/ContentContainer';
import PulseIndicator from '../../components/clinical/PulseIndicator';
import JoinConsultationButton from '../../components/appointment/JoinConsultationButton';
import StatTile from '../../components/common/StatTile';
import { KpiSkeleton, CardSkeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { resolveDoctorName } from '../../utils/resolveDoctorName';

export const PatientDashboard = () => {
  const [upcomingAppts, setUpcomingAppts] = useState([]);
  const [completedAppts, setCompletedAppts] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const [apptsRes, profileRes, rxRes, recordsRes] = await Promise.all([
        getMyAppointmentsApi().catch(() => ({ data: [] })),
        getMyPatientProfileApi().catch(() => ({ data: null })),
        getMyPrescriptionsApi().catch(() => ({ data: [] })),
        getMyMedicalRecordsApi().catch(() => ({ data: [] }))
      ]);

      const rawAppts = Array.isArray(apptsRes.data)
        ? apptsRes.data
        : Array.isArray(apptsRes)
        ? apptsRes
        : [];

      const activeAppts = rawAppts.filter(
        (app) => app.status === 'booked' || app.status === 'scheduled' || app.status === 'in_progress'
      );
      const finishedAppts = rawAppts.filter((app) => app.status === 'completed');
      setUpcomingAppts(activeAppts);
      setCompletedAppts(finishedAppts);

      const pData = profileRes.data?.patient || profileRes.data;
      if (pData) setProfile(pData);

      const rxList = rxRes.data || (Array.isArray(rxRes) ? rxRes : []);
      setPrescriptions(Array.isArray(rxList) ? rxList : []);

      const recList = recordsRes.data || (Array.isArray(recordsRes) ? recordsRes : []);
      setMedicalRecords(Array.isArray(recList) ? recList : []);
    } catch (err) {
      setError(err.message || 'Failed to load patient healthcare dashboard');
    } finally {
      setLoading(false);
    }
  };

  const nextAppt = upcomingAppts[0];
  const patientName = user?.name || profile?.name || 'Patient';
  const firstName = patientName.split(' ')[0];
  const bloodGroup = profile?.bloodGroup || user?.bloodGroup || null;
  const age =
    profile?.age ||
    (profile?.dateOfBirth
      ? `${new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()} yrs`
      : null);

  const quickSpecialties = [
    { label: 'General Medicine', query: 'General Medicine' },
    { label: 'Cardiology', query: 'Cardiology' },
    { label: 'Dermatology', query: 'Dermatology' },
    { label: 'Pediatrics', query: 'Pediatrics' },
    { label: 'Orthopedics', query: 'Orthopedics' },
    { label: 'Neurology', query: 'Neurology' }
  ];

  const formattedToday = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  if (loading) {
    return (
      <ContentContainer className="space-y-6 pb-8">
        <div className="h-16 bg-white rounded-xl border border-slate-200/80 p-5 animate-pulse" />
        <KpiSkeleton count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer>
        <div className="py-12">
          <ErrorState message={error} onRetry={fetchDashboardData} />
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer className="space-y-6 pb-8">
      {/* 1. Calm Patient Greeting Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px] tracking-wide border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Patient Healthcare Portal
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Verified Health Account
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
            Welcome back, {firstName}
          </h2>

          <p className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formattedToday}</span>
            <span className="text-slate-300">·</span>
            <span>Your personal healthcare and consultations overview</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/patient/appointments')}
            icon={CalendarDays}
          >
            My Appointments
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/patient/doctors')}
            icon={Search}
          >
            Find a Doctor
          </Button>
        </div>
      </div>

      {/* 2. Operational Summary Strip (4 Core Patient Health Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile
          index={0}
          label="Upcoming Consultations"
          value={upcomingAppts.length}
          subtext={upcomingAppts.length > 0 ? 'Active visits scheduled' : 'No upcoming visits'}
          icon={CalendarDays}
          color="blue"
          onClick={() => navigate('/patient/appointments')}
        />

        <StatTile
          index={1}
          label="Active Prescriptions"
          value={prescriptions.length}
          subtext="Medication regimens on file"
          icon={Pill}
          color="green"
          onClick={() => navigate('/patient/prescriptions')}
        />

        <StatTile
          index={2}
          label="Medical Records"
          value={medicalRecords.length}
          subtext="Clinical reports & documents"
          icon={FileHeart}
          color="indigo"
          onClick={() => navigate('/patient/medical-records')}
        />

        <StatTile
          index={3}
          label="Completed Encounters"
          value={completedAppts.length}
          subtext="Past consultation history"
          icon={CheckCircle2}
          color="sky"
          onClick={() => navigate('/patient/appointments')}
        />
      </div>

      {/* 3. Row 1: Next Appointment (7 cols) & Patient Health Profile (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column (7 cols): Next Appointment Card */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between h-full space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Next Appointment
                  </h2>
                </div>
                {nextAppt ? (
                  <PulseIndicator
                    label={nextAppt.status === 'in_progress' ? 'Session In Progress' : 'Confirmed Booking'}
                  />
                ) : (
                  <span className="text-xs text-slate-400 font-medium">No Pending Visits</span>
                )}
              </div>

              {nextAppt ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0 border border-blue-100">
                        {resolveDoctorName(nextAppt.doctorId).charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {resolveDoctorName(nextAppt.doctorId).startsWith('Dr.')
                            ? resolveDoctorName(nextAppt.doctorId)
                            : `Dr. ${resolveDoctorName(nextAppt.doctorId)}`}
                        </h3>
                        <p className="text-xs text-blue-600 font-semibold">
                          {nextAppt.doctorId?.specialization || 'Clinical Specialist'}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{nextAppt.organizationId?.name || 'CareFlow Clinic'}</span>
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={nextAppt.status} />
                  </div>

                  {/* Visit Details */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Date & Time
                      </span>
                      <span className="font-semibold text-slate-900 block pt-0.5">
                        {formatDate(nextAppt.appointmentDate)} · {formatTime(nextAppt.startTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Consultation Mode
                      </span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5 pt-0.5">
                        {nextAppt.consultationType === 'online' ? (
                          <>
                            <Video className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-blue-700">Online Room</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>In-Clinic Visit</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-7 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Your clinical agenda is clear</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                    You currently have no scheduled appointments. Search our roster of qualified specialists to book your next consultation.
                  </p>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
              {nextAppt ? (
                <>
                  {nextAppt.consultationType === 'online' && (
                    <JoinConsultationButton
                      appointment={nextAppt}
                      compact={true}
                      className="text-xs py-1.5 px-3 rounded-lg"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/patient/appointments/${nextAppt._id}`)}
                    className="text-xs rounded-lg"
                  >
                    View Details
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/patient/doctors')}
                >
                  Book a Consultation
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Patient Health Profile */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between h-full space-y-4">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Patient Health Profile
                  </h2>
                </div>
                <Link
                  to="/patient/profile"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Edit
                </Link>
              </div>

              {/* 3 Core Vitals */}
              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">Age</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">{age || 'N/A'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">Blood Group</span>
                  <span className="font-bold text-rose-600 text-sm mt-0.5 block">{bloodGroup || 'N/A'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">Records</span>
                  <span className="font-bold text-blue-600 text-sm mt-0.5 block">{medicalRecords.length}</span>
                </div>
              </div>

              {/* Vitals Summary / Contact on file */}
              <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/60 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Emergency Contact:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                    {profile?.emergencyContact?.name ? `${profile.emergencyContact.name} (${profile.emergencyContact.phone || ''})` : 'Not on file'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Primary District:</span>
                  <span className="font-semibold text-slate-800">
                    {profile?.address?.district || profile?.address?.city || 'Tamil Nadu'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Status / Link */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Primary Care: Active</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/patient/profile')}
                className="text-xs py-1 px-2.5 rounded-lg"
              >
                View Full Profile
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Row 2: Recent Prescriptions (6 cols) & Recent Medical Records (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Recent Prescriptions */}
        <div className="flex flex-col">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between h-full space-y-3.5">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Recent Prescriptions
                  </h2>
                </div>
                <Link
                  to="/patient/prescriptions"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {prescriptions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 font-medium">
                  No active prescriptions recorded.
                </p>
              ) : (
                <div className="space-y-2">
                  {prescriptions.slice(0, 3).map((rx) => {
                    const docName = rx.doctorId?.userId?.name || rx.doctorId?.name || rx.doctorName || 'Doctor';
                    const medCount = rx.medicines?.length || rx.medications?.length || 0;
                    return (
                      <div
                        key={rx._id}
                        onClick={() => navigate('/patient/prescriptions')}
                        className="p-2.5 rounded-lg bg-slate-50/70 hover:bg-blue-50/40 border border-slate-200/70 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-900 truncate">
                            Dr. {docName}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {medCount} medication{medCount !== 1 ? 's' : ''} · {formatDate(rx.createdAt || rx.date)}
                          </p>
                        </div>
                        <StatusBadge status="completed" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Showing up to 3 recent medication regimens</span>
              <Link to="/patient/prescriptions" className="text-blue-600 font-semibold hover:underline">
                Manage
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Medical Records */}
        <div className="flex flex-col">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between h-full space-y-3.5">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <FileHeart className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Recent Medical Records
                  </h2>
                </div>
                <Link
                  to="/patient/medical-records"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>All Records</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {medicalRecords.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 font-medium">
                  No clinical documents uploaded.
                </p>
              ) : (
                <div className="space-y-2">
                  {medicalRecords.slice(0, 3).map((rec) => (
                    <div
                      key={rec._id}
                      onClick={() => navigate('/patient/medical-records')}
                      className="p-2.5 rounded-lg bg-slate-50/70 hover:bg-blue-50/40 border border-slate-200/70 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 truncate">
                          {rec.title || rec.fileName || 'Clinical Record'}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {rec.recordType ? rec.recordType.replace(/_/g, ' ') : 'Diagnostic'} · {formatDate(rec.recordDate || rec.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={rec.accessLevel || 'shared'} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Diagnostic reports, imaging, & summaries</span>
              <Link to="/patient/medical-records" className="text-blue-600 font-semibold hover:underline">
                Open Vault
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Row 3: Find Care Shortcuts by Specialty (Full-Width 12-col Grid) */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Find Care by Specialty
            </h2>
          </div>
          <Link
            to="/patient/doctors"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            <span>All Specialists</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {quickSpecialties.map((spec) => (
            <button
              key={spec.label}
              type="button"
              onClick={() => navigate(`/patient/doctors?specialty=${encodeURIComponent(spec.query)}`)}
              className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/60 hover:bg-blue-50/60 hover:border-blue-200 text-left transition-colors cursor-pointer group"
            >
              <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 block transition-colors">
                {spec.label}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Browse Specialists</span>
            </button>
          ))}
        </div>
      </div>
    </ContentContainer>
  );
};

export default PatientDashboard;
