/**
 * Centralized Time Formatting Utilities for CareFlow
 * Consistently converts 24h, ISO, or 12h time strings into standard 12h format: "09:00 AM", "02:30 PM", "12:00 PM".
 * Prevents duplicate suffixes (e.g. "09:00 AM AM") and handles noon/midnight crossovers cleanly.
 */

export const formatTime = (timeInput) => {
  if (!timeInput) return '';

  let str = String(timeInput).trim();

  // If input is an ISO Date string or Date object
  if (str.includes('T') || str.includes('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      let h = d.getHours();
      let m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    }
  }

  const upper = str.toUpperCase();
  const hasPM = upper.includes('PM');
  const hasAM = upper.includes('AM');

  // Strip all AM/PM instances to clean raw time numbers
  let cleanTime = upper.replace(/AM|PM/g, '').trim();
  const parts = cleanTime.split(':');
  if (parts.length < 2) return str;

  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);

  if (isNaN(h) || isNaN(m)) return str;

  let ampm = 'AM';
  if (hasPM) {
    ampm = 'PM';
    if (h < 12) h += 12;
  } else if (hasAM) {
    ampm = 'AM';
    if (h === 12) h = 0;
  } else {
    ampm = h >= 12 ? 'PM' : 'AM';
  }

  let displayHours = h % 12 || 12;

  return `${String(displayHours).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const formatTimeRange = (startTime, endTime) => {
  if (!startTime && !endTime) return 'N/A';
  if (startTime && !endTime) return formatTime(startTime);
  if (!startTime && endTime) return formatTime(endTime);

  const formattedStart = formatTime(startTime);
  const formattedEnd = formatTime(endTime);

  return `${formattedStart} - ${formattedEnd}`;
};
