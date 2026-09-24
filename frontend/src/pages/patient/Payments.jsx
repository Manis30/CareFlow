import React, { useEffect, useState } from 'react';
import { ShieldCheck, Receipt } from 'lucide-react';
import { getMyPaymentsApi } from '../../api/payment';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import ContentContainer from '../../components/layout/ContentContainer';
import PageHeader from '../../components/layout/PageHeader';
import { Table, TableHeader, TableHeadCell, TableBody, TableRow, TableCell, TableAmountCell, TableContainer } from '../../components/common/Table';
import { TableSkeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../utils/formatDate';

export const PatientPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { page, setPage, totalItems, totalPages, paginatedItems } = usePagination(payments, 10);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyPaymentsApi();
      const list = res.data || (Array.isArray(res) ? res : []);
      setPayments(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve transaction records');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ContentContainer maxWidth="7xl" className="space-y-6 pb-12 font-sans">
      <PageHeader
        subtitle="Financial records for medical consultation bookings and transaction history."
        actions={
          <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>CareFlow Billing Records</span>
          </div>
        }
      />

      {loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPayments} />
      ) : payments.length > 0 ? (
        <TableContainer className="rounded-xl">
          <Table>
            <TableHeader>
              <tr>
                <TableHeadCell>Amount</TableHeadCell>
                <TableHeadCell>Payment Method</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Transaction Reference</TableHeadCell>
                <TableHeadCell align="right">Date</TableHeadCell>
              </tr>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((pmt) => (
                <TableRow key={pmt._id}>
                  <TableAmountCell amount={pmt.amount || 0} />
                  <TableCell>
                    <span className="capitalize font-medium text-xs text-slate-800">
                      {pmt.paymentMethod === 'online' ? 'Online Payment' : 'Pay at Clinic Desk'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={pmt.status} />
                  </TableCell>
                  <TableCell variant="muted">
                    <span className="text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 font-sans">
                      {pmt.razorpayPaymentId || pmt.razorpayOrderId || 'CLINIC-DESK-SETTLED'}
                    </span>
                  </TableCell>
                  <TableCell align="right" variant="secondary">
                    {formatDate(pmt.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-100">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
              />
            </div>
          )}
        </TableContainer>
      ) : (
        <EmptyState
          icon={Receipt}
          title="No billing records found"
          description="Invoices and receipts for completed appointments and online consultations will be archived here."
        />
      )}
    </ContentContainer>
  );
};

export default PatientPayments;
