import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Select from '../common/Select';
import Button from '../common/Button';
import Loader from '../common/Loader';
import { shareMedicalRecordApi, revokeMedicalRecordApi } from '../../api/medicalRecord';
import { getDoctorsApi } from '../../api/doctor';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { confirmAction } from '../../utils/confirmDialog';
import { formatDoctorName } from '../../utils/formatName';

const ShareRecordModal = ({ isOpen, onClose, record, onSuccess }) => {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingDocs, setFetchingDocs] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
    }
  }, [isOpen]);

  const fetchDoctors = async () => {
    try {
      setFetchingDocs(true);
      const res = await getDoctorsApi();
      const docsList = res.data?.doctors || res.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(docsList)) {
        setDoctors(docsList);
      }
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    } finally {
      setFetchingDocs(false);
    }
  };

  const handleShare = async () => {
    if (!selectedDoctorId) return;
    try {
      setLoading(true);
      setError('');
      await shareMedicalRecordApi(record._id, selectedDoctorId);
      showSuccessToast('Medical record shared with doctor successfully!');
      setSelectedDoctorId('');
      onSuccess();
    } catch (err) {
      const errMsg = err.message || 'Failed to share record';
      setError(errMsg);
      showErrorToast(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (docId, docName) => {
    const isConfirmed = await confirmAction({
      title: 'Revoke Doctor Access?',
      text: `Are you sure you want to revoke access for ${docName}? They will no longer be able to view this medical record.`,
      confirmButtonText: 'Yes, Revoke Access',
      confirmButtonColor: '#e11d48'
    });

    if (!isConfirmed) return;

    try {
      setLoading(true);
      setError('');
      await revokeMedicalRecordApi(record._id, docId);
      showSuccessToast(`Access revoked for ${docName}`);
      onSuccess();
    } catch (err) {
      const errMsg = err.message || 'Failed to revoke access';
      setError(errMsg);
      showErrorToast(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Group doctors org-wise
  const doctorGroups = React.useMemo(() => {
    const orgMap = {};
    doctors.forEach((d) => {
      const orgName = d.organizationId?.name || 'CareFlow Clinic';
      if (!orgMap[orgName]) {
        orgMap[orgName] = [];
      }
      const dName = formatDoctorName(d.userId?.name || d.name);
      const spec = d.specialization || 'Specialist';
      orgMap[orgName].push({
        value: d._id,
        label: `${dName} (${spec})`
      });
    });

    return Object.entries(orgMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([orgName, opts]) => ({
        label: orgName,
        options: opts.sort((a, b) => a.label.localeCompare(b.label))
      }));
  }, [doctors]);

  const doctorOptions = React.useMemo(() => {
    return doctors.map((d) => {
      const dName = formatDoctorName(d.userId?.name || d.name);
      const spec = d.specialization || 'Specialist';
      const orgName = d.organizationId?.name ? ` — ${d.organizationId.name}` : '';
      return {
        value: d._id,
        label: `${dName} (${spec})${orgName}`
      };
    });
  }, [doctors]);

  if (!record) return null;

  const sharedWith = record.sharedWith || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Doctor Access">
      <div className="space-y-6 font-sans">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        {/* Share with new Doctor */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Share Record with Specialist Doctor
          </h4>
          {fetchingDocs ? (
            <Loader size="sm" color="teal" />
          ) : (
            <div className="flex gap-2 items-end">
              <Select
                placeholder="Select Doctor..."
                groups={doctorGroups}
                options={doctorOptions}
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="flex-grow"
              />
              <Button
                variant="primary"
                onClick={handleShare}
                disabled={!selectedDoctorId || loading}
                loading={loading}
              >
                Share Access
              </Button>
            </div>
          )}
        </div>

        {/* Shared Doctors List */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Doctors Currently Authorized ({sharedWith.length})
          </h4>
          {sharedWith.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No doctors currently have access to this record.</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {sharedWith.map((item, idx) => {
                const docObj = item.doctorId || item;
                const docId = typeof docObj === 'object' ? docObj._id : docObj;
                const rawName = typeof docObj === 'object' ? (docObj.userId?.name || docObj.name) : 'Doctor';
                const docName = formatDoctorName(rawName);
                const spec = typeof docObj === 'object' ? docObj.specialization : '';
                const orgName = typeof docObj === 'object' ? docObj.organizationId?.name : '';

                return (
                  <div key={docId || idx} className="flex items-center justify-between p-3.5 bg-white text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{docName}</p>
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 font-medium">
                        {spec && <span className="text-teal-700 font-semibold">{spec}</span>}
                        {spec && orgName && <span>•</span>}
                        {orgName && <span>{orgName}</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50 font-semibold"
                      onClick={() => handleRevoke(docId, docName)}
                      disabled={loading}
                    >
                      Revoke Access
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ShareRecordModal;
