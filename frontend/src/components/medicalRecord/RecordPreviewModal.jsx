import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  AlertCircle,
  Loader2,
  Sparkles,
  FileCheck2,
  Calendar,
  User,
  FileType,
  HardDrive,
  Activity,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Send,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import Button from '../common/Button';
import api from '../../api/axios';
import { handleDownload } from '../../utils/downloadFile';
import { formatDate } from '../../utils/formatDate';

export const RecordPreviewModal = ({ isOpen, onClose, record }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(100);

  // AI Document Action States
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [aiActionType, setAiActionType] = useState(null);
  const [aiActionOutput, setAiActionOutput] = useState(null);
  const [aiActionSummary, setAiActionSummary] = useState(null);
  const [aiActionError, setAiActionError] = useState(null);
  const [showAskInput, setShowAskInput] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [showExtractedText, setShowExtractedText] = useState(false);

  // Live updated record stats
  const [liveOcrConfidence, setLiveOcrConfidence] = useState(null);
  const [liveOcrStatus, setLiveOcrStatus] = useState(null);

  const askInputRef = useRef(null);

  const recordId = record?._id || record?.id;
  const rawMime = (record?.file?.mimeType || '').toLowerCase();
  const rawUrl = (record?.file?.url || record?.fileUrl || '').toLowerCase();
  const fileName = record?.file?.fileName || record?.title || 'Document';
  const ext = (record?.file?.fileExtension || fileName.split('.').pop() || '').toLowerCase();

  const isPdf = rawMime === 'application/pdf' || ext === 'pdf' || rawUrl.includes('.pdf');
  const isImage = rawMime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
  const isText = rawMime === 'text/plain' || ext === 'txt';
  const isDoc = ['doc', 'docx'].includes(ext) || rawMime.includes('word') || rawMime.includes('officedocument');

  const previewSupported = (isPdf || isImage || isText) && !isDoc;

  // Patient Name extraction
  const patientObj = record?.patientId || {};
  const patUserObj = patientObj?.userId || patientObj;
  const patientName = patUserObj?.name || patientObj?.name || record?.patientName || 'Authorized Patient';

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const fileSizeStr = formatFileSize(record?.file?.fileSize);

  // Sync initial OCR values
  useEffect(() => {
    if (record) {
      const ocrVal = record.ocrConfidence ?? record.metadata?.ocrConfidence ?? null;
      setLiveOcrConfidence(Number.isFinite(Number(ocrVal)) ? Math.round(Number(ocrVal)) : null);
      setLiveOcrStatus(record.ocrStatus || null);
    }
  }, [record]);

  // Load preview blob
  useEffect(() => {
    let active = true;
    let localBlobUrl = null;

    if (!isOpen || !recordId) {
      setBlobUrl(null);
      setLoading(false);
      setLoadError(false);
      setAiActionOutput(null);
      setAiActionType(null);
      setShowAskInput(false);
      setQaHistory([]);
      setZoom(100);
      return;
    }

    if (!previewSupported) {
      setLoading(false);
      setLoadError(false);
      return;
    }

    const fetchPreviewBlob = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const res = await api.get(`/medical-record/${recordId}/preview`, {
          responseType: 'blob'
        });
        if (!active) return;
        const contentType = res.headers?.['content-type'] || (isPdf ? 'application/pdf' : 'application/octet-stream');
        const typedBlob = res.data.type === contentType ? res.data : new Blob([res.data], { type: contentType });
        localBlobUrl = window.URL.createObjectURL(typedBlob);
        setBlobUrl(localBlobUrl);
      } catch (err) {
        console.error('[Preview Load Error]:', err?.message || err);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPreviewBlob();

    return () => {
      active = false;
      if (localBlobUrl) {
        window.URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [isOpen, recordId, previewSupported]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !record) return null;

  const handleDownloadClick = () => {
    handleDownload(record, fileName);
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    } else {
      const url = record?.file?.url || record?.fileUrl;
      if (url) window.open(url, '_blank');
    }
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  // Run Record-Scoped AI Actions
  const handleAiAction = async (actionType) => {
    if (aiActionLoading) return;

    if (actionType === 'ask') {
      setShowAskInput(true);
      setTimeout(() => askInputRef.current?.focus(), 100);
      return;
    }

    setAiActionLoading(true);
    setAiActionType(actionType);
    setAiActionError(null);

    try {
      const endpoint = actionType === 'summarize'
        ? `/medical-record/${recordId}/ai/summarize`
        : `/medical-record/${recordId}/ai/extract`;

      const res = await api.post(endpoint);
      const data = res.data?.data;

      if (data?.ocrConfidence !== undefined && data?.ocrConfidence !== null) {
        setLiveOcrConfidence(Math.round(data.ocrConfidence));
        setLiveOcrStatus(data.isLowConfidence ? 'LOW_CONFIDENCE' : 'COMPLETED');
      }

      if (actionType === 'summarize') {
        if (data?.summary && typeof data.summary === 'object') {
          setAiActionSummary(data.summary);
          setAiActionOutput(data.summaryText || 'Record summary generated.');
        } else if (typeof data?.summary === 'string' && data.summary.trim()) {
          setAiActionSummary(null);
          setAiActionOutput(data.summary);
        } else {
          setAiActionSummary(null);
          setAiActionOutput('Unable to generate a summary right now.');
        }
      } else {
        setAiActionSummary(null);
        setAiActionOutput(data?.findings || 'Findings extracted successfully.');
      }
    } catch (err) {
      console.error('[Record AI Action Error]:', err);
      setAiActionSummary(null);
      setAiActionError(err.response?.data?.message || 'AI action could not be completed right now. Please try again.');
    } finally {
      setAiActionLoading(false);
    }
  };

  // Handle Ask Question about this record
  const handleAskSubmit = async (e) => {
    e?.preventDefault();
    const q = askQuestion.trim();
    if (!q || aiActionLoading) return;

    setAiActionLoading(true);
    setAiActionError(null);
    setAskQuestion('');

    try {
      const res = await api.post(`/medical-record/${recordId}/ai/ask`, { question: q });
      const data = res.data?.data;
      const ans = data?.answer || "I couldn't find that information in this record.";

      if (data?.ocrConfidence !== undefined && data?.ocrConfidence !== null) {
        setLiveOcrConfidence(Math.round(data.ocrConfidence));
      }

      setQaHistory((prev) => [...prev, { question: q, answer: ans }]);
      setAiActionType('ask');
      setAiActionSummary(null);
      setAiActionOutput(ans);
    } catch (err) {
      console.error('[Ask Record Error]:', err);
      setAiActionError(err.response?.data?.message || 'Could not answer the question right now.');
    } finally {
      setAiActionLoading(false);
    }
  };

  const recordTypeFormatted = record.recordType ? record.recordType.replace(/_/g, ' ') : 'Medical Record';
  const fileExtFormatted = ext ? ext.toUpperCase() : (isPdf ? 'PDF' : isImage ? 'IMAGE' : 'DOCUMENT');

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      {/* Clinical Workspace Shell: Fixed max-height with two independent scrolling columns */}
      <div className="relative w-full max-w-[1320px] h-[92vh] max-h-[960px] bg-[#F8FAFC] rounded-[16px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* ── WORKSPACE HEADER ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-white border-b border-slate-200 shrink-0 z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0 shadow-2xs">
              <FileCheck2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate leading-tight">
                {record.title || fileName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <span className="capitalize">{recordTypeFormatted}</span>
                <span>•</span>
                <span>{fileExtFormatted}</span>
                {fileSizeStr && (
                  <>
                    <span>•</span>
                    <span>{fileSizeStr}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              title="Open document in new tab"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-[10px] transition-colors cursor-pointer shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>New Tab</span>
            </button>

            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={handleDownloadClick}
              className="text-xs font-semibold px-3 py-1.5 rounded-[10px] border-slate-200 hover:bg-slate-50 text-slate-800"
            >
              Download
            </Button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close document workspace"
              className="p-1.5 rounded-[10px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── WORKSPACE BODY: 68% DOCUMENT VIEWER + 32% INTELLIGENCE PANEL ──── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-[#F8FAFC]">
          
          {/* ── LEFT COLUMN: DOCUMENT VIEWER CANVAS (68%) ─────────────────── */}
          <div className="flex-1 lg:w-[68%] w-full min-h-0 min-w-0 flex flex-col p-3 sm:p-4 lg:p-5 overflow-hidden">
            <div className="w-full h-full min-h-0 flex flex-col bg-white rounded-[12px] border border-slate-200 shadow-xs overflow-hidden relative">
              
              {/* Document Viewport Control Toolbar */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-50/80 border-b border-slate-200 shrink-0 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <FileText className="w-3 h-3" />
                    {isPdf ? 'PDF Document' : isImage ? 'Medical Image' : isText ? 'Clinical Text' : 'Document'}
                  </span>
                </div>

                {/* Zoom & View Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoom <= 50}
                    title="Zoom out"
                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-700 w-10 text-center select-none">
                    {zoom}%
                  </span>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoom >= 250}
                    title="Zoom in"
                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    title="Fit to normal view (100%)"
                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer ml-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    title="Open in full browser window"
                    className="sm:hidden p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer ml-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Viewport Surface: Fully scrollable with independent overflow */}
              <div className="flex-1 min-h-0 min-w-0 overflow-auto bg-slate-100/40 relative flex items-start justify-center p-2 sm:p-4">
                {loading ? (
                  <div className="text-center py-24 px-6 space-y-3 m-auto">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">
                      Loading clinical document...
                    </p>
                  </div>
                ) : loadError ? (
                  <div className="text-center py-20 px-6 space-y-3 max-w-md m-auto">
                    <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto border border-rose-200">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Unable to preview this document.
                    </h4>
                    <p className="text-xs text-slate-500">
                      The document preview could not be displayed directly in the browser canvas. You can still download the original document securely.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Download}
                      onClick={handleDownloadClick}
                      className="mt-2"
                    >
                      Download Document
                    </Button>
                  </div>
                ) : !previewSupported ? (
                  <div className="text-center py-20 px-6 space-y-3 max-w-md m-auto">
                    <div className="w-12 h-12 rounded-[12px] bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-200">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Preview unavailable for {isDoc ? 'Word documents (.docx)' : `this file format (${ext ? `.${ext}` : 'file'})`}.
                    </h4>
                    <p className="text-xs text-slate-500">
                      Microsoft Word and proprietary binary formats cannot be rendered directly in the embedded canvas. Download the file to review it on your device.
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Download}
                        onClick={handleDownloadClick}
                      >
                        Download Document
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={ExternalLink}
                        onClick={handleOpenInNewTab}
                      >
                        Open Document
                      </Button>
                    </div>
                  </div>
                ) : isPdf && blobUrl ? (
                  <div
                    className="w-full h-full min-h-[620px] transition-transform duration-100 ease-out origin-top flex items-center justify-center"
                    style={{ transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none' }}
                  >
                    <iframe
                      src={`${blobUrl}#view=FitH&toolbar=1`}
                      title={fileName}
                      className="w-full h-full min-h-[620px] border-0 rounded-[8px] bg-white shadow-2xs"
                      onError={() => setLoadError(true)}
                    />
                  </div>
                ) : isImage && blobUrl ? (
                  <div className="w-full h-full min-h-0 flex items-center justify-center overflow-auto p-2">
                    <img
                      src={blobUrl}
                      alt={fileName}
                      className="max-w-none transition-transform duration-100 ease-out object-contain rounded-[8px] shadow-md origin-top"
                      style={{ transform: `scale(${zoom / 100})` }}
                      onError={() => setLoadError(true)}
                    />
                  </div>
                ) : isText && blobUrl ? (
                  <div
                    className="w-full h-full min-h-[500px] bg-white p-5 rounded-[8px] border border-slate-200 overflow-auto shadow-2xs"
                    style={{ transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none', transformOrigin: 'top left' }}
                  >
                    <iframe
                      src={blobUrl}
                      title={fileName}
                      className="w-full h-full border-0 font-mono text-xs text-slate-800"
                      onError={() => setLoadError(true)}
                    />
                  </div>
                ) : (
                  <div className="text-center py-16 space-y-2 m-auto">
                    <p className="text-xs text-slate-500">Preview unavailable for this document.</p>
                    <Button variant="primary" size="sm" icon={Download} onClick={handleDownloadClick}>
                      Download Document
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: RECORD INTELLIGENCE PANEL (32%) ──────────────── */}
          <div className="lg:w-[32%] w-full min-h-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col overflow-y-auto p-5 sm:p-6 space-y-5 shrink-0">
            
            {/* 1. Panel Header */}
            <div>
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Record Intelligence
                </h3>
              </div>
            </div>

            {/* 2. Structured Metadata List */}
            <div className="space-y-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Patient
                </span>
                <span className="font-semibold text-slate-900 text-right truncate">
                  {patientName}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Document
                </span>
                <span className="font-semibold text-slate-900 text-right truncate">
                  {record.title || fileName}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  Record Type
                </span>
                <span className="font-semibold text-slate-900 text-right capitalize">
                  {recordTypeFormatted}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                  <FileType className="w-3.5 h-3.5 text-slate-400" />
                  File Type
                </span>
                <span className="font-semibold text-slate-900 uppercase">
                  {fileExtFormatted}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Uploaded
                </span>
                <span className="font-semibold text-slate-900">
                  {formatDate(record.createdAt)}
                </span>
              </div>

              {fileSizeStr && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                    File Size
                  </span>
                  <span className="font-semibold text-slate-900">
                    {fileSizeStr}
                  </span>
                </div>
              )}

              {/* OCR Confidence / Processing Status */}
              <div className="flex items-start justify-between gap-3 pt-1">
                <span className="text-slate-500 font-medium shrink-0">
                  {liveOcrConfidence !== null ? 'OCR Confidence' : 'OCR Status'}
                </span>
                {liveOcrConfidence !== null ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      liveOcrConfidence >= 85
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : liveOcrConfidence >= 50
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {liveOcrConfidence}%
                  </span>
                ) : liveOcrStatus === 'COMPLETED' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Verified
                  </span>
                ) : liveOcrStatus === 'PROCESSING' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Processing
                  </span>
                ) : liveOcrStatus === 'UNAVAILABLE' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    Unavailable
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Ready for Analysis
                  </span>
                )}
              </div>

              {/* View Extracted Text Feature (Separated from AI Summary) */}
              {record?.extractedText && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowExtractedText(!showExtractedText)}
                    className="flex items-center justify-between w-full text-[10.5px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      {showExtractedText ? 'Hide Raw Extracted Text' : 'View Raw Extracted Text'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showExtractedText ? 'rotate-180' : ''}`} />
                  </button>
                  {showExtractedText && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700 max-h-36 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
                      {record.extractedText}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. AI Document Actions */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                AI Document Actions
              </h4>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleAiAction('summarize')}
                  disabled={aiActionLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-[10px] border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-200 text-slate-900 transition-all text-xs font-semibold cursor-pointer disabled:opacity-60 shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Summarize Record
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => handleAiAction('extract')}
                  disabled={aiActionLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-[10px] border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-200 text-slate-900 transition-all text-xs font-semibold cursor-pointer disabled:opacity-60 shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    Extract Findings
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => handleAiAction('ask')}
                  disabled={aiActionLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-[10px] border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-200 text-slate-900 transition-all text-xs font-semibold cursor-pointer disabled:opacity-60 shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    Ask About This Record
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>

              {/* Interactive Ask Input Box */}
              {showAskInput && (
                <form onSubmit={handleAskSubmit} className="pt-2 space-y-2 animate-in fade-in duration-100">
                  <div className="relative">
                    <input
                      ref={askInputRef}
                      type="text"
                      value={askQuestion}
                      onChange={(e) => setAskQuestion(e.target.value)}
                      placeholder="Ask a question about this record..."
                      disabled={aiActionLoading}
                      className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-400 font-medium text-slate-800"
                    />
                    <button
                      type="submit"
                      disabled={!askQuestion.trim() || aiActionLoading}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-40 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                    <span>Scoped strictly to this document</span>
                    <button
                      type="button"
                      onClick={() => setShowAskInput(false)}
                      className="hover:text-slate-600"
                    >
                      Hide
                    </button>
                  </div>
                </form>
              )}

              {/* Action Loading State */}
              {aiActionLoading && (
                <div className="p-3.5 rounded-[10px] bg-blue-50 border border-blue-100 flex items-center gap-2.5 text-xs text-blue-700 font-medium animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  <span>
                    {aiActionType === 'summarize'
                      ? 'Analyzing record...'
                      : aiActionType === 'extract'
                      ? 'Extracting findings...'
                      : 'Searching document content...'}
                  </span>
                </div>
              )}

              {/* Action Error Banner */}
              {aiActionError && (
                <div className="p-3 rounded-[10px] bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{aiActionError}</span>
                </div>
              )}

              {/* Action Output Result Card */}
              {aiActionOutput && !aiActionLoading && (
                <div className="p-3.5 rounded-[12px] bg-slate-50 border border-slate-200 space-y-2 text-xs shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-200/80 pb-1.5">
                    <span className="flex items-center gap-1.5 text-blue-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {aiActionType === 'summarize'
                        ? 'Record Summary'
                        : aiActionType === 'extract'
                        ? 'Structured Findings'
                        : 'Answer'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAiActionOutput(null);
                        setAiActionSummary(null);
                        setAiActionType(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  {aiActionType === 'summarize' && aiActionSummary ? (
                    <div className="space-y-3 pt-1 text-slate-800 max-h-80 overflow-y-auto pr-1">
                      {/* Overview */}
                      {aiActionSummary.overview && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Overview
                          </div>
                          <p className="text-[11.5px] text-slate-700 leading-relaxed font-normal">
                            {aiActionSummary.overview}
                          </p>
                        </div>
                      )}

                      {/* Key Findings */}
                      {aiActionSummary.keyFindings?.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Key Findings
                          </div>
                          <ul className="space-y-1 pl-1">
                            {aiActionSummary.keyFindings.map((finding, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-[11.5px] text-slate-700 leading-relaxed font-normal">
                                <span className="text-blue-500 font-bold shrink-0">•</span>
                                <span>{finding}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Medications */}
                      {aiActionSummary.medications?.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Medications
                          </div>
                          <ul className="space-y-1 pl-1">
                            {aiActionSummary.medications.map((med, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-[11.5px] text-slate-700 leading-relaxed font-normal">
                                <span className="text-emerald-500 font-bold shrink-0">•</span>
                                <span>{med}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Allergies */}
                      {aiActionSummary.allergies?.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Allergies
                          </div>
                          <ul className="space-y-1 pl-1">
                            {aiActionSummary.allergies.map((allergy, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-[11.5px] text-slate-700 leading-relaxed font-normal">
                                <span className="text-amber-500 font-bold shrink-0">•</span>
                                <span>{allergy}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recent Clinical Notes */}
                      {aiActionSummary.recentNotes?.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Recent Clinical Notes
                          </div>
                          <ul className="space-y-1 pl-1">
                            {aiActionSummary.recentNotes.map((note, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-[11.5px] text-slate-700 leading-relaxed font-normal">
                                <span className="text-indigo-500 font-bold shrink-0">•</span>
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-800 leading-relaxed whitespace-pre-line text-[11.5px] max-h-72 overflow-y-auto pr-1">
                      {aiActionOutput}
                    </div>
                  )}
                </div>
              )}

              {/* Q&A Recent History */}
              {qaHistory.length > 1 && !aiActionLoading && (
                <div className="pt-2 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Previous Questions
                  </div>
                  {qaHistory.slice(0, -1).map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50/60 border border-slate-200 text-[11px] space-y-1">
                      <p className="font-semibold text-slate-700">Q: {item.question}</p>
                      <p className="text-slate-600 line-clamp-2">A: {item.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default RecordPreviewModal;
