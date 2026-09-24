/**
 * Parses natural time expressions into canonical "HH:mm" (24-hour format).
 * Supports: "10", "10.30", "10:30", "10am", "10 AM", "10.30 AM", "10:30 AM",
 * "10.30 - 11.00", "10:30 - 11:00", "14:30", "2pm", "2:30 pm".
 *
 * NOTE: Returns ONLY the canonical start time. Does NOT invent end time.
 * @param {string} rawTime
 * @returns {string|null} "HH:mm" or null
 */
export const parseNaturalTimeExpression = (rawTime) => {
  if (!rawTime || typeof rawTime !== 'string') return null;
  const clean = rawTime.trim().toLowerCase();

  // Pattern matches first time token (supports dot or colon separator, optional am/pm)
  const timeRegex = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i;
  const match = clean.match(timeRegex);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  let minute = match[2] !== undefined ? parseInt(match[2], 10) : 0;
  const meridiem = match[3] ? match[3].toLowerCase() : null;

  if (isNaN(hour) || isNaN(minute) || minute < 0 || minute > 59) return null;

  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  } else if (meridiem === 'am' && hour === 12) {
    hour = 0;
  } else if (!meridiem) {
    // If no am/pm specified and hour between 1 and 6, assume afternoon clinic hours (13:00 - 18:00)
    // If between 7 and 12, assume morning/noon (07:00 - 12:00)
    if (hour >= 1 && hour <= 6) {
      hour += 12;
    }
  }

  if (hour < 0 || hour > 23) return null;

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
};

/**
 * Calculates the exact Start DateTime for an appointment.
 * @param {Date|string} appointmentDate
 * @param {string} startTimeStr - e.g. "11:00 AM", "10.30", "14:30", "09:00"
 * @returns {Date|null}
 */
export const getAppointmentStartDateTime = (appointmentDate, startTimeStr) => {
  if (!appointmentDate) return null;
  const baseDate = new Date(appointmentDate);
  if (isNaN(baseDate.getTime())) return null;

  const parsed = parseNaturalTimeExpression(startTimeStr);
  let hours = 0;
  let minutes = 0;

  if (parsed) {
    const [h, m] = parsed.split(':').map(Number);
    hours = h;
    minutes = m;
  }

  baseDate.setHours(hours, minutes, 0, 0);
  return baseDate;
};

/**
 * Safely normalizes cancelReason to a trimmed string.
 * @param {any} rawReason
 * @returns {string}
 */
export const normalizeCancelReason = (rawReason) => {
  if (!rawReason) return '';
  if (typeof rawReason === 'string') return rawReason.trim();
  if (typeof rawReason === 'object') {
    if (typeof rawReason.cancelReason === 'string') return rawReason.cancelReason.trim();
    if (typeof rawReason.reason === 'string') return rawReason.reason.trim();
  }
  return String(rawReason).trim();
};

/**
 * Converts a time string (e.g. "09:30 AM", "10.30", "14:00") to total minutes from midnight.
 * @param {string} timeStr
 * @returns {number|null}
 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parsed = parseNaturalTimeExpression(timeStr);
  if (!parsed) return null;
  const [h, m] = parsed.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Checks if two time ranges [startA, endA] and [startB, endB] overlap.
 * Range overlap formula: startA < endB && endA > startB
 * @param {number} startA
 * @param {number} endA
 * @param {number} startB
 * @param {number} endB
 * @returns {boolean}
 */
export const doTimeRangesOverlap = (startA, endA, startB, endB) => {
  if (startA === null || endA === null || startB === null || endB === null) return false;
  return startA < endB && endA > startB;
};

/**
 * Formats YYYY-MM-DD date string safely from Date object or ISO string.
 * @param {Date|string} dateVal
 * @returns {string}
 */
export const formatDateKey = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') return dateVal.split('T')[0];
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const y = dateVal.getUTCFullYear();
    const m = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(dateVal).split('T')[0];
};
