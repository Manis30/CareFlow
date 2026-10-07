import {AppError} from "../middleware/errorHandler.js";

import {
    createPatientService,
    getMyPatientProfileService,
    updateMyPatientProfileService,
    getPatientService
} from "../service/patient.js";

export const createPatientController = async (req, res) => {
    const result = await createPatientService(
        req.body,
        req.file
    );

    if (result.accessToken && result.refreshToken) {
        res.cookie('accessToken', result.accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
    }

    const { sanitizeUser } = await import("../util/sanitizeUser.js");
    const userData = sanitizeUser(result.user);

    res.status(201).json({
        success: true,
        message: "Patient created successfully",
        data: userData,
        user: userData,
        patient: result.patient,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
    });
};

export const getMyPatientProfileController = async (req, res) => {

    const userId = req.user.id;

    const result = await getMyPatientProfileService(userId);

    if (!result) {
        throw new AppError(404, "Patient profile not found");
    }

    res.status(200).json({
        success: true,
        data: result
    });
};

export const updateMyPatientProfileController = async (
    req,
    res
) => {

    const userId = req.user.id;

    const result = await updateMyPatientProfileService(
        userId,
        req.body,
        req.file
    );

    if (!result) {
        throw new AppError(
            404,
            "Patient profile not found"
        );
    }

    res.status(200).json({
        success: true,
        message: "Patient profile updated successfully",
        data: result
    });
};

export const getPatientController = async (req, res) => {

    const { id } = req.params;

    const result = await getPatientService(id);

    if (!result) {
        throw new AppError(404, "Patient not found");
    }

    res.status(200).json({
        success: true,
        data: result
    });
};

export const getMyCareTimelineController = async (req, res, next) => {
    try {
        const { getPatientByUserId } = await import("../repository/patient.js");
        const { getPatientCareTimeline } = await import("../service/patientCare.js");
        const patient = await getPatientByUserId(req.user.id);
        if (!patient) {
            throw new AppError(404, "Patient profile not found");
        }
        const data = await getPatientCareTimeline(patient._id);
        res.status(200).json({
            success: true,
            message: "Care timeline fetched successfully",
            data
        });
    } catch (err) {
        next(err);
    }
};

export const getMyProactiveAlertsController = async (req, res, next) => {
    try {
        const { getPatientByUserId } = await import("../repository/patient.js");
        const { getProactivePatientCareAlerts } = await import("../service/patientCare.js");
        const patient = await getPatientByUserId(req.user.id);
        if (!patient) {
            throw new AppError(404, "Patient profile not found");
        }
        const data = await getProactivePatientCareAlerts(patient._id);
        res.status(200).json({
            success: true,
            message: "Proactive care alerts fetched successfully",
            data
        });
    } catch (err) {
        next(err);
    }
};

export const getMyFollowUpsController = async (req, res, next) => {
    try {
        const { getPatientByUserId } = await import("../repository/patient.js");
        const { getPatientFollowUpTasks } = await import("../service/patientCare.js");
        const patient = await getPatientByUserId(req.user.id);
        if (!patient) {
            throw new AppError(404, "Patient profile not found");
        }
        const data = await getPatientFollowUpTasks(patient._id);
        res.status(200).json({
            success: true,
            message: "Follow-up tasks fetched successfully",
            data
        });
    } catch (err) {
        next(err);
    }
};