import { AppError } from "../middleware/errorHandler.js";
import {
    createPrescriptionService,
    getMyPrescriptionsService,
    getPrescriptionByIdService,
    getPrescriptionByAppointmentService,
    updatePrescriptionService
} from "../service/prescription.js";

export const createPrescriptionController = async (req, res) => {
    const { appointmentId } = req.params;
    const result = await createPrescriptionService(
        appointmentId,
        req.user.id,
        req.body
    );
    res.status(201).json({
        success: true,
        message: "Prescription created successfully",
        data: result
    });
};

export const getMyPrescriptionsController = async (req, res) => {
    const result = await getMyPrescriptionsService(
        req.user.id,
        req.user.role
    );
    res.status(200).json({
        success: true,
        message: "Prescriptions fetched successfully",
        data: result
    });
};

export const getPrescriptionByAppointmentController = async (req, res) => {
    const { appointmentId } = req.params;
    const result = await getPrescriptionByAppointmentService(
        appointmentId,
        req.user.id,
        req.user.role
    );
    res.status(200).json({
        success: true,
        message: "Prescription fetched successfully",
        data: result
    });
};

export const getPrescriptionByIdController = async (req, res) => {
    const { id } = req.params;
    const result = await getPrescriptionByIdService(
        id,
        req.user.id,
        req.user.role
    );
    res.status(200).json({
        success: true,
        message: "Prescription fetched successfully",
        data: result
    });
};

export const updatePrescriptionController = async (req, res) => {
    const { id } = req.params;
    const result = await updatePrescriptionService(
        id,
        req.user.id,
        req.body
    );
    res.status(200).json({
        success: true,
        message: "Prescription updated successfully",
        data: result
    });
};
