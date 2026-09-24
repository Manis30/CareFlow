import api from './axios';

export const getUserConversationsApi = async () => {
  const response = await api.get('/chat/conversations');
  return response.data;
};

export const getAppointmentMessagesApi = async (targetId) => {
  if (!targetId) return { data: [] };
  const response = await api.get(`/chat/conversation/${targetId}/messages`).catch(async () => {
    return await api.get(`/chat/appointment/${targetId}/messages`);
  });
  return response.data;
};

export const getConversationMessagesApi = async (targetId) => {
  return await getAppointmentMessagesApi(targetId);
};

export const sendAppointmentMessageApi = async (targetId, messageData) => {
  const url = targetId ? `/chat/conversation/${targetId}/messages` : '/chat/message';

  if (messageData instanceof FormData) {
    const response = await api.post(url, messageData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).catch(async () => {
      return await api.post(`/chat/appointment/${targetId}/message`, messageData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    });
    return response.data;
  }

  const response = await api.post(url, messageData).catch(async () => {
    return await api.post(`/chat/appointment/${targetId}/message`, messageData);
  });
  return response.data;
};

export const sendChatMessageApi = async (targetId, messageData) => {
  return await sendAppointmentMessageApi(targetId, messageData);
};

export const createOrGetConversationApi = async (payload) => {
  const response = await api.post('/chat/conversation/create', payload).catch(async () => {
    return await api.post('/chat/conversations/direct', payload);
  });
  return response.data;
};

