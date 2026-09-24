import { AppError } from "../middleware/errorHandler.js";
import {
    getAllOrganizationsPlatformService,
    getOrganizationByIdService,
    approveOrganizationService,
    rejectOrganizationService,
    suspendOrganizationService,
    activateOrganizationService,
    getDoctorsPlatformService,
    getDoctorByIdPlatformService,
    getPatientsPlatformService,
    getAppointmentsPlatformService,
    getPaymentsPlatformService,
    getSuperAdminDashboardService,
    getRegionalClinicalPerformanceService,
    getOrganizationAnalyticsPlatformService,
    getPatientAnalyticsPlatformService,
    getAppointmentAnalyticsPlatformService
} from "../service/superAdmin.js";

export const getAllOrganizationsPlatformController = async (req, res) => {
    const result = await getAllOrganizationsPlatformService(req.query);
    res.status(200).json({
        success: true,
        message: "Organizations fetched successfully",
        data: result
    });
};

export const getOrganizationByIdController = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw new AppError(400, "Organization ID required");
    }
    const result = await getOrganizationByIdService(id);
    res.status(200).json({
        success: true,
        message: "Organization fetched successfully",
        data: result
    });
};

export const approveOrganizationController = async (req, res) => {
    const { id } = req.params;
    const result = await approveOrganizationService(id);
    res.status(200).json({
        success: true,
        message: "Organization approved successfully",
        data: result
    });
};

export const rejectOrganizationController = async (req, res) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const result = await rejectOrganizationService(id, rejectionReason);
    res.status(200).json({
        success: true,
        message: "Organization rejected successfully",
        data: result
    });
};

export const suspendOrganizationController = async (req, res) => {
    const { id } = req.params;
    const { suspensionReason } = req.body;
    const result = await suspendOrganizationService(id, suspensionReason);
    res.status(200).json({
        success: true,
        message: "Organization suspended successfully",
        data: result
    });
};

export const activateOrganizationController = async (req, res) => {
    const { id } = req.params;
    const result = await activateOrganizationService(id);
    res.status(200).json({
        success: true,
        message: "Organization activated successfully",
        data: result
    });
};

export const getDoctorsPlatformController = async (req, res) => {
    const result = await getDoctorsPlatformService(req.query);
    res.status(200).json({
        success: true,
        message: "Platform doctors fetched successfully",
        data: result
    });
};

export const getDoctorByIdPlatformController = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw new AppError(400, "Doctor ID required");
    }
    const result = await getDoctorByIdPlatformService(id);
    res.status(200).json({
        success: true,
        message: "Doctor fetched successfully",
        data: result
    });
};

export const getPatientsPlatformController = async (req, res) => {
    const result = await getPatientsPlatformService(req.query);
    res.status(200).json({
        success: true,
        message: "Platform patients fetched successfully",
        data: result
    });
};

export const getAppointmentsPlatformController = async (req, res) => {
    const result = await getAppointmentsPlatformService(req.query);
    res.status(200).json({
        success: true,
        message: "Platform appointments fetched successfully",
        data: result
    });
};

export const getPaymentsPlatformController = async (req, res) => {
    const result = await getPaymentsPlatformService(req.query);
    res.status(200).json({
        success: true,
        message: "Platform payments fetched successfully",
        data: result
    });
};

export const getSuperAdminDashboardController = async (req, res) => {
    const result = await getSuperAdminDashboardService();
    res.status(200).json({
        success: true,
        message: "Dashboard analytics fetched successfully",
        data: result
    });
};

export const getRegionalClinicalPerformanceController = async (req, res) => {
    const result = await getRegionalClinicalPerformanceService(req.query);
    res.status(200).json({
        success: true,
        message: "Regional clinical performance fetched successfully",
        data: result
    });
};

export const getOrganizationAnalyticsPlatformController = async (req, res) => {
    const result = await getOrganizationAnalyticsPlatformService(req.query);
    res.status(200).json({
        success: true,
        message: "Organization analytics telemetry fetched successfully",
        data: result
    });
};

export const getPatientAnalyticsPlatformController = async (req, res) => {
    const result = await getPatientAnalyticsPlatformService(req.query);
    res.status(200).json({
        success: true,
        message: "Patient analytics telemetry fetched successfully",
        data: result
    });
};

export const getAppointmentAnalyticsPlatformController = async (req, res) => {
    const result = await getAppointmentAnalyticsPlatformService(req.query);
    res.status(200).json({
        success: true,
        message: "Appointment analytics telemetry fetched successfully",
        data: result
    });
};


