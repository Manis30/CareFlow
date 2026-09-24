/**
 * Reusable Display Formatting Utilities for CareFlow Application
 */

/**
 * Converts a string to Title Case safely.
 * Example: "careplus medical center" -> "CarePlus Medical Center"
 */
export const formatTitleCase = (str) => {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';

  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 1) return word.toUpperCase();
      // Keep acronyms and camelCase like CarePlus, ICU, MRI intact
      if (/^[A-Z0-9-]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

/**
 * Formats a person's full name.
 * Example: "vetrivel cheliyan" -> "Vetrivel Cheliyan"
 */
export const formatName = (rawName, fallback = 'User') => {
  if (!rawName || typeof rawName !== 'string') return fallback;
  let clean = String(rawName).trim();
  while (/^(dr\.?|doctor)\s+/i.test(clean)) {
    clean = clean.replace(/^(dr\.?|doctor)\s+/i, '').trim();
  }
  if (!clean) return fallback;
  return formatTitleCase(clean);
};

/**
 * Formats a doctor's display name, strictly preventing duplicate "Dr. Dr." prefixes.
 * Examples:
 *   formatDoctorName("priya sharma")      -> "Dr. Priya Sharma"
 *   formatDoctorName("Dr. Priya Sharma")  -> "Dr. Priya Sharma"
 *   formatDoctorName("Dr. Dr. Priya")     -> "Dr. Priya"
 */
export const formatDoctorName = (rawName, fallback = 'Doctor') => {
  if (
    !rawName ||
    typeof rawName !== 'string' ||
    rawName.trim().toLowerCase() === 'unknown' ||
    rawName.trim().toLowerCase() === 'dr. unknown'
  ) {
    return `Dr. ${fallback}`;
  }

  let name = String(rawName).trim();
  while (/^(dr\.?|doctor)\s+/i.test(name)) {
    name = name.replace(/^(dr\.?|doctor)\s+/i, '').trim();
  }

  if (!name || name.toLowerCase() === 'unknown') return `Dr. ${fallback}`;

  return `Dr. ${formatTitleCase(name)}`;
};

/**
 * Formats Organization / Clinic names cleanly.
 */
export const formatOrganizationName = (rawName, fallback = 'CareFlow Clinic') => {
  if (!rawName || typeof rawName !== 'string') return fallback;
  return formatTitleCase(rawName);
};

/**
 * Formats Department names cleanly.
 */
export const formatDepartmentName = (rawName, fallback = 'General') => {
  if (!rawName || typeof rawName !== 'string') return fallback;
  return formatTitleCase(rawName);
};

/**
 * Formats Patient names cleanly.
 */
export const formatPatientName = (rawName, fallback = 'Patient') => {
  if (!rawName || typeof rawName !== 'string') return fallback;
  return formatTitleCase(rawName);
};

/**
 * Formats medicine names.
 */
export const formatMedicineName = (rawName) => {
  if (!rawName || typeof rawName !== 'string') return 'Medicine';
  return formatTitleCase(rawName);
};

/**
 * Formats medical specializations.
 */
export const formatSpecialization = (rawSpec) => {
  if (!rawSpec || typeof rawSpec !== 'string') return 'Medical Specialist';
  return formatTitleCase(rawSpec);
};

/**
 * Formats medical diagnosis.
 */
export const formatDiagnosis = (rawDiag) => {
  if (!rawDiag || typeof rawDiag !== 'string') return 'General Health Checkup';
  return formatTitleCase(rawDiag);
};

/**
 * Formats role names nicely.
 */
export const formatRole = (rawRole) => {
  if (!rawRole || typeof rawRole !== 'string') return 'User';
  const clean = rawRole.replace(/_/g, ' ');
  return formatTitleCase(clean);
};

/**
 * Formats currency values in Indian Rupees (INR).
 * Example: 1500 -> "₹1,500", 0 -> "₹0"
 */
export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount ?? 0));

export default {
  formatTitleCase,
  formatName,
  formatDoctorName,
  formatOrganizationName,
  formatDepartmentName,
  formatPatientName,
  formatMedicineName,
  formatSpecialization,
  formatDiagnosis,
  formatRole,
  formatCurrency
};
