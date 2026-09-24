import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';

const sizeMap = {
  xs: 'w-6 h-6 rounded-lg text-xs',
  sm: 'w-8 h-8 rounded-xl text-sm',
  md: 'w-10 h-10 rounded-xl text-base',
  lg: 'w-14 h-14 rounded-2xl text-lg',
  xl: 'w-20 h-20 rounded-2xl text-xl'
};

const iconSizeMap = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-9 h-9'
};

/**
 * Safely resolves the logo URL from an organization object or direct logo prop.
 */
const getLogoUrl = (organization, fallbackLogo) => {
  if (typeof fallbackLogo === 'string' && fallbackLogo.trim()) {
    return fallbackLogo.trim();
  }
  if (typeof fallbackLogo === 'object' && fallbackLogo?.url && typeof fallbackLogo.url === 'string') {
    return fallbackLogo.url.trim();
  }

  if (!organization) return null;

  if (
    typeof organization === 'string' &&
    (organization.startsWith('http://') || organization.startsWith('https://') || organization.startsWith('data:image/'))
  ) {
    return organization.trim();
  }

  if (typeof organization === 'object') {
    const candidates = [
      organization?.organizationLogo?.url,
      organization?.organizationLogo,
      organization?.logo?.url,
      organization?.logo,
      organization?.logoUrl?.url,
      organization?.logoUrl,
      organization?.organizationId?.organizationLogo?.url,
      organization?.organizationId?.organizationLogo,
      organization?.organizationId?.logo?.url,
      organization?.organizationId?.logo,
      organization?.organizationId?.logoUrl?.url,
      organization?.organizationId?.logoUrl
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return null;
};

const OrganizationLogo = ({
  organization = null,
  logo = null,
  size = 'md',
  className = '',
  alt = ''
}) => {
  const [imgError, setImgError] = useState(false);

  const resolvedLogoUrl = getLogoUrl(organization, logo);

  // Reset imgError whenever resolvedLogoUrl changes
  useEffect(() => {
    setImgError(false);
  }, [resolvedLogoUrl]);

  const containerSizeClass = sizeMap[size] || sizeMap.md;
  const iconSizeClass = iconSizeMap[size] || iconSizeMap.md;

  const orgName =
    (typeof organization === 'object'
      ? organization?.name || organization?.organizationId?.name
      : null) || 'Clinic Organization';

  const showImage = Boolean(resolvedLogoUrl && !imgError);

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 overflow-hidden bg-white border border-slate-200/90 shadow-2xs transition-all ${containerSizeClass} ${className}`}
      title={orgName}
    >
      {showImage ? (
        <img
          src={resolvedLogoUrl}
          alt={alt || orgName}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain p-0.5 rounded-inherit"
        />
      ) : (
        /* DEFAULT ORGANIZATION FALLBACK LOGO (Generic Healthcare/Clinic Icon) */
        <div className="w-full h-full flex flex-col items-center justify-center bg-teal-50 text-teal-700 p-0.5">
          <Building2 className={`${iconSizeClass} text-teal-600`} />
        </div>
      )}
    </div>
  );
};

export default OrganizationLogo;
