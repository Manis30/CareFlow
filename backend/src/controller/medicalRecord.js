import { AppError } from "../middleware/errorHandler.js";
import {
    uploadMedicalRecordService,
    getMyMedicalRecordsService,
    getMedicalRecordByIdService,
    shareMedicalRecordService,
    revokeMedicalRecordService,
    getMedicalRecordsByAppointmentService,
    updateMedicalRecordService,
    deleteMedicalRecordService,
    getMedicalRecordFileService
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

/**
 * Authorized file preview endpoint.
 * Delivers verified MIME type with inline disposition so the browser renders PDF/images directly.
 */
export const previewMedicalRecordController = async (req, res) => {
    const { id } = req.params;
    const fileData = await getMedicalRecordFileService(id, req.user, "preview");

    res.setHeader("Content-Type", fileData.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${fileData.fileName}"`);
    res.setHeader("Content-Length", fileData.fileSize);
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.send(fileData.buffer);
};

/**
 * Authorized file download endpoint.
 * Delivers original file with attachment disposition and preserved, sanitized filename.
 */
export const downloadMedicalRecordController = async (req, res) => {
    const { id } = req.params;
    const fileData = await getMedicalRecordFileService(id, req.user, "download");

    res.setHeader("Content-Type", fileData.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileData.fileName}"`);
    res.setHeader("Content-Length", fileData.fileSize);
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.send(fileData.buffer);
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

/**
 * AI Summarize Medical Record: Scoped strictly to the selected document.
 */
export const summarizeMedicalRecordController = async (req, res) => {
    const { id } = req.params;
    const { summarizeRecordService } = await import("../service/medicalRecordIntelligence.js");
    const result = await summarizeRecordService(id, req.user);

    res.status(200).json({
        success: true,
        message: "Record summary generated successfully",
        data: result
    });
};

/**
 * AI Extract Clinical Findings: Scoped strictly to the selected document.
 */
export const extractMedicalRecordFindingsController = async (req, res) => {
    const { id } = req.params;
    const { extractFindingsService } = await import("../service/medicalRecordIntelligence.js");
    const result = await extractFindingsService(id, req.user);

    res.status(200).json({
        success: true,
        message: "Clinical findings extracted successfully",
        data: result
    });
};

/**
 * AI Ask About This Record: Interactive Q&A scoped strictly to the selected document.
 */
export const askMedicalRecordQuestionController = async (req, res) => {
    const { id } = req.params;
    const { question } = req.body;
    const { askAboutRecordService } = await import("../service/medicalRecordIntelligence.js");
    const result = await askAboutRecordService(id, req.user, question);

    res.status(200).json({
        success: true,
        message: "Question answered successfully",
        data: result
    });
};

