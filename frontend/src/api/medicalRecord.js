import api from './axios';

export const uploadMedicalRecordApi = async (formData) => {
  const response = await api.post('/medical-record/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const getMyMedicalRecordsApi = async () => {
  const response = await api.get('/medical-record/my');
  return response.data;
};

export const getMedicalRecordsByAppointmentApi = async (appointmentId) => {
  const response = await api.get(`/medical-record/appointment/${appointmentId}`);
  return response.data;
};

export const getMedicalRecordByIdApi = async (id) => {
  const response = await api.get(`/medical-record/${id}`);
  return response.data;
};

export const updateMedicalRecordApi = async (id, data) => {
  const response = await api.patch(`/medical-record/${id}`, data);
  return response.data;
};

export const deleteMedicalRecordApi = async (id) => {
  const response = await api.delete(`/medical-record/${id}`);
  return response.data;
};

export const shareMedicalRecordApi = async (id, doctorId) => {
  const response = await api.post(`/medical-record/${id}/share`, { doctorId });
  return response.data;
};

export const revokeMedicalRecordApi = async (id, doctorId) => {
  const response = await api.patch(`/medical-record/${id}/revoke`, { doctorId });
  return response.data;
};
