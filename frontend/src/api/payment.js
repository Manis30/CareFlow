import api from './axios';

export const getMyPaymentsApi = async () => {
  const response = await api.get('/payment/my');
  return response.data;
};

export const getPaymentByAppointmentIdApi = async (appointmentId) => {
  const response = await api.get(`/payment/appointment/${appointmentId}`);
  return response.data;
};

export const createRazorpayOrderApi = async (appointmentId) => {
  const response = await api.post(`/payment/${appointmentId}/create-order`);
  return response.data;
};

export const verifyRazorpayPaymentApi = async (verificationPayload) => {
  const response = await api.post('/payment/verify', verificationPayload);
  return response.data;
};

export const createOnlineBookingOrderApi = async (bookingPayload) => {
  const response = await api.post('/payment/create-booking-order', bookingPayload);
  return response.data;
};

export const verifyAndCreateOnlineAppointmentApi = async (payload) => {
  const response = await api.post('/payment/verify-booking-payment', payload);
  return response.data;
};

export const getClinicPaymentsApi = async (filterParams = 'all') => {
  const params = typeof filterParams === 'string' ? { status: filterParams } : filterParams;
  const response = await api.get('/payment/organization', { params });
  return response.data;
};
