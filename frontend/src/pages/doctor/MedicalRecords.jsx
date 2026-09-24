import React, { useEffect, useState } from 'react';
import { FileText, Download, Eye, Calendar, Clock, User, ShieldCheck } from 'lucide-react';
import { getMyMedicalRecordsApi } from '../../api/medicalRecord';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import PatientAvatar from '../../components/common/PatientAvatar';
import Pagination from '../../components/common/Pagination';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import usePagination from '../../hooks/usePagination';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { formatName } from '../../utils/formatters';
import { handleDownload } from '../../utils/downloadFile';

const DoctorMedicalRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { page, setPage, totalItems, totalPages, paginatedItems } = usePagination(records, 9);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyMedicalRecordsApi();
      if (res.data) setRecords(res.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch medical records');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ContentContainer className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        subtitle="Diagnostic reports and documents shared by patients for clinical review."
        actions={
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-100 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>{records.length} Records Shared</span>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRecords} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Shared Records"
          description="Diagnostic documents and lab reports will appear here when patients share their medical records."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedItems.map((rec) => {
              const patientObj = rec.patientId || {};
              const patUserObj = patientObj.userId || patientObj;
              const rawPatientName =
                patUserObj?.name || patientObj.name || rec.patientName || 'Patient';
              const patientName = formatName(rawPatientName, 'Patient');

              const apptObj = rec.appointmentId || {};
              const apptDate = apptObj.appointmentDate
                ? formatDate(apptObj.appointmentDate)
                : formatDate(rec.createdAt);
              const apptTime = apptObj.startTime
                ? `${formatTime(apptObj.startTime)} – ${formatTime(apptObj.endTime)}`
                : null;
              const recordTypeLabel = (rec.recordType || 'DOCUMENT').replace(/_/g, ' ');

              return (
                <div
                  key={rec._id}
                  className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4 shadow-xs hover:border-blue-400 hover:shadow-md transition-all duration-200"
                >
                  <div className="space-y-4">
                    {/* Patient Context Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <PatientAvatar patient={rec.patientId} name={patientName} size="md" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            PATIENT
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {patientName}
                          </h4>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 uppercase tracking-wider shrink-0">
                        {recordTypeLabel}
                      </span>
                    </div>

                    {/* Document Title & Description */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                        <FileText className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="text-sm font-bold text-slate-900 truncate">
                          {rec.title}
                        </h5>
                        <p className="text-[11px] text-slate-500 font-medium pt-0.5">
                          Uploaded: {formatDate(rec.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Consultation Linkage Context */}
                    {apptObj.appointmentDate && (
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
                    )}
                  </div>

                  {/* Actions */}
                  {rec.file?.url && (
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <a
                        href={rec.file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDownload(rec.file?.url, rec.title)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  )}
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

export default DoctorMedicalRecords;
