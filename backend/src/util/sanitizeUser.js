import { normalizeRole } from "./canonicalRole.js";

/**
 * Sanitizes user documents for API responses.
 * Ensures sensitive token/password hashes are removed and essential fields (including canonical role) are explicitly present.
 */
export const sanitizeUser = (userDoc) => {
    if (!userDoc) return null;
    const user = typeof userDoc.toObject === 'function' ? userDoc.toObject() : { ...userDoc };

    // Remove sensitive fields
    delete user.passwordHash;
    delete user.refreshTokenHash;
    delete user.resetTokenHash;
    delete user.resetTokenExpiry;
    delete user.password;

    const normalizedRole = normalizeRole(user.role);

    return {
        _id: user._id ? user._id.toString() : user.id,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: normalizedRole,
        organizationId: user.organizationId || null,
        profileImage: user.profileImage || { url: null, publicId: null },
        mustResetPassword: user.mustResetPassword ?? false,
        isActive: user.isActive ?? true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
};

export default sanitizeUser;
