import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  Video,
  MapPin,
  CheckCircle2,
  FileHeart,
  Pill,
  ArrowRight,
  Activity,
  Calendar,
  Search
} from 'lucide-react';
import {
  getDoctorTodayAppointmentsApi,
  getDoctorUpcomingAppointmentsApi,
  getDoctorCompletedAppointmentsApi
} from '../../api/appointment';
import { useAuth } from '../../context/AuthContext';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import ContentContainer from '../../components/layout/ContentContainer';
import PulseIndicator from '../../components/clinical/PulseIndicator';
import JoinConsultationButton from '../../components/appointment/JoinConsultationButton';
import StatTile from '../../components/common/StatTile';
import { KpiSkeleton, ScheduleSkeleton, CardSkeleton, ChartSkeleton } from '../../components/common/Skeleton';
import { CareFlowDonutChart, CareFlowTrendChart, CLINICAL_COLORS } from '../../components/amcharts';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';

export const DoctorDashboard = () => {
  const { user } = useAuth();
  const [todayAppts, setTodayAppts] = useState([]);
  const [upcomingAppts, setUpcomingAppts] = useState([]);
  const [completedAppts, setCompletedAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_progress' | 'scheduled' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDoctorData();
  }, []);

  const fetchDoctorData = async () => {
    try {
      setLoading(true);
      setError('');
      const [todayRes, upcomingRes, completedRes] = await Promise.all([
        getDoctorTodayAppointmentsApi(),
        getDoctorUpcomingAppointmentsApi(),
        getDoctorCompletedAppointmentsApi().catch(() => ({ data: [] }))
      ]);
      setTodayAppts(todayRes.data || []);
      setUpcomingAppts(upcomingRes.data || []);
      setCompletedAppts(completedRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve clinical practice data');
    } finally {
      setLoading(false);
    }
  };

  const doctorName = user?.name || 'Practitioner';
  const specialization = user?.doctorProfile?.specialization || 'General Medicine';
  const clinicName = user?.doctorProfile?.clinicName || 'CareFlow Health';

  // Appointment categorization
  const inProgressAppts = useMemo(
    () => todayAppts.filter((a) => a.status === 'in_progress'),
    [todayAppts]
  );
  const completedToday = useMemo(
    () => todayAppts.filter((a) => a.status === 'completed'),
    [todayAppts]
  );
  const scheduledToday = useMemo(
    () => todayAppts.filter((a) => a.status === 'scheduled' || a.status === 'booked'),
    [todayAppts]
  );

  // Next patient in line
  const nextPatientAppt = useMemo(() => {
    if (inProgressAppts.length > 0) return inProgressAppts[0];
    if (scheduledToday.length > 0) return scheduledToday[0];
    if (upcomingAppts.length > 0) return upcomingAppts[0];
    return null;
  }, [inProgressAppts, scheduledToday, upcomingAppts]);

  // Today's Status Distribution for Donut Chart
  const todayStatusData = useMemo(() => {
    const list = [
      { name: 'In Room', value: inProgressAppts.length, color: CLINICAL_COLORS.emerald },
      { name: 'In Queue', value: scheduledToday.length, color: CLINICAL_COLORS.primary },
      { name: 'Completed', value: completedToday.length, color: CLINICAL_COLORS.cyan }
    ];
    return list.filter((item) => item.value > 0);
  }, [inProgressAppts, scheduledToday, completedToday]);

  // Historical Consultation Activity from real completed appointments
  const historicalActivityData = useMemo(() => {
    if (!completedAppts || completedAppts.length === 0) return [];
    const counts = {};
    completedAppts.forEach((a) => {
      if (!a.appointmentDate) return;
      const dKey = new Date(a.appointmentDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      counts[dKey] = (counts[dKey] || 0) + 1;
    });
    return Object.entries(counts)
      .slice(-7)
      .map(([date, count]) => ({ date, count }));
  }, [completedAppts]);

  const completedSparkline = useMemo(() => {
    if (!historicalActivityData || historicalActivityData.length < 2) return null;
    return historicalActivityData.map((d) => d.count);
  }, [historicalActivityData]);

  // Filtered list of today's appointments
  const filteredTodayAppts = useMemo(() => {
    return todayAppts.filter((appt) => {
      const pName = (
        appt.patientId?.userId?.name ||
        appt.patientId?.name ||
        appt.patientName ||
        'Patient'
      ).toLowerCase();
      const reason = (appt.reason || '').toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        pName.includes(searchQuery.toLowerCase()) ||
        reason.includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'scheduled') return appt.status === 'scheduled' || appt.status === 'booked';
      return appt.status === statusFilter;
    });
  }, [todayAppts, statusFilter, searchQuery]);

  // Daily completion rate
  const completionRate = todayAppts.length
    ? Math.round((completedToday.length / todayAppts.length) * 100)
    : 100;

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
          <div className="lg:col-span-7">
            <ScheduleSkeleton count={4} />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <ChartSkeleton height={200} />
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
          <ErrorState message={error} onRetry={fetchDoctorData} />
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer className="space-y-6 pb-8">
      {/* 1. Clinical Shift Header */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px] tracking-wide border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Doctor Clinical Workspace
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <MapPin className="w-3 h-3 text-slate-400" />
              {clinicName}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
            Good day, Dr. {doctorName}
          </h2>

          <p className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formattedToday}</span>
            <span className="text-slate-300">·</span>
            <span className="text-blue-600 font-semibold">{specialization}</span>
          </p>
        </div>

        {/* Quick Clinical Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/doctor/availability')}
            icon={Clock}
          >
            Practice Hours
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/doctor/prescriptions')}
            icon={Pill}
          >
            New Prescription
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/doctor/appointments')}
            icon={CalendarDays}
          >
            Appointments
          </Button>
        </div>
      </div>

      {/* 2. Today's Clinical KPIs per Spec */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile
          index={0}
          label="Today's Appointments"
          value={todayAppts.length}
          subtext="Total consultations today"
          icon={CalendarDays}
          color="blue"
          onClick={() => navigate('/doctor/appointments')}
        />

        <StatTile
          index={1}
          label="Upcoming Appointments"
          value={upcomingAppts.length}
          subtext="Next 7 days scheduled"
          icon={Clock}
          color="indigo"
          onClick={() => navigate('/doctor/appointments')}
        />

        <StatTile
          index={2}
          label="Completed Today"
          value={completedToday.length}
          subtext={`${completedToday.length} of ${todayAppts.length} concluded`}
          icon={CheckCircle2}
          color="green"
          sparklineData={completedSparkline}
          onClick={() => navigate('/doctor/appointments')}
        />

        <StatTile
          index={3}
          label="Pending Consultations"
          value={scheduledToday.length + inProgressAppts.length}
          subtext={`${inProgressAppts.length} currently in room`}
          icon={Activity}
          color="sky"
          onClick={() => navigate('/doctor/appointments')}
        />
      </div>

      {/* 3. Main Workspace: Today's Clinical Roster (7 cols) & Analytics + Next Patient + Queue (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (7 cols): Today's Clinical Roster */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Today's Clinical Roster
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Chronological consultation schedule for today's operating hours
                </p>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 text-xs font-semibold shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded-md transition-all duration-150 cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({todayAppts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('in_progress')}
                  className={`px-2 py-1 rounded-md transition-all duration-150 cursor-pointer ${
                    statusFilter === 'in_progress'
                      ? 'bg-white text-emerald-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  In Room ({inProgressAppts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('scheduled')}
                  className={`px-2 py-1 rounded-md transition-all duration-150 cursor-pointer ${
                    statusFilter === 'scheduled'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Queue ({scheduledToday.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-2 py-1 rounded-md transition-all duration-150 cursor-pointer ${
                    statusFilter === 'completed'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Completed ({completedToday.length})
                </button>
              </div>
            </div>

            {/* In-List Search */}
            {todayAppts.length > 2 && (
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patient name or chief complaint..."
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all font-medium"
                />
              </div>
            )}

            {/* Timeline Appointment Feed */}
            {filteredTodayAppts.length > 0 ? (
              <div className="space-y-3 pt-1">
                {filteredTodayAppts.map((appt, idx) => {
                  const patient = appt.patientId;
                  const patientUser = patient?.userId;
                  const patientName =
                    patientUser?.name || patient?.name || appt.patientName || 'Patient';
                  const isOnline = appt.consultationType === 'online';
                  const isLive = appt.status === 'in_progress';
                  const isDone = appt.status === 'completed';
                  const isLast = idx === filteredTodayAppts.length - 1;

                  const gender = patient?.gender ? String(patient.gender).toUpperCase() : null;
                  const bloodGroup = patient?.bloodGroup || null;
                  const age = patient?.age || null;

                  return (
                    <div key={appt._id} className="flex items-start gap-3 sm:gap-4">
                      {/* Time Marker */}
                      <div className="w-16 sm:w-20 shrink-0 text-right pt-2 font-semibold text-xs text-slate-700 font-sans">
                        {formatTime(appt.startTime)}
                      </div>

                      {/* Timeline Node */}
                      <div className="flex flex-col items-center shrink-0 self-stretch">
                        <div
                          className={`w-3 h-3 rounded-full border-2 transition-all ${
                            isLive
                              ? 'bg-blue-600 border-blue-600 ring-4 ring-blue-100 shadow-2xs'
                              : isDone
                              ? 'bg-emerald-600 border-emerald-600'
                              : 'bg-white border-slate-300'
                          }`}
                        />
                        {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1 min-h-[36px]" />}
                      </div>

                      {/* Clinical Card */}
                      <div
                        className={`flex-1 rounded-xl border transition-all duration-150 p-4 space-y-3 shadow-2xs ${
                          isLive
                            ? 'border-blue-400 bg-blue-50/20'
                            : isDone
                            ? 'border-slate-200 bg-slate-50/50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {/* Header Row: Patient info & Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                                isLive
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                  : 'bg-blue-50 text-blue-700 border-blue-100'
                              }`}
                            >
                              {patientName.charAt(0).toUpperCase()}
                            </div>

                            <div className="truncate">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xs font-bold text-slate-900 truncate">
                                  {patientName}
                                </h3>
                                {isLive && <PulseIndicator label="Live Session" />}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5 flex-wrap">
                                {gender && <span>{gender}</span>}
                                {age && (
                                  <>
                                    <span>·</span>
                                    <span>{age} yrs</span>
                                  </>
                                )}
                                {bloodGroup && (
                                  <>
                                    <span>·</span>
                                    <span className="font-semibold text-rose-600">{bloodGroup}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <StatusBadge status={appt.status} />
                        </div>

                        {/* Chief Complaint / Clinical Reason */}
                        {appt.reason && (
                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                              Chief Complaint
                            </span>
                            <p className="text-slate-700 font-medium line-clamp-2">
                              "{appt.reason}"
                            </p>
                          </div>
                        )}

                        {/* Card Footer: Metadata & Actions */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-[11px] text-slate-700">
                              {isOnline ? (
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
                            <span className="text-[11px] font-medium text-slate-500">
                              {appt.duration || 30} mins
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isOnline && appt.status !== 'cancelled' && (
                              <JoinConsultationButton
                                appointment={appt}
                                compact={true}
                                className="text-xs py-1 px-2.5 rounded-lg"
                              />
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/doctor/appointments/${appt._id}`)}
                              className="text-xs rounded-lg"
                            >
                              {isDone ? 'View Summary' : 'Open Chart'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {statusFilter === 'all'
                    ? 'No consultations scheduled today'
                    : `No appointments marked "${statusFilter}"`}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                  {statusFilter === 'all'
                    ? 'Your clinical agenda is clear today. You can review shared records or configure your upcoming availability schedule.'
                    : 'Switch back to all consultations or clear your search filter.'}
                </p>
                {statusFilter !== 'all' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    Reset Filter
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Visual Status + Next Patient + Queue */}
        <div className="lg:col-span-5 space-y-4">
          <CareFlowDonutChart
            title="Today's Session Flow"
            subtitle="Status distribution of today's scheduled patient cases"
            data={todayStatusData}
            height={200}
            centerLabel={todayAppts.length}
            centerSubtext="Today"
          />

          {/* 2. Historical Consultation Activity (if completed appointments exist) */}
          {historicalActivityData.length > 1 && (
            <CareFlowTrendChart
              title="Recent Clinical Activity"
              subtitle="Completed patient encounters over recent dates"
              data={historicalActivityData}
              categoryField="date"
              series={[{ key: 'count', name: 'Encounters', color: CLINICAL_COLORS.primary }]}
              height={200}
            />
          )}

          {/* 3. Next Patient Card */}
          {nextPatientAppt && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Next Patient in Line
                  </h2>
                </div>
                <StatusBadge status={nextPatientAppt.status} />
              </div>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center border border-blue-100">
                      {(
                        nextPatientAppt.patientId?.userId?.name ||
                        nextPatientAppt.patientId?.name ||
                        nextPatientAppt.patientName ||
                        'P'
                      ).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {nextPatientAppt.patientId?.userId?.name ||
                          nextPatientAppt.patientId?.name ||
                          nextPatientAppt.patientName ||
                          'Upcoming Patient'}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {formatDate(nextPatientAppt.appointmentDate)} at {formatTime(nextPatientAppt.startTime)}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/doctor/appointments/${nextPatientAppt._id}`)}
                  >
                    Open Chart
                  </Button>
                </div>

                {nextPatientAppt.reason && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Chief Complaint
                    </span>
                    <p className="text-slate-700 font-medium">
                      "{nextPatientAppt.reason}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Upcoming Consultation Queue */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Upcoming Queue
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/doctor/appointments')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Full Calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingAppts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 font-medium">
                No upcoming appointments in the pipeline.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingAppts.slice(0, 4).map((appt) => {
                  const pName =
                    appt.patientId?.userId?.name ||
                    appt.patientId?.name ||
                    appt.patientName ||
                    'Patient';
                  return (
                    <div
                      key={appt._id}
                      onClick={() => navigate(`/doctor/appointments/${appt._id}`)}
                      className="p-2.5 rounded-lg bg-slate-50/70 hover:bg-blue-50/40 border border-slate-200/70 flex items-center justify-between gap-3 transition-colors cursor-pointer group text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {pName}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {formatDate(appt.appointmentDate)} · {formatTime(appt.startTime)}
                        </p>
                      </div>
                      <StatusBadge status={appt.consultationType} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Clinical Practice Workflows */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
              Practice Workflows
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => navigate('/doctor/availability')}
                className="p-3 rounded-lg border border-slate-200/70 bg-slate-50/60 hover:bg-blue-50 hover:border-blue-200 text-left transition-colors cursor-pointer"
              >
                <Clock className="w-4 h-4 text-blue-600 mb-1.5" />
                <span className="font-bold text-slate-900 block">Operating Hours</span>
                <span className="text-[11px] text-slate-500 block font-medium">Manage bookable slots</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/doctor/medical-records')}
                className="p-3 rounded-lg border border-slate-200/70 bg-slate-50/60 hover:bg-blue-50 hover:border-blue-200 text-left transition-colors cursor-pointer"
              >
                <FileHeart className="w-4 h-4 text-indigo-600 mb-1.5" />
                <span className="font-bold text-slate-900 block">Shared Records</span>
                <span className="text-[11px] text-slate-500 block font-medium">Diagnostic documents</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ContentContainer>
  );
};

export default DoctorDashboard;
