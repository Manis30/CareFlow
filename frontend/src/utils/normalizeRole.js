import { ROLES } from './constants';

/**
 * Normalizes any role string variation to canonical role values:
 * - 'super_admin'
 * - 'organization_admin'
 * - 'receptionist'
 * - 'doctor'
 * - 'patient'
 */
export const normalizeRole = (rawRole) => {
  if (!rawRole) return '';
  const str = String(rawRole).toLowerCase().trim();

  if (['super_admin', 'super-admin', 'superadmin'].includes(str)) {
    return ROLES.SUPER_ADMIN;
  }
  if (['organization_admin', 'admin', 'clinic_admin', 'org_admin', 'organizationadmin', 'receptionist'].includes(str)) {
    return ROLES.ORGANIZATION_ADMIN;
  }
  if (['doctor'].includes(str)) {
    return ROLES.DOCTOR;
  }
  if (['patient'].includes(str)) {
    return ROLES.PATIENT;
  }

  return str;
};

export const getDashboardRoute = (role) => {
  switch (String(role || "").toLowerCase().trim()) {
    case "super_admin":
      return "/super-admin/dashboard";

    case "organization_admin":
    case "receptionist":
    case "admin":
      return "/admin/dashboard";

    case "doctor":
      return "/doctor/dashboard";

    case "patient":
      return "/patient/dashboard";

    default:
      return "/login";
  }
};

export function getRoleHomePath(rawRole) {
  const role = normalizeRole(rawRole);
  return getDashboardRoute(role);
}

