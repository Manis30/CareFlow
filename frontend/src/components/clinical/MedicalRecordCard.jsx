import React from 'react';
import { FileHeart, User, Eye, Share2, Lock, Unlock } from 'lucide-react';
import Button from '../common/Button';
import { formatDate } from '../../utils/formatDate';

export const MedicalRecordCard = ({
  record,
  onPreview,
  onShare,
  className = ''
}) => {
  if (!record) return null;

  const title = record.title || record.documentType || 'Clinical Document';
  const category = record.category || (record.recordType ? record.recordType.replace(/_/g, ' ') : record.documentType || 'Clinical Document');
  const doctorName = record.doctorId?.userId?.name || record.doctorId?.name || record.uploadedBy?.name || 'Self Uploaded';
  const date = record.createdAt || record.date;
  const isShared = record.isShared || (record.sharedWith && record.sharedWith.length > 0);

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 p-5 shadow-xs transition-all duration-150 flex flex-col justify-between space-y-4 group ${className}`}
    >
      <div className="space-y-3">
        {/* Top Meta Bar */}
        <div className="flex items-start justify-between gap-2">
          <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-100">
            {category}
          </span>
          <span className="text-[11px] text-slate-400 font-medium font-sans">
            {formatDate(date)}
          </span>
        </div>

        {/* Title & Document Identity */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:border-blue-400 transition-colors">
            <FileHeart className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              {title}
            </h3>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5 truncate">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {doctorName}
            </p>
          </div>
        </div>

        {record.notes && (
          <p className="text-xs text-slate-600 font-medium line-clamp-2 pt-1.5 border-t border-slate-100">
            {record.notes}
          </p>
        )}
      </div>

      {/* Footer Status & Actions */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px]">
          {isShared ? (
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1 font-semibold">
              <Unlock className="w-3 h-3 text-emerald-600" /> Shared
            </span>
          ) : (
            <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1 font-semibold">
              <Lock className="w-3 h-3 text-slate-400" /> Private Record
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onShare && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onShare}
              icon={Share2}
              className="text-xs px-2.5 py-1 rounded-xl text-slate-600 hover:text-blue-600"
            >
              Share
            </Button>
          )}
          {onPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPreview}
              icon={Eye}
              className="text-xs px-2.5 py-1 rounded-xl"
            >
              Preview
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalRecordCard;
