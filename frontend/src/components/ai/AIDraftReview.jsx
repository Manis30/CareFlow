import React from 'react';
import { FileEdit, CheckCircle2, Edit3 } from 'lucide-react';
import Button from '../common/Button';

export const AIDraftReview = ({ draftText, onApprove, onEdit, className = '' }) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-amber-300 p-4.5 shadow-xs space-y-3.5 my-2.5 text-slate-900 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
        <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
          <FileEdit className="w-4 h-4 text-amber-700" />
          Physician Draft Note
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold uppercase border border-amber-200">
          Physician Review
        </span>
      </div>

      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs leading-relaxed font-mono whitespace-pre-line text-slate-800">
        {draftText}
      </div>

      <p className="text-[11px] text-slate-500 font-medium">
        CareFlow generated clinical drafts assist physician workflow. Clinician sign-off is mandatory before recording.
      </p>

      <div className="flex items-center gap-2 pt-1">
        {onApprove && (
          <Button
            variant="primary"
            size="sm"
            onClick={onApprove}
            icon={CheckCircle2}
            className="flex-1 text-xs"
          >
            Sign & Save Record
          </Button>
        )}
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            icon={Edit3}
            className="text-xs"
          >
            Edit
          </Button>
        )}
      </div>
    </div>
  );
};

export default AIDraftReview;
