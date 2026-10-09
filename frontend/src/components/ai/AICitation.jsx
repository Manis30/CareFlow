import React from 'react';
import { FileHeart, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AICitation = ({ citations = [] }) => {
  const navigate = useNavigate();
  if (!citations) return null;

  const rawList = Array.isArray(citations) ? citations : [citations];
  const validCitations = rawList.filter(Boolean);

  if (validCitations.length === 0) return null;

  const handleCitationClick = (recordId) => {
    if (recordId) {
      const isDoctor = window.location.pathname.startsWith('/doctor');
      const targetPath = isDoctor ? '/doctor/medical-records' : '/patient/medical-records';
      navigate(targetPath);
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
        Clinical Evidence:
      </span>
      {validCitations.map((cite, idx) => {
        let title = 'Medical Record';
        let date = null;
        let recordType = null;
        let recordId = null;

        if (typeof cite === 'string') {
          title = cite;
        } else if (typeof cite === 'object' && cite !== null) {
          title = cite.title || cite.name || cite.documentName || 'Medical Record';
          date = cite.date || (cite.createdAt ? new Date(cite.createdAt).toISOString().split('T')[0] : null);
          recordType = cite.recordType || cite.documentType || cite.type || null;
          recordId = cite.recordId || cite.id || cite._id || null;
        }

        const isClickable = Boolean(recordId);
        const stableKey = recordId ? `cite-id-${recordId}-${idx}` : `cite-t-${String(title).slice(0, 20)}-${idx}`;

        return (
          <span
            key={stableKey}
            onClick={() => isClickable && handleCitationClick(recordId)}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            title={isClickable ? 'View in Medical Records' : undefined}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200/80 ${
              isClickable ? 'cursor-pointer hover:bg-blue-100/80 transition-colors' : ''
            }`}
          >
            <FileHeart className="w-3 h-3 text-blue-600 shrink-0" />
            <span>
              {recordType ? `${recordType} · ` : 'Record · '}
              {title}
              {date ? ` (${date})` : ''}
            </span>
            {isClickable && <ExternalLink className="w-2.5 h-2.5 text-blue-500 shrink-0 opacity-70" />}
          </span>
        );
      })}
    </div>
  );
};

export default AICitation;
