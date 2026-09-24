/**
 * Normalizes an address value (object, JSON string, plain string, or null/undefined)
 * into a standard address object: { street, city, state, pincode }.
 */
export const normalizeAddress = (address) => {
  if (!address) {
    return { street: '', city: '', state: '', pincode: '' };
  }

  if (typeof address === 'string') {
    const trimmed = address.trim();
    if (!trimmed) {
      return { street: '', city: '', state: '', pincode: '' };
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          street: parsed.street ? String(parsed.street).trim() : '',
          city: parsed.city ? String(parsed.city).trim() : '',
          state: parsed.state ? String(parsed.state).trim() : '',
          pincode: parsed.pincode ? String(parsed.pincode).trim() : ''
        };
      }
    } catch (e) {
      // Plain legacy address string
      return { street: trimmed, city: '', state: '', pincode: '' };
    }
  }

  if (typeof address === 'object') {
    return {
      street: address.street ? String(address.street).trim() : '',
      city: address.city ? String(address.city).trim() : '',
      state: address.state ? String(address.state).trim() : '',
      pincode: address.pincode ? String(address.pincode).trim() : ''
    };
  }

  return { street: '', city: '', state: '', pincode: '' };
};

/**
 * Formats an address into a human-readable string: "Street, City, State - Pincode"
 * Returns "Address not provided" if empty.
 */
export const formatAddress = (address) => {
  const normalized = normalizeAddress(address);

  const locationParts = [
    normalized.street,
    normalized.city,
    normalized.state
  ].filter(Boolean);

  let formattedAddress = locationParts.join(', ');

  if (normalized.pincode) {
    formattedAddress += formattedAddress
      ? ` - ${normalized.pincode}`
      : normalized.pincode;
  }

  return formattedAddress || 'Address not provided';
};

export default formatAddress;
