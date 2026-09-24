import { AppError } from "../middleware/errorHandler.js";
import {
    createOrganizationService,
    getAllOrganizationService,
    getOrganizationService,
    updateOrganizationService,
    deleteOrganizationService,
    updateOrganizationLogoService,
    removeOrganizationLogoService
} from "../service/organization.js";
import { normalizeRole } from "../util/canonicalRole.js";

export const getMyOrganizationController = async (req, res) => {
    const userRole = normalizeRole(req.user.role);
    if (userRole === "super_admin") {
        throw new AppError(403, "Super Admin does not belong to a single clinic organization");
    }

    const orgId = req.user.organizationId;
    if (!orgId) {
        throw new AppError(400, "No organization associated with this account");
    }
    const organization = await getOrganizationService(orgId);
    res.status(200).json({ success: true, data: organization });
};

export const updateMyOrganizationController = async (req, res) => {
    const userRole = normalizeRole(req.user.role);
    if (userRole === "super_admin") {
        throw new AppError(
            403,
            "Super Admin is not authorized to edit clinic configuration or operational details. Super Admin has read-only access to clinic configurations."
        );
    }

    const orgId = req.user.organizationId;
    if (!orgId) {
        throw new AppError(400, "No organization associated with this account");
    }
    const result = await updateOrganizationService(orgId, req.body);
    res.status(200).json({
        success: true,
        message: "Organization profile updated successfully",
        data: result
    });
};

export const updateMyOrganizationLogoController = async (req, res) => {
    const orgId = req.user.organizationId;
    if (!orgId) {
        throw new AppError(400, "No organization associated with this account");
    }
    const result = await updateOrganizationLogoService(orgId, req.file);
    res.status(200).json({
        success: true,
        message: "Organization logo updated successfully",
        data: result
    });
};

export const removeMyOrganizationLogoController = async (req, res) => {
    const orgId = req.user.organizationId;
    if (!orgId) {
        throw new AppError(400, "No organization associated with this account");
    }
    const result = await removeOrganizationLogoService(orgId);
    res.status(200).json({
        success: true,
        message: "Organization logo removed successfully",
        data: result
    });
};

export const createOrganizationController = async (req, res) => {
    const data = req.body;
    const result = await createOrganizationService(data, req.file);
    res.status(201).json({
        success: true,
        message: "Organization created successfully",
        organization: result.organization,
        admin: result.admin,
        tempPassword: result.tempPassword
    });
};

export const getAllOrganizationController = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await getAllOrganizationService(page, limit);
    res.status(200).json({
        success: true,
        message: "Organizations fetched successfully",
        data: result
    });
};

export const getOrganizationCitiesController = async (req, res) => {
    const { getDistinctCitiesRepo } = await import("../repository/organization.js");
    const cities = await getDistinctCitiesRepo();
    res.status(200).json({ success: true, data: cities });
};

export const getActiveOrganizationsController = async (req, res) => {
    const { getActiveOrganizationsRepo } = await import("../repository/organization.js");
    const { city } = req.query;
    const orgs = await getActiveOrganizationsRepo({ city });
    res.status(200).json({ success: true, data: orgs });
};

export const getOrganizationController = async (req, res) => {
    const { id } = req.params;
    const userRole = normalizeRole(req.user.role);

    // Multi-tenant check for organization_admin
    if (userRole === "organization_admin") {
        const userOrgId = req.user.organizationId ? req.user.organizationId.toString() : null;
        if (id !== userOrgId) {
            throw new AppError(403, "You do not have permission to view other organization profiles");
        }
    }

    const organization = await getOrganizationService(id);
    res.status(200).json({
        success: true,
        message: "Organization data fetched successfully",
        data: organization
    });
};

export const updateOrganizationController = async (req, res) => {
    const { id } = req.params;
    const userRole = normalizeRole(req.user.role);

    // 1. Super Admin is strictly forbidden from editing clinic details
    if (userRole === "super_admin") {
        const bodyKeys = Object.keys(req.body || {});
        const allowedKeys = ["status", "suspensionReason"];
        const hasUnauthorizedKeys = bodyKeys.some((k) => !allowedKeys.includes(k));

        if (hasUnauthorizedKeys) {
            throw new AppError(
                403,
                "Super Admin is not authorized to edit clinic details or configuration. Super Admin has read-only access to clinic details and can only modify organization status (approved/suspended)."
            );
        }
    }

    // 2. Organization Admin can only update their own organization
    if (userRole === "organization_admin") {
        const userOrgId = req.user.organizationId ? req.user.organizationId.toString() : null;
        if (id !== userOrgId) {
            throw new AppError(403, "You do not have permission to update other organization profiles");
        }
    }

    const result = await updateOrganizationService(id, req.body);
    res.status(200).json({
        success: true,
        message: "Organization status updated successfully",
        data: result
    });
};

export const deleteOrganizationController = async (req, res) => {
    const { id } = req.params;
    const result = await deleteOrganizationService(id);
    res.status(200).json({
        success: true,
        message: "Organization status updated to suspended successfully"
    });
};