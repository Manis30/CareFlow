import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Trash2,
  CalendarCheck,
  CalendarX,
  Users,
  Edit2,
  ChevronRight,
  Building2,
  CheckCircle2,
  Filter,
  X
} from 'lucide-react';
import { getDoctorsApi, deleteDoctorApi } from '../../api/doctor';
import { getAdminAppointmentStatsApi, getAdminAppointmentsApi } from '../../api/appointment';
import { TableSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmModal from '../../components/common/ConfirmModal';
import Pagination from '../../components/common/Pagination';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import StatTile from '../../components/common/StatTile';
import { CareFlowDoctorLeaderboard, CareFlowDotPlot, CLINICAL_COLORS } from '../../components/amcharts';
import { DateRangePicker } from '../../components/common/DateRangePicker';
import { ActiveFilterChip } from '../../components/common/ActiveFilterChip';
import usePagination from '../../hooks/usePagination';
import { formatDoctorName } from '../../utils/formatName';
import { formatCurrency } from '../../utils/formatters';
import {
  TableContainer,
  Table,
  TableHeader,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell
} from '../../components/common/Table';

export const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [dateRange, setDateRange] = useState({ key: 'ALL', label: 'All Time' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, doctor: null });
  const [actionLoading, setActionLoading] = useState(false);

  const navigate = useNavigate();

  // Keyboard shortcut: ESC clears active filters
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClearAllFilters();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      setError('');
      const [res, statsRes, apptRes] = await Promise.allSettled([
        getDoctorsApi(),
        getAdminAppointmentStatsApi(),
        getAdminAppointmentsApi({ limit: 300 })
      ]);

      if (res.status === 'fulfilled') {
        const docsList = res.value?.data?.doctors || res.value?.data || (Array.isArray(res.value) ? res.value : []);
        setDoctors(Array.isArray(docsList) ? docsList : []);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        setStats(statsRes.value.data);
      }
      if (apptRes.status === 'fulfilled' && apptRes.value?.data) {
        const aList = apptRes.value.data.appointments || apptRes.value.data || (Array.isArray(apptRes.value.data) ? apptRes.value.data : []);
        setAppointments(Array.isArray(aList) ? aList : []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load clinic doctors');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.doctor) return;
    try {
      setActionLoading(true);
      await deleteDoctorApi(deleteModal.doctor._id);
      setDeleteModal({ isOpen: false, doctor: null });
      fetchDoctors();
    } catch (err) {
      alert(err.message || 'Failed to deactivate doctor');
    } finally {
      setActionLoading(false);
    }
  };

  const getDoctorInitials = (doc) => {
    const rawName = doc.userId?.name || doc.name || '';
    if (!rawName) return 'DR';
    const parts = rawName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return rawName.slice(0, 2).toUpperCase();
  };

  const getDoctorDepartmentNames = (doc) => {
    if (!doc) return 'General';
    if (Array.isArray(doc.departmentIds) && doc.departmentIds.length > 0) {
      const names = doc.departmentIds
        .map((d) => (typeof d === 'object' && d?.name ? d.name : d))
        .filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    if (Array.isArray(doc.departments) && doc.departments.length > 0) {
      return doc.departments.join(', ');
    }
    if (typeof doc.departmentId === 'object' && doc.departmentId?.name) {
      return doc.departmentId.name;
    }
    if (typeof doc.departmentId === 'string' && doc.departmentId.trim()) {
      return doc.departmentId;
    }
    return 'General';
  };

  const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  const isDoctorAvailableToday = (doc) => {
    const isActive = doc.userId?.isActive !== false;
    if (!isActive) return false;
    const schedule = Array.isArray(doc.available) ? doc.available : [];
    const todayItem = schedule.find(
      (a) => (a.day || a.dayOfWeek || a.dayName || '').toLowerCase() === todayWeekday
    );
    return Boolean(todayItem?.isAvailable);
  };

  // Date-filtered Appointments for accurate clinician analytics
  const filteredAppointments = useMemo(() => {
    if (!appointments || appointments.length === 0) return [];
    if (!dateRange?.startDate) return appointments;
    const start = new Date(dateRange.startDate).getTime();
    const end = dateRange.endDate ? new Date(`${dateRange.endDate}T23:59:59.999Z`).getTime() : Infinity;
    return appointments.filter((a) => {
      const d = new Date(a.appointmentDate || a.createdAt).getTime();
      return d >= start && d <= end;
    });
  }, [appointments, dateRange]);

  // 1. Clinician Performance Leaderboard (100% Truthful Data from real appointments / stats)
  const leaderboardDoctors = useMemo(() => {
    if (!doctors || doctors.length === 0) return [];

    const docApptMap = {};
    if (filteredAppointments.length > 0) {
      filteredAppointments.forEach((a) => {
        const dId = String(a.doctorId?._id || a.doctorId || '');
        if (!dId) return;
        if (!docApptMap[dId]) {
          docApptMap[dId] = { total: 0, completed: 0, revenue: 0 };
        }
        docApptMap[dId].total += 1;
        if (a.status === 'completed') {
          docApptMap[dId].completed += 1;
        }
        const fee = Number(a.paymentId?.amount || a.consultationFee || 0);
        if (fee > 0 && (a.status === 'completed' || a.paymentStatus === 'paid')) {
          docApptMap[dId].revenue += fee;
        }
      });
    }

    const revList = Array.isArray(stats?.doctorRevenueThisMonth) ? stats.doctorRevenueThisMonth : [];
    const revMap = {};
    revList.forEach((r) => {
      const dId = String(r.doctorId || r._id || '');
      if (dId) revMap[dId] = r;
    });

    return doctors.map((doc) => {
      const id = String(doc._id || doc.id || '');
      const name = formatDoctorName(doc.userId?.name || doc.name || 'Doctor');
      const dept = getDoctorDepartmentNames(doc);
      const apptStat = docApptMap[id];
      const stat = revMap[id];

      // Exact values: prefer filtered appointments cohort, fallback to exact backend stat
      const appts = apptStat ? apptStat.total : Number(stat?.totalAppointments || 0);
      const comp = apptStat ? apptStat.completed : Number(stat?.paidAppointments || 0);
      const rev = apptStat && apptStat.revenue > 0
        ? apptStat.revenue
        : Number(stat?.revenue || stat?.totalRevenue || 0);

      return {
        id,
        name,
        specialization: dept,
        appointments: appts,
        completed: comp,
        revenue: rev,
        completionRate: appts > 0 ? Math.round((comp / appts) * 100) : 0,
        fee: doc.consultationFee || 500,
        rating: doc.rating || 4.8
      };
    });
  }, [doctors, stats, filteredAppointments]);

  // 2. Clinician Consultation Volume vs Real Clinic Benchmark (Dot Plot)
  const dotPlotItems = useMemo(() => {
    return leaderboardDoctors.map((doc) => ({
      id: doc.id,
      label: doc.name,
      value: doc.appointments,
      sublabel: doc.specialization
    }));
  }, [leaderboardDoctors]);

  const uniqueDepartmentsCount = useMemo(() => {
    const set = new Set();
    doctors.forEach((d) => set.add(getDoctorDepartmentNames(d)));
    return set.size;
  }, [doctors]);

  const onDutyCount = useMemo(
    () => doctors.filter(isDoctorAvailableToday).length,
    [doctors]
  );

  const activeCount = useMemo(
    () => doctors.filter((d) => d.userId?.isActive !== false).length,
    [doctors]
  );

  const filteredDoctors = doctors.filter((doc) => {
    if (selectedDoctorId) {
      if (String(doc._id) !== String(selectedDoctorId)) return false;
    }
    if (selectedDepartment) {
      const dName = getDoctorDepartmentNames(doc);
      if (!dName.toLowerCase().includes(selectedDepartment.toLowerCase())) return false;
    }
    if (filter === 'available_today') return isDoctorAvailableToday(doc);
    if (filter === 'unavailable_today') return !isDoctorAvailableToday(doc);
    return true;
  });

  const {
    page,
    setPage,
    totalItems,
    totalPages,
    paginatedItems,
    resetPage
  } = usePagination(filteredDoctors, 10);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    resetPage();
  };

  // Active Cross-Filters
  const activeFiltersList = useMemo(() => {
    const list = [];
    if (selectedDoctorId) {
      const doc = doctors.find((d) => String(d._id) === String(selectedDoctorId));
      list.push({
        label: `Clinician: ${formatDoctorName(doc?.userId?.name || doc?.name || 'Selected Doctor')}`,
        onRemove: () => {
          setSelectedDoctorId(null);
          resetPage();
        }
      });
    }
    if (selectedDepartment) {
      list.push({
        label: `Department: ${selectedDepartment}`,
        onRemove: () => {
          setSelectedDepartment(null);
          resetPage();
        }
      });
    }
    if (filter === 'available_today') {
      list.push({
        label: 'Status: On Duty Today',
        onRemove: () => handleFilterChange('all')
      });
    } else if (filter === 'unavailable_today') {
      list.push({
        label: 'Status: Off Roster',
        onRemove: () => handleFilterChange('all')
      });
    }
    if (dateRange?.key && dateRange.key !== 'ALL') {
      list.push({
        label: `Window: ${dateRange.label || dateRange.key}`,
        onRemove: () => setDateRange({ key: 'ALL', label: 'All Time' })
      });
    }
    return list;
  }, [selectedDoctorId, selectedDepartment, filter, dateRange, doctors]);

  const handleClearAllFilters = () => {
    setSelectedDoctorId(null);
    setSelectedDepartment(null);
    setFilter('all');
    setDateRange({ key: 'ALL', label: 'All Time' });
    resetPage();
  };

  const doctorLoadSparklines = useMemo(() => {
    const vals = leaderboardDoctors.map((d) => d.appointments).filter((v) => v !== undefined);
    return vals.length >= 2 ? vals : undefined;
  }, [leaderboardDoctors]);

  return (
    <ContentContainer maxWidth="7xl" className="space-y-6">
      {/* Subtitle & Actions */}
      <PageHeader
        subtitle="Manage clinic medical specialists, department assignments, and consultation fees."
        actions={
          <div className="flex items-center gap-3">
            <DateRangePicker
              value={dateRange.key}
              onChange={(range) => setDateRange(range)}
            />
            <Button
              variant="primary"
              icon={UserPlus}
              onClick={() => navigate('/admin/doctors/add')}
            >
              Register Clinician
            </Button>
          </div>
        }
      />

      {/* 1. KPIs Strip (4 indicators) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile
          index={0}
          label="Total Clinicians"
          value={doctors.length}
          subtext="Registered practitioners"
          icon={Users}
          color="blue"
          sparklineData={doctorLoadSparklines}
        />
        <StatTile
          index={1}
          label="On Duty Today"
          value={onDutyCount}
          subtext={`${doctors.length - onDutyCount} off roster`}
          icon={CalendarCheck}
          color="green"
        />
        <StatTile
          index={2}
          label="Clinical Departments"
          value={uniqueDepartmentsCount}
          subtext="Represented disciplines"
          icon={Building2}
          color="purple"
        />
        <StatTile
          index={3}
          label="Active Status"
          value={activeCount}
          subtext="Operational practitioners"
          icon={CheckCircle2}
          color="indigo"
        />
      </div>

      {/* 2. Visual Analytics: Clinician Leaderboard (7 cols) & Volume Benchmark Dot Plot (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 flex flex-col">
          <CareFlowDoctorLeaderboard
            title="Clinician Performance & Load Leaderboard"
            subtitle="Switch operational metrics and click any clinician to filter the registry below"
            doctors={leaderboardDoctors}
            activeDoctorId={selectedDoctorId}
            className="h-full"
            onDoctorClick={(d) => {
              setSelectedDoctorId((prev) => (prev === d.id ? null : d.id));
              resetPage();
            }}
            limit={6}
          />
        </div>

        <div className="lg:col-span-5 flex flex-col">
          <CareFlowDotPlot
            title="Practitioner Consultation Volume"
            subtitle="Individual volume evaluated against dynamic clinic benchmark"
            items={dotPlotItems}
            benchmarkLabel="Clinic Average"
            selectedItem={selectedDoctorId}
            className="h-full"
            onItemClick={(item) => {
              setSelectedDoctorId((prev) => (prev === item.id ? null : item.id));
              resetPage();
            }}
            unit="cases"
          />
        </div>
      </div>

      {/* Active Cross-Filter Chips */}
      <ActiveFilterChip
        filters={activeFiltersList}
        onClearAll={handleClearAllFilters}
      />

      {/* 3. Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleFilterChange('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-bold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>All Clinicians</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/60 text-slate-700 font-bold">
            {doctors.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange('available_today')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            filter === 'available_today'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs font-bold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          <span>On Duty Today</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
            {onDutyCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange('unavailable_today')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            filter === 'unavailable_today'
              ? 'bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs font-bold'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CalendarX className="w-3.5 h-3.5" />
          <span>Off Duty Today</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/60 text-slate-700 font-bold">
            {doctors.length - onDutyCount}
          </span>
        </button>
      </div>

      {/* 4. Table */}
      {loading ? (
        <TableSkeleton rows={8} columns={9} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDoctors} />
      ) : filteredDoctors.length === 0 ? (
        <EmptyState
          title="No Clinicians Found"
          description={
            filter === 'all'
              ? "Select 'Register Clinician' to add medical specialists to your organization."
              : 'No doctors match the selected availability filter.'
          }
          actionText={filter === 'all' ? 'Register Clinician' : undefined}
          onAction={filter === 'all' ? () => navigate('/admin/doctors/add') : undefined}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHeadCell align="left" className="w-14">Profile</TableHeadCell>
                <TableHeadCell align="left">Clinician</TableHeadCell>
                <TableHeadCell align="left">Specialization</TableHeadCell>
                <TableHeadCell align="left">Department</TableHeadCell>
                <TableHeadCell align="left">Email</TableHeadCell>
                <TableHeadCell align="left">Phone</TableHeadCell>
                <TableHeadCell align="left">Fee</TableHeadCell>
                <TableHeadCell align="center">Status</TableHeadCell>
                <TableHeadCell align="right">Actions</TableHeadCell>
              </tr>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((doc) => {
                const doctorName = doc.userId?.name || doc.name || 'Doctor';
                const doctorEmail = doc.userId?.email || doc.email || 'N/A';
                const doctorPhone = doc.userId?.phone || doc.phone || 'N/A';
                const profileUrl = doc.userId?.profileImage?.url || doc.profileImage?.url;
                const isActive = doc.userId?.isActive !== false;

                return (
                  <TableRow
                    key={doc._id}
                    onClick={() => navigate(`/admin/doctors/${doc._id}`)}
                    hoverable={true}
                  >
                    <TableCell align="left">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0 overflow-hidden shadow-2xs">
                        {profileUrl ? (
                          <img
                            src={profileUrl}
                            alt={doctorName}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                        <span className={profileUrl ? 'hidden' : 'block'}>
                          {getDoctorInitials(doc)}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell align="left" variant="primary">
                      <span className="font-bold text-slate-900 truncate">
                        {formatDoctorName(doctorName)}
                      </span>
                    </TableCell>

                    <TableCell align="left" variant="secondary">
                      <span className="text-blue-600 font-semibold">
                        {doc.specialization || 'Clinical Specialist'}
                      </span>
                    </TableCell>

                    <TableCell align="left" variant="secondary">
                      <span className="text-slate-700 font-medium">
                        {getDoctorDepartmentNames(doc)}
                      </span>
                    </TableCell>

                    <TableCell align="left" variant="secondary">
                      <span className="text-slate-500 font-mono text-[11px] truncate">
                        {doctorEmail}
                      </span>
                    </TableCell>

                    <TableCell align="left" variant="secondary">
                      <span className="text-slate-500 text-xs">
                        {doctorPhone}
                      </span>
                    </TableCell>

                    <TableCell align="left" variant="primary">
                      <span className="font-semibold text-slate-900">
                        {doc.consultationFee ? formatCurrency(doc.consultationFee) : '—'}
                      </span>
                    </TableCell>

                    <TableCell align="center">
                      <StatusBadge status={isActive ? 'active' : 'suspended'} />
                    </TableCell>

                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/doctors/${doc._id}/edit`)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Edit Clinician"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal({ isOpen: true, doctor: doc })}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Deactivate Clinician"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/doctors/${doc._id}`)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="px-4 py-3 border-t border-slate-100">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              limit={10}
              onPageChange={setPage}
            />
          </div>
        </TableContainer>
      )}

      {/* Confirm Deactivate Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, doctor: null })}
        onConfirm={handleDelete}
        title="Deactivate Clinician"
        message={`Are you sure you want to deactivate Dr. ${
          deleteModal.doctor?.userId?.name || deleteModal.doctor?.name || ''
        }? They will no longer appear for active appointment bookings.`}
        confirmText="Deactivate"
        variant="danger"
        loading={actionLoading}
      />
    </ContentContainer>
  );
};

export default Doctors;
