import React, { useEffect, useState, useMemo } from 'react';
import { getAdminAppointmentsApi } from '../../api/appointment';
import { TableSkeleton, KpiSkeleton, ChartSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import PatientAvatar from '../../components/common/PatientAvatar';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import StatTile from '../../components/common/StatTile';
import { CareFlowTrendChart, CareFlowRankChart, CLINICAL_COLORS } from '../../components/amcharts';
import { calculateNewVsReturningSplit } from '../../utils/clinicalCalculations';
import usePagination from '../../hooks/usePagination';
import {
  TableContainer,
  Table,
  TableHeader,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  CompletedVisitsBadge
} from '../../components/common/Table';
import { Users, CheckCircle2, Building2, Activity, Filter, X } from 'lucide-react';

export const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedDept, setSelectedDept] = useState(null);

  const filteredPatients = useMemo(() => {
    if (!selectedDept) return patients;
    return patients.filter((p) => p.departments && p.departments.has(selectedDept));
  }, [patients, selectedDept]);

  const { page, setPage, totalItems, totalPages, paginatedItems, resetPage } = usePagination(filteredPatients, 10);

  // Keyboard shortcut: ESC clears active department filter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedDept(null);
        resetPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchClinicPatients();
  }, []);

  const fetchClinicPatients = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getAdminAppointmentsApi({ limit: 1000 });
      const rawAppointments = res.data?.appointments || [];
      setAppointments(rawAppointments);

      if (rawAppointments.length > 0) {
        const uniquePatientsMap = new Map();

        rawAppointments.forEach((appt) => {
          if (appt.patientId && appt.patientId._id) {
            const patId = appt.patientId._id;
            if (!uniquePatientsMap.has(patId)) {
              uniquePatientsMap.set(patId, {
                ...appt.patientId,
                visitsCount: 0,
                departments: new Set()
              });
            }

            const existing = uniquePatientsMap.get(patId);
            if (appt.departmentId?.name) {
              existing.departments.add(appt.departmentId.name);
            }
            if (appt.status === 'completed') {
              existing.visitsCount += 1;
            }
          }
        });

        setPatients(Array.from(uniquePatientsMap.values()));
      } else {
        setPatients([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch clinic patients');
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const totalCompletedVisits = useMemo(() => {
    return patients.reduce((sum, p) => sum + (p.visitsCount || 0), 0);
  }, [patients]);

  const uniqueDepartmentsCount = useMemo(() => {
    const set = new Set();
    appointments.forEach((a) => {
      if (a.departmentId?.name) set.add(a.departmentId.name);
    });
    return set.size || 1;
  }, [appointments]);

  const activeTreatedPatients = useMemo(() => {
    return patients.filter((p) => p.visitsCount > 0).length;
  }, [patients]);

  // Analytics: Overall Patient Encounter Activity over time
  const visitActivityData = useMemo(() => {
    if (!appointments || appointments.length === 0) return [];
    const monthCounts = {};
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
    const now = new Date();

    // Determine earliest recorded encounter date (defaulting back at least 6 months for a rich monthly timeline)
    let minDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    appointments.forEach((a) => {
      if (!a.appointmentDate) return;
      const d = new Date(a.appointmentDate);
      if (isNaN(d.getTime())) return;
      if (d < minDate) {
        minDate = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[k] = (monthCounts[k] || 0) + 1;
    });

    const timeline = [];
    const maxDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

    while (curr <= maxDate) {
      const k = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
      timeline.push({
        date: monthFormatter.format(curr),
        count: monthCounts[k] || 0
      });
      curr.setMonth(curr.getMonth() + 1);
    }

    return timeline;
  }, [appointments]);

  // Analytics: Visits by Department
  const visitsByDeptData = useMemo(() => {
    if (!appointments || appointments.length === 0) return [];
    const deptCounts = {};
    appointments.forEach((a) => {
      const dept = a.departmentId?.name || 'General';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });
    return Object.entries(deptCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [appointments]);

  // Analytics: New vs. Returning Patient Split
  const newVsReturning = useMemo(() => {
    return calculateNewVsReturningSplit({ patients, appointments });
  }, [patients, appointments]);

  return (
    <ContentContainer maxWidth="7xl" className="space-y-6">
      <PageHeader
        subtitle="Catalog of unique patients with clinical consultation records at this facility."
        actions={
          <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 shadow-2xs">
            {patients.length} Registered Patient{patients.length === 1 ? '' : 's'}
          </span>
        }
      />

      {/* 1. KPIs Strip (4 indicators) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile
          index={0}
          label="Total Patients"
          value={patients.length}
          subtext="Unique clinical cohort"
          icon={Users}
          color="blue"
        />
        <StatTile
          index={1}
          label="Completed Visits"
          value={totalCompletedVisits}
          subtext="Concluded encounters"
          icon={CheckCircle2}
          color="green"
        />
        <StatTile
          index={2}
          label="Departments Visited"
          value={uniqueDepartmentsCount}
          subtext="Clinical specialty reach"
          icon={Building2}
          color="purple"
        />
        <StatTile
          index={3}
          label="Active In-Care"
          value={activeTreatedPatients}
          subtext="Completed ≥ 1 visit"
          icon={Activity}
          color="indigo"
        />
      </div>

      {/* 2. Visual Analytics: Visit Activity (Trend) & Visits by Department (Rank Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6">
          <CareFlowTrendChart
            title="Patient Encounter Activity"
            subtitle="Overall monthly consultation encounter volume"
            data={visitActivityData}
            categoryField="date"
            series={[{ key: 'count', name: 'Encounters', color: CLINICAL_COLORS.primary }]}
            height={220}
          />
        </div>

        <div className="lg:col-span-6">
          <CareFlowRankChart
            title="Encounters by Clinical Department"
            subtitle="Distribution of patient volume across departments (click to filter)"
            data={visitsByDeptData}
            categoryField="name"
            valueField="value"
            selectedItem={selectedDept}
            barColor={CLINICAL_COLORS.primary}
            height={220}
            onItemClick={(item) => {
              setSelectedDept((prev) => (prev === item.name ? null : item.name));
              resetPage();
            }}
          />
        </div>
      </div>

      {/* 3. New vs. Returning Cohort Intelligence Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              Patient Cohort Loyalty: New vs. Returning Intake
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Proportional distribution of first-time clinical visits vs established recurring patients
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              New Patients: {newVsReturning.newCount} ({newVsReturning.newPct}%)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Returning Patients: {newVsReturning.returningCount} ({newVsReturning.returningPct}%)
            </span>
          </div>
        </div>

        {/* 100% Proportional Stacked Rail */}
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5 shadow-inner">
          <div
            style={{ width: `${newVsReturning.newPct}%` }}
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            title={`New Patients: ${newVsReturning.newCount} (${newVsReturning.newPct}%)`}
          />
          <div
            style={{ width: `${newVsReturning.returningPct}%` }}
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            title={`Returning Patients: ${newVsReturning.returningCount} (${newVsReturning.returningPct}%)`}
          />
        </div>
      </div>

      {/* Active Filter Pill if selected */}
      {selectedDept && (
        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-slate-600 font-medium">Department Filter:</span>
            <span className="font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200">
              {selectedDept}
            </span>
            <span className="text-slate-500 hidden sm:inline">
              ({filteredPatients.length} matching patients)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedDept(null);
              resetPage();
            }}
            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer text-xs"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* 3. Table */}
      {loading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchClinicPatients} />
      ) : patients.length === 0 ? (
        <EmptyState
          title="No Patients Registered"
          description="Patients will appear here automatically after booking appointments with your organization."
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHeadCell align="left">Patient Name</TableHeadCell>
                <TableHeadCell align="left">Email Address</TableHeadCell>
                <TableHeadCell align="left">Phone</TableHeadCell>
                <TableHeadCell align="left">Gender</TableHeadCell>
                <TableHeadCell align="center">Completed Visits</TableHeadCell>
              </tr>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((pat) => {
                const name = pat.name || pat.userId?.name || 'Patient';
                const email = pat.email || pat.userId?.email || 'N/A';
                const phone = pat.phone || pat.userId?.phone || 'N/A';
                const gender = pat.gender || 'N/A';

                return (
                  <TableRow key={pat._id} hoverable={true}>
                    <TableCell align="left" variant="primary">
                      <div className="flex items-center gap-3">
                        <PatientAvatar patient={pat} name={name} size="sm" />
                        <span className="font-bold text-slate-900 truncate">{name}</span>
                      </div>
                    </TableCell>
                    <TableCell align="left" variant="secondary">
                      <span className="text-slate-600 font-medium">{email}</span>
                    </TableCell>
                    <TableCell align="left" variant="secondary">
                      <span className="text-slate-600 font-medium">{phone}</span>
                    </TableCell>
                    <TableCell align="left" variant="secondary">
                      <span className="capitalize text-slate-700 font-medium">{gender}</span>
                    </TableCell>
                    <TableCell align="center">
                      <CompletedVisitsBadge count={pat.visitsCount || 0} />
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
    </ContentContainer>
  );
};

export default Patients;
