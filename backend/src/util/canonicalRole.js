export const CANONICAL_ROLES = {
  SUPER_ADMIN: "super_admin",
  ORGANIZATION_ADMIN: "organization_admin",
  DOCTOR: "doctor",
  PATIENT: "patient"
};

/**
 * Normalizes any legacy or variant role string to canonical role string:
 * - 'super_admin'
 * - 'organization_admin'
 * - 'doctor'
 * - 'patient'
 */
export const normalizeRole = (rawRole) => {
  if (!rawRole) return "";
  const str = String(rawRole).toLowerCase().trim();

  if (["super_admin", "super-admin", "superadmin"].includes(str)) {
    return CANONICAL_ROLES.SUPER_ADMIN;
  }
  if (
    [
      "organization_admin",
      "admin",
      "clinic_admin",
      "org_admin",
      "organizationadmin",
      "organization-admin",
      "organization admin"
    ].includes(str)
  ) {
    return CANONICAL_ROLES.ORGANIZATION_ADMIN;
  }
  if (["doctor"].includes(str)) {
    return CANONICAL_ROLES.DOCTOR;
  }
  if (["patient"].includes(str)) {
    return CANONICAL_ROLES.PATIENT;
  }

  return str;
};

export default normalizeRole;
