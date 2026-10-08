import { AppError } from "../middleware/errorHandler.js";
import { getPatientByUserId } from "../repository/patient.js";
import { getDoctorByUserId, getDoctorById } from "../repository/doctor.js";
import { getAppointmentById } from "../repository/appointment.js";
import uploadToCloudinary from "../util/uploadToCloudinary.js";
import deleteFromCloudinary from "../util/deleteFromCloudinary.js";
import DoctorModel from "../model/doctor.js";
import cloudinary from "../config/cloudinary.js";
import { resolveMedicalFileType, sanitizeFileName } from "../util/fileTypeResolver.js";
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

/**
 * Authorizes user access to a specific medical record based on CareFlow invariants:
 * - super_admin: platform permission
 * - admin: authorized organization scope
 * - patient: own records only
 * - doctor: authorized patient records (assigned appointment, shared record, or uploaded by doctor)
 */
export const authorizeMedicalRecordAccess = async (record, user) => {
    if (!record) {
        throw new AppError(404, "Medical record not found");
    }
    if (!user) {
        throw new AppError(401, "Authentication required");
    }

    const userRole = user.role;
    const userId = (user.id || user._id)?.toString();

    if (userRole === "super_admin") {
        return true;
    }

    if (userRole === "admin") {
        const recordOrgId = record.organizationId?._id?.toString() || record.organizationId?.toString();
        const userOrgId = user.organizationId?._id?.toString() || user.organizationId?.toString();
        if (recordOrgId && userOrgId && recordOrgId === userOrgId) {
            return true;
        }
        throw new AppError(403, "You are not allowed to access this medical record");
    }

    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        const recordPatientId = record.patientId?._id?.toString() || record.patientId?.toString();
        if (patient && recordPatientId === patient._id.toString()) {
            return true;
        }
        throw new AppError(403, "You are not allowed to access this medical record");
    }

    if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            throw new AppError(403, "You are not allowed to access this medical record");
        }
        const doctorIdStr = doctor._id.toString();

        // 1. Shared with this doctor
        const isShared = (record.sharedWith || []).some(
            (s) => (s.doctorId?._id?.toString() || s.doctorId?.toString()) === doctorIdStr
        );
        if (isShared) return true;

        // 2. Doctor assigned to the appointment
        if (record.appointmentId) {
            const apptId = record.appointmentId?._id || record.appointmentId;
            const appointment = await getAppointmentById(apptId);
            const apptDoctorId = appointment?.doctorId?._id?.toString() || appointment?.doctorId?.toString();
            if (apptDoctorId === doctorIdStr) {
                return true;
            }
        }

        // 3. Uploaded by this doctor
        const uploaderId = record.uploadedBy?._id?.toString() || record.uploadedBy?.toString();
        if (uploaderId === userId) {
            return true;
        }

        throw new AppError(403, "You are not allowed to access this medical record");
    }

    throw new AppError(403, "You are not allowed to access this medical record");
};

export const uploadMedicalRecordService = async (userId, userRole, bodyData, file) => {
    if (!file) {
        throw new AppError(400, "Medical record file is required");
    }

    // Validate file type and magic bytes
    const fileType = resolveMedicalFileType(file);
    if (!fileType.isValid) {
        throw new AppError(400, fileType.error || "Unsupported medical file format");
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
                throw new AppError(403, "You do not own this appointment");
            }
            organizationId = appointment.organizationId._id || appointment.organizationId;
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

    // Upload with correct Cloudinary resource_type: "raw" for documents (PDF/DOC/DOCX/TXT), "image" for images
    const uploadedFile = await uploadToCloudinary(
        file.buffer,
        "careflow/medical-records",
        {
            resourceType: fileType.cloudinaryResourceType,
            fileName: file.originalname,
            fileExtension: fileType.extension
        }
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
            resourceType: fileType.cloudinaryResourceType,
            mimeType: fileType.mimeType,
            fileName: file.originalname || uploadedFile.publicId,
            fileExtension: fileType.extension,
            fileCategory: fileType.category,
            fileSize: file.size || file.buffer?.length || uploadedFile.bytes || 0
        },
        visibility: appointmentId ? "appointment" : "private"
    };

    const record = await createMedicalRecord(recordData);

    // Trigger extraction/OCR and RAG embedding pipeline for all uploaded documents (PDF, image, text)
    if (file.buffer) {
        try {
            const { extractTextFromDocumentBuffer } = await import("./documentExtraction.js");
            const { ingestDocument } = await import("./ai/documentQaService.js");
            const extracted = await extractTextFromDocumentBuffer({
                buffer: file.buffer,
                mimeType: fileType.mimeType || file.mimetype || "",
                fileName: file.originalname || "document"
            });
            if (extracted?.text?.trim()) {
                const isLowConfidence = extracted.isLowConfidence || (extracted.confidence < 50);
                const ocrStatus = isLowConfidence ? "LOW_CONFIDENCE" : "COMPLETED";

                await MedicalRecordModel.updateOne(
                    { _id: record._id },
                    {
                        $set: {
                            extractedText: extracted.text.trim(),
                            ocrConfidence: extracted.confidence,
                            ocrStatus
                        }
                    }
                );
                record.extractedText = extracted.text.trim();
                record.ocrConfidence = extracted.confidence;
                record.ocrStatus = ocrStatus;

                await ingestDocument({
                    patientId,
                    organizationId,
                    documentId: record._id,
                    documentType: record.recordType || "medical_record",
                    sourceId: String(record._id),
                    textContent: extracted.text.trim(),
                    ocrConfidence: extracted.confidence,
                    isLowConfidence
                });
            }
        } catch (ocrErr) {
            console.warn("[Upload Extraction/RAG Ingestion Notice]:", ocrErr.message);
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
    await authorizeMedicalRecordAccess(record, { id: userId, role: userRole });
    return record;
};

/**
 * Retrieves the authorized file stream/buffer for preview or download.
 * Ensures verified MIME types, safe filename, and handles legacy Cloudinary URLs.
 */
export const getMedicalRecordFileService = async (id, user, mode = "preview") => {
    const record = await getMedicalRecordById(id);
    if (!record) {
        throw new AppError(404, "Medical record not found");
    }

    await authorizeMedicalRecordAccess(record, user);

    const storedUrl = record.file?.url || "";
    let mimeType = record.file?.mimeType;
    let extension = record.file?.fileExtension;

    // Backward compatibility inference for legacy records
    if (!mimeType) {
        if (storedUrl.toLowerCase().includes(".pdf") || record.title?.toLowerCase().includes("pdf")) {
            mimeType = "application/pdf";
            extension = "pdf";
        } else if (storedUrl.toLowerCase().includes(".png")) {
            mimeType = "image/png";
            extension = "png";
        } else if (storedUrl.toLowerCase().includes(".webp")) {
            mimeType = "image/webp";
            extension = "webp";
        } else if (storedUrl.toLowerCase().includes(".jpg") || storedUrl.toLowerCase().includes(".jpeg")) {
            mimeType = "image/jpeg";
            extension = "jpg";
        } else {
            const resolved = resolveMedicalFileType({
                mimetype: record.file?.mimeType,
                originalname: record.file?.fileName || record.title
            });
            mimeType = resolved.isValid ? resolved.mimeType : "application/octet-stream";
            extension = resolved.extension || "bin";
        }
    }

    const safeFileName = sanitizeFileName(
        record.file?.fileName || `${record.title || "medical_record"}.${extension || "pdf"}`,
        extension || "pdf"
    );

    const publicId = record.file?.publicId;
    const storedResourceType = record.file?.resourceType || (mimeType === "application/pdf" ? "raw" : "image");

    let buffer = null;

    // Strategy 1: Retrieve through authenticated Cloudinary signed download URL using SDK
    if (publicId) {
        const candidateResourceTypes = [
            storedResourceType,
            storedResourceType === "image" ? "raw" : "image"
        ];

        for (const rType of candidateResourceTypes) {
            try {
                const format = (rType === "image" && (mimeType === "application/pdf" || extension === "pdf"))
                    ? "pdf"
                    : (rType === "image" ? (extension || "") : "");

                const signedDownloadUrl = cloudinary.utils.private_download_url(publicId, format, {
                    resource_type: rType,
                    type: "upload"
                });

                const cloudRes = await fetch(signedDownloadUrl);
                if (cloudRes.ok) {
                    const candidateBuf = Buffer.from(await cloudRes.arrayBuffer());
                    if (candidateBuf.length > 0) {
                        const prefix = candidateBuf.subarray(0, 15).toString("ascii").toLowerCase();
                        if (!prefix.includes("<!doc") && !prefix.includes("<html")) {
                            buffer = candidateBuf;
                            break;
                        }
                    }
                }
            } catch (cloudErr) {
                // Try next resource type candidate
            }
        }
    }

    // Strategy 2: Direct URL fetch (handles raw Cloudinary public URLs, custom hosting, or external seeds)
    if (!buffer && storedUrl) {
        try {
            const directRes = await fetch(storedUrl);
            if (directRes.ok) {
                const candidateBuf = Buffer.from(await directRes.arrayBuffer());
                if (candidateBuf.length > 0) {
                    const prefix = candidateBuf.subarray(0, 15).toString("ascii").toLowerCase();
                    if (!prefix.includes("<!doc") && !prefix.includes("<html")) {
                        buffer = candidateBuf;
                    }
                }
            }
        } catch (directErr) {
            console.error(`[MedicalRecord Direct Fetch Error] ${storedUrl}:`, directErr.message);
        }
    }

    if (!buffer || buffer.length === 0) {
        throw new AppError(502, "Failed to retrieve document file from storage provider");
    }

    // Binary verification: Never stream Cloudinary HTML error pages as application/pdf or image
    const prefix = buffer.subarray(0, 15).toString("ascii").toLowerCase();
    if (prefix.includes("<!doc") || prefix.includes("<html")) {
        throw new AppError(502, "Storage provider returned an error page instead of binary content");
    }

    if (mimeType === "application/pdf") {
        const magic = buffer.subarray(0, 4).toString("ascii");
        if (magic !== "%PDF") {
            throw new AppError(502, "Document file is corrupted or not a valid PDF document");
        }
    }

    return {
        buffer,
        mimeType,
        fileName: safeFileName,
        fileSize: buffer.length
    };
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
        (s) => s.doctorId._id.toString() === doctorId.toString()
    );

    if (isAlreadyShared) {
        return record;
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
            throw new AppError(403, "You are not allowed to view records for this appointment");
        }
    } else if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor || appointment.doctorId._id.toString() !== doctor._id.toString()) {
            throw new AppError(403, "You are not allowed to view records for this appointment");
        }
    } else {
        throw new AppError(403, "You are not allowed to view records for this appointment");
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
            await deleteFromCloudinary(record.file.publicId, {
                resourceType: record.file.resourceType === "raw" ? "raw" : "image"
            });
        } catch (error) {
            console.error("Cloudinary file deletion failed:", error.message);
        }
    }

    return await deleteMedicalRecordById(id);
};
