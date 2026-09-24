import api from './axios';

export const createPatientProfileApi = async (formData) => {
  const response = await api.post('/patient/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const getMyPatientProfileApi = async () => {
  const response = await api.get('/patient/');
  return response.data;
};

export const updateMyPatientProfileApi = async (formData) => {
  const response = await api.patch('/patient/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const getPatientByIdApi = async (id) => {
  const response = await api.get(`/patient/${id}`);
  return response.data;
};
