import React, { useEffect, useState } from 'react';
import { getUserConversationsApi } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';
import { getSocketClient } from '../../socket/socket';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ContentContainer from '../../components/layout/ContentContainer';
import ChatWindow from '../../components/chat/ChatWindow';
import { resolveProfileImage } from '../../utils/resolveProfileImage';
import { sortConversationsByLatest } from '../../utils/chatManager';

const DoctorChat = () => {
  const [conversations, setConversations] = useState([]);
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
      const rawList = res.data || [];

      const formattedList = rawList.map((item) => {
        let name = 'Organization Admin';
        let subtext = 'Clinic Administration';
        let avatar = null;
        let category = item.category || 'ORGANIZATION CHAT';

        if (item.conversationType === 'ORGANIZATION_ADMIN_DOCTOR' || item.conversationType === 'ORG_ADMIN_DOCTOR' || item.adminObj) {
          const adminObj = item.adminObj;
          name = adminObj?.name || 'Organization Admin';
          subtext = adminObj?.organizationId?.name || 'Clinic Administration';
          avatar = resolveProfileImage(adminObj);
          category = 'ORGANIZATION CHAT';
        } else if (item.patientObj) {
          const patObj = item.patientObj;
          name = patObj?.userId?.name || patObj?.name || 'Patient';
          subtext = 'Patient Consultation';
          avatar = resolveProfileImage(patObj?.userId || patObj);
          category = 'PATIENT CHAT';
        }

        return {
          ...item,
          displayName: name,
          displaySubtext: subtext,
          profileImage: avatar,
          category,
          lastMessageText: item.lastMessageText || 'No messages yet',
          lastMessageAt: item.lastMessageAt || 0
        };
      });

      const sortedList = sortConversationsByLatest(formattedList);
      setConversations(sortedList);
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
      const content = message.message || (message.attachment?.url ? '📎 File' : 'New message');
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

  // Primary Organization Admin conversation for Doctor
  const adminConv =
    conversations.find((c) => c.category === 'ORGANIZATION CHAT' || c.conversationType === 'ORGANIZATION_ADMIN_DOCTOR' || c.conversationType === 'ORG_ADMIN_DOCTOR' || c.adminObj) ||
    conversations[0];

  if (loading) return <Loader size="lg" className="my-12 flex justify-center mx-auto" />;
  if (error) return <ErrorState message={error} onRetry={fetchConversations} />;

  return (
    <ContentContainer
      maxWidth="7xl"
      className="h-[calc(100vh-6.5rem)] md:h-[calc(100vh-6.5rem)] flex flex-col min-h-0 !pt-2 !pb-0 !space-y-0 overflow-hidden"
    >
      {/* Main Chat Area Container */}
      {conversations.length === 0 || !adminConv ? (
        <EmptyState
          title="No Organization Admin available"
          description="Organization Administrator contact will appear here automatically."
        />
      ) : (
        <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs h-full">
          <ChatWindow
            conversationId={adminConv.conversationId || adminConv._id}
            appointmentId={adminConv.latestApptId}
            conversationType={adminConv.conversationType}
            recipientId={adminConv.organizationAdminId || adminConv.adminObj?._id}
            currentUserId={user?._id || user?.id}
            currentRole="doctor"
            participantName={adminConv.displayName}
            participantSubtext={adminConv.displaySubtext}
            participantImage={adminConv.profileImage}
            showLiveStatus={false}
            onMessageSent={handleMessageSent}
            onBack={null}
          />
        </div>
      )}
    </ContentContainer>
  );
};

export default DoctorChat;
