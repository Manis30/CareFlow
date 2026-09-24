import React, { useEffect, useState, useMemo } from 'react';
import { CreditCard, CheckCircle2, Clock, DollarSign, RotateCcw } from 'lucide-react';
import { getClinicPaymentsApi } from '../../api/payment';
import { getDepartmentsApi } from '../../api/department';
import { getDoctorsApi } from '../../api/doctor';
import { TableSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import Select from '../../components/common/Select';
import Pagination from '../../components/common/Pagination';
import Button from '../../components/common/Button';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import StatTile from '../../components/common/StatTile';
import {
  CareFlowTrendChart,
  CareFlowStatusChart,
  CareFlowSankey,
  CLINICAL_COLORS
} from '../../components/amcharts';
import { DateRangePicker } from '../../components/common/DateRangePicker';
import { ActiveFilterChip } from '../../components/common/ActiveFilterChip';
import {
  TableContainer,
  Table,
  TableHeader,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell
} from '../../components/common/Table';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { formatCurrency, formatDoctorName } from '../../utils/formatters';

export const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [allPaymentsList, setAllPaymentsList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateRange, setDateRange] = useState({ key: 'ALL', label: 'All Time' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  // Keyboard shortcut: ESC clears active filters
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setStatusFilter('all');
        setDepartmentFilter('');
        setDoctorFilter('');
        setDateRange({ key: 'ALL', label: 'All Time' });
        setCurrentPage(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchDropdownOptions();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchPayments();
  }, [statusFilter, departmentFilter, doctorFilter]);

  const fetchDropdownOptions = async () => {
    try {
      const [deptRes, docRes] = await Promise.allSettled([
        getDepartmentsApi(),
        getDoctorsApi()
      ]);

      if (deptRes.status === 'fulfilled') {
        const dList = deptRes.value.data || (Array.isArray(deptRes.value) ? deptRes.value : []);
        setDepartments(Array.isArray(dList) ? dList : []);
      }

      if (docRes.status === 'fulfilled') {
        const docList = docRes.value.data || (Array.isArray(docRes.value) ? docRes.value : []);
        setDoctors(Array.isArray(docList) ? docList : []);
      }
    } catch (err) {
      console.error('Failed to load dropdown filter options:', err);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError('');

      const activeParams = {
        status: statusFilter,
        departmentId: departmentFilter,
        doctorId: doctorFilter
      };

      const allParams = {
        status: 'all',
        departmentId: departmentFilter,
        doctorId: doctorFilter
      };

      const [resFiltered, resAll] = await Promise.all([
        getClinicPaymentsApi(activeParams),
        getClinicPaymentsApi(allParams)
      ]);

      const listFiltered = resFiltered.data || (Array.isArray(resFiltered) ? resFiltered : []);
      const listAll = resAll.data || (Array.isArray(resAll) ? resAll : []);

      setPayments(Array.isArray(listFiltered) ? listFiltered : []);
      setAllPaymentsList(Array.isArray(listAll) ? listAll : []);
    } catch (err) {
      setError(err.message || 'Failed to load clinic payment history');
    } finally {
      setLoading(false);
    }
  };

  // Date Filtering on Payment Collections
  const dateFilteredAllPayments = useMemo(() => {
    if (!allPaymentsList || allPaymentsList.length === 0) return [];
    if (!dateRange?.startDate) return allPaymentsList;
    const start = new Date(dateRange.startDate).getTime();
    const end = dateRange.endDate ? new Date(`${dateRange.endDate}T23:59:59.999Z`).getTime() : Infinity;
    return allPaymentsList.filter((p) => {
      const raw = p.paidAt || p.createdAt;
      if (!raw) return true;
      const d = new Date(raw).getTime();
      return d >= start && d <= end;
    });
  }, [allPaymentsList, dateRange]);

  const dateFilteredPayments = useMemo(() => {
    if (!payments || payments.length === 0) return [];
    if (!dateRange?.startDate) return payments;
    const start = new Date(dateRange.startDate).getTime();
    const end = dateRange.endDate ? new Date(`${dateRange.endDate}T23:59:59.999Z`).getTime() : Infinity;
    return payments.filter((p) => {
      const raw = p.paidAt || p.createdAt;
      if (!raw) return true;
      const d = new Date(raw).getTime();
      return d >= start && d <= end;
    });
  }, [payments, dateRange]);

  // KPIs
  const totalPaidAmount = useMemo(() => {
    return dateFilteredAllPayments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [dateFilteredAllPayments]);

  const totalPendingAmount = useMemo(() => {
    return dateFilteredAllPayments
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [dateFilteredAllPayments]);

  const totalGrossRevenue = totalPaidAmount + totalPendingAmount;

  // Visual Analytics 1: Multi-Series Revenue Settlement Trend (Paid vs Pending) - Monthly Timeline
  const revenueActivityData = useMemo(() => {
    if (!dateFilteredAllPayments || dateFilteredAllPayments.length === 0) return [];
    const monthKeyMap = {};
    const monthData = {};
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
    const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    dateFilteredAllPayments.forEach((pmt) => {
      const rawDate = pmt.paidAt || pmt.createdAt;
      if (!rawDate) return;
      const d = new Date(rawDate);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (k > currentMonthKey) return;

      if (!monthKeyMap[k]) {
        monthKeyMap[k] = monthFormatter.format(d);
        monthData[k] = { date: monthFormatter.format(d), paid: 0, pending: 0, count: 0 };
      }

      const amt = Number(pmt.amount) || 0;
      monthData[k].count += 1;
      if (pmt.status === 'paid') {
        monthData[k].paid += amt;
      } else if (pmt.status === 'pending') {
        monthData[k].pending += amt;
      }
    });

    const sortedKeys = Object.keys(monthKeyMap).sort();
    return sortedKeys.map((k) => monthData[k]);
  }, [dateFilteredAllPayments]);

  const paidSparkline = useMemo(() => {
    const vals = revenueActivityData.map((d) => d.paid);
    return vals.length >= 2 ? vals : undefined;
  }, [revenueActivityData]);

  const pendingSparkline = useMemo(() => {
    const vals = revenueActivityData.map((d) => d.pending);
    return vals.length >= 2 ? vals : undefined;
  }, [revenueActivityData]);

  const grossSparkline = useMemo(() => {
    const vals = revenueActivityData.map((d) => d.paid + d.pending);
    return vals.length >= 2 ? vals : undefined;
  }, [revenueActivityData]);

  const txSparkline = useMemo(() => {
    const vals = revenueActivityData.map((d) => d.count);
    return vals.length >= 2 ? vals : undefined;
  }, [revenueActivityData]);

  // Visual Analytics 2: Multi-Stage Financial Settlement Flow (Sankey)
  const financialFlowData = useMemo(() => {
    if (!dateFilteredAllPayments || dateFilteredAllPayments.length === 0) return [];

    const methodTotals = {};
    const methodStatusTotals = {};

    dateFilteredAllPayments.forEach((pmt) => {
      const amt = Number(pmt.amount) || 0;
      if (amt <= 0) return;
      const method = pmt.paymentMethod === 'online' || pmt.razorpayPaymentId ? 'Online Portal' : 'Clinic Desk';
      const statusLabel = pmt.status === 'paid' ? 'Settled Fees' : (pmt.status === 'pending' ? 'Pending Clearance' : 'Failed Billing');

      methodTotals[method] = (methodTotals[method] || 0) + amt;
      const pairKey = `${method}__${statusLabel}`;
      methodStatusTotals[pairKey] = (methodStatusTotals[pairKey] || 0) + amt;
    });

    const links = [];
    Object.entries(methodTotals).forEach(([method, total]) => {
      links.push({
        from: 'Gross Invoiced',
        to: method,
        value: total
      });
    });

    Object.entries(methodStatusTotals).forEach(([key, total]) => {
      const [method, statusLabel] = key.split('__');
      links.push({
        from: method,
        to: statusLabel,
        value: total
      });
    });

    return links;
  }, [dateFilteredAllPayments]);

  const handleSankeyNodeClick = (node) => {
    if (!node || !node.id) return;
    const nodeId = String(node.id).toLowerCase();
    if (nodeId.includes('settled') || nodeId.includes('paid')) {
      setStatusFilter('paid');
      setCurrentPage(1);
    } else if (nodeId.includes('pending')) {
      setStatusFilter('pending');
      setCurrentPage(1);
    } else if (nodeId.includes('failed')) {
      setStatusFilter('failed');
      setCurrentPage(1);
    } else if (nodeId.includes('gross')) {
      setStatusFilter('all');
      setCurrentPage(1);
    }
  };

  const availableDoctors = departmentFilter
    ? doctors.filter((doc) => {
        const dId = doc.departmentId?._id || doc.departmentId;
        const dIds = Array.isArray(doc.departmentIds) ? doc.departmentIds.map((d) => d._id || d) : [];
        return dId === departmentFilter || dIds.includes(departmentFilter);
      })
    : doctors;

  const handleDepartmentChange = (e) => {
    const selectedDept = e.target.value;
    setDepartmentFilter(selectedDept);
    setCurrentPage(1);

    if (selectedDept && doctorFilter) {
      const isStillAvailable = doctors.some((doc) => {
        if (doc._id !== doctorFilter) return false;
        const dId = doc.departmentId?._id || doc.departmentId;
        const dIds = Array.isArray(doc.departmentIds) ? doc.departmentIds.map((d) => d._id || d) : [];
        return dId === selectedDept || dIds.includes(selectedDept);
      });
      if (!isStillAvailable) {
        setDoctorFilter('');
      }
    }
  };

  // Active Cross-Filter Chips
  const activeFiltersList = useMemo(() => {
    const list = [];
    if (statusFilter && statusFilter !== 'all') {
      const labels = { paid: 'Settled', pending: 'Pending', failed: 'Failed' };
      list.push({
        label: `Status: ${labels[statusFilter] || statusFilter}`,
        onRemove: () => {
          setStatusFilter('all');
          setCurrentPage(1);
        }
      });
    }
    if (departmentFilter) {
      const dept = departments.find((d) => d._id === departmentFilter);
      list.push({
        label: `Department: ${dept?.name || 'Selected'}`,
        onRemove: () => {
          setDepartmentFilter('');
          setCurrentPage(1);
        }
      });
    }
    if (doctorFilter) {
      const doc = doctors.find((d) => d._id === doctorFilter);
      list.push({
        label: `Clinician: ${formatDoctorName(doc?.userId?.name || doc?.name || 'Selected')}`,
        onRemove: () => {
          setDoctorFilter('');
          setCurrentPage(1);
        }
      });
    }
    if (dateRange?.key && dateRange.key !== 'ALL') {
      list.push({
        label: `Window: ${dateRange.label || dateRange.key}`,
        onRemove: () => {
          setDateRange({ key: 'ALL', label: 'All Time' });
          setCurrentPage(1);
        }
      });
    }
    return list;
  }, [statusFilter, departmentFilter, doctorFilter, dateRange, departments, doctors]);

  const handleClearAllFilters = () => {
    setStatusFilter('all');
    setDepartmentFilter('');
    setDoctorFilter('');
    setDateRange({ key: 'ALL', label: 'All Time' });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(dateFilteredPayments.length / limit) || 1;
  const paginatedPayments = dateFilteredPayments.slice((currentPage - 1) * limit, currentPage * limit);

  return (
    <ContentContainer maxWidth="7xl" className="space-y-6">
      <PageHeader
        subtitle="Clinic financial ledger tracking settled fees, payment gateway records, and outstanding patient invoices."
        actions={
          <div className="flex items-center gap-3">
            <DateRangePicker
              value={dateRange.key}
              onChange={(range) => {
                setDateRange(range);
                setCurrentPage(1);
              }}
            />
            <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-100 shadow-2xs">
              Settled: {formatCurrency(totalPaidAmount)}
            </span>
          </div>
        }
      />

      {/* 1. KPIs Strip (4 indicators) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile
          index={0}
          label="Total Gross Volume"
          value={formatCurrency(totalGrossRevenue)}
          subtext="Invoiced clinical fees"
          icon={DollarSign}
          color="blue"
          sparklineData={grossSparkline}
        />
        <StatTile
          index={1}
          label="Settled Revenue"
          value={formatCurrency(totalPaidAmount)}
          subtext="Realized payments"
          icon={CheckCircle2}
          color="green"
          sparklineData={paidSparkline}
        />
        <StatTile
          index={2}
          label="Pending Clearance"
          value={formatCurrency(totalPendingAmount)}
          subtext="Unsettled consultation balances"
          icon={Clock}
          color="amber"
          sparklineData={pendingSparkline}
        />
        <StatTile
          index={3}
          label="Total Transactions"
          value={dateFilteredAllPayments.length}
          subtext="Ledger billing entries"
          icon={CreditCard}
          color="purple"
          sparklineData={txSparkline}
        />
      </div>

      {/* 2. Visual Analytics: Multi-Stage Flow (Sankey 7 cols) & Revenue Trend (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <CareFlowSankey
            title="Multi-Stage Financial Settlement Flow"
            subtitle="Trace gross invoiced fees through collection channels to clearance status (click node to filter)"
            payments={dateFilteredAllPayments}
            stages={2}
            height={280}
            onNodeClick={handleSankeyNodeClick}
          />
        </div>

        <div className="lg:col-span-5">
          <CareFlowTrendChart
            title="Revenue Settlement Activity"
            subtitle="Overall monthly timeline of realized fee receipts and pending clearance"
            data={revenueActivityData}
            categoryField="date"
            series={[
              { key: 'paid', name: 'Settled Receipts', color: CLINICAL_COLORS.emerald },
              { key: 'pending', name: 'Pending Clearance', color: CLINICAL_COLORS.amber }
            ]}
            height={280}
          />
        </div>
      </div>

      {/* 3. Proportional Clearance Status Bar */}
      <CareFlowStatusChart
        title="Payment Clearance & Settlement Breakdown"
        subtitle="Proportional distribution of billing invoices (click segment to filter ledger table)"
        statuses={[
          {
            key: 'paid',
            label: 'Settled',
            count: dateFilteredAllPayments.filter((p) => p.status === 'paid').length,
            color: CLINICAL_COLORS.emerald
          },
          {
            key: 'pending',
            label: 'Pending',
            count: dateFilteredAllPayments.filter((p) => p.status === 'pending').length,
            color: CLINICAL_COLORS.amber
          },
          {
            key: 'failed',
            label: 'Failed',
            count: dateFilteredAllPayments.filter((p) => p.status === 'failed').length,
            color: CLINICAL_COLORS.rose
          }
        ]}
        activeStatus={statusFilter === 'all' ? null : statusFilter}
        onStatusClick={(key) => {
          setStatusFilter((prev) => (prev === key ? 'all' : key));
          setCurrentPage(1);
        }}
      />

      {/* Active Cross-Filter Chips */}
      <ActiveFilterChip
        filters={activeFiltersList}
        onClearAll={handleClearAllFilters}
      />

      {/* 3. Filter and Tab Control Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {['all', 'paid', 'pending'].map((st) => {
              const count =
                st === 'all'
                  ? dateFilteredAllPayments.length
                  : dateFilteredAllPayments.filter((p) => p.status === st).length;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-bold'
                      : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {st === 'all' ? 'All Records' : st} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-44 sm:w-48">
              <Select
                placeholder="All Departments"
                options={departments.map((d) => ({ value: d._id, label: d.name }))}
                value={departmentFilter}
                onChange={handleDepartmentChange}
                className="text-xs"
              />
            </div>

            <div className="w-44 sm:w-48">
              <Select
                placeholder="All Clinicians"
                options={availableDoctors.map((doc) => ({
                  value: doc._id,
                  label: formatDoctorName(doc.userId?.name || doc.name)
                }))}
                value={doctorFilter}
                onChange={(e) => {
                  setDoctorFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs"
              />
            </div>

            {(statusFilter !== 'all' || departmentFilter || doctorFilter) && (
              <Button
                variant="outline"
                size="sm"
                icon={RotateCcw}
                onClick={() => {
                  setStatusFilter('all');
                  setDepartmentFilter('');
                  setDoctorFilter('');
                  setCurrentPage(1);
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Main Table */}
      {loading ? (
        <TableSkeleton rows={8} columns={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPayments} />
      ) : dateFilteredPayments.length === 0 ? (
        <EmptyState
          title="No Payment Records Found"
          description={
            statusFilter !== 'all' || departmentFilter || doctorFilter || (dateRange?.key && dateRange.key !== 'ALL')
              ? 'No transaction records match the selected filter parameters.'
              : 'Payment receipts will be cataloged here once patient consultations are billed.'
          }
          actionText={statusFilter !== 'all' || departmentFilter || doctorFilter || (dateRange?.key && dateRange.key !== 'ALL') ? 'Clear Filters' : undefined}
          onAction={handleClearAllFilters}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHeadCell align="left">Patient</TableHeadCell>
                <TableHeadCell align="left">Clinician</TableHeadCell>
                <TableHeadCell align="left">Consultation Date</TableHeadCell>
                <TableHeadCell align="left">Channel</TableHeadCell>
                <TableHeadCell align="left">Amount</TableHeadCell>
                <TableHeadCell align="left">Method</TableHeadCell>
                <TableHeadCell align="center">Payment Status</TableHeadCell>
                <TableHeadCell align="right">Settlement Date</TableHeadCell>
              </tr>
            </TableHeader>
            <TableBody>
              {paginatedPayments.map((pmt) => (
                <TableRow key={pmt._id} hoverable={true}>
                  <TableCell align="left" variant="primary">
                    <span className="font-bold text-slate-900">{pmt.patientName}</span>
                  </TableCell>

                  <TableCell align="left" variant="secondary">
                    <span className="font-medium text-slate-800">{formatDoctorName(pmt.doctorName)}</span>
                  </TableCell>

                  <TableCell align="left" variant="secondary">
                    <span className="text-slate-600">
                      {pmt.appointmentDate ? formatDate(pmt.appointmentDate) : '—'}
                      {pmt.startTime ? ` • ${formatTime(pmt.startTime)}` : ''}
                    </span>
                  </TableCell>

                  <TableCell align="left" variant="secondary">
                    <span className="capitalize font-semibold text-blue-600">
                      {pmt.consultationType === 'online' ? 'Online' : 'In-Clinic'}
                    </span>
                  </TableCell>

                  <TableCell align="left" variant="primary">
                    <span className="font-bold text-slate-900 text-sm">
                      {formatCurrency(pmt.amount ?? 0)}
                    </span>
                  </TableCell>

                  <TableCell align="left" variant="secondary">
                    <span className="uppercase text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {pmt.paymentMethod || 'Online'}
                    </span>
                  </TableCell>

                  <TableCell align="center">
                    <StatusBadge status={pmt.status} />
                  </TableCell>

                  <TableCell align="right" variant="secondary">
                    <span className="text-slate-500 font-medium">
                      {pmt.paidAt ? formatDate(pmt.paidAt) : pmt.createdAt ? formatDate(pmt.createdAt) : 'Pending'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="px-4 py-3 border-t border-slate-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={dateFilteredPayments.length}
              limit={limit}
              onPageChange={setCurrentPage}
            />
          </div>
        </TableContainer>
      )}
    </ContentContainer>
  );
};

export default AdminPayments;
