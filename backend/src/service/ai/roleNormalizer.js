import { AppError } from "../../middleware/errorHandler.js";

/**
 * Canonical Role Normalization Layer for CareFlow AI.
 * Rule 1: Exactly four roles exist in CareFlow AI:
 * - super_admin
 * - admin (canonical organization-admin role)
 * - doctor
 * - patient
 * 
 * Rejects legacy roles (receptionist, front_desk, etc.).
 * Normalizes 'organization_admin' to 'admin'.
 */
export const CANONICAL_ROLES = Object.freeze([
    "super_admin",
    "admin",
    "doctor",
    "patient"
]);

export const normalizeRole = (role) => {
    if (!role || typeof role !== "string") {
        return "patient";
    }

    const clean = role.trim().toLowerCase();

    // Disallow receptionist / front desk legacy roles from accessing AI workflows
    if (clean === "receptionist" || clean === "receptionist_admin" || clean === "front_desk") {
        throw new AppError(403, `Access denied: Role '${role}' is not authorized to access CareFlow AI workflows.`);
    }

    // Canonicalize organization_admin -> admin
    if (clean === "organization_admin" || clean === "org_admin") {
        return "admin";
    }

    if (CANONICAL_ROLES.includes(clean)) {
        return clean;
    }

    throw new AppError(403, `Access denied: Unknown or unauthorized role '${role}'.`);
};

export const isAuthorizedAIRole = (role) => {
    try {
        const canonical = normalizeRole(role);
        return CANONICAL_ROLES.includes(canonical);
    } catch {
        return false;
    }
};
