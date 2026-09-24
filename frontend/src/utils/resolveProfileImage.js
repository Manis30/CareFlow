const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/**
 * Converts relative asset paths or Cloudinary URLs to full accessible image URLs.
 */
export const getMediaUrl = (pathOrUrl) => {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  const str = pathOrUrl.trim();
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:image/')) {
    return str;
  }
  if (str.startsWith('/')) {
    return `${BACKEND_ORIGIN}${str}`;
  }
  return `${BACKEND_ORIGIN}/${str}`;
};

/**
 * Safe profile image resolver for users, doctors, and patients across backend schemas.
 * Returns valid URL string or null if unprovided.
 */
export const resolveProfileImage = (entity) => {
  if (!entity) return null;

  if (typeof entity === 'string') {
    return getMediaUrl(entity);
  }

  // Inspect common nested locations
  const imgCandidate =
    entity.profileImage?.url ||
    entity.profileImage ||
    entity.avatar?.url ||
    entity.avatar ||
    entity.profilePicture?.url ||
    entity.profilePicture ||
    entity.user?.profileImage?.url ||
    entity.user?.profileImage ||
    entity.userId?.profileImage?.url ||
    entity.userId?.profileImage;

  if (typeof imgCandidate === 'string') {
    return getMediaUrl(imgCandidate);
  }

  if (typeof imgCandidate === 'object' && imgCandidate !== null && typeof imgCandidate.url === 'string') {
    return getMediaUrl(imgCandidate.url);
  }

  return null;
};

/**
 * Derives professional initials from participant or user name.
 */
export const getInitials = (name, fallback = 'U') => {
  if (!name || typeof name !== 'string') return fallback;
  const cleanName = name
    .replace(/^Dr\.\s*/i, '')
    .replace(/^Doctor\s*/i, '')
    .trim();

  if (!cleanName) return fallback;

  const parts = cleanName.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleanName.slice(0, 2).toUpperCase();
};

export default resolveProfileImage;
