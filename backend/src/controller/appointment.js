import { AppError } from "../middleware/errorHandler.js";
import { getPatientByUserId } from "../repository/patient.js";

import {
    createAppointmentService,
    validateAppointmentSlotService,
    getMyAppointmentsService,
    getAppointmentService,
    cancelAppointmentService,

    getDoctorTodayAppointmentsService,
    getDoctorUpcomingAppointmentsService,
    getDoctorCompletedAppointmentsService,
    getDoctorCancelledAppointmentsService,

    cancelAppointmentByDoctorService,
    completeAppointmentService,

    getAllClinicAppointmentsService,
    getClinicAppointmentStatsService,

    updateOnlineMeetingService,
    getOnlineMeetingService
} from "../service/appointment.js";

export const validateSlotController = async (req, res) => {
    const { doctorId, appointmentDate, startTime, endTime } = req.body;
    let patientId = req.body.patientId;

    if (!patientId && req.user && req.user.role === "patient") {
        const patient = await getPatientByUserId(req.user.id);
        if (patient) {
            patientId = patient._id;
        }
    }

    const result = await validateAppointmentSlotService({
        doctorId,
        patientId,
        appointmentDate,
        startTime,
        endTime
    });

    res.status(200).json({
        success: true,
        data: result
    });
};

export const createAppointmentController = async (
    req,
    res
) => {

    const result = await createAppointmentService(
        req.user.id,
        req.body
    );

    res.status(201).json({
        success: true,
        message: "Appointment booked successfully",
        data: result
    });

};


export const getMyAppointmentsController = async (
    req,
    res
) => {

    const result = await getMyAppointmentsService(
        req.user.id,
        req.query.status
    );

    res.status(200).json({
        success: true,
        data: result
    });

};



export const getAppointmentController = async (
    req,
    res
) => {

    const result = await getAppointmentService(
        req.params.id,
        req.user
    );

    res.status(200).json({
        success: true,
        data: result
    });

};


export const cancelAppointmentController = async (
    req,
    res
) => {

    const result = await cancelAppointmentService(
        req.params.id,
        req.user.id,
        req.body.cancelReason
    );

    res.status(200).json({
        success: true,
        message: "Appointment cancelled successfully",
        data: result
    });

};



export const getDoctorTodayAppointmentsController = async (
    req,
    res
) => {

    const result =
        await getDoctorTodayAppointmentsService(
            req.user.id
        );

    res.status(200).json({
        success: true,
        data: result
    });

};



export const getDoctorUpcomingAppointmentsController = async (
    req,
    res
) => {

    const result =
        await getDoctorUpcomingAppointmentsService(
            req.user.id
        );

    res.status(200).json({
        success: true,
        data: result
    });

};


export const getDoctorCompletedAppointmentsController = async (
    req,
    res
) => {

    const result =
        await getDoctorCompletedAppointmentsService(
            req.user.id
        );

    res.status(200).json({
        success: true,
        data: result
    });

};



export const getDoctorCancelledAppointmentsController = async (
    req,
    res
) => {

    const result =
        await getDoctorCancelledAppointmentsService(
            req.user.id
        );

    res.status(200).json({
        success: true,
        data: result
    });

};


export const cancelAppointmentByDoctorController = async (
    req,
    res
) => {

    const result =
        await cancelAppointmentByDoctorService(
            req.params.id,
            req.user.id,
            req.body.cancelReason
        );

    res.status(200).json({
        success: true,
        message: "Appointment cancelled successfully",
        data: result
    });

};



export const completeAppointmentController = async (
    req,
    res
) => {

    const result =
        await completeAppointmentService(
            req.params.id,
            req.user.id
        );

    res.status(200).json({
        success: true,
        message: "Appointment marked as completed",
        data: result
    });

};



export const getAllClinicAppointmentsController = async (
    req,
    res
) => {

    const organizationId =
        req.user.organizationId;

    if (!organizationId) {

        throw new AppError(
            400,
            "Organization not found for this admin"
        );
    }


    const result =
        await getAllClinicAppointmentsService(
            organizationId,
            req.query
        );

    res.status(200).json({
        success: true,
        data: result
    });

};
export const getClinicAppointmentStatsController = async (
    req,
    res
) => {

    const organizationId =
        req.user.organizationId;

    if (!organizationId) {
        throw new AppError(
            400,
            "Organization not found for this admin"
        );
    }
    const result =
        await getClinicAppointmentStatsService(
            organizationId
        );
    res.status(200).json({
        success: true,
        data: result
    });

};

export const updateOnlineMeetingController = async (req, res) => {
    const { id } = req.params;
    const result = await updateOnlineMeetingService(
        id,
        req.user.id,
        req.body
    );
    res.status(200).json({
        success: true,
        message: "Meeting details updated successfully",
        data: result
    });
};

export const getOnlineMeetingController = async (req, res) => {
    const { id } = req.params;
    const result = await getOnlineMeetingService(
        id,
        req.user
    );
    res.status(200).json({
        success: true,
        message: "Meeting details fetched successfully",
        data: result
    });
};
