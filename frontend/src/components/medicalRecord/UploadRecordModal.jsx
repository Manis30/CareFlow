import React, { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import Textarea from '../common/Textarea';
import FileUpload from '../common/FileUpload';
import Button from '../common/Button';
import { uploadMedicalRecordApi } from '../../api/medicalRecord';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const RECORD_TYPES = [
  { value: 'lab_report', label: 'Lab Report' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'scan', label: 'Scan / Radiology' },
  { value: 'other', label: 'Other Document' }
];

const UploadRecordModal = ({ isOpen, onClose, appointmentId, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [recordType, setRecordType] = useState('lab_report');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const formData = new FormData();
      formData.append('title', title);
      formData.append('recordType', recordType);
      if (description) formData.append('description', description);
      if (appointmentId) formData.append('appointmentId', appointmentId);
      formData.append('file', file);

      await uploadMedicalRecordApi(formData);
      showSuccessToast('Medical record uploaded successfully!');
      setTitle('');
      setDescription('');
      setFile(null);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      const errMsg = err.message || 'Failed to upload medical record';
      setError(errMsg);
      showErrorToast(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Medical Record">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <Input
          label="Record Title"
          placeholder="e.g. Blood Test Report June 2026"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="Record Category"
          options={RECORD_TYPES}
          value={recordType}
          onChange={(e) => setRecordType(e.target.value)}
          required
        />

        <FileUpload
          label="Document / Image File"
          accept="image/*,application/pdf"
          onChange={(f) => setFile(f)}
          required
        />

        <Textarea
          label="Description / Summary"
          placeholder="Optional notes or details about this record..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Upload Document
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default UploadRecordModal;
