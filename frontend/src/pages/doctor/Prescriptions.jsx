import React, { useEffect, useState } from 'react';
import { ClipboardList, Calendar, Clock, ArrowRight, FileText } from 'lucide-react';
import { getMyPrescriptionsApi } from '../../api/prescription';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import PatientAvatar from '../../components/common/PatientAvatar';
import PrescriptionDocView from '../../components/prescription/PrescriptionDocView';
import Pagination from '../../components/common/Pagination';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import usePagination from '../../hooks/usePagination';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { formatName, formatDiagnosis } from '../../utils/formatters';

const DoctorPrescriptions = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { page, setPage, totalItems, totalPages, paginatedItems } = usePagination(
    prescriptions,
    9
  );

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyPrescriptionsApi();
      if (res.data) setPrescriptions(res.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch prescriptions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ContentContainer className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        title={selectedPrescription ? 'Prescription Details' : undefined}
        subtitle={
          selectedPrescription
            ? `Official prescription record #${selectedPrescription._id?.slice(-8).toUpperCase()} authorized by physician.`
            : 'Official medical prescriptions and dosage schedules generated for completed patient consultations.'
        }
        backButton={
          selectedPrescription
            ? {
                label: 'Back to Prescriptions',
                onClick: () => setSelectedPrescription(null)
              }
            : undefined
        }
        actions={
          !selectedPrescription && (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-100 shadow-2xs">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <span>{prescriptions.length} Issued</span>
            </div>
          )
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPrescriptions} />
      ) : prescriptions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No Prescriptions Issued Yet"
          description="Prescriptions issued following completed consultations will be catalogued in this registry."
        />
      ) : selectedPrescription ? (
        <div className="space-y-6 max-w-4xl">
          <PrescriptionDocView prescription={selectedPrescription} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedItems.map((pres) => {
              const patientObj = pres.patientId || {};
              const patUserObj = patientObj.userId || patientObj;
              const rawPatientName =
                patUserObj?.name || patientObj.name || pres.patientName || 'Patient';
              const patientName = formatName(rawPatientName, 'Patient');

              const apptObj = pres.appointmentId || {};
              const apptDate = apptObj.appointmentDate
                ? formatDate(apptObj.appointmentDate)
                : formatDate(pres.createdAt);
              const apptTime = apptObj.startTime
                ? `${formatTime(apptObj.startTime)} – ${formatTime(apptObj.endTime)}`
                : null;

              return (
                <div
                  key={pres._id}
                  onClick={() => setSelectedPrescription(pres)}
                  className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4 cursor-pointer hover:border-blue-400 hover:shadow-md shadow-xs transition-all duration-200 group"
                >
                  <div className="space-y-4">
                    {/* Patient and Medicine Count Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <PatientAvatar patient={pres.patientId} name={patientName} size="md" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            PATIENT
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                            {patientName}
                          </h4>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 shrink-0">
                        {pres.medicines?.length || 0}{' '}
                        {pres.medicines?.length === 1 ? 'Med' : 'Meds'}
                      </span>
                    </div>

                    {/* Clinical Diagnosis */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        CLINICAL DIAGNOSIS
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
                        {formatDiagnosis(pres.diagnosis)}
                      </p>
                    </div>

                    {/* Appointment Date Context */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs text-slate-600 font-medium">
                      <div className="flex items-center justify-between gap-y-1 text-[11px]">
                        <span className="flex items-center gap-1.5 text-slate-900 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          {apptDate}
                        </span>
                        {apptTime && (
                          <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {apptTime}
                          </span>
                        )}
                      </div>
                      {apptObj.reason && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 pt-1 border-t border-slate-200/60">
                          <span className="font-semibold text-slate-700">Reason:</span> {apptObj.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Issued: {formatDate(pres.createdAt)}
                    </span>
                    <span className="font-semibold text-blue-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      View Slip <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              limit={9}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </ContentContainer>
  );
};

export default DoctorPrescriptions;
