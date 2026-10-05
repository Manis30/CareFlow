import { formatDoctorName as formatDocNameUtil, formatTitleCase } from './formatters';

export const formatDoctorName = (rawName, fallback = 'Doctor') => {
  return formatDocNameUtil(rawName, fallback);
};

export const cleanDoctorNameInput = (rawName) => {
  if (!rawName) return '';
  let name = String(rawName).trim();
  name = name.replace(/^(\s*dr\.?\s*|\s*doctor\s*|\s*specialist\s*)+/i, '').trim();
  return formatTitleCase(name);
};

export default formatDoctorName;
