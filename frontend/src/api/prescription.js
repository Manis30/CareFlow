import api from './axios';

export const createPrescriptionApi = async (appointmentId, prescriptionData) => {
  const response = await api.post(`/prescription/${appointmentId}`, prescriptionData);
  return response.data;
};

export const getMyPrescriptionsApi = async () => {
  const response = await api.get('/prescription/my');
  return response.data;
};

export const getPrescriptionByAppointmentApi = async (appointmentId) => {
  const response = await api.get(`/prescription/appointment/${appointmentId}`);
  return response.data;
};

export const getPrescriptionByIdApi = async (id) => {
  const response = await api.get(`/prescription/${id}`);
  return response.data;
};

export const updatePrescriptionApi = async (id, data) => {
  const response = await api.patch(`/prescription/${id}`, data);
  return response.data;
};
