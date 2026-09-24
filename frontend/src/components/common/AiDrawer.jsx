import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Loader2,
  Trash2,
  Activity,
  Calendar,
  User,
  Clock,
  FileHeart,
  Building2,
  HelpCircle,
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
import ECGDivider from '../clinical/ECGDivider';

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
      "Summarize medical records for my next appointment",
      "Draft clinical notes for consultation",
      "Check operating schedule for today"
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
  }, [messages, isOpen]);

  useEffect(() => {
    if (user && isOpen && !historyLoaded) {
      loadHistory();
    }
  }, [user, isOpen, historyLoaded]);

  const loadHistory = async () => {
    try {
      const res = await api.get('/ai/history');
      if (res.data?.data?.messages && Array.isArray(res.data.data.messages)) {
        const formatted = res.data.data.messages.map((m) => {
          const isEmerg = m.responseType === 'EMERGENCY_ESCALATION' || m.isEmergency === true;
          const isConf = m.responseType === 'CONFIRMATION_REQUIRED' || m.isConfirmationCard === true || m.isConfirmation === true;
          const confPayload = m.confirmationPayload || m.payload || null;
          return {
            sender: m.role === 'user' ? 'user' : 'ai',
            text: m.text,
            citations: m.citations || [],
            isEmergency: isEmerg,
            isConfirmation: isConf,
            confirmationId: m.confirmationId || confPayload?.confirmationId || null,
            payload: confPayload?.payload || m.payload || null,
            summary: confPayload?.summary || m.summary || m.text || null,
            toolCallsUsed: m.toolCallsUsed || [],
            responseType: m.responseType || (isEmerg ? 'EMERGENCY_ESCALATION' : (isConf ? 'CONFIRMATION_REQUIRED' : 'live_data')),
            timestamp: m.timestamp || new Date()
          };
        });
        if (formatted.length > 0) {
          setMessages(formatted);
        } else {
          setMessages([
            {
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
          sender: 'ai',
          text: `Intelligence workspace session reset. How may I assist you now?`
        }
      ]);
    } catch (e) {
      console.error('[CareFlow Intelligence] Failed to clear history:', e);
    }
  };

  const handleSendMessage = async (textToSend, confirmed = false, confirmationId = null) => {
    if (loading) return;
    const queryText = textToSend || inputMessage;
    if (!queryText.trim() && !confirmed) return;

    if (!confirmed) {
      setMessages((prev) => [...prev, { sender: 'user', text: queryText }]);
      setInputMessage('');
    }

    setLoading(true);

    try {
      const requestPayload = confirmed
        ? { confirmed: true, confirmationId }
        : { message: queryText };

      const response = await api.post('/ai/gateway', requestPayload);
      const data = response.data?.data;

      // Authoritative Emergency Signal: responseType === "EMERGENCY_ESCALATION" or data?.isEmergency
      if (data?.responseType === 'EMERGENCY_ESCALATION' || data?.isEmergency || data?.safety?.isEmergency) {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            isEmergency: true,
            responseType: 'EMERGENCY_ESCALATION',
            text: data.aiResponse || data.escalationMessage || "Red-flag clinical symptoms detected. Please contact emergency services (108 / 112 / 911) immediately or proceed to the nearest medical emergency facility."
          }
        ]);
      } else if (data?.responseType === 'CONFIRMATION_REQUIRED' || data?.requiresConfirmation || data?.result?.confirmation_required) {
        const confData = data.result || data;
        setMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            isConfirmation: true,
            responseType: 'CONFIRMATION_REQUIRED',
            confirmationId: data.confirmationId || confData.confirmationId,
            summary: confData.summary || data.aiResponse || "Clinical confirmation required before booking or write action.",
            payload: confData.payload || confData.actionPayload || null,
            citations: data.citations || []
          }
        ]);
      } else if (data?.responseType === 'ACTION_COMPLETED') {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: data.aiResponse || "Your booking has been confirmed and scheduled.",
            citations: data.citations || [],
            responseType: 'ACTION_COMPLETED'
          }
        ]);
        window.dispatchEvent(new CustomEvent('careflow:appointment-updated'));
      } else if (
        data?.responseType === 'ANALYTICS' ||
        data?.isAnalytics === true ||
        data?.analyticsPayload ||
        data?.result?.isAnalytics === true
      ) {
        const analyticsData = data.analyticsPayload || data.result || data;
        setMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            isAnalytics: true,
            analyticsResult: analyticsData,
            text: data.aiResponse || analyticsData.groundedNarrative || analyticsData.summary || '',
            citations: data.citations || []
          }
        ]);
      } else {
        const responseText = data?.aiResponse || (typeof data?.result === 'string' ? data.result : data?.result?.summary || JSON.stringify(data?.result, null, 2));
        setMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: typeof responseText === 'object' ? (responseText.response || JSON.stringify(responseText)) : responseText,
            citations: data?.citations || data?.result?.citations || [],
            responseType: data?.responseType || 'live_data'
          }
        ]);
      }
    } catch (err) {
      console.error('[CareFlow Intelligence Error]:', err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.data?.aiResponse ||
        err.message ||
        'CareFlow Intelligence encountered an error. Please retry your inquiry.';
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          isError: true,
          text: errorMessage
        }
      ]);
    } finally {
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
                  key={idx}
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
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
                  >
                    {isUser ? (
                      <div className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs sm:text-sm font-medium shadow-xs max-w-[85%]">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="w-full space-y-2">
                        {/* Emergency Escalation */}
                        {msg.isEmergency ? (
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
                                  { sender: 'user', text: 'Action cancelled.' },
                                  { sender: 'ai', text: 'Appointment recommendation was dismissed.' }
                                ])
                              }
                            />
                            {msg.citations && <AICitation citations={msg.citations} />}
                          </div>
                        ) : msg.isAnalytics ? (
                          /* Structured Analytics Card */
                          <div>
                            <AIAnalyticsResult
                              result={msg.analyticsResult}
                              summaryText={msg.text}
                            />
                            {msg.citations && <AICitation citations={msg.citations} />}
                          </div>
                        ) : msg.isError ? (
                          /* Error Notice */
                          <AIError
                            errorText={msg.text}
                            onRetry={() => handleSendMessage(inputMessage || 'Retry last command')}
                          />
                        ) : (
                          /* Standard Grounded Intelligence Narrative */
                          <div className="bg-white border border-slate-200/80 p-4 rounded-2xl rounded-tl-xs shadow-xs text-xs sm:text-sm text-slate-800 leading-relaxed space-y-2">
                            <div className="whitespace-pre-line">{msg.text}</div>
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

              {loading && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-600 w-fit shadow-xs">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="font-medium">Processing healthcare intelligence...</span>
                </div>
              )}

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
                      key={idx}
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
