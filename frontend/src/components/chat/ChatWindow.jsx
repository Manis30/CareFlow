import React, { useEffect, useState, useRef } from 'react';
import { Send, Paperclip, AlertCircle, ArrowLeft, CheckCheck, ChevronDown, MessageSquare } from 'lucide-react';
import { getAppointmentMessagesApi, sendAppointmentMessageApi, createOrGetConversationApi } from '../../api/chat';
import { getSocketClient } from '../../socket/socket';
import Loader from '../common/Loader';
import Button from '../common/Button';
import PulseIndicator from '../clinical/PulseIndicator';
import { formatDateTime } from '../../utils/formatDate';

const normalizeRoleString = (rawRole) => {
  if (!rawRole) return '';
  const s = String(rawRole).toLowerCase().trim();
  if (['super_admin', 'super-admin', 'superadmin'].includes(s)) return 'super_admin';
  if (['organization_admin', 'admin', 'clinic_admin', 'org_admin'].includes(s)) return 'organization_admin';
  if (['doctor'].includes(s)) return 'doctor';
  if (['patient'].includes(s)) return 'patient';
  return s;
};

const ChatWindow = ({
  conversationId = null,
  appointmentId = null,
  conversationType = "PATIENT_DOCTOR",
  recipientId = null,
  currentUserId,
  currentRole,
  participantName = 'Chat Partner',
  participantSubtext = 'Active Session',
  participantImage = null,
  showLiveStatus = false,
  onMessageSent = null,
  onBack = null
}) => {
  const [activeConvId, setActiveConvId] = useState(conversationId);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [showNewMessagesIndicator, setShowNewMessagesIndicator] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesContainerRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesCacheRef = useRef(new Map());

  useEffect(() => {
    setActiveConvId(conversationId);
  }, [conversationId]);

  const targetKey = activeConvId || appointmentId || `${conversationType}_${recipientId}`;
  const normalizedCurrentRole = normalizeRoleString(currentRole);

  const checkIfNearBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    const threshold = 120;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  };

  const scrollToBottom = (behavior = 'smooth') => {
    setShowNewMessagesIndicator(false);
    setUnreadCount(0);
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior });
    } else if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (checkIfNearBottom()) {
      setShowNewMessagesIndicator(false);
      setUnreadCount(0);
    }
  };

  const fetchMessages = async (showLoader = true) => {
    try {
      if (showLoader && !messagesCacheRef.current.has(targetKey)) {
        setLoading(true);
      }
      setError('');

      if (!activeConvId && !appointmentId) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const lookupId = activeConvId || appointmentId;
      const res = await getAppointmentMessagesApi(lookupId);
      if (res?.data) {
        setMessages(res.data);
        messagesCacheRef.current.set(targetKey, res.data);
      }
    } catch (err) {
      if (err.status !== 404 && err.statusCode !== 404) {
        setError(err.message || 'Failed to load chat messages');
      }
    } finally {
      setLoading(false);
      setShowNewMessagesIndicator(false);
      setUnreadCount(0);
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  useEffect(() => {
    setShowNewMessagesIndicator(false);
    setUnreadCount(0);

    if (messagesCacheRef.current.has(targetKey)) {
      setMessages(messagesCacheRef.current.get(targetKey));
      setLoading(false);
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 50);
      fetchMessages(false);
    } else {
      fetchMessages(true);
    }
  }, [targetKey]);

  useEffect(() => {
    const socket = getSocketClient();

    if (!socket.connected) {
      socket.connect();
    }

    setSocketConnected(socket.connected);

    const handleConnect = () => {
      setSocketConnected(true);
      if (appointmentId) socket.emit('join_appointment_chat', { appointmentId, conversationId: activeConvId });
      if (activeConvId) socket.emit('join_conversation', { conversationId: activeConvId });
    };

    socket.on('connect', handleConnect);

    if (socket.connected) {
      if (appointmentId) socket.emit('join_appointment_chat', { appointmentId, conversationId: activeConvId });
      if (activeConvId) socket.emit('join_conversation', { conversationId: activeConvId });
    }

    const handleChatJoined = () => {
      setError('');
    };

    const handleNewMessage = (newMsg) => {
      if (!newMsg) return;

      const senderIdStr = typeof newMsg.senderId === 'object' ? newMsg.senderId?._id : newMsg.senderId;
      const msgRoleNorm = normalizeRoleString(newMsg.senderRole);
      const isMe = (senderIdStr && currentUserId && senderIdStr.toString() === currentUserId.toString()) ||
        (msgRoleNorm && normalizedCurrentRole && msgRoleNorm === normalizedCurrentRole);

      const isNearBottom = checkIfNearBottom();

      setMessages((prev) => {
        if (prev.some((m) => m._id && newMsg._id && m._id === newMsg._id)) return prev;
        const next = [...prev, newMsg];
        messagesCacheRef.current.set(targetKey, next);
        return next;
      });

      if (isMe || isNearBottom) {
        setTimeout(() => scrollToBottom('smooth'), 50);
      } else {
        setShowNewMessagesIndicator(true);
        setUnreadCount((c) => c + 1);
      }
    };

    const handleChatError = (errData) => {
      if (errData?.message && !errData.message.includes('join conversation room')) {
        setError(errData.message);
      }
    };

    socket.on('chat_joined', handleChatJoined);
    socket.on('new_message', handleNewMessage);
    socket.on('message:new', handleNewMessage);
    socket.on('chat_error', handleChatError);

    return () => {
      if (appointmentId) socket.emit('leave_appointment_chat', { appointmentId, conversationId: activeConvId });
      if (activeConvId) socket.emit('leave_conversation', { conversationId: activeConvId });
      socket.off('connect', handleConnect);
      socket.off('chat_joined', handleChatJoined);
      socket.off('new_message', handleNewMessage);
      socket.off('message:new', handleNewMessage);
      socket.off('chat_error', handleChatError);
    };
  }, [targetKey, activeConvId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if ((!text && !attachment) || sending) return;

    try {
      setSending(true);
      setError('');

      let validConvId = activeConvId;

      if (!validConvId && recipientId) {
        const convRes = await createOrGetConversationApi({
          recipientId,
          conversationType
        });

        const resolvedConv = convRes?.data || convRes?.conversation;
        validConvId = resolvedConv?._id || resolvedConv?.id;

        if (!validConvId) {
          throw new Error("Failed to initialize conversation with recipient.");
        }

        setActiveConvId(validConvId);
      }

      const socket = getSocketClient();

      if (attachment) {
        const formData = new FormData();
        formData.append('message', text);
        formData.append('attachment', attachment);
        if (validConvId) formData.append('conversationId', validConvId);
        if (conversationType) formData.append('conversationType', conversationType);
        if (recipientId) formData.append('recipientId', recipientId);

        const res = await sendAppointmentMessageApi(validConvId, formData);
        const savedMsg = res.data?.message || res.data;
        const updatedConv = res.data?.conversation || { _id: validConvId, organizationAdminId: recipientId };

        if (savedMsg) {
          setMessages((prev) => {
            if (prev.some((m) => m._id && savedMsg._id && m._id === savedMsg._id)) return prev;
            const next = [...prev, savedMsg];
            messagesCacheRef.current.set(validConvId, next);
            return next;
          });
        }
        if (onMessageSent) onMessageSent(savedMsg, updatedConv);
        setInputText('');
        setAttachment(null);
        setTimeout(() => scrollToBottom('smooth'), 50);
      } else {
        const payload = {
          conversationId: validConvId,
          conversationType,
          recipientId,
          message: text
        };
        const res = await sendAppointmentMessageApi(validConvId, payload);
        const savedMsg = res.data?.message || res.data;
        const updatedConv = res.data?.conversation || { _id: validConvId, organizationAdminId: recipientId };

        if (socket?.connected && validConvId) {
          socket.emit('join_conversation', { conversationId: validConvId });
        }

        if (savedMsg) {
          setMessages((prev) => {
            if (prev.some((m) => m._id && savedMsg._id && m._id === savedMsg._id)) return prev;
            const next = [...prev, savedMsg];
            messagesCacheRef.current.set(validConvId, next);
            return next;
          });
        }
        if (onMessageSent) onMessageSent(savedMsg, updatedConv);
        setInputText('');
        setTimeout(() => scrollToBottom('smooth'), 50);
      }
    } catch (err) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'C';
    const parts = name.replace(/^Dr\.\s*/i, '').trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs relative">
      {/* Participant Header (DomoApp Clean Bar) */}
      <div className="px-5 py-3.5 bg-white text-slate-900 flex items-center justify-between shrink-0 z-10 border-b border-slate-200/80">
        <div className="flex items-center gap-3.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden text-slate-500 hover:text-slate-900 p-1 cursor-pointer -ml-1 shrink-0"
              title="Back to contacts"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-extrabold text-sm flex items-center justify-center border border-blue-100 overflow-hidden shrink-0 shadow-2xs">
            {participantImage ? (
              <img src={participantImage} alt={participantName} className="w-full h-full object-cover" />
            ) : (
              <span>{getInitials(participantName)}</span>
            )}
          </div>

          <div className="truncate">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
              {participantName}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium truncate">{participantSubtext}</p>
          </div>
        </div>

        {showLiveStatus && (
          <div className="flex items-center gap-2 shrink-0">
            <PulseIndicator
              status={socketConnected ? 'online' : 'offline'}
              pulseColor={socketConnected ? '#2563EB' : '#E11D48'}
            />
            <span className="text-[10px] font-extrabold text-slate-400 hidden sm:inline uppercase tracking-wider">
              {socketConnected ? 'Encrypted Stream' : 'Reconnecting'}
            </span>
          </div>
        )}
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Message History Area */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-slate-50/60 flex flex-col">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5"
        >
          {loading ? (
            <div className="h-full min-h-full flex items-center justify-center p-6">
              <Loader size="md" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full min-h-full flex flex-col items-center justify-center text-slate-400 space-y-3 p-6 text-center select-none">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm font-bold text-slate-900">Consultation Channel Open</p>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-medium">
                Send a message to begin real-time clinical dialogue with {participantName}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, index) => {
                const senderIdStr = typeof msg.senderId === 'object' ? msg.senderId?._id : msg.senderId;
                const msgRoleNorm = normalizeRoleString(msg.senderRole);
                const isMe = (senderIdStr && currentUserId && senderIdStr.toString() === currentUserId.toString()) ||
                  (msgRoleNorm && normalizedCurrentRole && msgRoleNorm === normalizedCurrentRole);

                return (
                  <div
                    key={msg._id || index}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 shadow-xs font-sans transition-all ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-xs'
                          : 'bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs'
                      }`}
                    >
                      {msg.message && (
                        <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
                          {msg.message}
                        </p>
                      )}

                      {msg.attachment?.url && (
                        <div className="mt-2 pt-2 border-t border-white/20">
                          <a
                            href={msg.attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1.5 underline text-xs font-semibold ${
                              isMe ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'
                            }`}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>Clinical Attachment</span>
                          </a>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1.5 mt-2 pt-0.5">
                        <span className={`text-[10px] font-mono ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                          {formatDateTime(msg.createdAt)}
                        </span>
                        {isMe && <CheckCheck className="w-3.5 h-3.5 text-blue-200 shrink-0" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Floating "New Messages" Button Indicator */}
        {showNewMessagesIndicator && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-4 right-5 z-20 bg-blue-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-blue-700 transition-all animate-bounce cursor-pointer"
          >
            <span>New messages</span>
            {unreadCount > 0 && (
              <span className="bg-white text-blue-700 text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                {unreadCount}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Composer Input Bar */}
      <form onSubmit={handleSendMessage} className="p-3.5 bg-white border-t border-slate-200/80 flex flex-col gap-2 shrink-0 z-10">
        {attachment && (
          <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50 text-blue-800 rounded-xl text-xs border border-blue-100">
            <span className="truncate font-semibold flex items-center gap-2">
              <Paperclip className="w-3.5 h-3.5 text-blue-600" /> {attachment.name}
            </span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer p-1"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <label className="p-2 text-slate-400 hover:text-blue-600 cursor-pointer rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <Paperclip className="w-5 h-5" />
            <input
              type="file"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a clinical or operational message..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
          />

          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={Send}
            loading={sending}
            disabled={(!inputText.trim() && !attachment) || sending}
            className="shrink-0 font-bold rounded-xl"
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatWindow;
