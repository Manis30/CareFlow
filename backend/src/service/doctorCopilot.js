import mongoose from "mongoose";
import DoctorModel from "../model/doctor.js";
import PatientModel from "../model/patient.js";
import AppointmentModel from "../model/appointment.js";
import PrescriptionModel from "../model/prescription.js";
import MedicalRecordModel from "../model/medicalRecord.js";
import FollowUpTaskModel from "../model/followUpTask.js";
import { AppError } from "../middleware/errorHandler.js";
import { checkPrescriptionSafety } from "./medication.js";
import { getDoctorAuthorizedMedicalRecords, searchPatientDocuments } from "./ai/documentQaService.js";
import { parseOrdinalIndex } from "./ai/entityResolver.js";

/**
 * CareFlow AI — Phase 4: Doctor Clinical Copilot Service
 * 
 * Invariants & Policies:
 * 1. Strict Doctor Authorization Gate: First gate on all clinical endpoints.
 *    Doctor must belong to organization AND have an appointment or shared record with patient.
 * 2. Zero Direct DB Access by LLM: All clinical data retrieved via trusted service layer.
 * 3. Anti-Hallucination: Zero fabricated vitals, diagnoses, or lab values.
 * 4. DRAFT-Only Prescriptions & SOAP Notes: Explicitly labeled as AI draft requiring clinician signature.
 * 5. Prompt Injection Defense: OCR & patient records treated strictly as untrusted DATA.
 */

/**
 * Sanitize clinical text from documents, OCR, or notes to neutralize prompt injection tokens.
 * Wraps content in safe data boundary delimiters.
 */
export const sanitizeClinicalInput = (text) => {
    if (!text || typeof text !== "string") return "";
    
    // Neutralize common prompt injection patterns
    const sanitized = text
        .replace(/ignore\s+(?:all\s+)?previous\s+instructions/gi, "[SANATIZED_PROMPT_INJECTION]")
        .replace(/system\s+prompt\s*(?:override|bypass|injection)?/gi, "[SANATIZED_SYSTEM_PROMPT]")
        .replace(/you\s+are\s+now\s+(?:an?\s+)?(?:unfiltered|admin|root|jailbreak)/gi, "[SANATIZED_ROLE_OVERRIDE]")
        .replace(/as\s+an\s+ai\s+language\s+model,\s+(?:ignore|disregard)/gi, "[SANATIZED_OVERRIDE]")
        .replace(/<\/?(?:script|system|instruction|admin)>/gi, "");

    return sanitized;
};

/**
 * Retrieve all patients authorized for a specific doctor within their organization.
 * Authorization criteria:
 * - Has at least one appointment with this doctor in this organization, OR
 * - Has at least one medical record shared with this doctor in this organization.
 */
export const getDoctorAuthorizedPatients = async (doctorUser, filter = {}) => {
    const doctorUserId = doctorUser?.id || doctorUser?._id;
    if (!doctorUserId) {
        throw new AppError(400, "Doctor user identity is required");
    }

    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }

    const orgId = doctor.organizationId?._id || doctor.organizationId || doctorUser.organizationId;
    if (!orgId) {
        throw new AppError(403, "Doctor is not associated with an organization");
    }

    // 1. Distinct patient IDs from appointments
    const apptPatientIds = await AppointmentModel.find({
        doctorId: doctor._id,
        organizationId: orgId
    }).distinct("patientId");

    // 2. Distinct patient IDs from shared medical records
    const sharedRecordPatientIds = await MedicalRecordModel.find({
        "sharedWith.doctorId": doctor._id,
        $or: [
            { organizationId: orgId },
            { organizationId: null },
            { organizationId: { $exists: false } }
        ]
    }).distinct("patientId");

    const allAuthorizedPatientIds = Array.from(new Set([
        ...apptPatientIds.map(String),
        ...sharedRecordPatientIds.map(String)
    ])).filter(id => mongoose.Types.ObjectId.isValid(id));

    if (allAuthorizedPatientIds.length === 0) {
        return {
            doctorId: String(doctor._id),
            organizationId: String(orgId),
            patients: [],
            totalCount: 0
        };
    }

    const patientQuery = {
        _id: { $in: allAuthorizedPatientIds }
    };

    const patients = await PatientModel.find(patientQuery)
        .populate("userId", "name email phone")
        .lean();

    let matchedPatients = patients.map(p => ({
        patientId: String(p._id),
        name: p.userId?.name || "Patient",
        email: p.userId?.email || null,
        phone: p.userId?.phone || null,
        gender: p.gender || "Not specified",
        dateOfBirth: p.dateOfBirth || null,
        bloodGroup: p.bloodGroup || null,
        allergies: Array.isArray(p.allergies) ? p.allergies : []
    }));

    if (filter.name || filter.query) {
        const q = String(filter.name || filter.query).toLowerCase().trim();
        matchedPatients = matchedPatients.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.email && p.email.toLowerCase().includes(q)) ||
            (p.phone && p.phone.includes(q))
        );
    }

    let message = "";
    if (matchedPatients.length === 0) {
        message = "You currently do not have any authorized patients with scheduled appointments or shared records in your organization.";
    } else if (matchedPatients.length === 1) {
        message = `I found one patient available to you: ${matchedPatients[0].name}.\n\nWould you like me to review their records?`;
    } else {
        const items = matchedPatients.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
        message = `I can help with that. Here are the patients you currently have access to:\n\n${items}\n\nWhich patient would you like to review?`;
    }

    return {
        success: true,
        doctorId: String(doctor._id),
        organizationId: String(orgId),
        patients: matchedPatients,
        totalCount: matchedPatients.length,
        message,
        response: message,
        agentState: {
            stage: "SELECT_PATIENT",
            authorizedPatients: matchedPatients.map((p, idx) => ({
                patientId: String(p.patientId || p._id),
                name: p.name,
                displayName: p.name,
                index: idx + 1
            }))
        }
    };
};

/**
 * CareFlow AI — Doctor Patient Selection Resolver
 * Resolves doctor's input ("Rajasekaran", "1", "first one", "second one", etc.)
 * against agentState.authorizedPatients.
 * Never exposes MongoDB IDs to the doctor.
 * Disambiguates duplicate patient names without guessing.
 */
export const resolveDoctorPatientSelection = async (doctorUser, { selection, prompt, agentState = {} } = {}) => {
    const authorized = Array.isArray(agentState?.authorizedPatients) ? agentState.authorizedPatients : [];
    if (authorized.length === 0) {
        return { handled: false };
    }

    const doctorUserId = doctorUser?.id || doctorUser?._id;
    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) return { handled: false };
    const orgId = doctor.organizationId?._id || doctor.organizationId;

    const selText = String(selection || prompt || "").trim();
    const selLower = selText.toLowerCase();

    let resolvedPatient = null;

    // 1. Check numeric / ordinal selection ("1", "2", "first one", "second one", "#1", etc.)
    const ordIdx = parseOrdinalIndex(selText);
    if (ordIdx !== null && ordIdx >= 0 && ordIdx < authorized.length) {
        resolvedPatient = authorized[ordIdx];
    } else {
        const numMatch = selLower.match(/^(?:patient|number|#)?\s*(\d+)$/i);
        if (numMatch) {
            const parsed = parseInt(numMatch[1], 10) - 1;
            if (parsed >= 0 && parsed < authorized.length) {
                resolvedPatient = authorized[parsed];
            }
        }
    }

    // 2. Check name matching against authorized list if not resolved by index
    if (!resolvedPatient) {
        const cleanName = selLower
            .replace(/^(?:please\s+)?(?:select|choose|show|review|open|check|view|about|look\s+at|chart\s+for|records?\s+for|patient)?\s+/i, "")
            .replace(/[?.!]+$/, "")
            .trim();

        const matches = authorized.filter(p => {
            const pName = (p.name || p.displayName || "").toLowerCase();
            return pName === cleanName || pName.includes(cleanName) || cleanName.includes(pName);
        });

        if (matches.length === 1) {
            resolvedPatient = matches[0];
        } else if (matches.length > 1) {
            // Ambiguous names (Section 5): Disambiguate with human-readable attributes
            const patientIds = matches.map(m => m.patientId);
            const appts = await AppointmentModel.find({
                doctorId: doctor._id,
                organizationId: orgId,
                patientId: { $in: patientIds }
            }).sort({ appointmentDate: -1 }).lean();

            const apptMap = new Map();
            for (const a of appts) {
                const pid = String(a.patientId);
                if (!apptMap.has(pid)) {
                    const dStr = a.appointmentDate ? new Date(a.appointmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "recent";
                    apptMap.set(pid, dStr);
                }
            }

            const choiceLines = matches.map((m, idx) => {
                const details = [];
                if (m.dateOfBirth) {
                    const dob = new Date(m.dateOfBirth);
                    const birthYear = dob.getFullYear();
                    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                    details.push(`b. ${birthYear}, age ${age}`);
                }
                const apptInfo = apptMap.get(String(m.patientId));
                if (apptInfo) details.push(`last visit: ${apptInfo}`);
                const detailStr = details.length > 0 ? ` (${details.join(" · ")})` : "";
                return `${idx + 1}. ${m.name}${detailStr}`;
            });

            const uniqueChoices = new Set(choiceLines.map(l => l.replace(/^\d+\.\s*/, '').trim()));
            let ambiguityMsg = `I found ${matches.length} patients matching "${cleanName || selText}":\n\n${choiceLines.join("\n")}\n\nWhich patient would you like to review? Please reply with a number (1-${matches.length}).`;
            if (uniqueChoices.size < matches.length) {
                ambiguityMsg = `I found ${matches.length} patients matching "${cleanName || selText}" with identical recorded attributes:\n\n${choiceLines.join("\n")}\n\nPlease provide another identifying detail (such as a visit date or contact detail) to select the correct patient.`;
            }

            return {
                handled: true,
                isAmbiguous: true,
                aiResponse: ambiguityMsg,
                responseType: "CLARIFICATION",
                agentState: {
                    ...agentState,
                    stage: "SELECT_PATIENT",
                    pendingGoal: agentState.pendingGoal || "SHARED_RECORDS",
                    authorizedPatients: matches
                }
            };
        }
    }

    if (!resolvedPatient) {
        return { handled: false };
    }

    // Resolve internal appointment context for the resolved patient
    const patientAppts = await AppointmentModel.find({
        doctorId: doctor._id,
        organizationId: orgId,
        patientId: resolvedPatient.patientId,
        status: { $nin: ["CANCELLED", "cancelled"] }
    }).sort({ appointmentDate: -1 }).lean();

    const activeApptId = patientAppts.length > 0 ? String(patientAppts[0]._id) : null;

    const nextState = {
        ...agentState,
        stage: "PATIENT_SELECTED",
        patientId: String(resolvedPatient.patientId),
        patientName: resolvedPatient.name,
        activePatient: {
            patientId: String(resolvedPatient.patientId),
            name: resolvedPatient.name
        },
        appointmentId: activeApptId || agentState.appointmentId || null,
        authorizedPatients: authorized
    };

    // If the doctor asked for shared records or was in the middle of a record discovery flow:
    const wantsSharedRecords = /\b(shared\s+(?:medical\s+)?records?|records?|reports?|documents?)\b/i.test(selLower);
    const isJustSelection = /^\s*(?:\d+|first|second|third|fourth|fifth)\s*$/i.test(selLower) ||
        selLower.trim() === resolvedPatient.name.toLowerCase().trim();
    const hadPendingRecordRequest = agentState?.pendingGoal === "SHARED_RECORDS" ||
        agentState?.requestedAction === "records" ||
        agentState?.goal === "SHARED_RECORDS" ||
        /\b(records?|reports?|documents?|shared)\b/i.test(String(agentState?.originalPrompt || agentState?.rawPrompt || ""));

    if ((wantsSharedRecords && !isJustSelection) || (isJustSelection && hadPendingRecordRequest)) {
        const sharedRecordsResult = await getDoctorSharedMedicalRecords(doctorUser, {
            patientId: resolvedPatient.patientId,
            agentState: nextState
        });
        return {
            handled: true,
            resolvedPatient,
            aiResponse: sharedRecordsResult.response || sharedRecordsResult.message,
            toolUsed: "getSharedMedicalRecords",
            result: sharedRecordsResult,
            agentState: sharedRecordsResult.agentState || nextState
        };
    }

    const aiResponse = `I have selected ${resolvedPatient.name}. What would you like to do? You can ask to view their shared medical records, prepare a pre-visit brief, or check their appointment history.`;

    return {
        handled: true,
        resolvedPatient,
        aiResponse,
        toolUsed: "lookupDoctorPatient",
        result: {
            patientId: resolvedPatient.patientId,
            name: resolvedPatient.name,
            appointmentId: activeApptId
        },
        agentState: nextState
    };
};

/**
 * Resolve doctor-patient context with priority order:
 * 1. Active appointmentId
 * 2. patientId (if provided)
 * 3. Multi-turn context state (agentState.patientId / resolvedContext.patientId)
 * 4. Authorized patient lookup by name
 */
export const resolveDoctorPatientContext = async (doctorUser, params = {}) => {
    const doctorUserId = doctorUser?.id || doctorUser?._id;
    if (!doctorUserId) {
        throw new AppError(400, "Doctor identity required");
    }

    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }

    const orgId = doctor.organizationId?._id || doctor.organizationId;
    let targetPatientId = params.patientId || null;
    let appointment = null;

    // 1. If appointmentId is supplied:
    if (params.appointmentId) {
        appointment = await AppointmentModel.findById(params.appointmentId)
            .populate({ path: "patientId", populate: { path: "userId", select: "name email phone" } })
            .lean();

        if (!appointment) {
            throw new AppError(404, "Appointment not found");
        }
        if (String(appointment.doctorId?._id || appointment.doctorId) !== String(doctor._id)) {
            throw new AppError(403, "Doctor is not assigned to this appointment");
        }
        if (String(appointment.organizationId?._id || appointment.organizationId) !== String(orgId)) {
            throw new AppError(403, "Cross-tenant access forbidden");
        }
        targetPatientId = String(appointment.patientId?._id || appointment.patientId);
    }

    // 2. If targetPatientId is known or recovered from state
    if (!targetPatientId && (params.agentState?.patientId || params.resolvedContext?.patientId)) {
        const statePatientId = params.agentState?.patientId || params.resolvedContext?.patientId;
        const text = String(params.rawPrompt || params.prompt || params.query || "").toLowerCase();
        // Use state patient if pronoun is used or if no distinct new patient name is specified
        const hasPronoun = /\b(she|he|her|his|their|the\s+patient|this\s+patient)\b/i.test(text);
        const mentionsNewPatient = /\bpatient\s+([A-Za-z]+)/i.test(text) && !text.includes(String(params.agentState?.patientName || "").toLowerCase());

        if (hasPronoun || !mentionsNewPatient) {
            targetPatientId = statePatientId;
        }
    }

    // Fallback: If "this patient" or "the patient" is mentioned without state, and doctor has exactly 1 authorized patient
    if (!targetPatientId) {
        const text = String(params.rawPrompt || params.prompt || params.query || "").toLowerCase();
        if (/\b(this\s+patient|the\s+patient)\b/i.test(text)) {
            const authResult = await getDoctorAuthorizedPatients(doctorUser, {});
            if (authResult.patients?.length === 1) {
                targetPatientId = authResult.patients[0].patientId;
            }
        } else if (/\b(next\s+patient|next\s+appointment|upcoming\s+patient)\b/i.test(text)) {
            const now = new Date();
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);

            let nextAppt = await AppointmentModel.findOne({
                doctorId: doctor._id,
                organizationId: orgId,
                status: { $in: ["BOOKED", "booked", "confirmed", "CONFIRMED"] },
                appointmentDate: { $gte: startOfToday }
            }).sort({ appointmentDate: 1, startTime: 1 }).lean();

            if (!nextAppt) {
                nextAppt = await AppointmentModel.findOne({
                    doctorId: doctor._id,
                    organizationId: orgId,
                    status: { $in: ["BOOKED", "booked", "confirmed", "CONFIRMED", "COMPLETED", "completed"] }
                }).sort({ appointmentDate: -1 }).lean();
            }

            if (nextAppt?.patientId) {
                targetPatientId = String(nextAppt.patientId);
                appointment = nextAppt;
            }
        }
    }

    // 3. If targetPatientId is present, verify doctor authorization
    if (targetPatientId) {
        const hasAppt = await AppointmentModel.exists({
            doctorId: doctor._id,
            patientId: targetPatientId,
            organizationId: orgId
        });
        const hasShared = await MedicalRecordModel.exists({
            patientId: targetPatientId,
            "sharedWith.doctorId": doctor._id,
            $or: [
                { organizationId: orgId },
                { organizationId: null },
                { organizationId: { $exists: false } }
            ]
        });

        if (!hasAppt && !hasShared) {
            throw new AppError(403, "Doctor is not authorized to access records for this patient");
        }

        const patientDoc = await PatientModel.findById(targetPatientId)
            .populate("userId", "name email phone")
            .lean();

        if (!patientDoc) {
            throw new AppError(404, "Patient not found");
        }

        if (!appointment) {
            appointment = await AppointmentModel.findOne({
                doctorId: doctor._id,
                patientId: targetPatientId,
                organizationId: orgId
            }).sort({ appointmentDate: -1 }).lean();
        }

        return {
            patient: {
                patientId: String(patientDoc._id),
                name: patientDoc.userId?.name || "Patient",
                email: patientDoc.userId?.email || null,
                phone: patientDoc.userId?.phone || null,
                gender: patientDoc.gender || "Not specified",
                dateOfBirth: patientDoc.dateOfBirth || null,
                bloodGroup: patientDoc.bloodGroup || null,
                allergies: patientDoc.allergies || []
            },
            appointment,
            isAmbiguous: false,
            notFound: false
        };
    }

    // 4. Resolve patient by name across authorized patients
    let searchName = params.patientName || null;
    if (!searchName && (params.rawPrompt || params.prompt || params.query)) {
        const text = String(params.rawPrompt || params.prompt || params.query);
        const nameMatch = text.match(/(?:what\s+is|what\s+are|tell\s+me\s+about|give\s+me|summarize|show|view|get|list|find|about)\s+([A-Za-z.\s]+?)'s/i) ||
                          text.match(/([A-Za-z.\s]+?)'s\s+(?:(?:full|complete|past|latest|active|current|shared|recent)\s+)*(?:chart|records?|medical\s+records?|history|results|tests|prescriptions|medications?|medicines?|notes|consultation|vitals)/i) ||
                          text.match(/(?:patient|chart\s+(?:for|of)|records?\s+(?:for|of)|look\s*up\s+patient|about\s+patient)\s+([A-Za-z.\s]+?)(?:'s|\s+on|\s+at|\s+for|\s+records?|\s+reports?|\s+documents?|\s+history|\s+tomorrow|\s+today|\?|$)/i) ||
                          text.match(/(?:show|view|get|list|find)\s+([A-Za-z.\s]+?)'s\s+(?:records?|shared\s+records?|documents?|reports?)/i);
        if (nameMatch && nameMatch[1].trim().length > 1) {
            let candidate = nameMatch[1].trim();
            candidate = candidate.replace(/^(?:the\s+|my\s+|this\s+|that\s+)?patient(?:\s+|$)/i, '').trim();
            const generic = new Set(["my", "the", "a", "an", "all", "any", "this", "that", "shared", "medical", "patient", "patients", "the patient", "this patient", "record", "records", "report", "reports", "document", "documents", "information", "history"]);
            if (candidate.length > 1 && !generic.has(candidate.toLowerCase())) {
                searchName = candidate;
            }
        }
    }

    if (searchName) {
        const authResult = await getDoctorAuthorizedPatients(doctorUser, { name: searchName });
        const matches = authResult.patients;

        if (matches.length === 0) {
            return {
                patient: null,
                appointment: null,
                isAmbiguous: false,
                notFound: true,
                message: `Patient not found in your authorized clinic records.`
            };
        }

        if (matches.length > 1) {
            const patientIds = matches.map(m => m.patientId);
            const appts = await AppointmentModel.find({
                doctorId: doctor._id,
                organizationId: orgId,
                patientId: { $in: patientIds }
            }).sort({ appointmentDate: -1 }).lean();

            const apptMap = new Map();
            for (const a of appts) {
                const pid = String(a.patientId);
                if (!apptMap.has(pid)) {
                    const dStr = a.appointmentDate ? new Date(a.appointmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "recent";
                    apptMap.set(pid, dStr);
                }
            }

            const choiceLines = matches.map((p, i) => {
                const details = [];
                if (p.dateOfBirth) {
                    const dob = new Date(p.dateOfBirth);
                    const birthYear = dob.getFullYear();
                    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                    details.push(`b. ${birthYear}, age ${age}`);
                } else if (p.gender && p.gender !== "Not specified") {
                    details.push(p.gender);
                }
                const lastAppt = apptMap.get(String(p.patientId));
                if (lastAppt) details.push(`last visit: ${lastAppt}`);
                const detailStr = details.length > 0 ? ` (${details.join(" · ")})` : "";
                return `${i + 1}. ${p.name}${detailStr}`;
            });

            const uniqueChoices = new Set(choiceLines.map(l => l.replace(/^\d+\.\s*/, '').trim()));
            let clarQuestion = `I found ${matches.length} patients matching "${searchName}":\n\n${choiceLines.join("\n")}\n\nPlease select which patient to view by replying with their number.`;
            if (uniqueChoices.size < matches.length) {
                clarQuestion = `I found ${matches.length} patients matching "${searchName}" with identical recorded attributes:\n\n${choiceLines.join("\n")}\n\nPlease provide another identifying detail (such as a visit date or contact detail) to select the correct patient.`;
            }

            return {
                patient: null,
                appointment: null,
                isAmbiguous: true,
                notFound: false,
                matches,
                clarificationQuestion: clarQuestion
            };
        }

        // Exactly 1 match
        const singleMatch = matches[0];
        const patientDoc = await PatientModel.findById(singleMatch.patientId)
            .populate("userId", "name email phone")
            .lean();

        const latestAppt = await AppointmentModel.findOne({
            doctorId: doctor._id,
            patientId: singleMatch.patientId,
            organizationId: orgId
        }).sort({ appointmentDate: -1 }).lean();

        return {
            patient: singleMatch,
            appointment: latestAppt,
            isAmbiguous: false,
            notFound: false
        };
    }

    return {
        patient: null,
        appointment: null,
        isAmbiguous: false,
        notFound: true,
        message: "No patient specified or found in context."
    };
};

/**
 * Generate a comprehensive Pre-Visit Clinical Brief for an appointment.
 * Sections:
 * 1. Patient identity & demographics
 * 2. Chief complaint / reason for visit
 * 3. Recent consultations & past visits
 * 4. Relevant medical records & OCR documents
 * 5. Active & prior prescriptions
 * 6. Recorded allergies (or explicitly "No known allergies documented")
 * 7. Pending follow-up tasks from previous visits
 */
export const getPreVisitBrief = async (doctorUser, params = {}) => {
    const doctorUserId = doctorUser?.id || doctorUser?._id;
    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) throw new AppError(404, "Doctor profile not found");
    const orgId = doctor.organizationId?._id || doctor.organizationId;

    let appointment = null;
    let patientId = params.patientId || null;

    if (params.appointmentId) {
        appointment = await AppointmentModel.findById(params.appointmentId)
            .populate({ path: "patientId", populate: { path: "userId", select: "name email phone" } })
            .lean();
        if (!appointment) throw new AppError(404, "Appointment not found");
        if (String(appointment.doctorId?._id || appointment.doctorId) !== String(doctor._id)) {
            throw new AppError(403, "Doctor is not assigned to this appointment");
        }
        if (String(appointment.organizationId?._id || appointment.organizationId) !== String(orgId)) {
            throw new AppError(403, "Cross-tenant access forbidden");
        }
        patientId = String(appointment.patientId?._id || appointment.patientId);
    } else if (patientId) {
        // Find nearest or latest appointment with this doctor
        appointment = await AppointmentModel.findOne({
            doctorId: doctor._id,
            patientId,
            organizationId: orgId
        }).sort({ appointmentDate: -1 })
          .populate({ path: "patientId", populate: { path: "userId", select: "name email phone" } })
          .lean();
    }

    if (!patientId) {
        throw new AppError(400, "appointmentId or patientId is required for pre-visit brief");
    }

    // Verify Doctor Authorization
    const hasAppt = await AppointmentModel.exists({
        doctorId: doctor._id,
        patientId,
        organizationId: orgId
    });
    const hasShared = await MedicalRecordModel.exists({
        patientId,
        organizationId: orgId,
        "sharedWith.doctorId": doctor._id
    });
    if (!hasAppt && !hasShared) {
        throw new AppError(403, "Doctor is not authorized to access clinical brief for this patient");
    }

    const patient = await PatientModel.findById(patientId)
        .populate("userId", "name email phone")
        .lean();
    if (!patient) throw new AppError(404, "Patient record not found");

    const patientName = patient.userId?.name || "Patient";
    const chiefComplaint = appointment?.reasonForVisit || appointment?.reason || appointment?.triageInfo?.chiefComplaint || "General consultation";

    // 1. Past Consultations
    const pastAppointments = await AppointmentModel.find({
        patientId,
        organizationId: orgId,
        _id: appointment ? { $ne: appointment._id } : { $exists: true }
    }).sort({ appointmentDate: -1 }).limit(5).lean();

    // 2. Active Prescriptions
    const prescriptions = await PrescriptionModel.find({
        patientId,
        organizationId: orgId
    }).sort({ createdAt: -1 }).limit(5).lean();

    // 3. Authorized Medical Records
    const authRecordsResult = await getDoctorAuthorizedMedicalRecords({
        doctorUserId,
        patientId,
        organizationId: orgId
    });
    const medicalRecords = authRecordsResult.records || [];

    // 4. Pending Follow-up Tasks
    const followUps = await FollowUpTaskModel.find({
        patientId,
        organizationId: orgId,
        status: "PENDING"
    }).sort({ followUpDate: 1 }).limit(5).lean();

    // Demographics and Allergies
    const allergiesList = Array.isArray(patient.allergies) && patient.allergies.length > 0
        ? patient.allergies.join(", ")
        : "No known allergies documented";

    const age = patient.dateOfBirth
        ? `${Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} yrs`
        : "Not documented";

    // Construct Markdown Brief
    const lines = [
        `### Pre-Visit Clinical Brief: ${patientName}`,
        `**Demographics:** Age: ${age} | Gender: ${patient.gender || 'Not documented'} | Blood Group: ${patient.bloodGroup || 'Not documented'}`,
        `**Allergies:** ${allergiesList}`,
        `**Chief Complaint / Visit Reason:** ${chiefComplaint}`,
        "",
        `#### Recent Consultations (${pastAppointments.length}):`
    ];

    if (pastAppointments.length === 0) {
        lines.push("• No previous consultation history recorded in clinic.");
    } else {
        for (const appt of pastAppointments) {
            const dt = new Date(appt.appointmentDate).toISOString().split('T')[0];
            lines.push(`• ${dt}: ${appt.reason || appt.reasonForVisit || 'Consultation'} [Status: ${appt.status}]`);
        }
    }

    lines.push("", `#### Active & Recent Prescriptions (${prescriptions.length}):`);
    if (prescriptions.length === 0) {
        lines.push("• No active prescription records found.");
    } else {
        for (const p of prescriptions) {
            const medNames = (p.medicines || []).map(m => `${m.medicineName} (${m.dosage || 'standard dosage'})`).join(", ");
            lines.push(`• Diagnosis: ${p.diagnosis} | Medicines: ${medNames || 'None'}`);
        }
    }

    lines.push("", `#### Relevant Medical Records (${medicalRecords.length}):`);
    if (medicalRecords.length === 0) {
        lines.push("• No shared medical documents or lab reports on file.");
    } else {
        for (const r of medicalRecords.slice(0, 5)) {
            lines.push(`• ${r.title} (${r.recordType}): ${r.description || 'Uploaded record'}`);
        }
    }

    lines.push("", `#### Open Follow-Up Items (${followUps.length}):`);
    if (followUps.length === 0) {
        lines.push("• No pending follow-up care items.");
    } else {
        for (const f of followUps) {
            const fDate = new Date(f.followUpDate).toISOString().split('T')[0];
            lines.push(`• Due ${fDate}: ${f.reason} - ${f.instructions || ''}`);
        }
    }

    const summaryText = lines.join("\n");

    return {
        appointmentId: appointment ? String(appointment._id) : null,
        patientId: String(patient._id),
        patientName,
        chiefComplaint,
        allergies: allergiesList,
        pastConsultationCount: pastAppointments.length,
        prescriptionCount: prescriptions.length,
        recordCount: medicalRecords.length,
        pendingFollowUpCount: followUps.length,
        summaryText,
        responseType: "PRE_VISIT_BRIEF",
        brief: {
            patient: {
                id: String(patient._id),
                name: patientName,
                age,
                gender: patient.gender || null,
                bloodGroup: patient.bloodGroup || null,
                allergies: patient.allergies || []
            },
            chiefComplaint,
            pastAppointments,
            prescriptions,
            medicalRecords,
            followUps
        }
    };
};

/**
 * Generate a grounded Doctor Clinical Summary for a patient.
 * Distinct Sections:
 * - FACTS / RECORDED FINDINGS
 * - TIMELINE
 * - CURRENT MEDICATIONS
 * - OPEN FOLLOW-UP ITEMS
 * - UNKNOWN / NOT DOCUMENTED (explicitly states missing information)
 */
export const getDoctorClinicalSummary = async (doctorUser, params = {}) => {
    const doctorUserId = doctorUser?.id || doctorUser?._id;
    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) throw new AppError(404, "Doctor profile not found");
    const orgId = doctor.organizationId?._id || doctor.organizationId;

    let targetPatientId = params.patientId || params.agentState?.patientId || null;
    let targetPatientName = params.agentState?.patientName || null;
    if (params.appointmentId) {
        const appt = await AppointmentModel.findById(params.appointmentId).lean();
        if (appt) targetPatientId = String(appt.patientId?._id || appt.patientId);
    }

    if (!targetPatientId) {
        const resolved = await resolveDoctorPatientContext(doctorUser, {
            patientName: params.patientName,
            query: params.query || params.prompt || "",
            agentState: params.agentState
        });
        if (resolved?.patient?.patientId) {
            targetPatientId = resolved.patient.patientId;
            targetPatientName = resolved.patient.name;
        } else if (resolved?.isAmbiguous) {
            return {
                success: false,
                isAmbiguous: true,
                message: resolved.clarificationQuestion,
                response: resolved.clarificationQuestion,
                agentState: {
                    ...(params.agentState || {}),
                    stage: "SELECT_PATIENT",
                    authorizedPatients: resolved.matches
                }
            };
        } else if (resolved?.notFound) {
            return {
                success: false,
                notFound: true,
                message: resolved.message || "Patient not found in your authorized clinic records.",
                response: resolved.message || "Patient not found in your authorized clinic records.",
                agentState: params.agentState || {}
            };
        }
    }

    if (!targetPatientId) {
        throw new AppError(400, "patientId is required for clinical summary");
    }

    // Verify Doctor Authorization
    const hasAppt = await AppointmentModel.exists({
        doctorId: doctor._id,
        patientId: targetPatientId,
        organizationId: orgId
    });
    const hasShared = await MedicalRecordModel.exists({
        patientId: targetPatientId,
        "sharedWith.doctorId": doctor._id,
        $or: [
            { organizationId: orgId },
            { organizationId: null },
            { organizationId: { $exists: false } }
        ]
    });
    if (!hasAppt && !hasShared) {
        throw new AppError(403, "Doctor is not authorized to access clinical summary for this patient");
    }

    const patient = await PatientModel.findById(targetPatientId)
        .populate("userId", "name email phone")
        .lean();
    if (!patient) throw new AppError(404, "Patient not found");

    const appointments = await AppointmentModel.find({
        patientId: targetPatientId,
        organizationId: orgId
    }).sort({ appointmentDate: -1 }).lean();

    const prescriptions = await PrescriptionModel.find({
        patientId: targetPatientId,
        organizationId: orgId
    }).sort({ createdAt: -1 }).lean();

    const authRecords = await getDoctorAuthorizedMedicalRecords({
        doctorUserId,
        patientId: targetPatientId,
        organizationId: orgId
    });
    const records = authRecords.records || [];

    const followUps = await FollowUpTaskModel.find({
        patientId: targetPatientId,
        organizationId: orgId,
        status: "PENDING"
    }).sort({ followUpDate: 1 }).lean();

    // 1. Current Findings & Latest Consultation
    const latestAppt = appointments[0] || null;
    let latestConsultationText = "None on record";
    if (latestAppt) {
        const apptDateStr = new Date(latestAppt.appointmentDate).toISOString().split('T')[0];
        const apptReason = latestAppt.reason || latestAppt.reasonForVisit || 'General Consultation';
        const notes = latestAppt.doctorNotes || latestAppt.clinicalNotes || latestAppt.triageInfo?.chiefComplaint || 'None documented';
        latestConsultationText = `${apptDateStr} (${latestAppt.status}) — Reason: ${apptReason}. Clinical notes: ${notes}`;
    }

    const currentMedications = [];
    for (const p of prescriptions) {
        const rxDate = p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : 'N/A';
        for (const m of (p.medicines || [])) {
            const medDesc = `${m.medicineName} (${m.dosage || 'standard'}, ${m.frequency || 'as directed'})`;
            currentMedications.push(`[${rxDate} Prescription] ${medDesc}${m.instructions ? ` — Directions: ${m.instructions}` : ''}`);
        }
    }

    // 2. Documented Facts & Verified Diagnoses
    const facts = [];
    const diagnoses = Array.from(new Set(prescriptions.map(p => p.diagnosis).filter(Boolean)));
    if (diagnoses.length > 0) {
        facts.push(`Documented Diagnoses: ${diagnoses.join(", ")}`);
    } else {
        facts.push("Documented Diagnoses: None documented in available prescriptions");
    }
    if (Array.isArray(patient.allergies) && patient.allergies.length > 0) {
        facts.push(`Allergies: ${patient.allergies.join(", ")}`);
    } else {
        facts.push("Allergies: No known drug allergies documented");
    }
    if (patient.bloodGroup) {
        facts.push(`Blood Group: ${patient.bloodGroup}`);
    }

    // 3. Historical Consultations & Timeline
    const timeline = [];
    for (const appt of appointments) {
        const dateStr = new Date(appt.appointmentDate).toISOString().split('T')[0];
        timeline.push({
            date: appt.appointmentDate,
            citation: `[${dateStr} Consultation]`,
            event: `${appt.status.toUpperCase()} — ${appt.reason || appt.reasonForVisit || 'General'}`
        });
    }
    for (const p of prescriptions) {
        const dateStr = new Date(p.createdAt).toISOString().split('T')[0];
        timeline.push({
            date: p.createdAt,
            citation: `[${dateStr} Prescription]`,
            event: `Prescription issued for ${p.diagnosis}`
        });
    }
    for (const r of records) {
        const dateStr = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'N/A';
        timeline.push({
            date: r.createdAt || new Date(),
            citation: `[${dateStr} Medical Record: ${r.title}]`,
            event: `Record Type: ${r.recordType}`
        });
    }
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 4. Authorized Shared Medical Records
    const sharedRecords = records.map(r => {
        const dateStr = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'N/A';
        return `[${dateStr}] ${r.title} (${r.recordType})`;
    });

    // 5. Open Follow-up Items
    const openFollowUps = followUps.map(f =>
        `Due ${new Date(f.followUpDate).toISOString().split('T')[0]}: ${f.reason}`
    );

    // 6. Unknown / Missing Documentation Gaps (Strict Grounding)
    const unknownOrNotDocumented = [
        "In-clinic vitals (Blood pressure, pulse, temperature, respiratory rate) are not documented in available records; requires in-person measurement.",
        "Recent laboratory blood panels not explicitly attached in shared records."
    ];
    if (!patient.bloodGroup) {
        unknownOrNotDocumented.push("Blood group: Not documented in available records.");
    }

    const citations = [
        ...appointments.slice(0, 5).map(a => `Consultation (${new Date(a.appointmentDate).toISOString().split('T')[0]})`),
        ...prescriptions.map(p => `Prescription (${new Date(p.createdAt).toISOString().split('T')[0]})`),
        ...records.map(r => `Medical Record: ${r.title} (${r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'N/A'})`)
    ];

    const formattedSummary = [
        `CLINICAL SUMMARY: ${patient.userId?.name || 'Patient'}`,
        "",
        "1. LATEST CONSULTATION:",
        `• ${latestConsultationText}`,
        "",
        `2. ACTIVE MEDICATIONS (${currentMedications.length}):`,
        ...(currentMedications.length > 0 ? currentMedications.map(m => `• ${m}`) : ["• No active medications recorded"]),
        "",
        "3. DOCUMENTED CLINICAL FACTS:",
        ...facts.map(f => `• ${f}`),
        "",
        `4. HISTORICAL TIMELINE (${timeline.length} events):`,
        ...(timeline.length > 0 ? timeline.slice(0, 5).map(t => `• ${new Date(t.date).toISOString().split('T')[0]}: ${t.event}`) : ["• No timeline events recorded"]),
        "",
        `5. AUTHORIZED MEDICAL RECORDS (${sharedRecords.length}):`,
        ...(sharedRecords.length > 0 ? sharedRecords.map(r => `• ${r}`) : ["• No shared medical records available"]),
        "",
        "6. MISSING INFORMATION & CLINICAL GAPS:",
        ...unknownOrNotDocumented.map(u => `• ${u}`)
    ].join("\n");

    return {
        success: true,
        patientId: String(targetPatientId),
        patientName: patient.userId?.name || "Patient",
        latestConsultation: latestConsultationText,
        facts,
        timeline,
        currentMedications,
        sharedRecords,
        openFollowUps,
        unknownOrNotDocumented,
        citations: Array.from(new Set(citations)),
        formattedSummary,
        response: formattedSummary,
        responseType: "ANSWER"
    };
};

/**
 * Draft safe structured SOAP Clinical Notes (Subjective, Objective, Assessment, Plan).
 * 
 * Safety & Anti-Hallucination Guardrails:
 * - Objective findings: If vitals or physical exam findings are not provided, strictly outputs:
 *   "Not documented in available context; requires physical examination and vitals measurement by attending physician."
 *   Guaranteed zero fabricated vitals (e.g. no fake "BP 120/80").
 * - Output marked strictly as DRAFT requiring clinician review.
 * - Zero automatic persistence to database.
 */
/**
 * Resolve doctor consultation context for clinical notes according to canonical resolution order:
 * 1. Active appointment context (agentState.appointmentId or params.appointmentId)
 * 2. Active patient context (agentState.patientId or params.patientId)
 * 3. Today's appointments for this doctor
 * 4. Upcoming appointments
 * 5. Recent/authorized consultations
 */
export const resolveDoctorConsultationForNotes = async (doctorUser, params = {}, agentState = {}) => {
    const doctorUserId = doctorUser?.id || doctorUser?._id;
    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) throw new AppError(404, "Doctor profile not found");
    const orgId = doctor.organizationId?._id || doctor.organizationId;

    // 1. Active appointment context
    const apptId = params.appointmentId || agentState?.appointmentId;
    if (apptId) {
        const appt = await AppointmentModel.findById(apptId)
            .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
            .lean();
        if (appt && String(appt.doctorId?._id || appt.doctorId) === String(doctor._id)) {
            return { resolvedAppointment: appt };
        }
    }

    // 2. Active patient context
    const patientId = params.patientId || agentState?.patientId;
    if (patientId) {
        const patientAppts = await AppointmentModel.find({
            doctorId: doctor._id,
            patientId,
            status: { $nin: ["cancelled", "CANCELLED"] }
        })
        .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
        .sort({ appointmentDate: -1 })
        .lean();

        if (patientAppts.length === 1) {
            return { resolvedAppointment: patientAppts[0] };
        }
        if (patientAppts.length > 1) {
            return { candidateConsultations: patientAppts };
        }
    }

    // 3. Today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppts = await AppointmentModel.find({
        doctorId: doctor._id,
        appointmentDate: { $gte: today, $lt: tomorrow },
        status: { $nin: ["cancelled", "CANCELLED"] }
    })
    .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
    .sort({ startTime: 1 })
    .lean();

    if (todayAppts.length === 1) {
        return { resolvedAppointment: todayAppts[0] };
    }
    if (todayAppts.length > 1) {
        return { candidateConsultations: todayAppts };
    }

    // 4. Upcoming appointments
    const upcomingAppts = await AppointmentModel.find({
        doctorId: doctor._id,
        appointmentDate: { $gte: tomorrow },
        status: { $in: ["booked", "in_progress", "BOOKED", "IN_PROGRESS"] }
    })
    .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
    .sort({ appointmentDate: 1, startTime: 1 })
    .lean();

    if (upcomingAppts.length === 1) {
        return { resolvedAppointment: upcomingAppts[0] };
    }
    if (upcomingAppts.length > 1) {
        return { candidateConsultations: upcomingAppts };
    }

    // 5. Recent/authorized consultations
    const recentAppts = await AppointmentModel.find({
        doctorId: doctor._id,
        status: { $nin: ["cancelled", "CANCELLED"] }
    })
    .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
    .sort({ appointmentDate: -1, startTime: -1 })
    .limit(5)
    .lean();

    if (recentAppts.length === 1) {
        return { resolvedAppointment: recentAppts[0] };
    }
    if (recentAppts.length > 1) {
        return { candidateConsultations: recentAppts };
    }

    return { candidateConsultations: [] };
};

export const resolveDoctorConsultationSelection = async (doctorUser, { selection, prompt, agentState = {} } = {}) => {
    const consultations = Array.isArray(agentState?.consultations) ? agentState.consultations : [];
    if (consultations.length === 0) return { handled: false };

    const selText = String(selection || prompt || "").trim();
    const selLower = selText.toLowerCase();

    let picked = null;
    const ordIdx = parseOrdinalIndex(selText);
    if (ordIdx !== null && ordIdx >= 0 && ordIdx < consultations.length) {
        picked = consultations[ordIdx];
    } else {
        const numMatch = selLower.match(/^(?:consultation|number|#)?\s*(\d+)$/i);
        if (numMatch) {
            const parsed = parseInt(numMatch[1], 10) - 1;
            if (parsed >= 0 && parsed < consultations.length) {
                picked = consultations[parsed];
            }
        }
    }

    if (!picked) {
        const cleanName = selLower
            .replace(/^(?:please\s+)?(?:select|choose|draft|for|consultation\s+for|patient)?\s+/i, "")
            .replace(/[?.!]+$/, "")
            .trim();
        const matches = consultations.filter(c => {
            const pName = (c.patientName || "").toLowerCase();
            return pName === cleanName || pName.includes(cleanName) || cleanName.includes(pName);
        });
        if (matches.length === 1) {
            picked = matches[0];
        }
    }

    if (!picked) return { handled: false };

    const draftResult = await draftSoapClinicalNotes(doctorUser, {
        appointmentId: picked.appointmentId,
        patientId: picked.patientId,
        patientName: picked.patientName,
        agentState
    });

    const nextState = {
        ...agentState,
        stage: "DRAFTED_NOTES",
        appointmentId: picked.appointmentId,
        patientId: picked.patientId,
        patientName: picked.patientName
    };

    return {
        handled: true,
        aiResponse: draftResult.draftContent || draftResult.message,
        result: draftResult,
        agentState: nextState
    };
};

export const draftSoapClinicalNotes = async (doctorUser, params = {}) => {
    const doctorUserId = doctorUser?.id || doctorUser?._id;
    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) throw new AppError(404, "Doctor profile not found");
    const orgId = doctor.organizationId?._id || doctor.organizationId;

    let appointment = null;
    let patient = null;

    if (params.appointmentId) {
        appointment = await AppointmentModel.findById(params.appointmentId)
            .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
            .lean();
        if (appointment) {
            if (String(appointment.doctorId?._id || appointment.doctorId) !== String(doctor._id)) {
                throw new AppError(403, "Doctor is not assigned to this appointment");
            }
            patient = appointment.patientId;
        }
    } else {
        // Resolve consultation internally without asking doctor for raw MongoDB IDs
        const resolution = await resolveDoctorConsultationForNotes(doctorUser, params, params.agentState);
        if (resolution.resolvedAppointment) {
            appointment = resolution.resolvedAppointment;
            patient = appointment.patientId;
        } else if (Array.isArray(resolution.candidateConsultations) && resolution.candidateConsultations.length > 1) {
            const candidates = resolution.candidateConsultations;
            const items = candidates.map((c, idx) => {
                const patName = c.patientId?.userId?.name || c.patientId?.name || "Patient";
                const dStr = c.appointmentDate ? new Date(c.appointmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                const tStr = c.startTime || "";
                return `${idx + 1}. ${patName} — ${dStr}, ${tStr}`;
            }).join("\n");

            const choiceMsg = `I found these consultations:\n\n${items}\n\nWhich consultation would you like?`;
            return {
                handled: true,
                needsSelection: true,
                isDraft: false,
                responseType: "CLARIFICATION",
                aiResponse: choiceMsg,
                message: choiceMsg,
                agentState: {
                    ...(params.agentState || {}),
                    stage: "SELECT_CONSULTATION",
                    consultations: candidates.map((c, idx) => ({
                        index: idx + 1,
                        appointmentId: String(c._id),
                        patientId: String(c.patientId?._id || c.patientId),
                        patientName: c.patientId?.userId?.name || c.patientId?.name || "Patient",
                        dateStr: c.appointmentDate ? new Date(c.appointmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
                        timeStr: c.startTime || ""
                    }))
                }
            };
        } else if (params.patientId) {
            patient = await PatientModel.findById(params.patientId)
                .populate("userId", "name")
                .lean();
        } else {
            return {
                handled: true,
                isDraft: false,
                responseType: "CLARIFICATION",
                aiResponse: "You currently do not have any scheduled or recent consultations to draft clinical notes for.",
                message: "You currently do not have any scheduled or recent consultations to draft clinical notes for."
            };
        }
    }

    const patientName = patient?.userId?.name || params.patientName || "Patient";
    const symptoms = params.symptoms || appointment?.reasonForVisit || appointment?.reason || "Patient presented for scheduled clinical consultation.";
    
    // STRICT ANTI-FABRICATION OBJECTIVE GUARDRAIL:
    // If no explicit objective measurement was passed, do NOT invent vitals!
    const objective = params.findings || params.examination || params.vitals
        ? sanitizeClinicalInput(params.findings || params.examination || params.vitals)
        : "Not documented in available context; requires physical examination and vitals measurement by attending physician.";

    const assessment = params.diagnosis || params.assessment
        ? sanitizeClinicalInput(params.diagnosis || params.assessment)
        : `Preliminary clinical evaluation for presenting symptoms: ${symptoms}. Formal diagnosis pending physician evaluation.`;

    const plan = params.plan
        ? sanitizeClinicalInput(params.plan)
        : "Diagnostic workup and therapeutic management to be determined by attending physician based on physical examination.";

    const soapNote = {
        subjective: `Patient ${patientName} presents with: ${sanitizeClinicalInput(symptoms)}.`,
        objective: objective,
        assessment: assessment,
        plan: plan
    };

    const formattedDraft = [
        `SOAP CLINICAL NOTE DRAFT (Requires Physician Review & Verification):`,
        `• S (Subjective): ${soapNote.subjective}`,
        `• O (Objective): ${soapNote.objective}`,
        `• A (Assessment): ${soapNote.assessment}`,
        `• P (Plan): ${soapNote.plan}`
    ].join("\n");

    return {
        isDraft: true,
        approvalRequired: true,
        responseType: "DRAFT_REQUIRING_REVIEW",
        appointmentId: appointment ? String(appointment._id) : null,
        patientName,
        soapNote,
        draftContent: formattedDraft,
        disclaimer: "DRAFT ONLY: AI-generated SOAP notes must be reviewed, verified, and signed by the treating clinician before filing to the medical record. Do not treat as final."
    };
};

/**
 * Draft prescription assistance with safety checks (duplicate active medications & allergy conflicts).
 * 
 * Safety Guardrails:
 * - Runs checkPrescriptionSafety against patient's active prescriptions and recorded allergies.
 * - If duplicates or allergies detected, flags prominent safety warnings.
 * - Output marked strictly as DRAFT requiring clinician review.
 * - Zero automated dispensing or database mutation.
 */
export const draftPrescriptionAssistance = async (doctorUser, params = {}) => {
    const doctorUserId = doctorUser?.id || doctorUser?._id;
    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) throw new AppError(404, "Doctor profile not found");
    const orgId = doctor.organizationId?._id || doctor.organizationId;

    let targetPatientId = params.patientId || null;
    if (!targetPatientId && params.appointmentId) {
        const appt = await AppointmentModel.findById(params.appointmentId).lean();
        if (appt) targetPatientId = String(appt.patientId?._id || appt.patientId);
    }

    const diagnosis = params.diagnosis || "Pending clinical diagnosis by attending physician";
    let medicines = [];

    if (Array.isArray(params.medicines) && params.medicines.length > 0) {
        medicines = params.medicines.map(m => ({
            medicineName: sanitizeClinicalInput(m.medicineName || m.name),
            dosage: m.dosage || "As directed by physician",
            frequency: m.frequency || "Once daily",
            duration: m.duration || "5 days",
            instructions: m.instructions || "Take after meals"
        }));
    } else if (params.medicineName) {
        medicines = [{
            medicineName: sanitizeClinicalInput(params.medicineName),
            dosage: params.dosage || "As directed by physician",
            frequency: params.frequency || "Once daily",
            duration: params.duration || "5 days",
            instructions: params.instructions || "Take after meals"
        }];
    } else {
        medicines = [{
            medicineName: "Medication selection to be determined by attending physician",
            dosage: "To be determined",
            frequency: "To be determined",
            duration: "To be determined",
            instructions: "Requires physician evaluation"
        }];
    }

    const safetyAlerts = [];

    // Run safety checks if patientId is available
    if (targetPatientId) {
        try {
            const patientDoc = await PatientModel.findById(targetPatientId).lean();
            const patientAllergies = Array.isArray(patientDoc?.allergies)
                ? patientDoc.allergies.filter(Boolean)
                : [];

            // Fetch existing prescriptions for duplicate check
            const existingPrescriptions = await PrescriptionModel.find({
                patientId: targetPatientId
            }).lean();

            const existingMeds = [];
            for (const rx of existingPrescriptions) {
                for (const m of rx.medicines || []) {
                    if (m.medicineName) existingMeds.push(m.medicineName.toLowerCase().trim());
                }
            }

            // Also check MedicationScheduleModel if active
            try {
                const MedicationScheduleModel = (await import("../model/medicationSchedule.js")).default;
                const schedules = await MedicationScheduleModel.find({
                    patientId: targetPatientId,
                    status: { $in: ["ACTIVE", "DOCTOR_APPROVED"] }
                }).lean();
                for (const s of schedules) {
                    if (s.medicineName) existingMeds.push(s.medicineName.toLowerCase().trim());
                }
            } catch (schedErr) {
                // Ignore schedule lookup error if model inactive
            }

            for (const med of medicines) {
                const medNameLower = (med.medicineName || "").toLowerCase().trim();
                if (!medNameLower) continue;

                // 1. Check duplicate active medication
                const isDuplicate = existingMeds.some(existing =>
                    existing === medNameLower || existing.includes(medNameLower) || medNameLower.includes(existing)
                );
                if (isDuplicate) {
                    safetyAlerts.push({
                        type: "DUPLICATE_MEDICATION",
                        medicineName: med.medicineName,
                        message: `Duplicate active medication detected: ${med.medicineName} is already prescribed in an active prescription.`
                    });
                }

                // 2. Check allergy conflict against patient.allergies
                for (const rawAllergy of patientAllergies) {
                    const allergyLower = String(rawAllergy).toLowerCase().trim();
                    if (allergyLower && (medNameLower.includes(allergyLower) || allergyLower.includes(medNameLower))) {
                        safetyAlerts.push({
                            type: "ALLERGY_CONFLICT",
                            medicineName: med.medicineName,
                            conflictAllergy: rawAllergy,
                            message: `Allergy conflict detected: Patient has recorded allergy to ${rawAllergy}.`
                        });
                    }
                }
            }
        } catch (err) {
            console.warn("[DoctorCopilot] Safety check error:", err.message);
        }
    }

    return {
        isDraft: true,
        approvalRequired: true,
        responseType: "DRAFT_REQUIRING_REVIEW",
        diagnosis: sanitizeClinicalInput(diagnosis),
        medicines,
        safetyAlerts,
        hasSafetyWarnings: safetyAlerts.length > 0,
        disclaimer: "DRAFT ONLY: Prescriptions must be reviewed, verified, and signed by a licensed physician before issuance. No automated medication dispensing permitted."
    };
};

/**
 * CareFlow AI — Phase 5 Part A1-A2: Shared Medical Record Discovery
 * When doctor asks a broad query about shared records, retrieve authorized shared-record list
 * and format a numbered prompt without automatically selecting one.
 * Persists safe metadata list in agentState.sharedMedicalRecords and sets stage: "SELECT_SHARED_RECORD".
 */
export const getDoctorSharedMedicalRecords = async (doctorUser, params = {}) => {
    const doctorUserId = doctorUser?.id || doctorUser?._id;
    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
    if (!doctor) throw new AppError(404, "Doctor profile not found");
    const orgId = doctor.organizationId?._id || doctor.organizationId;

    let targetPatientId = params.patientId || params.agentState?.patientId || null;
    let targetPatientName = params.agentState?.patientName || null;
    if (!targetPatientId) {
        const resolved = await resolveDoctorPatientContext(doctorUser, {
            patientName: params.patientName,
            query: params.query || params.prompt || "",
            agentState: params.agentState
        });
        if (resolved?.patient?.patientId) {
            targetPatientId = resolved.patient.patientId;
            targetPatientName = resolved.patient.name;
        } else if (resolved?.isAmbiguous) {
            return {
                success: false,
                isAmbiguous: true,
                message: resolved.clarificationQuestion,
                response: resolved.clarificationQuestion,
                records: [],
                agentState: {
                    ...(params.agentState || {}),
                    stage: "SELECT_PATIENT",
                    authorizedPatients: resolved.matches
                }
            };
        } else if (resolved?.notFound && (params.patientName || params.query)) {
            return {
                success: false,
                notFound: true,
                message: resolved.message || "Patient not found in your authorized clinic records.",
                response: resolved.message || "Patient not found in your authorized clinic records.",
                records: [],
                agentState: params.agentState || {}
            };
        }
    }

    if (!targetPatientId) {
        return {
            success: false,
            notFound: true,
            message: "Please specify which patient's shared medical records you would like to view.",
            records: [],
            agentState: params.agentState || {}
        };
    }

    // Authorization: Doctor must belong to organization and be assigned or have shared records
    const auth = await getDoctorAuthorizedMedicalRecords({
        doctorUserId,
        organizationId: orgId,
        patientId: targetPatientId
    });

    const records = (auth.records || []).map(r => {
        const d = r.createdAt ? new Date(r.createdAt) : (r.date ? new Date(r.date) : new Date());
        const formattedDate = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        return {
            id: String(r._id),
            title: r.title || "Medical Record",
            date: formattedDate,
            documentType: r.recordType || "medical_record",
            description: r.description || ""
        };
    });

    if (records.length === 0) {
        const noRecMsg = targetPatientName
            ? `I couldn't find any shared medical records for ${targetPatientName} available to you.`
            : "I couldn't find any shared medical records for this patient available to you.";
        return {
            success: true,
            records: [],
            patientId: String(targetPatientId),
            message: noRecMsg,
            response: noRecMsg,
            agentState: {
                ...(params.agentState || {}),
                stage: "PATIENT_SELECTED",
                patientId: String(targetPatientId),
                ...(targetPatientName ? { patientName: targetPatientName } : {})
            }
        };
    }

    const numberedItems = records.map((r, i) => `${i + 1}. ${r.title} — ${r.date}`).join("\n");
    const promptResponse = `I found ${records.length} shared medical record${records.length > 1 ? "s" : ""}${targetPatientName ? ` for ${targetPatientName}` : ""}:\n\n${numberedItems}\n\nWhich one would you like me to review?\nYou can choose a number or say 'all'.`;

    return {
        success: true,
        patientId: String(targetPatientId),
        records,
        response: promptResponse,
        message: promptResponse,
        agentState: {
            ...(params.agentState || {}),
            stage: "SELECT_SHARED_RECORD",
            patientId: String(targetPatientId),
            ...(targetPatientName ? { patientName: targetPatientName } : {}),
            sharedMedicalRecords: records
        }
    };
};

/**
 * CareFlow AI — Phase 5 Part A3-A5: Conversational Selection of Shared Medical Records
 * Resolves doctor's input ("1", "first one", "record 2", "all", etc.) against agentState.sharedMedicalRecords.
 * Executes searchPatientDocuments scoped strictly to the selected record or all authorized records.
 */
export const resolveSharedRecordSelection = async (doctorUser, { selection, query, agentState = {} } = {}) => {
    let records = Array.isArray(agentState?.sharedMedicalRecords) 
        ? agentState.sharedMedicalRecords 
        : (Array.isArray(agentState?.sharedRecords) ? agentState.sharedRecords : []);

    if (records.length === 0 && agentState?.patientId) {
        try {
            const refetch = await getDoctorSharedMedicalRecords(doctorUser, {
                patientId: agentState.patientId,
                agentState
            });
            if (refetch?.records && refetch.records.length > 0) {
                records = refetch.records;
            }
        } catch (_) { }
    }

    if (records.length === 0) {
        return {
            handled: true,
            aiResponse: "The shared medical records for this patient are no longer accessible or have been updated. Please ask to show the patient's records again to refresh the list.",
            searchResult: { answer: "Records no longer accessible." },
            citations: [],
            agentState: {
                ...agentState,
                stage: "PATIENT_SELECTED"
            }
        };
    }

    const selText = String(selection || query || "").trim();
    const selLower = selText.toLowerCase();

    // Check "all", "all of them", "review all", "check everything"
    const isAll = /^(all|all of them|review all|check everything|all records|every record)$/i.test(selLower) ||
                  /\b(review all|check all|summarize all|search all)\b/i.test(selLower);

    if (isAll) {
        const searchQuery = query && !isAll ? query : "Summarize all shared medical records and clinical findings";
        const searchResult = await searchPatientDocuments({
            user: doctorUser,
            query: searchQuery,
            patientId: agentState.patientId,
            recordIds: records.map(r => r.id || r._id)
        });

        return {
            handled: true,
            isAll: true,
            selectedRecord: null,
            searchResult,
            aiResponse: searchResult.answer,
            citations: searchResult.citations || [],
            hasLowConfidenceWarning: searchResult.hasLowConfidenceWarning || false,
            agentState: {
                ...agentState,
                stage: "RECORD_SELECTED",
                selectedRecordId: "all"
            }
        };
    }

    // Check numeric / ordinal selection
    let targetIdx = -1;
    const ordIdx = parseOrdinalIndex(selText);
    if (ordIdx !== null && ordIdx >= 0 && ordIdx < records.length) {
        targetIdx = ordIdx;
    } else {
        const numMatch = selLower.match(/(?:record|report|number|#)?\s*(\d+)/i);
        if (numMatch) {
            const parsed = parseInt(numMatch[1], 10) - 1;
            if (parsed >= 0 && parsed < records.length) {
                targetIdx = parsed;
            }
        }
    }

    // Also match by record title (e.g. "MRI Report")
    if (targetIdx === -1) {
        const titleMatch = records.findIndex(r => (r.title || "").toLowerCase().includes(selLower) || selLower.includes((r.title || "").toLowerCase()));
        if (titleMatch !== -1) targetIdx = titleMatch;
    }

    if (targetIdx >= 0 && targetIdx < records.length) {
        const chosen = records[targetIdx];
        const recordIdentifier = String(chosen.id || chosen._id);
        const searchQuery = query && query !== selText ? query : `Summarize medical record: ${chosen.title}`;
        const searchResult = await searchPatientDocuments({
            user: doctorUser,
            query: searchQuery,
            patientId: agentState.patientId,
            recordId: recordIdentifier
        });

        return {
            handled: true,
            isAll: false,
            selectedRecord: chosen,
            searchResult,
            aiResponse: searchResult.answer,
            citations: searchResult.citations || [],
            hasLowConfidenceWarning: searchResult.hasLowConfidenceWarning || false,
            agentState: {
                ...agentState,
                stage: "RECORD_SELECTED",
                selectedRecordId: recordIdentifier,
                selectedRecordTitle: chosen.title
            }
        };
    }

    // If in SELECT_SHARED_RECORD stage and doctor entered an invalid number or unrecognized choice:
    if (/^(?:\d+|record \d+|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)$/i.test(selLower)) {
        return {
            handled: true,
            aiResponse: `Please select a valid record number between 1 and ${records.length}, or reply 'all' to review all records.`,
            searchResult: { answer: "Invalid record index." },
            citations: [],
            agentState: {
                ...agentState,
                stage: "SELECT_SHARED_RECORD"
            }
        };
    }

    return { handled: false };
};

