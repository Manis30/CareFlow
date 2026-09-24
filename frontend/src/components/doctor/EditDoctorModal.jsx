import React, { useState, useEffect } from 'react';
import { X, Stethoscope, Award, IndianRupee, CheckCircle2, Building2 } from 'lucide-react';
import { updateDoctorApi } from '../../api/doctor';
import { getDepartmentsApi } from '../../api/department';
import Input from '../common/Input';
import Button from '../common/Button';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const EditDoctorModal = ({ isOpen, onClose, doctor, onSuccess }) => {
  const [departments, setDepartments] = useState([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [formData, setFormData] = useState({
    specialization: '',
    qualification: '',
    consultationFee: 500
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && doctor) {
      fetchDepartments();

      setFormData({
        specialization: doctor.specialization || '',
        qualification: doctor.qualification || '',
        consultationFee: doctor.consultationFee || 500
      });

      // Extract existing assigned department IDs
      let initialDeptIds = [];
      if (Array.isArray(doctor.departmentIds) && doctor.departmentIds.length > 0) {
        initialDeptIds = doctor.departmentIds.map((d) => (typeof d === 'object' ? d._id : d)).filter(Boolean);
      } else if (doctor.departmentId) {
        const singleId = typeof doctor.departmentId === 'object' ? doctor.departmentId._id : doctor.departmentId;
        if (singleId) initialDeptIds = [singleId];
      }
      setSelectedDeptIds(initialDeptIds);
    }
  }, [isOpen, doctor]);

  const fetchDepartments = async () => {
    try {
      const res = await getDepartmentsApi();
      const list = res.data || (Array.isArray(res) ? res : []);
      setDepartments(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  if (!isOpen || !doctor) return null;

  const toggleDepartment = (deptId) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const bodyData = new FormData();
      bodyData.append('specialization', formData.specialization);
      bodyData.append('qualification', formData.qualification);
      bodyData.append('consultationFee', formData.consultationFee);
      bodyData.append('departmentIds', JSON.stringify(selectedDeptIds));
      if (selectedDeptIds.length > 0) {
        bodyData.append('departmentId', selectedDeptIds[0]);
      }

      await updateDoctorApi(doctor._id, bodyData);
      showSuccessToast('Doctor profile updated successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to update doctor profile';
      setError(errMsg);
      showErrorToast(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const doctorName = doctor.userId?.name || doctor.name || 'Doctor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold">Edit Doctor Profile</h3>
            <p className="text-xs text-teal-300">Update departments and professional credentials for {doctorName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs text-slate-800">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          {/* Department Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-700" />
              Assigned Department(s)
            </label>

            {departments.length === 0 ? (
              <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  No departments created yet in your organization. Doctor will automatically belong to <strong>General</strong>.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500">Select one or more organization departments:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50/50">
                  {departments.map((dept) => {
                    const isSelected = selectedDeptIds.includes(dept._id);
                    return (
                      <label
                        key={dept._id}
                        onClick={() => toggleDepartment(dept._id)}
                        className={`p-2.5 rounded-lg border font-semibold cursor-pointer transition-all flex items-center justify-between select-none ${
                          isSelected
                            ? 'bg-teal-50 border-teal-600 text-teal-950 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80'
                        }`}
                      >
                        <span className="truncate pr-2">{dept.name}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
                {selectedDeptIds.length > 0 && (
                  <p className="text-[11px] font-semibold text-teal-700">
                    Selected ({selectedDeptIds.length}): {departments.filter((d) => selectedDeptIds.includes(d._id)).map((d) => d.name).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          <Input
            label="Specialization *"
            name="specialization"
            value={formData.specialization}
            onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
            icon={Stethoscope}
            required
          />

          <Input
            label="Qualification *"
            name="qualification"
            value={formData.qualification}
            onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
            icon={Award}
            required
          />

          <Input
            label="Consultation Fee (₹) *"
            type="number"
            name="consultationFee"
            value={formData.consultationFee}
            onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
            icon={IndianRupee}
            required
          />

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={loading}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDoctorModal;
