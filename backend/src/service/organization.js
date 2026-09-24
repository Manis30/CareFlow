import { registerService } from "./user.js";
import {
    createOrganizationRepository,
    getAllOrganizationRepo,
    getOrganizationRepo,
    updateOrganizationRepo,
    deleteOrganizationRepo
} from "../repository/organization.js";
import { getOrCreateGeneralDepartment } from "../repository/department.js";
import sanitizeUser from "../util/sanitizeUser.js";
import { normalizeTimeTo24h, timeToMinutes } from "../util/timeUtils.js";
import uploadToCloudinary from "../util/uploadToCloudinary.js";
import deleteFromCloudinary from "../util/deleteFromCloudinary.js";
import { AppError } from "../middleware/errorHandler.js";

export const DEFAULT_CLINIC_WORKING_HOURS = [
    { day: "monday", status: "OPEN", isOpen: true, enabled: true, open: "09:00", start: "09:00", close: "18:00", end: "18:00", clode: "18:00" },
    { day: "tuesday", status: "OPEN", isOpen: true, enabled: true, open: "09:00", start: "09:00", close: "18:00", end: "18:00", clode: "18:00" },
    { day: "wednesday", status: "OPEN", isOpen: true, enabled: true, open: "09:00", start: "09:00", close: "18:00", end: "18:00", clode: "18:00" },
    { day: "thursday", status: "OPEN", isOpen: true, enabled: true, open: "09:00", start: "09:00", close: "18:00", end: "18:00", clode: "18:00" },
    { day: "friday", status: "OPEN", isOpen: true, enabled: true, open: "09:00", start: "09:00", close: "18:00", end: "18:00", clode: "18:00" },
    { day: "saturday", status: "HALF_DAY", isOpen: true, enabled: true, open: "09:00", start: "09:00", close: "13:00", end: "13:00", clode: "13:00" },
    { day: "sunday", status: "CLOSED", isOpen: false, enabled: false, open: "", start: null, close: "", end: null, clode: "" }
];

export const normalizeWorkingHours = (workingHours) => {
    if (!Array.isArray(workingHours) || workingHours.length === 0) return DEFAULT_CLINIC_WORKING_HOURS;
    return workingHours.map((wh) => {
        const day = (wh.day || "").toLowerCase().trim();
        const rawOpen = wh.open || wh.start || "";
        const rawClose = wh.close || wh.end || wh.clode || "";
        const isOpen = wh.isOpen !== false && wh.enabled !== false && wh.status !== "CLOSED";

        let normOpen = (isOpen && rawOpen) ? normalizeTimeTo24h(rawOpen) : "";
        let normClose = (isOpen && rawClose) ? normalizeTimeTo24h(rawClose) : "";

        // Detect corrupt/invalid data (end <= start) for open days and repair
        const startMin = timeToMinutes(normOpen);
        const endMin = timeToMinutes(normClose);
        if (isOpen && (startMin === null || endMin === null || endMin <= startMin)) {
            normOpen = "09:00";
            normClose = (day === "saturday") ? "13:00" : "18:00";
        }

        return {
            ...wh,
            day,
            status: wh.status || (isOpen ? (day === "saturday" ? "HALF_DAY" : "OPEN") : "CLOSED"),
            isOpen,
            enabled: isOpen,
            open: normOpen,
            start: normOpen || null,
            close: normClose,
            end: normClose || null,
            clode: normClose
        };
    });
};

export const createOrganizationService = async (data, file = null) => {
    if (!data.name || !data.adminEmail || !data.adminName) {
        throw new AppError(400, "Organization name, admin name, and admin email are required");
    }

    const rawWH = (data.workingHours && data.workingHours.length > 0) ? data.workingHours : DEFAULT_CLINIC_WORKING_HOURS;

    const orgData = {
        name: data.name.trim(),
        email: data.email ? data.email.trim() : data.adminEmail.trim(),
        phone: data.phone ? data.phone.trim() : (data.adminPhone ? data.adminPhone.trim() : "0000000000"),
        address: data.address || {
            street: "12 Gandhi Road",
            city: "Villupuram",
            state: "Tamil Nadu",
            country: "India",
            pincode: "605602",
            latitude: 11.9401,
            longitude: 79.4861
        },
        workingHours: normalizeWorkingHours(rawWH),
        status: data.status || 'approved'
    };

    if (file) {
        const uploaded = await uploadToCloudinary(file.buffer, "careflow/organization-logos");
        orgData.organizationLogo = {
            url: uploaded.url,
            publicId: uploaded.public_id || uploaded.publicId
        };
    }

    const organization = await createOrganizationRepository(orgData);

    // Automatically initialize default "General" department for the organization
    await getOrCreateGeneralDepartment(organization._id);

    const defaultPassword = data.adminPassword || "12345678";

    const admin = await registerService({
        name: data.adminName.trim(),
        password: defaultPassword,
        email: data.adminEmail.trim(),
        phone: data.adminPhone ? data.adminPhone.trim() : "0000000000",
        role: "organization_admin",
        organizationId: organization._id,
        mustResetPassword: true
    });

    return {
        organization,
        admin: sanitizeUser(admin),
        tempPassword: defaultPassword
    };
};

export const getAllOrganizationService = async (page, limit) => {
    return await getAllOrganizationRepo(page, limit);
};

export const getOrganizationService = async (id) => {
    const org = await getOrganizationRepo(id);
    if (!org) {
        throw new AppError(404, "Organization not found");
    }
    return org;
};

export const updateOrganizationService = async (id, data) => {
    const allowedUpdates = {};
    if (data.name !== undefined) allowedUpdates.name = data.name.trim();
    if (data.email !== undefined) allowedUpdates.email = data.email.trim();
    if (data.phone !== undefined) allowedUpdates.phone = data.phone.trim();
    if (data.address !== undefined) allowedUpdates.address = data.address;
    if (data.workingHours !== undefined) allowedUpdates.workingHours = normalizeWorkingHours(data.workingHours);
    if (data.status !== undefined) allowedUpdates.status = data.status;
    if (data.rejectionReason !== undefined) allowedUpdates.rejectionReason = data.rejectionReason;
    if (data.suspensionReason !== undefined) allowedUpdates.suspensionReason = data.suspensionReason;
    if (data.organizationLogo !== undefined) allowedUpdates.organizationLogo = data.organizationLogo;

    const result = await updateOrganizationRepo(id, allowedUpdates);
    if (!result) {
        throw new AppError(404, "Organization not found");
    }
    return result;
};

export const updateOrganizationLogoService = async (orgId, file) => {
    if (!file) {
        throw new AppError(400, "No logo image file provided");
    }

    const org = await getOrganizationRepo(orgId);
    if (!org) {
        throw new AppError(404, "Organization not found");
    }

    if (org.organizationLogo?.publicId) {
        try {
            await deleteFromCloudinary(org.organizationLogo.publicId);
        } catch (e) {
            console.error("Failed to delete previous logo:", e.message);
        }
    }

    const uploaded = await uploadToCloudinary(file.buffer, "careflow/organization-logos");

    const updatedLogo = {
        url: uploaded.url,
        publicId: uploaded.public_id || uploaded.publicId
    };

    return await updateOrganizationRepo(orgId, { organizationLogo: updatedLogo });
};

export const removeOrganizationLogoService = async (orgId) => {
    const org = await getOrganizationRepo(orgId);
    if (!org) {
        throw new AppError(404, "Organization not found");
    }

    if (org.organizationLogo?.publicId) {
        try {
            await deleteFromCloudinary(org.organizationLogo.publicId);
        } catch (e) {
            console.error("Failed to delete organization logo from Cloudinary:", e.message);
        }
    }

    return await updateOrganizationRepo(orgId, {
        organizationLogo: { url: null, publicId: null }
    });
};

export const deleteOrganizationService = async (id) => {
    return await deleteOrganizationRepo(id, { status: 'suspended' });
};