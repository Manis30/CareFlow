import { AppError } from "../middleware/errorHandler.js";
import { getPatientByUserId } from "../repository/patient.js";
import { getDoctorByUserId, getDoctorById } from "../repository/doctor.js";
import { getAppointmentById } from "../repository/appointment.js";
import uploadToCloudinary from "../util/uploadToCloudinary.js";
import deleteFromCloudinary from "../util/deleteFromCloudinary.js";
import DoctorModel from "../model/doctor.js";
import {
    createMedicalRecord,
    getMedicalRecordById,
    getMedicalRecordsByPatientId,
    getMedicalRecordsByAppointmentId,
    getMedicalRecordsForDoctor,
    updateMedicalRecordById,
    deleteMedicalRecordById,
    shareMedicalRecordWithDoctor,
    revokeMedicalRecordDoctorAccess
} from "../repository/medicalRecord.js";

export const uploadMedicalRecordService = async (userId, userRole, bodyData, file) => {
    if (!file) {
        throw new AppError(400, "Medical record file is required");
    }

    let patientId = null;
    let organizationId = null;
    let appointmentId = bodyData.appointmentId || null;

    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        if (!patient) {
            throw new AppError(404, "Patient profile not found");
        }
        patientId = patient._id;

        if (appointmentId) {
            const appointment = await getAppointmentById(appointmentId);
            if (!appointment) {
                throw new AppError(404, "Appointment not found");
            }
            if (appointment.patientId._id.toString() !== patient._id.toString()) {
                throw new AppError(403, "Appointment does not belong to patient");
            }
            organizationId = appointment.organizationId._id || appointment.organizationId;
        } else {
            organizationId = bodyData.organizationId || null;
        }
    } else if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            throw new AppError(404, "Doctor profile not found");
        }
        organizationId = doctor.organizationId;

        if (!appointmentId) {
            throw new AppError(400, "Appointment ID is required for doctor uploads");
        }

        const appointment = await getAppointmentById(appointmentId);
        if (!appointment) {
            throw new AppError(404, "Appointment not found");
        }

        if (appointment.doctorId._id.toString() !== doctor._id.toString()) {
            throw new AppError(403, "Doctor is not assigned to this appointment");
        }

        patientId = appointment.patientId._id || appointment.patientId;
    } else {
        throw new AppError(403, "You are not allowed to upload medical records");
    }

    const uploadedFile = await uploadToCloudinary(
        file.buffer,
        "careflow/medical-records"
    );

    const recordData = {
        organizationId,
        patientId,
        appointmentId,
        uploadedBy: userId,
        uploadedByRole: userRole,
        recordType: bodyData.recordType || "other",
        title: bodyData.title || "Medical Record",
        description: bodyData.description || null,
        file: {
            url: uploadedFile.url,
            publicId: uploadedFile.publicId,
            resourceType: uploadedFile.resourceType || "auto"
        },
        visibility: appointmentId ? "appointment" : "private"
    };

    const record = await createMedicalRecord(recordData);

    // Trigger extraction/OCR and RAG embedding pipeline for uploaded image documents
    const isImage = file.mimetype?.startsWith("image/") || file.originalname?.match(/\.(png|jpg|jpeg|webp)$/i);
    if (isImage && file.buffer) {
        try {
            const { extractTextFromImage, ingestDocument } = await import("./ai/documentQaService.js");
            const ocrResult = await extractTextFromImage(file.buffer);
            if (ocrResult?.text?.trim()) {
                await ingestDocument({
                    patientId,
                    organizationId,
                    documentId: record._id,
                    documentType: record.recordType || "medical_record",
                    sourceId: String(record._id),
                    textContent: ocrResult.text,
                    ocrConfidence: ocrResult.confidence,
                    isLowConfidence: ocrResult.isLowConfidence
                });
            }
        } catch (ocrErr) {
            console.warn("[Upload OCR/RAG Ingestion Notice]:", ocrErr.message);
        }
    }

    return record;
};

export const getMyMedicalRecordsService = async (userId, userRole) => {
    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        if (!patient) {
            throw new AppError(404, "Patient profile not found");
        }
        return await getMedicalRecordsByPatientId(patient._id);
    } else if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            throw new AppError(404, "Doctor profile not found");
        }
        return await getMedicalRecordsForDoctor(doctor._id);
    }
    throw new AppError(403, "Invalid role for accessing medical records");
};

export const getMedicalRecordByIdService = async (id, userId, userRole) => {
    const record = await getMedicalRecordById(id);
    if (!record) {
        throw new AppError(404, "Medical record not found");
    }

    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        if (!patient || record.patientId._id.toString() !== patient._id.toString()) {
            throw new AppError(403, "You are not allowed to access this medical record");
        }
        return record;
    }

    if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            throw new AppError(404, "Doctor profile not found");
        }

        const isShared = record.sharedWith.some(
            (s) => s.doctorId._id.toString() === doctor._id.toString() || s.doctorId.toString() === doctor._id.toString()
        );

        let isAppointmentAssigned = false;
        if (record.appointmentId) {
            const appointment = await getAppointmentById(record.appointmentId);
            if (appointment && appointment.doctorId._id.toString() === doctor._id.toString()) {
                isAppointmentAssigned = true;
            }
        }

        if (!isShared && !isAppointmentAssigned) {
            throw new AppError(403, "You are not allowed to access this medical record");
        }
        return record;
    }

    throw new AppError(403, "You are not allowed to access this medical record");
};

export const shareMedicalRecordService = async (id, userId, doctorId) => {
    const patient = await getPatientByUserId(userId);
    if (!patient) {
        throw new AppError(404, "Patient profile not found");
    }

    const record = await getMedicalRecordById(id);
    if (!record) {
        throw new AppError(404, "Medical record not found");
    }

    if (record.patientId._id.toString() !== patient._id.toString()) {
        throw new AppError(403, "You are not allowed to share this medical record");
    }

    const doctorExists = await DoctorModel.findById(doctorId);
    if (!doctorExists) {
        throw new AppError(404, "Doctor not found");
    }

    const isAlreadyShared = record.sharedWith.some(
        (s) => s.doctorId._id.toString() === doctorId.toString() || s.doctorId.toString() === doctorId.toString()
    );

    if (isAlreadyShared) {
        throw new AppError(400, "Doctor already has access to this medical record");
    }

    return await shareMedicalRecordWithDoctor(id, doctorId);
};

export const revokeMedicalRecordService = async (id, userId, doctorId) => {
    const patient = await getPatientByUserId(userId);
    if (!patient) {
        throw new AppError(404, "Patient profile not found");
    }

    const record = await getMedicalRecordById(id);
    if (!record) {
        throw new AppError(404, "Medical record not found");
    }

    if (record.patientId._id.toString() !== patient._id.toString()) {
        throw new AppError(403, "You are not allowed to revoke access to this medical record");
    }

    return await revokeMedicalRecordDoctorAccess(id, doctorId);
};

export const getMedicalRecordsByAppointmentService = async (appointmentId, userId, userRole) => {
    const appointment = await getAppointmentById(appointmentId);
    if (!appointment) {
        throw new AppError(404, "Appointment not found");
    }

    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        if (!patient || appointment.patientId._id.toString() !== patient._id.toString()) {
            throw new AppError(403, "You are not allowed to access records for this appointment");
        }
    } else if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor || appointment.doctorId._id.toString() !== doctor._id.toString()) {
            throw new AppError(403, "Doctor is not assigned to this appointment");
        }
    } else {
        throw new AppError(403, "You are not allowed to access medical records for this appointment");
    }

    return await getMedicalRecordsByAppointmentId(appointmentId);
};

export const updateMedicalRecordService = async (id, userId, userRole, data) => {
    const record = await getMedicalRecordById(id);
    if (!record) {
        throw new AppError(404, "Medical record not found");
    }

    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        if (!patient || record.patientId._id.toString() !== patient._id.toString()) {
            throw new AppError(403, "You are not allowed to update this medical record");
        }
    } else {
        throw new AppError(403, "You are not allowed to update this medical record");
    }

    const allowedUpdates = {
        title: data.title || record.title,
        description: data.description !== undefined ? data.description : record.description,
        recordType: data.recordType || record.recordType
    };

    return await updateMedicalRecordById(id, allowedUpdates);
};

export const deleteMedicalRecordService = async (id, userId, userRole) => {
    const record = await getMedicalRecordById(id);
    if (!record) {
        throw new AppError(404, "Medical record not found");
    }

    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        if (!patient || record.patientId._id.toString() !== patient._id.toString()) {
            throw new AppError(403, "You are not allowed to delete this medical record");
        }
    } else {
        throw new AppError(403, "You are not allowed to delete this medical record");
    }

    if (record.file && record.file.publicId) {
        try {
            await deleteFromCloudinary(record.file.publicId, { resourceType: record.file.resourceType || "auto" });
        } catch (error) {
            console.error("Cloudinary file deletion failed:", error.message);
        }
    }

    return await deleteMedicalRecordById(id);
};
