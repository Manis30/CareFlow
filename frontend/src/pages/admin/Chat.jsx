import React, { useEffect, useState } from 'react';
import { Search, MessageSquare, ShieldCheck, Stethoscope, Building2, Radio } from 'lucide-react';
import { getUserConversationsApi } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';
import { getSocketClient } from '../../socket/socket';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Input from '../../components/common/Input';
import ContentContainer from '../../components/layout/ContentContainer';
import ChatWindow from '../../components/chat/ChatWindow';
import PulseIndicator from '../../components/clinical/PulseIndicator';
import { resolveProfileImage, getInitials } from '../../utils/resolveProfileImage';
import { formatDoctorName } from '../../utils/formatters';
import {
  sortConversationsByLatest,
  formatChatTime
} from '../../utils/chatManager';

const AdminChat = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConvKey, setSelectedConvKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [socketConnected, setSocketConnected] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await getUserConversationsApi();
      const rawList = res.data || [];

      const formattedList = rawList.map((item) => {
        let name = 'Contact';
        let subtext = 'Internal Contact';
        let avatar = null;
        let category = item.category || 'ORGANIZATION DOCTORS';
        let department = null;
        let roleBadge = 'Staff';
        let clinic = user?.organizationName || 'Clinic';

        if (item.conversationType === 'SUPER_ADMIN_ORGANIZATION_ADMIN' || item.conversationType === 'SUPER_ADMIN_ORG_ADMIN' || item.superAdminObj) {
          name = item.superAdminObj?.name || 'Super Admin';
          subtext = 'Platform Administration';
          avatar = resolveProfileImage(item.superAdminObj);
          category = 'PLATFORM ADMINISTRATION';
          roleBadge = 'Platform Admin';
          department = 'Governance';
        } else if (item.conversationType === 'ORGANIZATION_ADMIN_DOCTOR' || item.conversationType === 'ORG_ADMIN_DOCTOR' || item.doctorObj) {
          name = formatDoctorName(item.doctorObj?.userId?.name || item.doctorObj?.name || 'Doctor');
          subtext = item.doctorObj?.specialization || 'Clinic Specialist';
          avatar = resolveProfileImage(item.doctorObj?.userId || item.doctorObj);
          category = 'ORGANIZATION DOCTORS';
          roleBadge = 'Clinician';
          department = item.doctorObj?.departmentId?.name || item.doctorObj?.specialization || 'General Practice';
        }

        return {
          ...item,
          displayName: name,
          displaySubtext: subtext,
          profileImage: avatar,
          category,
          roleBadge,
          department,
          clinic,
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
      setError(err.message || 'Failed to load organization communications');
    } finally {
      setLoading(false);
    }
  };

  const updateConversationWithMessage = (message) => {
    if (!message) return;
    setConversations((prevList) => {
      const msgTime = message.createdAt ? new Date(message.createdAt).getTime() : Date.now();
      const content = message.message || (message.attachment?.url ? '📎 File attachment' : 'New message');
      const convId = (message.conversationId || message._id)?.toString();

      const targetIndex = prevList.findIndex((c) => {
        if (c.conversationId && convId && c.conversationId.toString() === convId) return true;
        if (c._id && convId && c._id.toString() === convId) return true;
        return false;
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

      const merged = prev.map((item) => {
        const isMatch =
          (item.conversationId && item.conversationId.toString() === convIdStr) ||
          (item._id && item._id.toString() === convIdStr);

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

    setSocketConnected(socket.connected);

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    const handleNewMsg = (msg) => {
      if (!msg) return;
      updateConversationWithMessage(msg);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('new_message', handleNewMsg);
    socket.on('message:new', handleNewMsg);
    socket.on('conversation:updated', handleConversationUpdatedSocket);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
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
    const matchesCategory =
      activeCategory === 'ALL' || conv.category === activeCategory;

    if (!matchesCategory) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    return (
      conv.displayName.toLowerCase().includes(q) ||
      conv.displaySubtext.toLowerCase().includes(q) ||
      conv.lastMessageText.toLowerCase().includes(q) ||
      (conv.department && conv.department.toLowerCase().includes(q))
    );
  });

  const selectedConv = conversations.find((c) => c.key === selectedConvKey);

  if (loading) return <Loader size="lg" className="my-16 flex justify-center mx-auto" />;
  if (error) return <ErrorState message={error} onRetry={fetchConversations} />;

  return (
    <ContentContainer
      maxWidth="full"
      className="h-[calc(100vh-6.5rem)] md:h-[calc(100vh-6.5rem)] flex flex-col min-h-0 !pt-2 !pb-0 !space-y-0 overflow-hidden"
    >
      {conversations.length === 0 ? (
        <EmptyState
          title="No communication channels active"
          description="Your clinic specialists and platform administration contacts will be listed here automatically."
        />
      ) : (
        <div className="flex-1 min-h-0 w-full grid grid-cols-1 md:grid-cols-12 gap-3.5 overflow-hidden h-full">
          {/* Left Column: Clinical Conversation Roster */}
          <div
            className={`md:col-span-5 lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-3.5 flex flex-col min-h-0 h-full shadow-2xs space-y-3 ${
              selectedConvKey ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Roster Header */}
            <div className="flex items-center justify-between shrink-0 px-1">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-600" />
                Active Roster
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 font-mono">
                {filteredConversations.length}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="p-1 bg-slate-100/90 rounded-lg border border-slate-200/70 flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('ALL');
                  setSearchQuery('');
                }}
                className={`flex-1 py-1 px-2 rounded-md text-xs text-center transition-all cursor-pointer ${
                  activeCategory === 'ALL'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('ORGANIZATION DOCTORS');
                  setSearchQuery('');
                }}
                className={`flex-1 py-1 px-2 rounded-md text-xs text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeCategory === 'ORGANIZATION DOCTORS'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <Stethoscope className="w-3 h-3 text-blue-600" /> Doctors
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('PLATFORM ADMINISTRATION');
                  setSearchQuery('');
                }}
                className={`flex-1 py-1 px-2 rounded-md text-xs text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeCategory === 'PLATFORM ADMINISTRATION'
                    ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-blue-600" /> Platform
              </button>
            </div>

            {/* Search Input */}
            <div className="shrink-0">
              <Input
                placeholder="Search clinician, department, or chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
                className="text-xs py-2"
              />
            </div>

            {/* Roster Items */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {filteredConversations.map((conv) => {
                const isSelected = selectedConvKey === conv.key;

                return (
                  <div
                    key={conv.key}
                    onClick={() => setSelectedConvKey(conv.key)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border text-xs space-y-2 ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-400 text-blue-950 font-semibold shadow-xs ring-1 ring-blue-500/20'
                        : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0 overflow-hidden">
                            {conv.profileImage ? (
                              <img src={conv.profileImage} alt={conv.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{getInitials(conv.displayName, conv.roleBadge === 'Clinician' ? 'DR' : 'SA')}</span>
                            )}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                        </div>

                        <div className="truncate flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 truncate">{conv.displayName}</p>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{conv.displaySubtext}</p>
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {formatChatTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    {/* Context Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {conv.department && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200/60">
                          {conv.department}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">
                        {conv.roleBadge}
                      </span>
                    </div>

                    {/* Last message preview */}
                    <p className="text-[11px] text-slate-500 line-clamp-1 border-t border-slate-100 pt-1.5 font-normal">
                      {conv.lastMessageText}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Chat Workspace */}
          <div
            className={`md:col-span-7 lg:col-span-8 flex flex-col min-h-0 h-full ${
              selectedConvKey ? 'flex' : 'hidden md:flex'
            }`}
          >
            {selectedConv ? (
              <ChatWindow
                conversationId={selectedConv.conversationId || selectedConv._id}
                appointmentId={selectedConv.latestApptId}
                conversationType={selectedConv.conversationType}
                recipientId={
                  selectedConv.recipientId ||
                  selectedConv.doctorId ||
                  selectedConv.doctorObj?._id ||
                  selectedConv.superAdminId ||
                  selectedConv.superAdminObj?._id
                }
                currentUserId={user?._id || user?.id}
                currentRole="organization_admin"
                participantName={selectedConv.displayName}
                participantSubtext={
                  selectedConv.department
                    ? `${selectedConv.department} • ${selectedConv.displaySubtext}`
                    : selectedConv.displaySubtext
                }
                participantImage={selectedConv.profileImage}
                showLiveStatus={false}
                onMessageSent={handleMessageSent}
                onBack={() => setSelectedConvKey(null)}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-400 space-y-3 h-full flex flex-col items-center justify-center shadow-2xs">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Select an operational communication channel</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Choose a clinic specialist or platform administrator to view encrypted clinical messages.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ContentContainer>
  );
};

export default AdminChat;
