import React, { useEffect, useState, useMemo } from 'react';
import {
  FileHeart,
  Upload,
  ShieldCheck
} from 'lucide-react';
import { getMyMedicalRecordsApi, deleteMedicalRecordApi } from '../../api/medicalRecord';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import UploadRecordModal from '../../components/medicalRecord/UploadRecordModal';
import ShareRecordModal from '../../components/medicalRecord/ShareRecordModal';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import ContentContainer from '../../components/layout/ContentContainer';
import PageHeader from '../../components/layout/PageHeader';
import MedicalRecordCard from '../../components/clinical/MedicalRecordCard';
import { CardSkeleton } from '../../components/common/Skeleton';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { confirmDelete } from '../../utils/confirmDialog';

export const PatientMedicalRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modals
  const [uploadModal, setUploadModal] = useState(false);
  const [shareModal, setShareModal] = useState({ isOpen: false, record: null });

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
      setError(err.message || 'Failed to retrieve medical records');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (record) => {
    const isConfirmed = await confirmDelete(record.title);
    if (!isConfirmed) return;

    try {
      await deleteMedicalRecordApi(record._id);
      showSuccessToast(`Document "${record.title}" deleted.`);
      fetchRecords();
    } catch (err) {
      showErrorToast(err.message || 'Failed to delete medical document');
    }
  };

  const categories = [
    'all',
    'Lab Report',
    'Prescription',
    'Medical Scan',
    'Discharge Summary',
    'Other'
  ];

  const getCategoryForRecord = (record) => {
    if (!record) return 'Other';
    const raw = `${record.recordType || ''} ${record.documentType || ''} ${record.category || ''} ${record.title || ''}`.toLowerCase();
    if (raw.includes('lab') || raw.includes('blood') || raw.includes('patholog') || raw.includes('urine') || raw.includes('test report')) {
      return 'Lab Report';
    }
    if (raw.includes('prescript') || raw.includes('medication') || raw.includes(' rx')) {
      return 'Prescription';
    }
    if (raw.includes('scan') || raw.includes('radio') || raw.includes('x-ray') || raw.includes('xray') || raw.includes('mri') || raw.includes('ct ') || raw.includes('ultrasound')) {
      return 'Medical Scan';
    }
    if (raw.includes('discharge')) {
      return 'Discharge Summary';
    }
    return 'Other';
  };

  const filteredRecords = useMemo(() => {
    if (selectedCategory === 'all') return records;
    return records.filter((r) => getCategoryForRecord(r) === selectedCategory);
  }, [records, selectedCategory]);

  const {
    paginatedItems: paginatedRecords = [],
    page: currentPage = 1,
    totalPages = 1,
    setPage: goToPage = () => {},
    totalItems: totalResults = 0
  } = usePagination(filteredRecords, 9);

  return (
    <ContentContainer className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        subtitle="Manage diagnostic reports, laboratory work, imaging scans, and clinical documents."
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-100 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              {records.length} Medical Documents
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={Upload}
              onClick={() => setUploadModal(true)}
            >
              Upload Document
            </Button>
          </div>
        }
      />

      {/* 2. Category Filter Pills */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all duration-150 whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              {cat === 'all' ? 'All Documents' : cat}
            </button>
          ))}
        </div>

        <span className="text-xs font-semibold text-slate-400 shrink-0">
          Showing {filteredRecords.length} documents
        </span>
      </div>

      {/* 3. Records Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRecords} />
      ) : filteredRecords.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedRecords.map((record) => (
              <MedicalRecordCard
                key={record._id}
                record={record}
                onPreview={() => {
                  if (record.fileUrl || record.file?.url) {
                    window.open(record.fileUrl || record.file?.url, '_blank', 'noopener,noreferrer');
                  } else {
                    showErrorToast('File preview URL not available.');
                  }
                }}
                onShare={() => setShareModal({ isOpen: true, record })}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={totalResults}
              />
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={FileHeart}
          title={
            selectedCategory === 'all'
              ? 'No medical records on file'
              : `No ${selectedCategory} documents on file`
          }
          description="Upload blood tests, radiological scans, prescriptions, or discharge summaries to share them with your doctors."
          actionText="Upload Document"
          onAction={() => setUploadModal(true)}
        />
      )}

      {/* Modals */}
      <UploadRecordModal
        isOpen={uploadModal}
        onClose={() => setUploadModal(false)}
        onSuccess={() => fetchRecords()}
      />

      {shareModal.isOpen && (
        <ShareRecordModal
          isOpen={shareModal.isOpen}
          record={shareModal.record}
          onClose={() => setShareModal({ isOpen: false, record: null })}
          onSuccess={() => fetchRecords()}
        />
      )}
    </ContentContainer>
  );
};

export default PatientMedicalRecords;
