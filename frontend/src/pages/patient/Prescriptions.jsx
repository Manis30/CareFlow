import React, { useEffect, useState } from 'react';
import { Pill, ArrowLeft, Stethoscope, ChevronRight } from 'lucide-react';
import { getMyPrescriptionsApi } from '../../api/prescription';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import PrescriptionDocView from '../../components/prescription/PrescriptionDocView';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import Button from '../../components/common/Button';
import ContentContainer from '../../components/layout/ContentContainer';
import PageHeader from '../../components/layout/PageHeader';
import { CardSkeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../utils/formatDate';
import { formatDoctorName, formatSpecialization } from '../../utils/formatters';

export const PatientPrescriptions = () => {
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
      const list = res.data || (Array.isArray(res) ? res : []);
      setPrescriptions(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve clinical prescriptions');
    } finally {
      setLoading(false);
    }
  };

  if (selectedPrescription) {
    return (
      <ContentContainer maxWidth="5xl" className="space-y-6 pb-12">
        <div className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedPrescription(null)}
            icon={ArrowLeft}
          >
            Back to Prescriptions
          </Button>
          <PrescriptionDocView prescription={selectedPrescription} />
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer className="space-y-6 pb-12">
      <PageHeader
        subtitle="Prescription records, medication regimens, and physician guidance issued for your completed encounters."
        actions={
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-100 shadow-2xs">
            <Pill className="w-4 h-4 text-blue-600" />
            {prescriptions.length} {prescriptions.length === 1 ? 'Prescription' : 'Prescriptions'} on File
          </span>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPrescriptions} />
      ) : prescriptions.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedItems.map((pres) => {
              const doctorObj = pres.doctorId || {};
              const rawDocName = doctorObj.userId?.name || doctorObj.name || pres.doctorName;
              const doctorName = formatDoctorName(rawDocName);
              const doctorSpec = formatSpecialization(doctorObj.specialization);
              const medicines = pres.medicines || [];

              return (
                <div
                  key={pres._id}
                  onClick={() => setSelectedPrescription(pres)}
                  className="rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 p-5 shadow-xs transition-all duration-150 cursor-pointer flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:border-blue-300 transition-colors">
                          <Stethoscope className="w-4.5 h-4.5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            Dr. {doctorName}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-medium truncate">
                            {doctorSpec}
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] text-slate-400 font-medium shrink-0 font-sans">
                        {formatDate(pres.createdAt)}
                      </span>
                    </div>

                    {/* Diagnosis */}
                    {pres.diagnosis && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Diagnosis
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1">
                          {pres.diagnosis}
                        </p>
                      </div>
                    )}

                    {/* Prescribed Medicines Summary */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Prescribed Items ({medicines.length})
                      </span>
                      {medicines.length > 0 ? (
                        <div className="space-y-1 text-xs">
                          {medicines.slice(0, 2).map((med, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-800 truncate">
                                {med.name || med.medicineName}
                              </span>
                              <span className="text-slate-500 font-medium">
                                {med.dosage || med.frequency || 'As directed'}
                              </span>
                            </div>
                          ))}
                          {medicines.length > 2 && (
                            <span className="text-[10px] font-semibold text-blue-600 block pt-0.5">
                              +{medicines.length - 2} more medications
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No item details</span>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Official E-Prescription
                    </span>
                    <span className="text-xs font-semibold text-blue-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      View Order <ChevronRight className="w-3.5 h-3.5" />
                    </span>
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
          icon={Pill}
          title="No prescriptions on record"
          description="Prescriptions generated following completed clinical consultations will be automatically archived here."
          actionText="Book a Consultation"
          onAction={() => window.location.href = '/patient/doctors'}
        />
      )}
    </ContentContainer>
  );
};

export default PatientPrescriptions;
