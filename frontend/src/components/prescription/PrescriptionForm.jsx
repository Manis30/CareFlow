import React, { useState } from 'react';
import { Plus, Trash2, ClipboardList, AlertCircle } from 'lucide-react';
import Input from '../common/Input';
import Textarea from '../common/Textarea';
import Button from '../common/Button';

const PrescriptionForm = ({ initialData, onSubmit, onCancel, loading, error }) => {
  const [diagnosis, setDiagnosis] = useState(initialData?.diagnosis || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [medicines, setMedicines] = useState(
    initialData?.medicines || [
      { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }
    ]
  );

  const handleMedicineChange = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const addMedicineRow = () => {
    setMedicines([
      ...medicines,
      { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }
    ]);
  };

  const removeMedicineRow = (index) => {
    if (medicines.length === 1) return;
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      diagnosis,
      notes,
      medicines
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Diagnosis Input */}
      <div>
        <Input
          label="Diagnosis"
          placeholder="Enter diagnosis (e.g. Acute Viral Fever, Hypertension)"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          required
        />
      </div>

      {/* Prescribed Medicines Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Prescribed Medicines <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
              {medicines.length} {medicines.length === 1 ? 'medicine' : 'medicines'}
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addMedicineRow} icon={Plus}>
            Add Medicine
          </Button>
        </div>

        <div className="space-y-2">
          {medicines.map((med, idx) => (
            <div
              key={idx}
              className="p-2.5 sm:p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2 relative transition-all duration-200 hover:border-slate-300 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {/* Row 1: 4-Column Grid on Desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    placeholder="Medicine Name (Paracetamol)"
                    value={med.medicineName}
                    onChange={(e) => handleMedicineChange(idx, 'medicineName', e.target.value)}
                    required
                    className="w-full text-xs font-medium text-slate-900 bg-white rounded-lg border border-slate-200 px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Dosage (500mg)"
                    value={med.dosage}
                    onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                    required
                    className="w-full text-xs font-medium text-slate-900 bg-white rounded-lg border border-slate-200 px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Frequency (1-0-1)"
                    value={med.frequency}
                    onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                    required
                    className="w-full text-xs font-medium text-slate-900 bg-white rounded-lg border border-slate-200 px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
                  />
                </div>
                <div className={medicines.length > 1 ? 'sm:col-span-3' : 'sm:col-span-4'}>
                  <input
                    type="text"
                    placeholder="Duration (5 days)"
                    value={med.duration}
                    onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                    required
                    className="w-full text-xs font-medium text-slate-900 bg-white rounded-lg border border-slate-200 px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
                  />
                </div>
                {medicines.length > 1 && (
                  <div className="sm:col-span-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => removeMedicineRow(idx)}
                      title="Remove medicine"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Row 2: Full Width Instructions */}
              <div>
                <input
                  type="text"
                  placeholder="Instructions / Advice (optional e.g. Take after meals)"
                  value={med.instructions}
                  onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                  className="w-full text-xs font-medium text-slate-700 bg-white/70 rounded-lg border border-slate-200/60 px-3 py-1.5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Doctor Notes */}
      <div>
        <Textarea
          label="Additional Doctor Notes"
          placeholder="Add dietary advice, precautions, or follow-up recommendations..."
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Sticky-style Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-slate-100 mt-3">
        <span className="text-xs text-slate-400 font-medium">
          Prescription will be saved to the patient's medical records
        </span>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          {onCancel && (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="primary" size="sm" icon={ClipboardList} loading={loading}>
            Create Prescription
          </Button>
        </div>
      </div>
    </form>
  );
};

export default PrescriptionForm;
