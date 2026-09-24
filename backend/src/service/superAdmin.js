import { AppError } from "../middleware/errorHandler.js";
import {
    getOrganizationsPlatformRepo,
    getOrganizationByIdRepo,
    updateOrganizationStatusRepo,
    getDoctorsPlatformRepo,
    getDoctorByIdPlatformRepo,
    getPatientsPlatformRepo,
    getAppointmentsPlatformRepo,
    getPaymentsPlatformRepo,
    getPlatformDashboardStatsRepo,
    getRegionalClinicalPerformanceRepo,
    getOrganizationAnalyticsPlatformRepo,
    getPatientAnalyticsPlatformRepo,
    getAppointmentAnalyticsPlatformRepo
} from "../repository/superAdmin.js";

export const approveOrganizationService = async (id) => {
    const org = await getOrganizationByIdRepo(id);
    if (!org) {
        throw new AppError(404, "Organization not found");
    }

    if (org.status === "approved") {
        throw new AppError(400, "Organization is already approved");
    }

    if (org.status === "rejected") {
        throw new AppError(400, "Cannot approve a rejected organization");
    }

    return await updateOrganizationStatusRepo(id, {
        status: "approved",
        rejectionReason: null,
        suspensionReason: null
    });
};

export const rejectOrganizationService = async (id, rejectionReason) => {
    const org = await getOrganizationByIdRepo(id);
    if (!org) {
        throw new AppError(404, "Organization not found");
    }

    if (org.status === "rejected") {
        throw new AppError(400, "Organization is already rejected");
    }

    if (org.status === "approved" || org.status === "suspended") {
        throw new AppError(400, "Only pending organizations can be rejected");
    }

    return await updateOrganizationStatusRepo(id, {
        status: "rejected",
        rejectionReason: rejectionReason || "Rejected by super admin"
    });
};

export const suspendOrganizationService = async (id, suspensionReason) => {
    const org = await getOrganizationByIdRepo(id);
    if (!org) {
        throw new AppError(404, "Organization not found");
    }

    if (org.status === "suspended") {
        throw new AppError(400, "Organization is already suspended");
    }

    if (org.status !== "approved") {
        throw new AppError(400, "Only approved organizations can be suspended");
    }

    return await updateOrganizationStatusRepo(id, {
        status: "suspended",
        suspensionReason: suspensionReason || "Suspended by super admin"
    });
};

export const activateOrganizationService = async (id) => {
    const org = await getOrganizationByIdRepo(id);
    if (!org) {
        throw new AppError(404, "Organization not found");
    }

    if (org.status === "approved") {
        throw new AppError(400, "Organization is already active");
    }

    if (org.status !== "suspended") {
        throw new AppError(400, "Only suspended organizations can be activated");
    }

    return await updateOrganizationStatusRepo(id, {
        status: "approved",
        suspensionReason: null
    });
};

export const getAllOrganizationsPlatformService = async (query = {}) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const filter = {};

    if (query.status) {
        filter.status = query.status;
    }

    return await getOrganizationsPlatformRepo(filter, page, limit);
};

export const getOrganizationByIdService = async (id) => {
    const org = await getOrganizationByIdRepo(id);
    if (!org) {
        throw new AppError(404, "Organization not found");
    }
    return org;
};

export const getDoctorsPlatformService = async (query = {}) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const filter = {};

    if (query.organizationId) {
        filter.organizationId = query.organizationId;
    }
    if (query.departmentId) {
        filter.departmentId = query.departmentId;
    }

    return await getDoctorsPlatformRepo(filter, page, limit);
};

export const getDoctorByIdPlatformService = async (id) => {
    const doctor = await getDoctorByIdPlatformRepo(id);
    if (!doctor) {
        throw new AppError(404, "Doctor not found");
    }
    return doctor;
};

export const getPatientsPlatformService = async (query = {}) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const filter = {};

    if (query.organizationId) {
        const AppointmentModel = (await import("../model/appointment.js")).default;
        const patientIds = await AppointmentModel.distinct("patientId", {
            organizationId: query.organizationId
        });
        filter._id = { $in: patientIds };
    }

    return await getPatientsPlatformRepo(filter, page, limit);
};

export const getAppointmentsPlatformService = async (query = {}) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const filter = {};

    if (query.organizationId) {
        filter.organizationId = query.organizationId;
    }
    if (query.status) {
        filter.status = query.status;
    }
    if (query.doctorId) {
        filter.doctorId = query.doctorId;
    }
    if (query.patientId) {
        filter.patientId = query.patientId;
    }
    if (query.departmentId) {
        filter.departmentId = query.departmentId;
    }
    if (query.startDate || query.endDate) {
        filter.appointmentDate = {};
        if (query.startDate) {
            filter.appointmentDate.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
            filter.appointmentDate.$lte = new Date(query.endDate);
        }
    }

    return await getAppointmentsPlatformRepo(filter, page, limit);
};

export const getPaymentsPlatformService = async (query = {}) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const filter = {};

    if (query.organizationId) {
        filter.organizationId = query.organizationId;
    }
    if (query.doctorId) {
        filter.doctorId = query.doctorId;
    }
    if (query.status) {
        filter.status = query.status;
    }
    if (query.patientId) {
        filter.patientId = query.patientId;
    }
    if (query.startDate || query.endDate) {
        filter.createdAt = {};
        if (query.startDate) {
            filter.createdAt.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
            const end = new Date(query.endDate);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }

    return await getPaymentsPlatformRepo(filter, page, limit);
};

export const getSuperAdminDashboardService = async () => {
    return await getPlatformDashboardStatsRepo();
};

export const getRegionalClinicalPerformanceService = async (query = {}) => {
    const timeframe = query.timeframe || "ALL";
    return await getRegionalClinicalPerformanceRepo(timeframe);
};

export const getOrganizationAnalyticsPlatformService = async (query = {}) => {
    return await getOrganizationAnalyticsPlatformRepo(query);
};

export const getPatientAnalyticsPlatformService = async (query = {}) => {
    const timeframe = query.timeframe || "6M";
    return await getPatientAnalyticsPlatformRepo(timeframe);
};

export const getAppointmentAnalyticsPlatformService = async (query = {}) => {
    return await getAppointmentAnalyticsPlatformRepo(query);
};

