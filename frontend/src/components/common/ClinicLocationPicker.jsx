import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Compass, CheckCircle2, Navigation, Loader2 } from 'lucide-react';
import Input from './Input';
import Button from './Button';

const ClinicLocationPicker = ({
  initialAddress = {},
  initialLatitude = 11.9401,
  initialLongitude = 79.4861,
  onChange = () => {}
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const [location, setLocation] = useState({
    street: initialAddress.street || '',
    city: initialAddress.city || '',
    state: initialAddress.state || '',
    country: initialAddress.country || 'India',
    pincode: initialAddress.pincode || '',
    latitude: Number(initialLatitude) || 11.9401,
    longitude: Number(initialLongitude) || 79.4861
  });

  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const leafletMarkerRef = useRef(null);

  useEffect(() => {
    onChange(location);
  }, [location]);

  // Reverse geocoding helper when coordinates change via click/drag
  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const street = addr.road || addr.suburb || addr.neighbourhood || addr.building || location.street;
        const city = addr.city || addr.town || addr.village || addr.county || location.city;
        const state = addr.state || location.state;
        const country = addr.country || location.country;
        const pincode = addr.postcode || location.pincode;

        setLocation((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          street,
          city,
          state,
          country,
          pincode
        }));
      } else {
        setLocation((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      }
    } catch (e) {
      setLocation((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    }
  };

  // Load Leaflet dynamically for interactive pin placement and dragging
  useEffect(() => {
    let isMounted = true;

    const loadLeaflet = async () => {
      if (!window.L) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          if (isMounted) initMap();
        };
        document.body.appendChild(script);
      } else {
        initMap();
      }
    };

    const initMap = () => {
      if (!mapContainerRef.current || !window.L) return;
      if (leafletMapRef.current) return;

      const L = window.L;
      const map = L.map(mapContainerRef.current).setView([location.latitude, location.longitude], 14);
      leafletMapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Custom Pin Marker
      const customIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `<div style="background-color: #0d9488; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); font-size: 16px;">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      const marker = L.marker([location.latitude, location.longitude], {
        draggable: true,
        icon: customIcon
      }).addTo(map);

      leafletMarkerRef.current = marker;

      // Handle Drag End
      marker.on('dragend', (e) => {
        const latLng = e.target.getLatLng();
        const lat = Number(latLng.lat.toFixed(6));
        const lng = Number(latLng.lng.toFixed(6));
        reverseGeocode(lat, lng);
      });

      // Handle Direct Map Click
      map.on('click', (e) => {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        marker.setLatLng([lat, lng]);
        reverseGeocode(lat, lng);
      });
    };

    loadLeaflet();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update Leaflet marker position when location changes externally
  useEffect(() => {
    if (leafletMapRef.current && leafletMarkerRef.current) {
      const currentMarkerPos = leafletMarkerRef.current.getLatLng();
      if (
        Math.abs(currentMarkerPos.lat - location.latitude) > 0.0001 ||
        Math.abs(currentMarkerPos.lng - location.longitude) > 0.0001
      ) {
        leafletMarkerRef.current.setLatLng([location.latitude, location.longitude]);
        leafletMapRef.current.setView([location.latitude, location.longitude], 14);
      }
    }
  }, [location.latitude, location.longitude]);

  // Optional Location Search helper
  const handleSearchLocation = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      setSearchError('');
      setSearchResults([]);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=5`
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data);
      } else {
        setSearchError('Location not found. You can select the exact location directly on the map.');
      }
    } catch (err) {
      setSearchError('Location search unavailable. You can click directly on the map to place the pin.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (result) => {
    const lat = Number(Number(result.lat).toFixed(6));
    const lng = Number(Number(result.lon).toFixed(6));
    reverseGeocode(lat, lng);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        reverseGeocode(lat, lng);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        alert('Could not access current location. Please select your location directly on the map.');
      }
    );
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Optional Search Bar & Use Current Location Button */}
      <div className="space-y-1.5 relative">
        <div className="flex items-center justify-between">
          <label className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-teal-600" />
            Optional Location Search
          </label>

          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={geoLoading}
            className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 cursor-pointer"
          >
            {geoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3 text-teal-600" />}
            Use Current Location
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type clinic name, address, or city to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchLocation(e);
              }
            }}
            className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
          <Button
            variant="primary"
            type="button"
            size="sm"
            loading={searching}
            icon={Search}
            onClick={handleSearchLocation}
          >
            Search
          </Button>
        </div>

        {searchError && (
          <p className="text-[11px] text-amber-700 font-semibold pt-1">{searchError}</p>
        )}

        {/* Search Suggestions Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {searchResults.map((res, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectResult(res)}
                className="p-3 hover:bg-teal-50 cursor-pointer transition-colors flex items-center gap-2 text-slate-800"
              >
                <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="truncate text-xs">{res.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Primary Interactive Map Picker (Click anywhere or Drag marker) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-teal-600" />
            Interactive Pin Placement (Click on Map or Drag Marker)
          </span>
          <span className="text-[10px] font-semibold text-slate-500 italic">Click anywhere on map to move pin</span>
        </div>

        <div className="rounded-2xl border border-slate-300 overflow-hidden bg-slate-100 h-64 relative shadow-2xs">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Real-Time Displayed Selected Coordinates */}
          <div className="absolute bottom-2 left-2 z-20 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-md text-[11px] font-extrabold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="text-teal-700">Selected Location: </span>
              <span>Latitude: {location.latitude.toFixed(6)}, Longitude: {location.longitude.toFixed(6)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Coordinates Display Toggle */}
      <div className="flex justify-between items-center pt-1">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[11px] font-semibold text-teal-700 hover:underline flex items-center gap-1"
        >
          <Compass className="w-3 h-3" />
          {showAdvanced ? 'Hide Advanced Geographic Coordinates' : 'Show Advanced Geographic Coordinates'}
        </button>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <Input
            label="Latitude Coordinate"
            value={location.latitude}
            onChange={(e) => setLocation({ ...location, latitude: Number(e.target.value) || 0 })}
          />
          <Input
            label="Longitude Coordinate"
            value={location.longitude}
            onChange={(e) => setLocation({ ...location, longitude: Number(e.target.value) || 0 })}
          />
        </div>
      )}
    </div>
  );
};

export default ClinicLocationPicker;
