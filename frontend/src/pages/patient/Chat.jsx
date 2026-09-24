import React, { useEffect, useState, useRef } from 'react';
import { Search, MessageSquare, Stethoscope, ShieldCheck } from 'lucide-react';
import { getMyAppointmentsApi } from '../../api/appointment';
import { getUserConversationsApi } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';
import { getSocketClient } from '../../socket/socket';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Input from '../../components/common/Input';
import PageHeader from '../../components/layout/PageHeader';
import ChatWindow from '../../components/chat/ChatWindow';
import { resolveDoctorName } from '../../utils/resolveDoctorName';
import { resolveProfileImage, getInitials } from '../../utils/resolveProfileImage';
import { formatSpecialization } from '../../utils/formatters';
import {
  buildConversationKey,
  sortConversationsByLatest,
  formatChatTime
} from '../../utils/chatManager';

const PatientChat = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConvKey, setSelectedConvKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const apptLookupRef = useRef(new Map());

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch patient appointments for lookup mapping
      const apptRes = await getMyAppointmentsApi().catch(() => ({ data: [] }));
      const apptList = apptRes.data || [];
      const apptLookup = new Map();
      apptList.forEach((a) => {
        if (a?._id) apptLookup.set(a._id.toString(), a);
      });
      apptLookupRef.current = apptLookup;

      // Fetch pre-sorted backend conversations
      const res = await getUserConversationsApi();
      const rawList = res.data || [];

      const formattedList = rawList.map((item) => {
        const docObj = item.doctorObj;
        const dName = resolveDoctorName({ doctorId: docObj, doctor: docObj });
        const spec = formatSpecialization(docObj?.specialization || item.departmentId?.name);
        const avatar = resolveProfileImage(docObj);

        return {
          ...item,
          doctorName: dName,
          specialization: spec,
          profileImage: avatar,
          lastMessageText: item.lastMessageText || 'No messages yet',
          lastMessageAt: item.lastMessageAt || 0
        };
      });

      const sortedList = sortConversationsByLatest(formattedList);
      setConversations(sortedList);
      if (sortedList.length > 0) {
        setSelectedConvKey(sortedList[0].key);
      }
    } catch (err) {
      setError(err.message || 'Failed to load doctor conversations');
    } finally {
      setLoading(false);
    }
  };

  const updateConversationWithMessage = (message) => {
    if (!message) return;
    setConversations((prevList) => {
      const msgTime = message.createdAt ? new Date(message.createdAt).getTime() : Date.now();
      const content = message.message || (message.attachment?.url ? 'Attachment file' : 'New message');

      const msgDoctorId = message.doctorId
        ? (typeof message.doctorId === 'object' ? message.doctorId._id : message.doctorId).toString()
        : null;
      const msgApptId = message.appointmentId ? message.appointmentId.toString() : null;

      const targetIndex = prevList.findIndex((c) => {
        if (c.doctorId && msgDoctorId && c.doctorId.toString() === msgDoctorId) return true;
        return (
          c.appointmentIds?.some((id) => id.toString() === msgApptId) ||
          c.latestApptId?.toString() === msgApptId
        );
      });

      if (targetIndex === -1) return prevList;

      const targetConv = {
        ...prevList[targetIndex],
        lastMessageText: content,
        lastMessageAt: msgTime,
        hasMessages: true
      };

      const remaining = [...prevList];
      remaining.splice(targetIndex, 1);

      return [targetConv, ...remaining].sort((a, b) => (new Date(b.lastMessageAt || 0).getTime()) - (new Date(a.lastMessageAt || 0).getTime()));
    });
  };

  const handleConversationUpdatedSocket = (updatedConv) => {
    if (!updatedConv) return;
    setConversations((prev) => {
      const convIdStr = (updatedConv.conversationId || updatedConv._id)?.toString();
      const docIdStr = (updatedConv.doctorId?._id || updatedConv.doctorId)?.toString();

      const merged = prev.map((item) => {
        const isMatch =
          (item.conversationId && item.conversationId.toString() === convIdStr) ||
          (item._id && item._id.toString() === convIdStr) ||
          (item.doctorId && docIdStr && item.doctorId.toString() === docIdStr);

        if (isMatch) {
          const lastMsgContent = updatedConv.lastMessage?.content || updatedConv.lastMessageText || 'New message';
          const lastMsgTime = updatedConv.lastMessageAt ? new Date(updatedConv.lastMessageAt).getTime() : Date.now();
          return {
            ...item,
            lastMessageText: lastMsgContent,
            lastMessageAt: lastMsgTime,
            hasMessages: true
          };
        }
        return item;
      });

      return merged.sort((a, b) => (new Date(b.lastMessageAt || 0).getTime()) - (new Date(a.lastMessageAt || 0).getTime()));
    });
  };

  useEffect(() => {
    const socket = getSocketClient();
    if (!socket.connected) socket.connect();

    const handleNewMsg = (msg) => {
      if (!msg) return;
      updateConversationWithMessage(msg);
    };

    socket.on('new_message', handleNewMsg);
    socket.on('message:new', handleNewMsg);
    socket.on('conversation:updated', handleConversationUpdatedSocket);

    return () => {
      socket.off('new_message', handleNewMsg);
      socket.off('message:new', handleNewMsg);
      socket.off('conversation:updated', handleConversationUpdatedSocket);
    };
  }, []);

  const handleMessageSent = (sentMsg) => {
    if (!sentMsg) return;
    updateConversationWithMessage(sentMsg);
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      conv.doctorName.toLowerCase().includes(q) ||
      conv.specialization.toLowerCase().includes(q) ||
      conv.lastMessageText.toLowerCase().includes(q)
    );
  });

  const selectedConv = conversations.find((c) => c.key === selectedConvKey);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader size="lg" />
        <p className="text-xs font-semibold text-slate-500">Loading doctor consultations...</p>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchConversations} />;
  }

  return (
    <div className="h-[calc(100vh-6.5rem)] md:h-[calc(100vh-6.5rem)] flex flex-col min-h-0 overflow-hidden font-sans !pt-2 !pb-0 !space-y-0">


      {conversations.length === 0 ? (
        <EmptyState
          title="No active doctor conversations"
          description="Book an appointment with a doctor to enable live chat messaging."
        />
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden">
          {/* 1. Conversation List Sidebar */}
          <div
            className={`md:col-span-5 lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-3.5 flex flex-col min-h-0 h-full shadow-xs space-y-3 ${
              selectedConvKey ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="flex items-center justify-between shrink-0 px-1">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Attending Doctors</h2>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                {filteredConversations.length}
              </span>
            </div>

            <div className="shrink-0">
              <Input
                placeholder="Search physician or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
              {filteredConversations.map((conv) => {
                const isSelected = selectedConvKey === conv.key;

                return (
                  <div
                    key={conv.key}
                    onClick={() => setSelectedConvKey(conv.key)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border text-xs space-y-1.5 ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-400 text-blue-950 font-semibold shadow-xs ring-1 ring-blue-500/20'
                        : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0 overflow-hidden shadow-2xs">
                          {conv.profileImage ? (
                            <img src={conv.profileImage} alt={conv.doctorName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{getInitials(conv.doctorName, 'DR')}</span>
                          )}
                        </div>

                        <div className="truncate flex-1">
                          <p className="font-bold text-slate-900 truncate">{conv.doctorName}</p>
                          <p className="text-[11px] text-blue-600 font-semibold truncate">{conv.specialization}</p>
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                        {formatChatTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1 pt-1 border-t border-slate-100">
                      {conv.lastMessageText}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Active Chat Detail Window */}
          <div
            className={`md:col-span-7 lg:col-span-8 flex flex-col min-h-0 h-full ${
              selectedConvKey ? 'flex' : 'hidden md:flex'
            }`}
          >
            {selectedConv ? (
              <ChatWindow
                conversationId={selectedConv.conversationId}
                appointmentId={selectedConv.latestApptId}
                recipientId={selectedConv.doctorId}
                currentUserId={user?._id || user?.id}
                currentRole="patient"
                participantName={selectedConv.doctorName}
                participantSubtext={`${selectedConv.specialization || 'Consultation'} • ${selectedConv.consultationCount || 1} Consultation${(selectedConv.consultationCount || 1) > 1 ? 's' : ''}`}
                participantImage={selectedConv.profileImage}
                showLiveStatus={false}
                onMessageSent={handleMessageSent}
                onBack={() => setSelectedConvKey(null)}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-400 space-y-3 h-full flex flex-col items-center justify-center shadow-xs">
                <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Select a clinician consultation</p>
                  <p className="text-xs text-slate-400 mt-0.5">Choose a doctor from the list to start messaging.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientChat;
