import api from './axios';

export const createAppointmentApi = async (bookingData) => {
  const response = await api.post('/appointment/', bookingData);
  return response.data;
};

export const validateAppointmentSlotApi = async (payload) => {
  const response = await api.post('/appointment/validate-slot', payload);
  return response.data;
};

export const getMyAppointmentsApi = async (status) => {
  const response = await api.get('/appointment/my', { params: { status } });
  return response.data;
};

export const getDoctorTodayAppointmentsApi = async () => {
  const response = await api.get('/appointment/doctor/today');
  return response.data;
};

export const getDoctorUpcomingAppointmentsApi = async () => {
  const response = await api.get('/appointment/doctor/upcoming');
  return response.data;
};

export const getDoctorCompletedAppointmentsApi = async () => {
  const response = await api.get('/appointment/doctor/completed');
  return response.data;
};

export const getDoctorCancelledAppointmentsApi = async () => {
  const response = await api.get('/appointment/doctor/cancelled');
  return response.data;
};

export const getAdminAppointmentsApi = async (params = {}) => {
  const response = await api.get('/appointment/admin', { params });
  return response.data;
};

export const getAdminAppointmentStatsApi = async () => {
  const response = await api.get('/appointment/admin/stats');
  return response.data;
};

export const cancelAppointmentApi = async (id, cancelReason) => {
  const reasonStr = typeof cancelReason === 'object'
    ? (cancelReason?.cancelReason || cancelReason?.reason || '')
    : cancelReason;
  const response = await api.patch(`/appointment/${id}/cancel`, { cancelReason: reasonStr });
  return response.data;
};

export const cancelAppointmentByDoctorApi = async (id, cancelReason) => {
  const reasonStr = typeof cancelReason === 'object'
    ? (cancelReason?.cancelReason || cancelReason?.reason || '')
    : cancelReason;
  const response = await api.patch(`/appointment/${id}/doctor-cancel`, { cancelReason: reasonStr });
  return response.data;
};

export const completeAppointmentApi = async (id) => {
  const response = await api.patch(`/appointment/${id}/complete`);
  return response.data;
};

export const updateOnlineMeetingApi = async (id, meetingData) => {
  const response = await api.patch(`/appointment/${id}/meeting`, meetingData);
  return response.data;
};

export const getOnlineMeetingApi = async (id) => {
  const response = await api.get(`/appointment/${id}/meeting`);
  return response.data;
};

export const getMeetingAccessApi = async (id) => {
  const response = await api.get(`/appointment/${id}/meeting-access`);
  return response.data;
};

export const getAppointmentByIdApi = async (id) => {
  const response = await api.get(`/appointment/${id}`);
  return response.data;
};
