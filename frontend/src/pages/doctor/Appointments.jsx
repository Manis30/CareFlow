import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  Video,
  MapPin,
  Search,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import {
  getDoctorTodayAppointmentsApi,
  getDoctorUpcomingAppointmentsApi,
  getDoctorCompletedAppointmentsApi,
  getDoctorCancelledAppointmentsApi
} from '../../api/appointment';
import { ScheduleSkeleton } from '../../components/common/Skeleton';
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
import DoctorAppointmentCard from '../../components/appointment/DoctorAppointmentCard';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';

export const DoctorAppointments = () => {
  const [activeTab, setActiveTab] = useState('today');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all'); // 'all' | 'online' | 'in_person'
  const [tabCounts, setTabCounts] = useState({
    today: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchInitialCounts();
  }, []);

  const fetchInitialCounts = async () => {
    try {
      const [todayRes, upRes, compRes, cancRes] = await Promise.allSettled([
        getDoctorTodayAppointmentsApi(),
        getDoctorUpcomingAppointmentsApi(),
        getDoctorCompletedAppointmentsApi(),
        getDoctorCancelledAppointmentsApi()
      ]);
      setTabCounts({
        today: todayRes.status === 'fulfilled' ? (todayRes.value?.data?.length || 0) : 0,
        upcoming: upRes.status === 'fulfilled' ? (upRes.value?.data?.length || 0) : 0,
        completed: compRes.status === 'fulfilled' ? (compRes.value?.data?.length || 0) : 0,
        cancelled: cancRes.status === 'fulfilled' ? (cancRes.value?.data?.length || 0) : 0
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTabAppointments();
  }, [activeTab]);

  const fetchTabAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      let res;
      if (activeTab === 'today') {
        res = await getDoctorTodayAppointmentsApi();
      } else if (activeTab === 'upcoming') {
        res = await getDoctorUpcomingAppointmentsApi();
      } else if (activeTab === 'completed') {
        res = await getDoctorCompletedAppointmentsApi();
      } else if (activeTab === 'cancelled') {
        res = await getDoctorCancelledAppointmentsApi();
      }
      const list = res?.data || [];
      const safeList = Array.isArray(list) ? list : [];
      setAppointments(safeList);
      setTabCounts((prev) => ({ ...prev, [activeTab]: safeList.length }));
    } catch (err) {
      setError(err.message || 'Failed to retrieve appointment schedule');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'today', label: "Today's Consultations" },
    { id: 'upcoming', label: 'Upcoming Schedule' },
    { id: 'completed', label: 'Completed Visits' },
    { id: 'cancelled', label: 'Cancelled Records' }
  ];

  // Filtered appointments by search and channel
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const patientName = (
        appt.patientId?.userId?.name ||
        appt.patientId?.name ||
        appt.patientName ||
        'Patient'
      ).toLowerCase();
      const reason = (appt.reason || '').toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        patientName.includes(searchQuery.toLowerCase()) ||
        reason.includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (channelFilter === 'all') return true;
      return appt.consultationType === channelFilter;
    });
  }, [appointments, searchQuery, channelFilter]);

  const { page, setPage, totalItems, totalPages, paginatedItems, resetPage } = usePagination(
    filteredAppointments,
    10
  );

  useEffect(() => {
    resetPage();
  }, [activeTab, searchQuery, channelFilter]);

  // Statistics for the current tab
  const videoCount = useMemo(
    () => appointments.filter((a) => a.consultationType === 'online').length,
    [appointments]
  );
  const inPersonCount = appointments.length - videoCount;

  return (
    <ContentContainer className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        subtitle="Manage daily consultations, review patient details, access shared medical records, and conduct online video consultations."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/doctor/availability')}
              icon={Clock}
              className="text-xs rounded-xl"
            >
              Operating Hours
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/doctor/dashboard')}
              className="text-xs rounded-xl shadow-xs"
            >
              Clinical Dashboard
            </Button>
          </div>
        }
      />

      {/* 2. Quick Clinical KPI Tiles (Interactive tab filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => setActiveTab('today')} className="cursor-pointer">
          <StatTile
            label="Today's Sessions"
            value={tabCounts.today}
            subtext="Active today's consultations"
            icon={Clock}
            color="blue"
            className={activeTab === 'today' ? 'ring-2 ring-blue-500 shadow-xs' : ''}
          />
        </div>
        <div onClick={() => setActiveTab('upcoming')} className="cursor-pointer">
          <StatTile
            label="Upcoming Schedule"
            value={tabCounts.upcoming}
            subtext="Future patient bookings"
            icon={CalendarDays}
            color="indigo"
            className={activeTab === 'upcoming' ? 'ring-2 ring-indigo-500 shadow-xs' : ''}
          />
        </div>
        <div onClick={() => setActiveTab('completed')} className="cursor-pointer">
          <StatTile
            label="Completed Visits"
            value={tabCounts.completed}
            subtext="Concluded clinical records"
            icon={CheckCircle2}
            color="green"
            className={activeTab === 'completed' ? 'ring-2 ring-emerald-500 shadow-xs' : ''}
          />
        </div>
        <div onClick={() => setActiveTab('cancelled')} className="cursor-pointer">
          <StatTile
            label="Cancelled Records"
            value={tabCounts.cancelled}
            subtext="Cancelled or voided slots"
            icon={XCircle}
            color="red"
            className={activeTab === 'cancelled' ? 'ring-2 ring-rose-500 shadow-xs' : ''}
          />
        </div>
      </div>

      {/* 3. Navigation Tabs & Summary Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          {/* Tab buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-1.5 rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-semibold">
              <span className="text-slate-400 font-normal">Total:</span> {appointments.length}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 font-semibold">
              <Video className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-blue-500 font-normal">Video:</span> {videoCount}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400 font-normal">In-Clinic:</span> {inPersonCount}
            </span>
          </div>
        </div>

        {/* Search and Channel Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient name, ID or complaint..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50/70 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Channel:
            </span>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Channels</option>
              <option value="online">Online Video Only</option>
              <option value="in_person">In-Clinic Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Appointment List / Ledger */}
      {loading ? (
        <ScheduleSkeleton rows={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTabAppointments} />
      ) : filteredAppointments.length > 0 ? (
        <div className="space-y-4">
          <div className="space-y-4">
            {paginatedItems.map((appt, idx) => {
              const isLive = appt.status === 'in_progress' || appt.status === 'in-progress';
              const isDone = appt.status === 'completed';
              const isLast = idx === paginatedItems.length - 1;

              return (
                <div key={appt._id} className="flex items-start gap-3 sm:gap-5 group">
                  {/* Time / Date Indicator Column */}
                  <div className="w-20 sm:w-24 shrink-0 text-right pt-3 font-sans hidden sm:block">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {formatDate(appt.appointmentDate)}
                    </span>
                    <span className="text-[11px] text-slate-500 block font-medium">
                      {formatTime(appt.startTime)}
                    </span>
                  </div>

                  {/* Vertical Clinical Timeline Node Connector */}
                  <div className="flex flex-col items-center shrink-0 self-stretch pt-3.5">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                        isLive
                          ? 'bg-blue-600 border-blue-600 ring-4 ring-blue-100 shadow-xs'
                          : isDone
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'bg-white border-slate-300'
                      }`}
                    />
                    {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1 min-h-[48px]" />}
                  </div>

                  {/* Connected Card */}
                  <div className="flex-1 min-w-0">
                    <DoctorAppointmentCard
                      appointment={appt}
                      index={idx}
                      onOpenConsultation={(id) => navigate(`/doctor/appointments/${id}`)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
              />
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title={
            searchQuery
              ? 'No appointments matched your query'
              : activeTab === 'today'
              ? 'Your schedule is clear today'
              : activeTab === 'upcoming'
              ? 'No upcoming patient bookings in queue'
              : activeTab === 'completed'
              ? 'No completed visit records found'
              : 'No cancelled appointments'
          }
          description={
            searchQuery
              ? 'Try resetting the search terms or changing the channel filter.'
              : 'New patient bookings will appear here chronologically as appointments are scheduled.'
          }
        />
      )}
    </ContentContainer>
  );
};

export default DoctorAppointments;
