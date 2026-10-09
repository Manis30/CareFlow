import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Loader2,
  Trash2,
  Sparkles
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import AIBookingRecommendation from '../ai/AIBookingRecommendation';
import AICitation from '../ai/AICitation';
import AIAnalyticsResult from '../ai/AIAnalyticsResult';
import AIDraftReview from '../ai/AIDraftReview';
import AIEmergency from '../ai/AIEmergency';
import AIClarification from '../ai/AIClarification';
import AIError from '../ai/AIError';
import ClinicalPulse from '../clinical/ClinicalPulse';

/**
 * Sanitizes and flattens any doctor-facing text or plain object.
 * Strips raw OCR chunk markers and technical metadata from output.
 */
const sanitizeClinicalText = (raw) => {
  if (raw === null || raw === undefined) return '';
  let str = '';
  if (typeof raw === 'object') {
    str = raw.message || raw.summary || raw.response || raw.text || raw.answer || '';
    if (!str && typeof raw !== 'function') {
      try {
        str = JSON.stringify(raw);
      } catch {
        str = 'Clinical information processed.';
      }
    }
  } else {
    str = String(raw);
  }

  // Strip technical OCR chunk markers and internal markers
  return str
    .replace(/^Document Chunk \[\d+\]:\s*/gim, '')
    .replace(/Document Chunk \[\d+\]:\s*/gi, '')
    .replace(/\[Chunk \d+\]\s*/gi, '')
    .replace(/^Medical Record \[\d+\]:\s*/gim, '')
    .replace(/\[object Object\]/g, 'Medical Record');
};

export const AiDrawer = ({ isOpen: controlledIsOpen, onClose: controlledOnClose }) => {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  const setIsOpen = controlledOnClose || setInternalOpen;

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef = useRef(null);
  const isSubmittingRef = useRef(false);

  // Role-specific Intelligence Title
  const getIntelligenceTitle = () => {
    switch (user?.role) {
      case 'patient':
        return 'CareFlow Concierge';
      case 'doctor':
        return 'CareFlow Clinical Assistant';
      case 'organization_admin':
      case 'admin':
        return 'CareFlow Operations Intelligence';
      case 'super_admin':
        return 'CareFlow Platform Intelligence';
      default:
        return 'CareFlow Intelligence';
    }
  };

  const roleCategories = {
    patient: ['Appointments', 'Find Care', 'Prescriptions', 'Records'],
    doctor: ['Today Schedule', 'Patient Records', 'Clinical Notes', 'Availability'],
    organization_admin: ['Department Stats', 'Doctor Workload', 'Revenue Ledger', 'Booking Volume'],
    admin: ['Department Stats', 'Doctor Workload', 'Revenue Ledger', 'Booking Volume'],
    super_admin: ['Organization Growth', 'Platform Stats', 'System Health', 'Doctor Registry']
  };

  const categories = user?.role ? (roleCategories[user.role] || roleCategories.patient) : roleCategories.patient;

  const rolePrompts = {
    patient: [
      "I have a skin rash and need a consultation",
      "Show my upcoming appointments",
      "Explain my active prescriptions"
    ],
    doctor: [
      "Show patient Karthik Raj's records",
      "Summarize medical records for my next appointment",
      "Draft clinical notes for consultation"
    ],
    organization_admin: [
      "Which department had the most appointments this week?",
      "Summarize doctor workload across specialties",
      "Check pending payment transactions"
    ],
    admin: [
      "Which department had the most appointments this week?",
      "Summarize doctor workload across specialties",
      "Check pending payment transactions"
    ],
    super_admin: [
      "Platform organization growth and activity",
      "Platform appointment volume summary",
      "Doctor distribution across clinics"
    ]
  };

  const prompts = user?.role ? (rolePrompts[user.role] || rolePrompts.patient) : rolePrompts.patient;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, loading]);

  useEffect(() => {
    if (user && isOpen && !historyLoaded) {
      loadHistory();
    }
  }, [user, isOpen, historyLoaded]);

  const loadHistory = async () => {
    try {
      const res = await api.get('/ai/history');
      if (res.data?.data?.messages && Array.isArray(res.data.data.messages)) {
        const raw = res.data.data.messages;
        const formatted = [];

        for (let i = 0; i < raw.length; i++) {
          const m = raw[i];
          const isUser = m.role === 'user';
          const isEmerg = m.responseType === 'EMERGENCY_ESCALATION' || m.isEmergency === true;
          const isConf = m.responseType === 'CONFIRMATION_REQUIRED' || m.isConfirmationCard === true || m.isConfirmation === true;
          const confPayload = m.confirmationPayload || m.payload || null;
          const cleanText = sanitizeClinicalText(m.text);

          // Deduplicate accidental consecutive identical messages
          if (formatted.length > 0) {
            const prev = formatted[formatted.length - 1];
            if (prev.sender === (isUser ? 'user' : 'ai') && prev.text === cleanText && cleanText) {
              continue;
            }
          }

          formatted.push({
            id: String(m._id || m.id || `hist_${i}_${Date.now()}`),
            sender: isUser ? 'user' : 'ai',
            text: cleanText,
            citations: Array.isArray(m.citations) ? m.citations : [],
            isEmergency: isEmerg,
            isConfirmation: isConf,
            confirmationId: m.confirmationId || confPayload?.confirmationId || null,
            payload: confPayload?.payload || m.payload || null,
            summary: sanitizeClinicalText(confPayload?.summary || m.summary || m.text || null),
            toolCallsUsed: m.toolCallsUsed || [],
            responseType: m.responseType || (isEmerg ? 'EMERGENCY_ESCALATION' : (isConf ? 'CONFIRMATION_REQUIRED' : 'live_data')),
            timestamp: m.timestamp || new Date()
          });
        }

        if (formatted.length > 0) {
          setMessages(formatted);
        } else {
          setMessages([
            {
              id: `welcome_${Date.now()}`,
              sender: 'ai',
              text: `Welcome to ${getIntelligenceTitle()}. How can I assist with your clinical workflow today, ${user?.name || ''}?`
            }
          ]);
        }
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setHistoryLoaded(true);
    }
  };

  const clearHistory = async () => {
    try {
      await api.delete('/ai/history');
      setMessages([
        {
          id: `reset_${Date.now()}`,
          sender: 'ai',
          text: `Intelligence workspace session reset. How may I assist you now?`
        }
      ]);
    } catch (e) {
      console.error('[CareFlow Intelligence] Failed to clear history:', e);
    }
  };

  const handleSendMessage = async (textToSend, confirmed = false, confirmationId = null, retryMsgId = null) => {
    if (isSubmittingRef.current) return;
    const queryText = textToSend || inputMessage;
    if (!queryText.trim() && !confirmed) return;

    isSubmittingRef.current = true;
    setLoading(true);

    const userMsgId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const aiMsgId = retryMsgId || `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!confirmed && !retryMsgId) {
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, sender: 'user', text: queryText },
        { id: aiMsgId, sender: 'ai', isPending: true }
      ]);
      setInputMessage('');
    } else if (retryMsgId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === retryMsgId ? { ...m, isPending: true, isError: false, text: '' } : m
        )
      );
    } else if (confirmed) {
      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, sender: 'ai', isPending: true }
      ]);
    }

    try {
      const requestPayload = confirmed
        ? { confirmed: true, confirmationId }
        : { message: queryText };

      const response = await api.post('/ai/gateway', requestPayload);
      const data = response.data?.data;

      const updateAiSlot = (updateProps) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === aiMsgId);
          if (exists) {
            return prev.map((m) =>
              m.id === aiMsgId ? { id: aiMsgId, sender: 'ai', isPending: false, ...updateProps } : m
            );
          }
          return [...prev, { id: aiMsgId, sender: 'ai', isPending: false, ...updateProps }];
        });
      };

      // Authoritative Emergency Signal: responseType === "EMERGENCY" / "EMERGENCY_ESCALATION"
      if (data?.responseType === 'EMERGENCY' || data?.responseType === 'EMERGENCY_ESCALATION' || data?.isEmergency || data?.safety?.isEmergency) {
        updateAiSlot({
          isEmergency: true,
          responseType: 'EMERGENCY',
          text: sanitizeClinicalText(data.aiResponse || data.escalationMessage || "Red-flag clinical symptoms detected. Please contact emergency services (108 / 112 / 911) immediately or proceed to the nearest medical emergency facility.")
        });
      } else if (data?.responseType === 'CONFIRMATION_REQUIRED' || data?.requiresConfirmation || data?.result?.confirmation_required) {
        const confData = data.result || data;
        updateAiSlot({
          isConfirmation: true,
          responseType: 'CONFIRMATION_REQUIRED',
          confirmationId: data.confirmationId || confData.confirmationId,
          summary: sanitizeClinicalText(confData.summary || data.aiResponse || "Clinical confirmation required before booking or write action."),
          payload: confData.payload || confData.actionPayload || null,
          citations: Array.isArray(data.citations) ? data.citations : []
        });
      } else if (data?.responseType === 'BOOKING_SUCCESS' || data?.responseType === 'ACTION_COMPLETED') {
        updateAiSlot({
          text: sanitizeClinicalText(data.aiResponse || "Your booking has been confirmed and scheduled."),
          citations: Array.isArray(data.citations) ? data.citations : [],
          responseType: 'BOOKING_SUCCESS'
        });
        window.dispatchEvent(new CustomEvent('careflow:appointment-updated'));
      } else if (data?.responseType === 'BOOKING_FAILED' || data?.responseType === 'CONFLICT') {
        updateAiSlot({
          isError: true,
          responseType: 'BOOKING_FAILED',
          text: sanitizeClinicalText(data.aiResponse || "The requested booking could not be completed. The appointment slot was not created.")
        });
      } else if (data?.responseType === 'ERROR') {
        updateAiSlot({
          isError: true,
          responseType: 'ERROR',
          originalQuery: queryText,
          text: sanitizeClinicalText(data.aiResponse || "A clinical processing error occurred. Please retry your request.")
        });
      } else if (
        data?.responseType === 'ANALYTICS' ||
        data?.isAnalytics === true ||
        data?.analyticsPayload ||
        data?.result?.isAnalytics === true
      ) {
        const analyticsData = data.analyticsPayload || data.result || data;
        updateAiSlot({
          isAnalytics: true,
          analyticsResult: analyticsData,
          text: sanitizeClinicalText(data.aiResponse || analyticsData.groundedNarrative || analyticsData.summary || ''),
          citations: Array.isArray(data.citations) ? data.citations : []
        });
      } else if (
        data?.responseType === 'DRAFT_REQUIRING_REVIEW' ||
        data?.result?.isDraft === true ||
        data?.result?.responseType === 'DRAFT_REQUIRING_REVIEW'
      ) {
        updateAiSlot({
          isDraftReview: true,
          draftText: sanitizeClinicalText(data.aiResponse || data.result?.draftContent || (typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2))),
          text: sanitizeClinicalText(data.aiResponse || data.result?.draftContent),
          citations: Array.isArray(data.citations) ? data.citations : []
        });
      } else {
        // Safe Grounded Answer, Clarification, or Pure Data Response
        const resObj = data?.result;
        const fallbackText = typeof resObj === 'string'
          ? resObj
          : resObj?.message || resObj?.summary || resObj?.answer || resObj?.response || "I couldn't verify that information.";
        const responseText = data?.aiResponse || fallbackText;
        const cleanText = sanitizeClinicalText(responseText);

        const safeCitations = Array.isArray(data?.citations)
          ? data.citations
          : (Array.isArray(data?.result?.citations) ? data.result.citations : []);

        updateAiSlot({
          text: cleanText,
          citations: safeCitations,
          hasLowConfidenceWarning: Boolean(data?.hasLowConfidenceWarning || data?.result?.hasLowConfidenceWarning),
          responseType: data?.responseType || 'ANSWER'
        });
      }
    } catch (err) {
      console.error('[CareFlow Intelligence Error]:', err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.data?.aiResponse ||
        err.message ||
        'CareFlow Intelligence encountered an error. Please retry your inquiry.';

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === aiMsgId);
        if (exists) {
          return prev.map((m) =>
            m.id === aiMsgId
              ? {
                  id: aiMsgId,
                  sender: 'ai',
                  isPending: false,
                  isError: true,
                  originalQuery: queryText,
                  text: sanitizeClinicalText(errorMessage)
                }
              : m
          );
        }
        return [
          ...prev,
          {
            id: aiMsgId,
            sender: 'ai',
            isPending: false,
            isError: true,
            originalQuery: queryText,
            text: sanitizeClinicalText(errorMessage)
          }
        ];
      });
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleConfirmAction = (msg) => {
    if (loading) return;
    const confirmationId = msg.confirmationId;
    if (!confirmationId) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'ai',
          isError: true,
          text: "This confirmation request has expired or is invalid. Please request an appointment slot again."
        }
      ]);
      return;
    }
    handleSendMessage(
      null,
      true,
      confirmationId
    );
  };

  if (!user) return null;

  return (
    <>
      {/* Slide-in Clinical Intelligence Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200/80 z-10">
            {/* 1. Clinical Header */}
            <div className="h-16 px-5 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      CAREFLOW INTELLIGENCE
                    </span>
                    <ClinicalPulse width={36} height={12} color="#2563EB" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {getIntelligenceTitle()}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={clearHistory}
                  title="Clear conversation"
                  aria-label="Clear conversation history"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close intelligence drawer"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. Topic Chips Filter */}
            <div className="px-5 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
                Explore:
              </span>
              {categories.map((cat, idx) => (
                <button
                  key={`cat_${idx}`}
                  type="button"
                  onClick={() => handleSendMessage(`What can you tell me about ${cat}?`)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200/80 text-[11px] font-semibold text-slate-700 whitespace-nowrap transition-colors cursor-pointer shadow-2xs"
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 3. Messages Feed */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
              {messages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                const key = msg.id || `msg_${idx}`;

                return (
                  <div
                    key={key}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
                  >
                    {isUser ? (
                      <div className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs sm:text-sm font-medium shadow-xs max-w-[85%]">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="w-full space-y-2">
                        {msg.isPending ? (
                          /* In-Flight Pending Assistant Message */
                          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl rounded-tl-xs bg-white border border-slate-200/80 text-xs text-slate-600 w-fit shadow-xs">
                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                            <span className="font-medium">Analyzing healthcare data...</span>
                          </div>
                        ) : msg.isEmergency ? (
                          /* Emergency Escalation */
                          <AIEmergency escalationMessage={msg.text} />
                        ) : msg.isConfirmation ? (
                          /* Booking or Action Recommendation Requiring Confirmation */
                          <div className="space-y-2">
                            <p className="text-xs text-slate-800 leading-relaxed font-medium">
                              {msg.summary}
                            </p>
                            <AIBookingRecommendation
                              payload={msg.payload}
                              disabled={loading}
                              onConfirm={() => handleConfirmAction(msg)}
                              onCancel={() =>
                                setMessages((prev) => [
                                  ...prev,
                                  {
                                    id: `cancel_usr_${Date.now()}`,
                                    sender: 'user',
                                    text: 'Action cancelled.'
                                  },
                                  {
                                    id: `cancel_ai_${Date.now()}`,
                                    sender: 'ai',
                                    text: 'Appointment recommendation was dismissed.'
                                  }
                                ])
                              }
                            />
                            {msg.citations && msg.citations.length > 0 && (
                              <AICitation citations={msg.citations} />
                            )}
                          </div>
                        ) : msg.isAnalytics ? (
                          /* Structured Analytics Card */
                          <div>
                            <AIAnalyticsResult
                              result={msg.analyticsResult}
                              summaryText={msg.text}
                            />
                            {msg.citations && msg.citations.length > 0 && (
                              <AICitation citations={msg.citations} />
                            )}
                          </div>
                        ) : msg.isDraftReview ? (
                          /* Structured Physician Draft Note */
                          <div>
                            <AIDraftReview draftText={msg.draftText || msg.text} />
                            {msg.citations && msg.citations.length > 0 && (
                              <AICitation citations={msg.citations} />
                            )}
                          </div>
                        ) : msg.isError ? (
                          /* Error Notice with In-Place Retry */
                          <AIError
                            errorText={msg.text}
                            onRetry={() =>
                              handleSendMessage(
                                msg.originalQuery || inputMessage || 'Retry last command',
                                false,
                                null,
                                msg.id
                              )
                            }
                          />
                        ) : (
                          /* Standard Grounded Intelligence Narrative */
                          <div className="bg-white border border-slate-200/80 p-4 rounded-2xl rounded-tl-xs shadow-xs text-xs sm:text-sm text-slate-800 leading-relaxed space-y-2">
                            {msg.responseType === 'PRE_VISIT_BRIEF' && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold tracking-wider uppercase mb-1">
                                Pre-Visit Clinical Brief
                              </div>
                            )}
                            <div className="whitespace-pre-line">{msg.text}</div>
                            {msg.hasLowConfidenceWarning && (
                              <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex items-center gap-2">
                                <span className="font-semibold shrink-0">⚠️ Low OCR Confidence:</span>
                                <span>Portions of this scanned document have degraded clarity. Cross-verify critical values with original records.</span>
                              </div>
                            )}
                            {msg.citations && msg.citations.length > 0 && (
                              <AICitation citations={msg.citations} />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* 4. Suggested Prompts */}
            {messages.length <= 1 && (
              <div className="p-4 bg-white border-t border-slate-100 space-y-2 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Suggested Actions:
                </span>
                <div className="space-y-1.5">
                  {prompts.map((p, idx) => (
                    <button
                      key={`prm_${idx}`}
                      type="button"
                      onClick={() => handleSendMessage(p)}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-50/80 hover:bg-blue-50/60 hover:border-blue-200 border border-slate-200/60 text-xs font-medium text-slate-800 transition-colors truncate cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-4 bg-white border-t border-slate-100 shrink-0"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask CareFlow Intelligence..."
                  disabled={loading}
                  className="flex-1 text-xs sm:text-sm font-medium text-slate-900 bg-white rounded-xl border border-slate-200/80 py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={loading || !inputMessage.trim()}
                  aria-label="Send query"
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AiDrawer;
