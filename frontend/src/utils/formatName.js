import { formatDoctorName as formatDocNameUtil, formatTitleCase } from './formatters';

export const formatDoctorName = (rawName, fallback = 'Doctor') => {
  return formatDocNameUtil(rawName, fallback);
};

export const cleanDoctorNameInput = (rawName) => {
  if (!rawName) return '';
  let name = String(rawName).trim();
  while (/^(dr\.?|doctor)\s+/i.test(name)) {
    name = name.replace(/^(dr\.?|doctor)\s+/i, '').trim();
  }
  return formatTitleCase(name);
};

export default formatDoctorName;
