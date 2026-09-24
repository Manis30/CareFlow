import { AppError } from "../middleware/errorHandler.js";
import {
    uploadMedicalRecordService,
    getMyMedicalRecordsService,
    getMedicalRecordByIdService,
    shareMedicalRecordService,
    revokeMedicalRecordService,
    getMedicalRecordsByAppointmentService,
    updateMedicalRecordService,
    deleteMedicalRecordService
} from "../service/medicalRecord.js";

export const uploadMedicalRecordController = async (req, res) => {
    const result = await uploadMedicalRecordService(
        req.user.id,
        req.user.role,
        req.body,
        req.file
    );
    res.status(201).json({
        success: true,
        message: "Medical record uploaded successfully",
        data: result
    });
};

export const getMyMedicalRecordsController = async (req, res) => {
    const result = await getMyMedicalRecordsService(
        req.user.id,
        req.user.role
    );
    res.status(200).json({
        success: true,
        message: "Medical records fetched successfully",
        data: result
    });
};

export const getMedicalRecordByIdController = async (req, res) => {
    const { id } = req.params;
    const result = await getMedicalRecordByIdService(
        id,
        req.user.id,
        req.user.role
    );
    res.status(200).json({
        success: true,
        message: "Medical record fetched successfully",
        data: result
    });
};

export const shareMedicalRecordController = async (req, res) => {
    const { id } = req.params;
    const { doctorId } = req.body;

    if (!doctorId) {
        throw new AppError(400, "Doctor ID is required to share medical record");
    }

    const result = await shareMedicalRecordService(
        id,
        req.user.id,
        doctorId
    );

    res.status(200).json({
        success: true,
        message: "Medical record shared with doctor successfully",
        data: result
    });
};

export const revokeMedicalRecordController = async (req, res) => {
    const { id } = req.params;
    const { doctorId } = req.body;

    if (!doctorId) {
        throw new AppError(400, "Doctor ID is required to revoke medical record access");
    }

    const result = await revokeMedicalRecordService(
        id,
        req.user.id,
        doctorId
    );

    res.status(200).json({
        success: true,
        message: "Doctor access to medical record revoked successfully",
        data: result
    });
};

export const getMedicalRecordsByAppointmentController = async (req, res) => {
    const { appointmentId } = req.params;

    const result = await getMedicalRecordsByAppointmentService(
        appointmentId,
        req.user.id,
        req.user.role
    );

    res.status(200).json({
        success: true,
        message: "Appointment medical records fetched successfully",
        data: result
    });
};

export const updateMedicalRecordController = async (req, res) => {
    const { id } = req.params;

    const result = await updateMedicalRecordService(
        id,
        req.user.id,
        req.user.role,
        req.body
    );

    res.status(200).json({
        success: true,
        message: "Medical record updated successfully",
        data: result
    });
};

export const deleteMedicalRecordController = async (req, res) => {
    const { id } = req.params;

    await deleteMedicalRecordService(
        id,
        req.user.id,
        req.user.role
    );

    res.status(200).json({
        success: true,
        message: "Medical record deleted successfully"
    });
};
