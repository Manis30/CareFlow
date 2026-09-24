import { createWorker } from "tesseract.js";
import DocumentChunkModel from "../../model/documentChunk.js";
import { generateStructuredContent } from "./geminiClient.js";
import { AppError } from "../../middleware/errorHandler.js";
import { checkGroundingGuardrail } from "./groundingGuardrail.js";
import { generateEmbeddingVector, EMBEDDING_CONFIG } from "./embeddingService.js";

/**
 * Perform OCR text extraction on image buffer/path using Tesseract.js.
 * Evaluates OCR confidence. Chunks with < 50% confidence marked isLowConfidence: true.
 */
export const extractTextFromImage = async (imageBufferOrPath) => {
    let worker = null;
    try {
        worker = await createWorker('eng');
        const ret = await worker.recognize(imageBufferOrPath);
        await worker.terminate();

        const confidence = ret.data?.confidence || 0;
        const text = ret.data?.text || '';

        return {
            text: text.trim(),
            confidence,
            isLowConfidence: confidence < 50
        };
    } catch (err) {
        if (worker) {
            try { await worker.terminate(); } catch (e) {}
        }
        console.error("[Tesseract OCR Error]:", err.message);
        return {
            text: '',
            confidence: 0,
            isLowConfidence: true
        };
    }
};

/**
 * Generate embedding vector using gemini-embedding-2 (768 dimensions).
 */
export const generateEmbedding = async (text) => {
    return generateEmbeddingVector(text);
};

/**
 * Chunk text into ~500 token segments and store in documentChunk collection with strict 768-dim validation.
 */
export const ingestDocument = async ({
    patientId,
    organizationId,
    documentId = null,
    documentType = "medical_record",
    sourceId = null,
    textContent,
    ocrConfidence = 100,
    isLowConfidence = false
}) => {
    if (!textContent || !textContent.trim()) {
        throw new AppError(400, "Text content is required for document ingestion");
    }

    if (!patientId || !organizationId) {
        throw new AppError(400, "patientId and organizationId are required for document ingestion");
    }

    // Split into ~500 word / token chunks
    const words = textContent.trim().split(/\s+/);
    const chunkSize = 500;
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize) {
        const chunkText = words.slice(i, i + chunkSize).join(' ');
        if (chunkText.trim()) {
            chunks.push(chunkText.trim());
        }
    }

    // Duplicate Ingestion Handling:
    // If this document was previously ingested, clean up older chunks to ensure idempotency and traceability
    const docIdentifier = documentId || (sourceId && String(sourceId).match(/^[0-9a-fA-F]{24}$/) ? sourceId : null);
    if (docIdentifier) {
        await DocumentChunkModel.deleteMany({
            $or: [
                { documentId: docIdentifier },
                { sourceId: String(docIdentifier) }
            ]
        });
    }

    const createdChunks = [];
    for (let index = 0; index < chunks.length; index++) {
        const chunkText = chunks[index];
        const embedding = await generateEmbeddingVector(chunkText);

        // Strict pre-save validation: Must be array of exactly 768 dimensions
        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_CONFIG.outputDimensionality) {
            throw new Error(`Embedding validation failed: expected ${EMBEDDING_CONFIG.outputDimensionality} dimensions, got ${embedding ? embedding.length : 'none'}. Chunk will not be saved.`);
        }

        const chunk = await DocumentChunkModel.create({
            patientId,
            organizationId,
            documentId: documentId || (sourceId && String(sourceId).match(/^[0-9a-fA-F]{24}$/) ? sourceId : undefined),
            documentType,
            sourceId: sourceId || (documentId ? String(documentId) : null),
            chunkIndex: index,
            text: chunkText,
            textContent: chunkText,
            embedding,
            ocrConfidence,
            isLowConfidence: isLowConfidence || ocrConfidence < 50
        });
        createdChunks.push(chunk);
    }

    return createdChunks;
};

import { getPatientByUserId } from "../../repository/patient.js";
import { getDoctorByUserId } from "../../repository/doctor.js";
import { getAppointmentById } from "../../repository/appointment.js";
import AppointmentModel from "../../model/appointment.js";
import MedicalRecordModel from "../../model/medicalRecord.js";

/**
 * Single Source of Truth for Doctor Medical Record Authorization.
 * A doctor can access records explicitly shared with current doctor
 * OR records associated with an appointment belonging to current doctor.
 * Strict organization isolation enforced.
 */
export const getDoctorAuthorizedMedicalRecords = async (params = {}) => {
    const user = params.user;
    const doctorUserId = params.doctorUserId || user?.id || user?._id;
    if (!doctorUserId) {
        throw new AppError(400, "Doctor user identity is required for medical record authorization.");
    }
    const doctor = await getDoctorByUserId(doctorUserId);
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }

    const orgId = doctor.organizationId?._id || doctor.organizationId || params.organizationId || user?.organizationId?._id || user?.organizationId;
    if (!orgId) {
        throw new AppError(403, "Doctor account is not associated with an organization");
    }

    let targetPatientId = params.patientId || null;
    const appointmentId = params.appointmentId || null;
    if (appointmentId) {
        const appointment = await getAppointmentById(appointmentId);
        if (!appointment) {
            throw new AppError(404, "Appointment not found");
        }
        const apptDocId = String(appointment.doctorId?._id || appointment.doctorId);
        if (apptDocId !== String(doctor._id)) {
            throw new AppError(403, "Doctor is not assigned to this appointment");
        }
        const apptOrgId = String(appointment.organizationId?._id || appointment.organizationId);
        if (apptOrgId !== String(orgId)) {
            throw new AppError(403, "Cross-tenant access forbidden");
        }
        targetPatientId = appointment.patientId?._id || appointment.patientId;

        // Appointments belonging to this doctor with this patient
        const doctorAppts = await AppointmentModel.find({
            doctorId: doctor._id,
            organizationId: orgId
        }, "_id").lean();
        const doctorApptIds = doctorAppts.map(a => a._id);

        const records = await MedicalRecordModel.find({
            organizationId: orgId,
            patientId: targetPatientId,
            $or: [
                { "sharedWith.doctorId": doctor._id },
                { appointmentId: { $in: doctorApptIds } }
            ]
        }).lean();

        return {
            doctor,
            organizationId: orgId,
            patientId: targetPatientId,
            records,
            recordIds: records.map(r => r._id)
        };
    }

    if (targetPatientId) {
        const doctorAppts = await AppointmentModel.find({
            doctorId: doctor._id,
            patientId: targetPatientId,
            organizationId: orgId
        }, "_id").lean();
        const doctorApptIds = doctorAppts.map(a => a._id);

        const sharedRecordsCount = await MedicalRecordModel.countDocuments({
            patientId: targetPatientId,
            organizationId: orgId,
            "sharedWith.doctorId": doctor._id
        });

        if (doctorAppts.length === 0 && sharedRecordsCount === 0) {
            throw new AppError(403, "Doctor is not authorized to access documents for this patient");
        }

        const records = await MedicalRecordModel.find({
            organizationId: orgId,
            patientId: targetPatientId,
            $or: [
                { "sharedWith.doctorId": doctor._id },
                { appointmentId: { $in: doctorApptIds } }
            ]
        }).lean();

        return {
            doctor,
            organizationId: orgId,
            patientId: targetPatientId,
            records,
            recordIds: records.map(r => r._id)
        };
    }

    // All records authorized for this doctor in this organization
    const doctorAppts = await AppointmentModel.find({
        doctorId: doctor._id,
        organizationId: orgId
    }, "_id").lean();
    const doctorApptIds = doctorAppts.map(a => a._id);

    const records = await MedicalRecordModel.find({
        organizationId: orgId,
        $or: [
            { "sharedWith.doctorId": doctor._id },
            { appointmentId: { $in: doctorApptIds } }
        ]
    }).lean();

    return {
        doctor,
        organizationId: orgId,
        patientId: null,
        records,
        recordIds: records.map(r => r._id)
    };
};

/**
 * Vector Search & Document QA scoped strictly to authorized documents and organization.
 * Executes MongoDB Atlas $vectorSearch aggregation with deterministic keyword/text fallback.
 * Guaranteed: Unshared or cross-tenant documents NEVER reach the LLM.
 */
export const searchPatientDocuments = async ({ user, query, patientId: explicitPatientId, appointmentId, limit = 5 }) => {
    if (!user) {
        throw new AppError(401, "Authentication required");
    }
    if (!query) {
        throw new AppError(400, "Search query is required");
    }

    const role = user.role || "patient";
    let organizationId = user.organizationId?._id || user.organizationId || null;
    let targetPatientId = null;
    let authorizedRecords = [];

    if (role === "doctor") {
        const authResult = await getDoctorAuthorizedMedicalRecords({
            doctorUserId: user.id || user._id,
            organizationId,
            patientId: explicitPatientId || null,
            appointmentId: appointmentId || null
        });
        organizationId = authResult.organizationId;
        targetPatientId = authResult.patientId;
        authorizedRecords = authResult.records;
    } else if (role === "patient") {
        const patientDoc = await getPatientByUserId(user.id || user._id);
        targetPatientId = patientDoc?._id || user.patientId || user._id || user.id;
        organizationId = organizationId || patientDoc?.organizationId?._id || patientDoc?.organizationId;

        const recordFilter = { patientId: targetPatientId };
        if (organizationId) recordFilter.organizationId = organizationId;
        authorizedRecords = await MedicalRecordModel.find(recordFilter).lean();
    } else if (role === "organization_admin" || role === "admin") {
        if (!organizationId) {
            throw new AppError(403, "Organization Admin account missing organization scope");
        }
        const recordFilter = { organizationId };
        if (explicitPatientId) {
            recordFilter.patientId = explicitPatientId;
            targetPatientId = explicitPatientId;
        }
        authorizedRecords = await MedicalRecordModel.find(recordFilter).lean();
    } else if (role === "super_admin") {
        const recordFilter = {};
        if (organizationId) recordFilter.organizationId = organizationId;
        if (explicitPatientId) {
            recordFilter.patientId = explicitPatientId;
            targetPatientId = explicitPatientId;
        }
        authorizedRecords = await MedicalRecordModel.find(recordFilter).lean();
    } else {
        throw new AppError(403, "Unauthorized role for medical document search");
    }

    const authorizedRecordIds = authorizedRecords.map(r => r._id);

    // CRITICAL: If no authorized records exist, halt immediately before querying document chunks!
    if (authorizedRecordIds.length === 0) {
        return {
            query,
            chunks: [],
            citations: [],
            answer: "I couldn't find that information in the records available to you.",
            hasLowConfidenceWarning: false,
            responseType: "GROUNDED_RECORD"
        };
    }

    const queryEmbedding = await generateEmbedding(query);
    let matchedChunks = [];
    let containsLowConfidence = false;

    // 1. Attempt Atlas Vector Search with strict authorization filter
    if (Array.isArray(queryEmbedding) && queryEmbedding.length === 768) {
        try {
            const vectorFilter = {
                organizationId: { $eq: organizationId },
                documentId: { $in: authorizedRecordIds }
            };
            if (targetPatientId) {
                vectorFilter.patientId = { $eq: targetPatientId };
            }

            matchedChunks = await DocumentChunkModel.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: queryEmbedding,
                        numCandidates: 50,
                        limit: limit,
                        filter: vectorFilter
                    }
                }
            ]);
        } catch (atlasErr) {
            matchedChunks = [];
        }
    }

    // 2. Deterministic Keyword / Text Fallback Search on DocumentChunkModel
    if (!matchedChunks || matchedChunks.length === 0) {
        const chunkFilter = {
            organizationId,
            $or: [
                { documentId: { $in: authorizedRecordIds } },
                { sourceId: { $in: authorizedRecordIds.map(String) } }
            ]
        };
        if (targetPatientId) {
            chunkFilter.patientId = targetPatientId;
        }

        const terms = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 3 && !['the', 'and', 'for', 'are', 'what', 'show', 'tell', 'about', 'from', 'this', 'with'].includes(w));

        if (terms.length > 0) {
            const regexList = terms.map(t => new RegExp(t, 'i'));
            const keywordChunks = await DocumentChunkModel.find({
                ...chunkFilter,
                $or: regexList.map(rx => ({ textContent: rx }))
            }).limit(limit).lean();

            matchedChunks = keywordChunks;
        }

        if (!matchedChunks || matchedChunks.length === 0) {
            matchedChunks = [];
        }
    }

    // 3. Grounding: If chunks matched, use them; otherwise, check if authorized MedicalRecords match search terms
    let contextText = "";
    if (matchedChunks && matchedChunks.length > 0) {
        containsLowConfidence = matchedChunks.some(c => c.isLowConfidence === true || (c.ocrConfidence && c.ocrConfidence < 50));
        contextText = matchedChunks.map((c, i) => `Document Chunk [${i + 1}]:\n${c.textContent}`).join('\n\n');
    } else {
        const queryLower = query.toLowerCase();
        const relevantRecords = authorizedRecords.filter(r => {
            const title = (r.title || "").toLowerCase();
            const desc = (r.description || "").toLowerCase();
            const type = (r.recordType || "").toLowerCase();
            return title.includes(queryLower) || desc.includes(queryLower) || type.includes(queryLower) ||
                queryLower.split(/\s+/).some(w => w.length >= 3 && (title.includes(w) || desc.includes(w)));
        });

        if (relevantRecords.length > 0) {
            contextText = relevantRecords.slice(0, 5).map((r, i) =>
                `Medical Record [${i + 1}]:\n• Title: ${r.title}\n• Type: ${r.recordType}\n• Description: ${r.description || 'No description'}\n• Date: ${r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'N/A'}`
            ).join('\n\n');
        }
    }

    if (!contextText) {
        return {
            query,
            chunks: [],
            citations: [],
            answer: "I couldn't find that information in the records available to you.",
            hasLowConfidenceWarning: false,
            responseType: "GROUNDED_RECORD"
        };
    }

    // Build citations cleanly without exposing Cloudinary secrets or internal storage URLs
    const recordMap = new Map(authorizedRecords.map(r => [String(r._id), r]));
    const citations = [];
    const seenCitations = new Set();

    if (matchedChunks && matchedChunks.length > 0) {
        for (const chunk of matchedChunks) {
            const docId = String(chunk.documentId || chunk.sourceId || "");
            const rec = recordMap.get(docId);
            if (rec && !seenCitations.has(String(rec._id))) {
                seenCitations.add(String(rec._id));
                citations.push({
                    recordId: String(rec._id),
                    title: rec.title || "Medical Document",
                    recordType: rec.recordType || chunk.documentType || "document",
                    date: rec.createdAt ? new Date(rec.createdAt).toISOString().split('T')[0] : null
                });
            }
        }
    }

    if (citations.length === 0) {
        for (const rec of authorizedRecords.slice(0, 3)) {
            citations.push({
                recordId: String(rec._id),
                title: rec.title || "Medical Record",
                recordType: rec.recordType || "record",
                date: rec.createdAt ? new Date(rec.createdAt).toISOString().split('T')[0] : null
            });
        }
    }

    let synthesizedAnswer = "";
    try {
        const aiRes = await generateStructuredContent({
            systemInstruction: "You are CareFlow AI Clinical Assistant. Answer the user question based strictly and truthfully ONLY on the provided authorized medical record context. If the information is not documented in the provided context, state clearly: 'I couldn't find that information in the records available to you.' Never invent or infer medical facts, diagnoses, medications, dosages, or lab values.",
            prompt: `User Question: "${query}"\n\nAuthorized Medical Record Context:\n${contextText}`
        });
        synthesizedAnswer = aiRes.response || (typeof aiRes === "string" ? aiRes : JSON.stringify(aiRes));

        // Grounding Guardrail Check
        const grounding = checkGroundingGuardrail(synthesizedAnswer, contextText);
        if (!grounding.isGrounded) {
            synthesizedAnswer = grounding.fallbackText;
        }
    } catch (err) {
        synthesizedAnswer = `Retrieved matching medical record information:\n${contextText.substring(0, 350)}...`;
    }

    let warningBanner = "";
    if (containsLowConfidence) {
        warningBanner = "\n\n⚠️ Note: The source document image had low image clarity/OCR confidence. Please verify with your doctor or physical prescription document before relying on this information.";
    }

    return {
        query,
        chunks: matchedChunks,
        citations,
        answer: `${synthesizedAnswer}${warningBanner}`,
        hasLowConfidenceWarning: containsLowConfidence,
        responseType: "GROUNDED_RECORD"
    };
};
