import api from './axios';

export const createDoctorApi = async (formData) => {
  const response = await api.post('/doctor/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const getDoctorsApi = async (params) => {
  const response = await api.get('/doctor/', { params });
  return response.data;
};

export const getMyDoctorProfileApi = async () => {
  const response = await api.get('/doctor/me');
  return response.data;
};

export const updateMyAvailabilityApi = async (availabilityData) => {
  const response = await api.patch('/doctor/me/availability', availabilityData);
  return response.data;
};

export const getDoctorByIdApi = async (id) => {
  const response = await api.get(`/doctor/${id}`);
  return response.data;
};

export const getDoctorAvailableSlotsApi = async (id, date) => {
  const response = await api.get(`/doctor/${id}/available-slots`, {
    params: { date }
  });
  return response.data;
};

export const updateDoctorApi = async (id, formData) => {
  const response = await api.patch(`/doctor/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const deleteDoctorApi = async (id) => {
  const response = await api.delete(`/doctor/${id}`);
  return response.data;
};
