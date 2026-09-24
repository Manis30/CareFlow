import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Video,
  MapPin,
  Plus,
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { getMyAppointmentsApi } from '../../api/appointment';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import ContentContainer from '../../components/layout/ContentContainer';
import PageHeader from '../../components/layout/PageHeader';
import StatTile from '../../components/common/StatTile';
import PulseIndicator from '../../components/clinical/PulseIndicator';
import JoinConsultationButton from '../../components/appointment/JoinConsultationButton';
import { ScheduleSkeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { resolveDoctorName } from '../../utils/resolveDoctorName';

export const PatientAppointments = () => {
  const [activeTab, setActiveTab] = useState('booked');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tabCounts, setTabCounts] = useState({
    booked: 0,
    completed: 0,
    cancelled: 0,
    total: 0
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchInitialCounts();
  }, []);

  const fetchInitialCounts = async () => {
    try {
      const [bookedRes, compRes, cancRes] = await Promise.allSettled([
        getMyAppointmentsApi('booked'),
        getMyAppointmentsApi('completed'),
        getMyAppointmentsApi('cancelled')
      ]);
      const booked = bookedRes.status === 'fulfilled' ? (bookedRes.value?.data?.length || 0) : 0;
      const completed = compRes.status === 'fulfilled' ? (compRes.value?.data?.length || 0) : 0;
      const cancelled = cancRes.status === 'fulfilled' ? (cancRes.value?.data?.length || 0) : 0;
      setTabCounts({
        booked,
        completed,
        cancelled,
        total: booked + completed + cancelled
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [activeTab]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyAppointmentsApi(activeTab);
      const list = res.data || [];
      const safeList = Array.isArray(list) ? list : [];
      setAppointments(safeList);
      setTabCounts((prev) => {
        const next = { ...prev, [activeTab]: safeList.length };
        next.total = (activeTab === 'booked' ? safeList.length : next.booked) +
                     (activeTab === 'completed' ? safeList.length : next.completed) +
                     (activeTab === 'cancelled' ? safeList.length : next.cancelled);
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to retrieve appointments ledger');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'booked', label: 'Upcoming Consultations' },
    { id: 'completed', label: 'Completed Encounters' },
    { id: 'cancelled', label: 'Cancelled Records' }
  ];

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const docName = resolveDoctorName(appt.doctorId).toLowerCase();
      const specialty = (appt.doctorId?.specialization || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return docName.includes(q) || specialty.includes(q);
    });
  }, [appointments, searchQuery]);

  const { page, setPage, totalItems, totalPages, paginatedItems, resetPage } = usePagination(
    filteredAppointments,
    10
  );

  useEffect(() => {
    resetPage();
  }, [activeTab, searchQuery]);

  return (
    <ContentContainer className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        subtitle="Manage scheduled consultations, join online appointments, and review past clinical visits."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => navigate('/patient/doctors')}
          >
            Book Consultation
          </Button>
        }
      />

      {/* 2. Interactive KPI Tiles (Click to filter tab) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => setActiveTab('booked')} className="cursor-pointer">
          <StatTile
            label="Upcoming Visits"
            value={tabCounts.booked}
            subtext="Reserved consultation slots"
            icon={CalendarDays}
            color="blue"
            className={activeTab === 'booked' ? 'ring-2 ring-blue-500 shadow-xs' : ''}
          />
        </div>
        <div onClick={() => setActiveTab('completed')} className="cursor-pointer">
          <StatTile
            label="Completed Visits"
            value={tabCounts.completed}
            subtext="Concluded clinical visits"
            icon={CheckCircle2}
            color="green"
            className={activeTab === 'completed' ? 'ring-2 ring-emerald-500 shadow-xs' : ''}
          />
        </div>
        <div onClick={() => setActiveTab('cancelled')} className="cursor-pointer">
          <StatTile
            label="Cancelled Records"
            value={tabCounts.cancelled}
            subtext="Cancelled bookings"
            icon={XCircle}
            color="red"
            className={activeTab === 'cancelled' ? 'ring-2 ring-rose-500 shadow-xs' : ''}
          />
        </div>
        <div>
          <StatTile
            label="Total Bookings"
            value={tabCounts.total}
            subtext="Lifetime consultation history"
            icon={Clock}
            color="purple"
          />
        </div>
      </div>

      {/* 3. Navigation Tabs & Filter Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-1.5 rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700 font-semibold text-xs">
            <span className="text-slate-400 font-medium">Total:</span> {appointments.length}
          </span>
        </div>

        {/* Quick Search */}
        {appointments.length > 2 && (
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by doctor name or specialty..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>
        )}
      </div>

      {/* 3. Appointment List / Timeline Feed */}
      {loading ? (
        <ScheduleSkeleton count={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAppointments} />
      ) : filteredAppointments.length > 0 ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${page}`}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.07
                }
              }
            }}
            className="space-y-4"
          >
            {paginatedItems.map((appt, idx) => {
              const isLast = idx === paginatedItems.length - 1;
              const docName = resolveDoctorName(appt.doctorId);
              const specialty = appt.doctorId?.specialization || 'Clinical Specialist';
              const clinicName = appt.organizationId?.name || 'CareFlow Clinic';
              const isOnline = appt.consultationType === 'online';
              const isLive = appt.status === 'in_progress';
              const isDone = appt.status === 'completed';
              const isCancelled = appt.status === 'cancelled';

              const cardBgClass = isLive
                ? 'bg-gradient-to-r from-teal-50/30 via-white to-white border-teal-300/90 ring-1 ring-teal-200/60 shadow-xs'
                : isDone
                ? 'bg-gradient-to-r from-emerald-50/25 via-white to-white border-slate-200/80 hover:border-emerald-300/80 shadow-xs'
                : isCancelled
                ? 'bg-gradient-to-r from-rose-50/20 via-white to-white border-slate-200/80 hover:border-rose-300/80 shadow-xs'
                : 'bg-gradient-to-r from-blue-50/20 via-white to-white border-slate-200/80 hover:border-blue-300/80 shadow-xs';

              return (
                <motion.div
                  key={appt._id}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
                    }
                  }}
                  className="flex items-start gap-4"
                >
                  {/* Time Indicator Column */}
                  <div className="w-24 sm:w-28 shrink-0 text-right pt-2 font-sans">
                    <span className="text-xs font-bold text-slate-900 block">
                      {formatDate(appt.appointmentDate)}
                    </span>
                    <span className="text-[11px] text-slate-500 block font-medium">
                      {formatTime(appt.startTime)}
                    </span>
                  </div>

                  {/* Vertical Clinical Node Marker */}
                  <div className="flex flex-col items-center shrink-0 self-stretch">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                        isLive
                          ? 'bg-blue-600 border-blue-600 ring-4 ring-blue-100 shadow-xs'
                          : isDone
                          ? 'bg-emerald-600 border-emerald-600 shadow-xs'
                          : isCancelled
                          ? 'bg-rose-500 border-rose-500 shadow-xs'
                          : 'bg-white border-slate-300'
                      }`}
                    />
                    {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1 min-h-[36px]" />}
                  </div>

                  {/* Card Container matching Doctor Portal aesthetic */}
                  <div
                    className={`flex-1 rounded-2xl border transition-all duration-200 p-5 space-y-3 mb-3 hover:shadow-md relative overflow-hidden ${cardBgClass}`}
                  >
                    {/* Status Accent Bar on left */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 ${
                        isDone
                          ? 'bg-emerald-500'
                          : isLive
                          ? 'bg-teal-500'
                          : isCancelled
                          ? 'bg-rose-500'
                          : 'bg-blue-500'
                      }`}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {docName.startsWith('Dr.') ? docName : `Dr. ${docName}`}
                          </h3>
                          {isLive && <PulseIndicator label="Active Consultation" />}
                        </div>
                        <p className="text-xs text-blue-600 font-semibold">{specialty}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{clinicName}</span>
                        </p>
                      </div>

                      <StatusBadge status={appt.status} />
                    </div>

                    {/* Consultation Mode & Actions */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 font-semibold text-[11px] text-slate-700">
                          {isOnline ? (
                            <>
                              <Video className="w-3.5 h-3.5 text-blue-600" />
                              <span className="text-blue-700">Online Consultation</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              <span>In-Clinic Visit</span>
                            </>
                          )}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Duration: {appt.duration || 30} mins
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isOnline && appt.status !== 'cancelled' && (
                          <JoinConsultationButton
                            appointment={appt}
                            compact={true}
                            className="text-xs py-1.5 px-3 rounded-xl"
                          />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/patient/appointments/${appt._id}`)}
                          className="text-xs rounded-xl"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {totalPages > 1 && (
              <div className="pt-4">
                <Pagination
                  currentPage={page}
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={totalItems}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title={
            activeTab === 'booked'
              ? 'Your healthcare timeline is clear'
              : activeTab === 'completed'
              ? 'No completed visits on file'
              : 'No cancelled appointments'
          }
          description={
            activeTab === 'booked'
              ? 'You have no scheduled clinical consultations. Search our accredited specialist roster to book an appointment.'
              : 'Past consultations and clinical notes will be recorded here.'
          }
          actionText={activeTab === 'booked' ? 'Find a Specialist' : null}
          onAction={activeTab === 'booked' ? () => navigate('/patient/doctors') : null}
        />
      )}
    </ContentContainer>
  );
};

export default PatientAppointments;
