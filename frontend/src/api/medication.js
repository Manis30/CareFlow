import api from './axios';

export const getTodayMedicationsApi = async () => {
  const response = await api.get('/medication/today');
  return response.data;
};

export const recordDoseLogApi = async (doseData) => {
  const response = await api.post('/medication/dose', doseData);
  return response.data;
};

export const getMedicationSchedulesApi = async (params = {}) => {
  const response = await api.get('/medication/schedules', { params });
  return response.data;
};

export const getMedicationAdherenceApi = async (days = 7) => {
  const response = await api.get('/medication/adherence', { params: { days } });
  return response.data;
};

export const getMyCareTimelineApi = async () => {
  const response = await api.get('/patient/care-timeline');
  return response.data;
};

export const getMyProactiveAlertsApi = async () => {
  const response = await api.get('/patient/proactive-alerts');
  return response.data;
};

export const getMyFollowUpsApi = async () => {
  const response = await api.get('/patient/follow-ups');
  return response.data;
};
