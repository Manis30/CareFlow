/**
 * Normalizes any time string (e.g., "09:00 AM", "6:00 PM", "18:00", "9:30", "06:00")
 * to a clean 24-hour "HH:mm" format (e.g. "09:00", "18:00").
 */
export const normalizeTimeTo24h = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return '';
    let str = timeStr.trim().toUpperCase();
    if (!str) return '';

    const isPM = str.includes('PM');
    const isAM = str.includes('AM');

    // Strip out letters
    str = str.replace(/[A-Z]/g, '').trim();

    const parts = str.split(':');
    let hours = parseInt(parts[0], 10);
    let minutes = parseInt(parts[1], 10);

    if (isNaN(hours)) hours = 0;
    if (isNaN(minutes)) minutes = 0;

    if (isPM && hours < 12) {
        hours += 12;
    } else if (isAM && hours === 12) {
        hours = 0;
    }

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
};

/**
 * Converts a time string ("10:30", "09:00 AM", "18:00") to total minutes from midnight.
 */
export const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const norm = normalizeTimeTo24h(timeStr);
    if (!norm || !/^\d{2}:\d{2}$/.test(norm)) return null;
    const [h, m] = norm.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
};

export default {
    normalizeTimeTo24h,
    timeToMinutes
};
