import React, { useState, useEffect } from 'react';
import { resolveProfileImage, getInitials as resolveInitials, getMediaUrl } from '../../utils/resolveProfileImage';

/**
 * UserAvatar - Unified circular avatar component with automatic image fallback.
 */
export const UserAvatar = ({
  user = null,
  name: nameProp = '',
  src: srcProp = null,
  image = null,
  avatarUrl = null,
  size = 'md',
  role = 'user', // 'doctor', 'patient', 'admin', 'user'
  className = ''
}) => {
  const [imgError, setImgError] = useState(false);

  // Determine candidate image string/object
  const explicitProp = avatarUrl || image || srcProp;
  const rawUrl = explicitProp
    ? (typeof explicitProp === 'object' ? explicitProp?.url : explicitProp)
    : resolveProfileImage(user);

  // Format via getMediaUrl (prepends BACKEND_ORIGIN if relative path like /uploads/...)
  const resolvedUrl = getMediaUrl(rawUrl);

  useEffect(() => {
    setImgError(false);
  }, [resolvedUrl]);

  const targetObj = user?.userId || user?.doctorId || user?.patientId || user || {};
  const rawName = nameProp || targetObj?.name || user?.name || 'User';
  const initials = resolveInitials(rawName, role === 'doctor' ? 'DR' : 'U');

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
    xl: 'w-14 h-14 text-base'
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  const bgClasses = role === 'doctor'
    ? 'bg-teal-100 text-teal-800 border-teal-200'
    : 'bg-teal-50 text-teal-700 border-teal-200/80';

  const showImage = Boolean(resolvedUrl && !imgError);

  return (
    <div
      className={`${currentSizeClass} rounded-full ${bgClasses} font-extrabold flex items-center justify-center shrink-0 border shadow-2xs overflow-hidden ${className}`}
      title={rawName}
    >
      {showImage ? (
        <img
          src={resolvedUrl}
          alt={rawName}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export default UserAvatar;
