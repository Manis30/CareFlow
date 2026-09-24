import React from 'react';
import { Pill, Clock, Calendar, User, FileText, Printer } from 'lucide-react';
import Button from '../common/Button';
import { formatDate } from '../../utils/formatDate';

export const PrescriptionCard = ({
  prescription,
  onView,
  onPrint,
  className = ''
}) => {
  if (!prescription) return null;

  const doctorName = prescription.doctorId?.userId?.name || prescription.doctorId?.name || 'Treating Clinician';
  const medicines = prescription.medicines || [];
  const date = prescription.createdAt || prescription.date;

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Pill className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
              Prescription Record
            </h4>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-600" /> {doctorName}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-medium text-slate-400 shrink-0">
          {formatDate(date)}
        </span>
      </div>

      {/* Medications List */}
      <div className="space-y-2">
        {medicines.slice(0, 3).map((med, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs"
          >
            <div className="space-y-0.5 truncate">
              <span className="font-semibold text-slate-900 block truncate">
                {med.name || med.medicineName}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {med.dosage || 'Standard dose'} · {med.frequency || 'Daily'}
              </span>
            </div>
            {med.duration && (
              <span className="px-2 py-0.5 rounded-md bg-white text-blue-700 font-semibold text-[10px] border border-blue-100 shrink-0">
                {med.duration}
              </span>
            )}
          </div>
        ))}
        {medicines.length > 3 && (
          <p className="text-[11px] text-slate-500 text-center">
            +{medicines.length - 3} more medications
          </p>
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-2 flex items-center gap-2 justify-end">
        {onPrint && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrint}
            icon={Printer}
            className="text-xs"
          >
            Print
          </Button>
        )}
        {onView && (
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            icon={FileText}
            className="text-xs"
          >
            View Document
          </Button>
        )}
      </div>
    </div>
  );
};

export default PrescriptionCard;
