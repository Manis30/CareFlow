import React, { useEffect, useState } from 'react';
import { Search, MessageSquare, Building2 } from 'lucide-react';
import { getUserConversationsApi } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';
import { getSocketClient } from '../../socket/socket';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Input from '../../components/common/Input';
import ChatWindow from '../../components/chat/ChatWindow';
import ContentContainer from '../../components/layout/ContentContainer';
import UserAvatar from '../../components/common/UserAvatar';
import { resolveProfileImage, getInitials } from '../../utils/resolveProfileImage';
import {
  sortConversationsByLatest,
  formatChatTime
} from '../../utils/chatManager';

const SuperAdminChat = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConvKey, setSelectedConvKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { user } = useAuth();

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await getUserConversationsApi();
      const rawList = res?.data || [];

      const formattedList = rawList.map((item) => {
        const adminObj = item.adminObj;
        const name = adminObj?.name || 'Organization Admin';
        const orgName = adminObj?.organizationId?.name || item.organizationId?.name || 'Clinic Admin';
        const avatar = resolveProfileImage(adminObj);

        return {
          ...item,
          displayName: name,
          displaySubtext: orgName,
          profileImage: avatar,
          lastMessageText: item.lastMessageText || 'No messages yet',
          lastMessageAt: item.lastMessageAt || 0
        };
      });

      const sortedList = sortConversationsByLatest(formattedList);
      setConversations(sortedList);
      if (sortedList.length > 0 && !selectedConvKey) {
        setSelectedConvKey(sortedList[0].key);
      }
    } catch (err) {
      setError(err.message || 'Failed to load organization conversations');
    } finally {
      setLoading(false);
    }
  };

  const updateConversationWithMessage = (message, updatedConv) => {
    if (!message && !updatedConv) return;

    setConversations((prevList) => {
      const msgTime = message?.createdAt ? new Date(message.createdAt).getTime() : Date.now();
      const content = message?.message || (message?.attachment?.url ? '📎 File' : 'New message');
      const convId = (updatedConv?._id || message?.conversationId || message?._id)?.toString();
      const targetOrgAdminId = updatedConv?.organizationAdminId?.toString();

      const targetIndex = prevList.findIndex((c) => {
        if (convId && c.conversationId && c.conversationId.toString() === convId) return true;
        if (convId && c._id && c._id.toString() === convId) return true;
        if (targetOrgAdminId && c.organizationAdminId && c.organizationAdminId.toString() === targetOrgAdminId) return true;
        return false;
      });

      if (targetIndex === -1) return prevList;

      const targetConv = {
        ...prevList[targetIndex],
        _id: convId || prevList[targetIndex]._id,
        conversationId: convId || prevList[targetIndex].conversationId,
        lastMessageText: content,
        lastMessageAt: msgTime,
        hasMessages: true
      };

      const remaining = [...prevList];
      remaining.splice(targetIndex, 1);

      return [targetConv, ...remaining].sort(
        (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
      );
    });
  };

  const handleConversationUpdatedSocket = (updatedConv) => {
    if (!updatedConv) return;
    setConversations((prev) => {
      const convIdStr = (updatedConv.conversationId || updatedConv._id)?.toString();
      const orgAdminIdStr = updatedConv.organizationAdminId?.toString();

      const merged = prev.map((item) => {
        const isMatch =
          (item.conversationId && item.conversationId.toString() === convIdStr) ||
          (item._id && item._id.toString() === convIdStr) ||
          (orgAdminIdStr && item.organizationAdminId && item.organizationAdminId.toString() === orgAdminIdStr);

        if (isMatch) {
          const lastMsgContent = updatedConv.lastMessage?.content || updatedConv.lastMessageText || 'New message';
          const lastMsgTime = updatedConv.lastMessageAt ? new Date(updatedConv.lastMessageAt).getTime() : Date.now();
          return {
            ...item,
            _id: convIdStr || item._id,
            conversationId: convIdStr || item.conversationId,
            lastMessageText: lastMsgContent,
            lastMessageAt: lastMsgTime,
            hasMessages: true
          };
        }
        return item;
      });

      return merged.sort(
        (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
      );
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

  const handleMessageSent = (sentMsg, updatedConv) => {
    if (!sentMsg) return;
    updateConversationWithMessage(sentMsg, updatedConv);
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (conv.displayName && conv.displayName.toLowerCase().includes(q)) ||
      (conv.displaySubtext && conv.displaySubtext.toLowerCase().includes(q))
    );
  });

  const selectedConv = conversations.find((c) => c.key === selectedConvKey);

  if (loading) {
    return (
      <ContentContainer maxWidth="7xl" className="h-[calc(100vh-9.5rem)] md:h-[calc(100vh-6rem)] flex items-center justify-center">
        <Loader size="lg" />
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer maxWidth="7xl" className="h-[calc(100vh-9.5rem)] md:h-[calc(100vh-6rem)] flex items-center justify-center">
        <div className="py-12 max-w-2xl mx-auto w-full">
          <ErrorState message={error} onRetry={fetchConversations} />
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer
      maxWidth="7xl"
      className="h-[calc(100vh-9.5rem)] md:h-[calc(100vh-6rem)] flex flex-col min-h-0 !pb-0 !space-y-0"
    >
      {conversations.length === 0 ? (
        <EmptyState
          title="No Organization Admins registered"
          description="Clinic administrator accounts will appear here automatically as clinic tenants are onboarded."
        />
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden h-full">
          {/* Conversation List Sidebar */}
          <div
            className={`md:col-span-5 lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-4 flex flex-col min-h-0 h-full shadow-xs space-y-3 ${
              selectedConvKey ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Clinic Contacts
              </h2>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                {filteredConversations.length}
              </span>
            </div>

            <div className="shrink-0">
              <Input
                placeholder="Search administrators or clinics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {filteredConversations.map((conv) => {
                const isSelected = selectedConvKey === conv.key;

                return (
                  <div
                    key={conv.key}
                    onClick={() => setSelectedConvKey(conv.key)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border text-xs space-y-1.5 ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500 text-slate-900 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200/80 text-slate-600 hover:bg-white hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 truncate">
                        <UserAvatar src={conv.profileImage} name={conv.displayName} size="md" />

                        <div className="truncate flex-1">
                          <p className="font-bold text-slate-900 truncate">{conv.displayName}</p>
                          <p className="text-[11px] text-blue-600 font-medium truncate flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                            {conv.displaySubtext}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {formatChatTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1 pt-1.5 border-t border-slate-200/60">
                      {conv.lastMessageText}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Chat Detail Window */}
          <div
            className={`md:col-span-7 lg:col-span-8 flex flex-col min-h-0 h-full ${
              selectedConvKey ? 'flex' : 'hidden md:flex'
            }`}
          >
            {selectedConv ? (
              <ChatWindow
                key={selectedConv.key}
                conversationId={selectedConv.conversationId || selectedConv._id}
                conversationType="SUPER_ADMIN_ORGANIZATION_ADMIN"
                recipientId={selectedConv.organizationAdminId}
                currentUserId={user?._id || user?.id}
                currentRole="super_admin"
                participantName={selectedConv.displayName}
                participantSubtext={selectedConv.displaySubtext}
                participantImage={selectedConv.profileImage}
                showLiveStatus={false}
                onMessageSent={handleMessageSent}
                onBack={() => setSelectedConvKey(null)}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-slate-500 space-y-3 h-full flex flex-col items-center justify-center shadow-xs">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm font-bold text-slate-900">Select an Administrator</p>
                <p className="text-xs max-w-sm leading-relaxed text-slate-500">
                  Choose a clinic administrator from the contact roster to open a secure direct consultation channel.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </ContentContainer>
  );
};

export default SuperAdminChat;
