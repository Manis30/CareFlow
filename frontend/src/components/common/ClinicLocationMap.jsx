import React from 'react';
import { MapPin, Navigation, Compass } from 'lucide-react';
import Button from './Button';
import OrganizationLogo from './OrganizationLogo';

const ClinicLocationMap = ({
  clinicName = 'Clinic Location',
  organization = null,
  address = null,
  latitude = null,
  longitude = null,
  mapUrl = null,
  showDirections = true,
  className = ''
}) => {
  // Extract string representation of address
  const formatAddressStr = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      const parts = [addr.street, addr.city, addr.state, addr.country, addr.pincode].filter(Boolean);
      return parts.join(', ');
    }
    return '';
  };

  const fullAddress = formatAddressStr(address);
  const lat = latitude !== null && latitude !== undefined && !isNaN(Number(latitude)) ? Number(latitude) : null;
  const lng = longitude !== null && longitude !== undefined && !isNaN(Number(longitude)) ? Number(longitude) : null;

  const hasCoords = lat !== null && lng !== null;
  const hasAddress = Boolean(fullAddress.trim());

  if (!hasCoords && !hasAddress && !mapUrl) {
    return (
      <div className={`p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2 font-sans ${className}`}>
        <Compass className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Location Not Configured</p>
        <p className="text-[11px] text-slate-400">The clinic address or geographic map coordinates have not been saved yet.</p>
      </div>
    );
  }

  // Dynamic OpenStreetMap / Google Maps embed URL
  let embedSrc = '';
  if (hasCoords) {
    embedSrc = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  } else if (hasAddress) {
    embedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&z=15&output=embed`;
  } else if (mapUrl) {
    embedSrc = mapUrl;
  }

  // Google Maps Get Directions link
  const directionsQuery = hasCoords ? `${lat},${lng}` : encodeURIComponent(fullAddress);
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${directionsQuery}`;

  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs font-sans flex flex-col min-h-[220px] ${className}`}>
      {/* Map Container */}
      <div className="relative w-full flex-1 min-h-[160px] bg-slate-100 overflow-hidden">
        {embedSrc ? (
          <iframe
            title={`${clinicName} Map`}
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            marginHeight="0"
            marginWidth="0"
            src={embedSrc}
            className="w-full h-full object-cover border-0 filter brightness-[0.98] contrast-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-teal-50/50">
            <MapPin className="w-8 h-8 text-teal-600 animate-bounce" />
          </div>
        )}

        {/* Map Badge */}
        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-white/90 backdrop-blur-md rounded-lg border border-slate-200/60 shadow-2xs text-[10px] font-bold text-slate-800 flex items-center gap-1.5 z-10">
          <OrganizationLogo organization={organization || clinicName} size="xs" />
          <span>{clinicName}</span>
        </div>
      </div>

      {/* Map Footer Bar */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
        <div className="truncate text-xs min-w-0">
          <p className="font-bold text-slate-900 truncate">{clinicName}</p>
          <p className="text-[11px] text-slate-500 truncate">{fullAddress || 'Clinic Coordinates Active'}</p>
        </div>

        {showDirections && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Get Directions</span>
          </a>
        )}
      </div>
    </div>
  );
};

export default ClinicLocationMap;
