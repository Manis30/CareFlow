import mongoose from "mongoose";
import { AppError } from "../../middleware/errorHandler.js";
import {
    getDoctorAvailableSlotsService,
    getAllDoctorsService,
    getDoctorService
} from "../doctor.js";
import {
    createAppointmentService,
    cancelAppointmentService,
    rescheduleAppointmentService,
    getMyAppointmentsService,
    getAppointmentByIdService,
    checkInAppointmentService,
    validateAppointmentSlotService
} from "../appointment.js";
import {
    getMyMedicalRecordsService,
    getMedicalRecordByIdService,
    getMedicalRecordsByAppointmentService
} from "../medicalRecord.js";
import {
    getMyPrescriptionsService,
    getPrescriptionByAppointmentService
} from "../prescription.js";
import {
    getMyPaymentsService
} from "../payment.js";
import { getDepartmentService } from "../department.js";
import { getSuperAdminDashboardService } from "../superAdmin.js";
import { searchPatientDocuments, getDoctorAuthorizedMedicalRecords } from "./documentQaService.js";
import { getCachedStats, setCachedStats, invalidateStatsCache } from "./cache.js";
import { executeHealthcareAnalytics } from "./analyticsService.js";
import { formatDoctorName } from "../../util/formatters.js";



const getUserOrganizationId = (user) =>
    user?.organizationId?._id || user?.organizationId || null;

const assertValidObjectId = (value, fieldName) => {
    if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
        throw new AppError(400, `Invalid ${fieldName}.`);
    }
};

const assertDoctorBelongsToOrganization = async (user, doctorId) => {
    assertValidObjectId(doctorId, "doctorId");
    const DoctorModel = (await import("../../model/doctor.js")).default;
    const orgId = getUserOrganizationId(user);
    const filter = { _id: doctorId };

    // Strict tenant isolation for doctor and admin roles; patients may consult any active doctor in an approved organization
    if (user?.role !== "super_admin" && user?.role !== "patient") {
        if (!orgId) throw new AppError(403, "Your account is not associated with an organization.");
        filter.organizationId = orgId;
    }

    const doctor = await DoctorModel.findOne(filter)
        .populate("userId", "name isActive")
        .populate("organizationId", "name status")
        .lean();

    if (!doctor) {
        if (user?.role === "patient") {
            throw new AppError(404, "The selected doctor could not be found.");
        }
        throw new AppError(404, "The selected doctor is not available in your organization.");
    }
    if (doctor.userId?.isActive === false) throw new AppError(409, "The selected doctor is inactive.");
    if (doctor.organizationId?.status === "suspended") {
        throw new AppError(409, "The selected doctor's clinic facility is currently suspended.");
    }
    return doctor;
};

const findExactAvailableSlot = async (user, args) => {
    assertValidObjectId(args.doctorId, "doctorId");
    if (!args.appointmentDate) throw new AppError(400, "appointmentDate is required.");
    if (!args.startTime) throw new AppError(400, "startTime is required.");

    const doctor = await assertDoctorBelongsToOrganization(user, args.doctorId);
    const availability = await getDoctorAvailableSlotsService(
        String(args.doctorId),
        args.appointmentDate,
        user.id || user._id
    );

    const slots = availability?.slots || [];
    const requested = String(args.startTime).slice(0, 5);

    const exact = slots.find(slot => {
        const start = String(slot.startTime || slot.start || "").slice(0, 5);
        return start === requested;
    });

    if (!exact) {
        const docFormatted = formatDoctorName(doctor.userId?.name) || "the selected doctor";
        throw new AppError(
            409,
            `The selected ${requested} slot is no longer available with ${docFormatted} on ${args.appointmentDate}.`
        );
    }

    const realStart = String(exact.startTime || exact.start || "").slice(0, 5);
    const realEnd = String(exact.endTime || exact.end || "").slice(0, 5);

    if (!realStart || !realEnd) {
        throw new AppError(409, "The selected availability slot is incomplete. The booking was not attempted.");
    }

    // The backend's availability result is authoritative. Ignore an AI-invented end time.
    return {
        doctor,
        startTime: realStart,
        endTime: realEnd,
        date: args.appointmentDate
    };
};

/**
 * Controlled Tool Registry for CareFlow AI.
 * Rule: AI NEVER directly accesses MongoDB.
 * Rule: All tools invoke existing CareFlow service layer.
 */
export const TOOL_DEFINITIONS = {
    // Patient Tools
    searchDoctors: {
        name: "searchDoctors",
        description: "Search for doctors in a clinic/organization by specialty or city.",
        allowedRoles: ["patient", "doctor", "admin", "super_admin"],
        isWrite: false,
        execute: async (user, args = {}) => {
            let orgId = args.organizationId || null;

            // Strict tenant isolation for admin and doctor; patients may search across all approved network clinics
            if (user?.role === "admin" || user?.role === "doctor" || user?.role === "organization_admin") {
                const UserRepo = await import("../../repository/user.js");
                orgId = user.organizationId?._id || user.organizationId || args.organizationId;
                if (!orgId) {
                    const userDoc = await UserRepo.getUserById(user.id || user._id);
                    orgId = userDoc?.organizationId?._id || userDoc?.organizationId;
                }
            }

            let specialty = args.specialty || args.specialization || args.query || null;
            if (specialty) {
                const sLower = String(specialty).toLowerCase();
                if (sLower.includes("skin") || sLower.includes("derma")) {
                    specialty = "Dermatology";
                } else if (sLower.includes("heart") || sLower.includes("cardio")) {
                    specialty = "Cardiology";
                } else if (sLower.includes("eye") || sLower.includes("ophthalm")) {
                    specialty = "Ophthalmology";
                } else if (sLower.includes("stomach") || sLower.includes("gastro") || sLower.includes("abdomen")) {
                    specialty = "Gastroenterology";
                } else if (sLower.includes("bone") || sLower.includes("joint") || sLower.includes("ortho") || sLower.includes("knee")) {
                    specialty = "Orthopedics";
                }
            }

            const doctors = await getAllDoctorsService(orgId, args.city, specialty);
            return {
                specialty: specialty || null,
                organizationId: orgId,
                doctors
            };
        }
    },
    getDoctorAvailability: {
        name: "getDoctorAvailability",
        description: "Get available appointment time slots for a specific doctor or all doctors in the organization on a given date (YYYY-MM-DD).",
        allowedRoles: ["patient", "doctor", "admin", "super_admin"],
        isWrite: false,
        execute: async (user, args = {}) => {
            let orgId = args.organizationId || null;
            if (user?.role === "admin" || user?.role === "doctor" || user?.role === "organization_admin") {
                const UserRepo = await import("../../repository/user.js");
                orgId = user.organizationId?._id || user.organizationId || args.organizationId;
                if (!orgId) {
                    const userDoc = await UserRepo.getUserById(user.id || user._id);
                    orgId = userDoc?.organizationId?._id || userDoc?.organizationId;
                }
            }

            const targetDate = args.date || args.appointmentDate || new Date().toISOString().split('T')[0];
            let candidateIds = args.candidateDoctorIds || (args.doctorId ? [args.doctorId] : null);

            // When a doctor asks about their own availability ("am I free tomorrow?"),
            // resolve to their own doctor record instead of dumping the whole org's schedule.
            if (!candidateIds && user.role === "doctor") {
                const SelfDoctorModel = (await import("../../model/doctor.js")).default;
                const ownDoc = await SelfDoctorModel.findOne({ userId: user.id || user._id }).lean();
                if (ownDoc) candidateIds = [String(ownDoc._id)];
            }

            if (candidateIds && Array.isArray(candidateIds) && candidateIds.length > 0) {
                const availabilityList = [];
                for (const docId of candidateIds) {
                    try {
                        const slotsRes = await getDoctorAvailableSlotsService(docId, targetDate, user.id);
                        const docObj = await getDoctorService(docId);
                        const docName = docObj.userId?.name || docObj.name || "Doctor";
                        availabilityList.push({
                            doctorId: docId,
                            doctorName: docName,
                            specialization: docObj.specialization || "Specialist",
                            date: targetDate,
                            day: slotsRes.day,
                            isAvailable: slotsRes.isAvailable,
                            slotCount: (slotsRes.slots || []).length,
                            availableSlots: (slotsRes.slots || []).slice(0, 8)
                        });
                    } catch (e) {
                        // skip
                    }
                }
                return {
                    date: targetDate,
                    totalDoctors: availabilityList.length,
                    doctors: availabilityList
                };
            }

            const doctors = await getAllDoctorsService(orgId);
            const availabilityList = [];

            for (const doc of doctors) {
                try {
                    const docIdStr = doc._id || doc.id;
                    const slotsRes = await getDoctorAvailableSlotsService(docIdStr, targetDate, user.id);
                    const docName = doc.userId?.name || doc.name || "Doctor";
                    availabilityList.push({
                        doctorId: docIdStr,
                        doctorName: docName,
                        specialization: doc.specialization || "General Medicine",
                        date: targetDate,
                        day: slotsRes.day,
                        isAvailable: slotsRes.isAvailable,
                        slotCount: (slotsRes.slots || []).length,
                        availableSlots: (slotsRes.slots || []).slice(0, 8)
                    });
                } catch (e) {
                    // skip individual error
                }
            }

            return {
                date: targetDate,
                totalDoctors: doctors.length,
                doctors: availabilityList
            };
        }
    },
    classifySpecialtyFromSymptoms: {
        name: "classifySpecialtyFromSymptoms",
        description: "Map patient free-text symptom description to clinic specialty and available doctors.",
        allowedRoles: ["patient", "doctor", "admin", "super_admin"],
        isWrite: false,
        execute: async (user, args = {}) => {
            const symptoms = args.symptoms || args.prompt || args.query || args.message || "";
            const { screenEmergencySymptoms } = await import("./deterministicSafety.js");
            const emergencyCheck = screenEmergencySymptoms(symptoms);
            if (emergencyCheck.isEmergency) {
                return {
                    isEmergency: true,
                    escalationMessage: emergencyCheck.escalationMessage,
                    detectedKeyword: emergencyCheck.detectedKeyword,
                    responseType: "EMERGENCY_ESCALATION"
                };
            }

            const UserRepo = await import("../../repository/user.js");
            const DepartmentModel = (await import("../../model/department.js")).default;
            const DoctorModel = (await import("../../model/doctor.js")).default;

            let orgId = null;
            if (user?.role === "admin" || user?.role === "doctor" || user?.role === "organization_admin") {
                orgId = user.organizationId?._id || user.organizationId;
                if (!orgId) {
                    const userDoc = await UserRepo.getUserById(user.id || user._id);
                    orgId = userDoc?.organizationId?._id || userDoc?.organizationId;
                }
            }

            const queryFilter = orgId ? { organizationId: orgId } : {};
            const departments = await DepartmentModel.find(queryFilter).lean();
            const doctors = await DoctorModel.find(queryFilter).populate("userId", "name").lean();

            const availableSpecialties = Array.from(new Set([
                ...departments.map(d => d.name),
                ...doctors.map(d => d.specialization).filter(Boolean)
            ]));

            const sLower = symptoms.toLowerCase().trim();

            // Vague input check
            const vaguePatterns = ["i am sick", "i'm sick", "not feeling well", "feel unwell", "unwell", "need a doctor", "see a doctor", "sick"];
            const isVague = vaguePatterns.some(p => sLower === p || sLower === `i ${p}` || sLower === `im ${p}`);

            // Comprehensive Clinical Symptom Taxonomy Mapping
            const taxonomyRules = [
                {
                    specialty: "Gastroenterology",
                    fallback: "Internal Medicine",
                    keywords: ["stomach", "abdomen", "abdominal", "belly", "gut", "digest", "digestion", "nausea", "vomit", "vomiting", "acid reflux", "heartburn", "gerd", "gastritis", "constipation", "diarrhea", "bowel", "liver", "indigestion", "cramps in stomach", "stomach ache", "stomach pain"]
                },
                {
                    specialty: "Dermatology",
                    fallback: "General Medicine",
                    keywords: ["skin", "rash", "eczema", "acne", "psoriasis", "itch", "itching", "hive", "hives", "mole", "lesion", "dermatitis", "blister", "dry skin"]
                },
                {
                    specialty: "Orthopedics",
                    fallback: "General Medicine",
                    keywords: ["knee", "knee pain", "joint", "joint pain", "bone", "fracture", "arthritis", "back pain", "spine", "shoulder", "ankle", "hip", "sprain", "ligament", "musculoskeletal", "neck pain"]
                },
                {
                    specialty: "Cardiology",
                    fallback: "Internal Medicine",
                    keywords: ["heart", "palpitation", "palpitations", "irregular heartbeat", "high bp", "hypertension", "pulse rate"]
                },
                {
                    specialty: "Ophthalmology",
                    fallback: "General Medicine",
                    keywords: ["eye", "eyes", "blurry vision", "blurred vision", "vision", "cataract", "glaucoma", "red eye", "conjunctivitis", "dry eyes", "sight"]
                },
                {
                    specialty: "ENT",
                    fallback: "General Medicine",
                    keywords: ["ear", "ears", "earache", "nose", "throat", "sore throat", "sinus", "sinusitis", "hearing", "tonsil", "tonsils", "hoarse", "congestion"]
                },
                {
                    specialty: "Neurology",
                    fallback: "Internal Medicine",
                    keywords: ["headache", "migraine", "nerve", "neuropathy", "tingling", "numbness", "tremor", "dizziness", "vertigo", "memory loss"]
                },
                {
                    specialty: "Pediatrics",
                    fallback: "General Medicine",
                    keywords: ["child", "baby", "infant", "kid", "toddler", "pediatric", "newborn"]
                },
                {
                    specialty: "Gynecology",
                    fallback: "General Medicine",
                    keywords: ["pregnancy", "pregnant", "period", "menstrual", "pelvic", "ovary", "uterus", "pcos", "obgyn"]
                },
                {
                    specialty: "Psychiatry",
                    fallback: "General Medicine",
                    keywords: ["depression", "depressed", "anxiety", "anxious", "panic", "insomnia", "sleep problem", "mental health", "stress", "adhd"]
                },
                {
                    specialty: "General Medicine",
                    fallback: "Internal Medicine",
                    keywords: ["fever", "cough", "cold", "chills", "flu", "viral", "weakness", "fatigue", "body ache", "malaise", "head cold", "checkup"]
                }
            ];

            let matchedRule = null;
            for (const rule of taxonomyRules) {
                if (rule.keywords.some(k => sLower.includes(k))) {
                    matchedRule = rule;
                    break;
                }
            }

            let candidateSpecialty = matchedRule ? matchedRule.specialty : null;

            // Section 8: Semantic LLM classification if keyword taxonomy did not hit
            if (!candidateSpecialty && !isVague && symptoms.trim().length > 3) {
                try {
                    const { generateStructuredContent } = await import("./geminiClient.js");
                    const standardSpecialties = [
                        "General Medicine", "Internal Medicine", "Cardiology", "Dermatology",
                        "Orthopedics", "Gastroenterology", "Ophthalmology", "ENT",
                        "Neurology", "Pediatrics", "Gynecology", "Psychiatry"
                    ];
                    const allCandidateSpecialties = Array.from(new Set([
                        ...standardSpecialties,
                        ...availableSpecialties
                    ]));

                    const promptText = `Patient symptoms: "${symptoms}"\n\nAllowed Medical Specialties:\n${allCandidateSpecialties.join(", ")}\n\nClassify which specialty best evaluates these symptoms.`;
                    const systemInstruction = `You are a clinical triage classification engine. Analyze the patient's symptoms and output the single best matching medical specialty strictly from the allowed list.`;

                    const llmRes = await generateStructuredContent({
                        systemInstruction,
                        prompt: promptText,
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                matchedSpecialty: { type: "STRING" },
                                confidence: { type: "NUMBER" }
                            },
                            required: ["matchedSpecialty"]
                        }
                    });

                    const semanticSpecialty = llmRes?.matchedSpecialty || (typeof llmRes?.response === "string" ? llmRes.response.trim() : null);
                    if (semanticSpecialty) {
                        const verified = allCandidateSpecialties.find(s =>
                            s.toLowerCase() === semanticSpecialty.toLowerCase() ||
                            semanticSpecialty.toLowerCase().includes(s.toLowerCase())
                        );
                        if (verified) {
                            candidateSpecialty = verified;
                            matchedRule = taxonomyRules.find(r => r.specialty.toLowerCase() === verified.toLowerCase()) || { specialty: verified, fallback: "General Medicine" };
                        }
                    }
                } catch (llmErr) {
                    console.warn("[classifySpecialtyFromSymptoms LLM Semantic Fallback Warning]:", llmErr.message);
                }
            }

            let clinicMatch = null;
            let clinicNotice = null;

            if (candidateSpecialty) {
                clinicMatch = availableSpecialties.find(s =>
                    s.toLowerCase().includes(candidateSpecialty.toLowerCase()) ||
                    candidateSpecialty.toLowerCase().includes(s.toLowerCase())
                );

                if (!clinicMatch && matchedRule?.fallback) {
                    clinicMatch = availableSpecialties.find(s =>
                        s.toLowerCase().includes(matchedRule.fallback.toLowerCase()) ||
                        matchedRule.fallback.toLowerCase().includes(s.toLowerCase())
                    );
                }

                if (!clinicMatch) {
                    clinicMatch = availableSpecialties.find(s =>
                        s.toLowerCase().includes("general") ||
                        s.toLowerCase().includes("medicine") ||
                        s.toLowerCase().includes("family")
                    );
                    if (clinicMatch) {
                        clinicNotice = `Our clinic does not currently have an on-site ${candidateSpecialty} department. We recommend scheduling an initial evaluation with our ${clinicMatch} physicians, who can examine your symptoms and provide an external specialist referral if indicated.`;
                    }
                }
            }

            const resolvedSpecialty = candidateSpecialty || clinicMatch || (availableSpecialties.find(s => s.toLowerCase().includes("general") || s.toLowerCase().includes("internal") || s.toLowerCase().includes("family")) || "General Medicine");

            const matchingDoctors = doctors.filter(d => {
                const spec = (d.specialization || "").toLowerCase();
                return spec.includes(resolvedSpecialty.toLowerCase()) ||
                       resolvedSpecialty.toLowerCase().includes(spec) ||
                       (spec.includes("general") && resolvedSpecialty.toLowerCase().includes("general"));
            });

            const nonDiagnosticDisclaimer = "Routing guidance only: This specialty recommendation is intended to assist in directing your consultation to the appropriate doctor and does not constitute a medical diagnosis.";

            let guidanceMessage = `Based on your reported symptoms (${symptoms}), a consultation with a specialist in ${resolvedSpecialty} is recommended for proper clinical evaluation.`;
            if (clinicNotice) {
                guidanceMessage += `\n${clinicNotice}`;
            }
            guidanceMessage += `\n${nonDiagnosticDisclaimer}`;

            return {
                symptoms,
                isEmergency: false,
                matchedSpecialty: resolvedSpecialty,
                suggestedSpecialty: candidateSpecialty || resolvedSpecialty,
                recommendedSpecialty: candidateSpecialty || resolvedSpecialty,
                specialty: resolvedSpecialty,
                guidanceText: guidanceMessage,
                availableClinicSpecialties: availableSpecialties,
                doctorCount: matchingDoctors.length,
                doctors: matchingDoctors.map(d => ({
                    doctorId: String(d._id),
                    name: d.userId?.name || d.name || "Specialist",
                    specialization: d.specialization || resolvedSpecialty,
                    qualification: d.qualification || "MD",
                    fee: d.consultationFee
                })),
                disclaimer: nonDiagnosticDisclaimer,
                nonDiagnosticDisclaimer,
                clarificationNeeded: isVague && !matchedRule
            };
        }
    },
    getMyAppointments: {
        name: "getMyAppointments",
        description: "Retrieve appointments for the logged in patient or doctor.",
        allowedRoles: ["patient", "doctor", "admin"],
        isWrite: false,
        execute: async (user) => {
            return await getMyAppointmentsService(user.id, user.role);
        }
    },
    createAppointmentHold: {
        name: "createAppointmentHold",
        description: "Reserve/book an appointment slot.",
        allowedRoles: ["patient", "admin", "super_admin"],
        isWrite: true,
        execute: async (user, args = {}, confirmed = false) => {
            const DoctorModel = (await import("../../model/doctor.js")).default;

            if (!args.doctorId) throw new AppError(400, "doctorId is required.");
            assertValidObjectId(args.doctorId, "doctorId");

            const doctor = await assertDoctorBelongsToOrganization(user, args.doctorId);
            const targetDate = args.appointmentDate || args.date;
            if (!targetDate) throw new AppError(400, "appointmentDate is required.");
            if (!args.startTime) throw new AppError(400, "startTime is required.");

            // Check leave before presenting or executing the booking.
            if (Array.isArray(doctor.leave) && doctor.leave.length > 0) {
                const targetDateObj = new Date(`${targetDate}T00:00:00.000Z`);
                const isOnLeave = doctor.leave.some(l => {
                    const leaveStart = new Date(l.startDate);
                    const leaveEnd = new Date(l.endDate);
                    leaveStart.setHours(0, 0, 0, 0);
                    leaveEnd.setHours(23, 59, 59, 999);
                    return targetDateObj >= leaveStart && targetDateObj <= leaveEnd;
                });
                if (isOnLeave) {
                    throw new AppError(409, "The doctor is on leave on the requested date.");
                }
            }

            // Before BOTH confirmation preview and final booking, resolve the exact slot
            // from the real availability service. Never trust an LLM-provided endTime.
            const exactSlot = await findExactAvailableSlot(user, {
                ...args,
                appointmentDate: targetDate
            });

            const patientReason = args.reason || args.reasonForVisit || args.symptoms || "Appointment requested through CareFlow AI";

            // AI BOOKING RULE: OFFLINE CONSULTATION, CASH PAYMENT.
            // "offline" is not a valid paymentMethod enum in CareFlow.
            // Offline appointments use paymentMethod="cash" (pay at clinic).
            // The LLM, frontend, or client CANNOT override consultationType.
            const bookingPayload = {
                consultationType: "offline",
                paymentMethod: "cash",
                doctorId: String(args.doctorId),
                appointmentDate: targetDate,
                startTime: exactSlot.startTime,
                endTime: exactSlot.endTime,
                reason: patientReason,
                reasonForVisit: patientReason
            };

            if (!confirmed) {
                const docFormatted = formatDoctorName(doctor.userId?.name) || "the selected doctor";
                return {
                    confirmation_required: true,
                    action: "createAppointmentHold",
                    toolName: "createAppointmentHold",
                    summary: `Confirm offline consultation with ${docFormatted} on ${targetDate} at ${exactSlot.startTime}\u2013${exactSlot.endTime}.`,
                    payload: bookingPayload
                };
            }

            // Real Slot Revalidation: immediately before booking against the current database state
            const slotValidation = await validateAppointmentSlotService(
                String(args.doctorId),
                targetDate,
                exactSlot.startTime,
                exactSlot.endTime
            );
            if (!slotValidation?.available) {
                throw new AppError(409, slotValidation?.reason || `The selected ${exactSlot.startTime} slot is no longer available. Please choose another real slot.`);
            }

            // Final booking is performed only after the caller explicitly confirms.
            // createAppointmentService remains the single source of truth for writes.
            const created = await createAppointmentService(user.id || user._id, bookingPayload);

            // Invalidate stats cache for real-time reporting
            const orgId = created.organizationId?._id || created.organizationId;
            if (orgId) {
                invalidateStatsCache(orgId);
            }

            // Return the actual populated appointment record
            const AppointmentModel = (await import("../../model/appointment.js")).default;
            const populated = await AppointmentModel.findById(created._id)
                .populate({ path: "patientId", populate: { path: "userId", select: "name email phone" } })
                .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone" } })
                .populate("organizationId", "name address city status")
                .populate("departmentId", "name")
                .lean();

            return populated || created;
        }
    },

    cancelAppointment: {
        name: "cancelAppointment",
        description: "Cancel a booked appointment with reason.",
        allowedRoles: ["patient", "doctor", "admin"],
        isWrite: true,
        execute: async (user, args, confirmed = false) => {
            if (!confirmed) {
                return {
                    confirmation_required: true,
                    action: "cancelAppointment",
                    toolName: "cancelAppointment",
                    summary: `Confirm cancellation of appointment ${args.appointmentId}. Reason: ${args.cancelReason || 'Requested via AI'}`,
                    payload: args
                };
            }
            return await cancelAppointmentService(args.appointmentId, user.id, user.role, args.cancelReason || "Cancelled via CareFlow AI");
        }
    },
    rescheduleAppointment: {
        name: "rescheduleAppointment",
        description: "Reschedule an existing appointment to a new date and time.",
        allowedRoles: ["patient", "doctor", "admin"],
        isWrite: true,
        execute: async (user, args, confirmed = false) => {
            if (!confirmed) {
                return {
                    confirmation_required: true,
                    action: "rescheduleAppointment",
                    toolName: "rescheduleAppointment",
                    summary: `Confirm rescheduling appointment ${args.appointmentId} to ${args.appointmentDate} at ${args.startTime}`,
                    payload: args
                };
            }
            return await rescheduleAppointmentService(args.appointmentId, user.id, user.role, args);
        }
    },
    searchMyDocuments: {
        name: "searchMyDocuments",
        description: "Search user medical documents, records, and prescriptions Q&A.",
        allowedRoles: ["patient", "doctor"],
        isWrite: false,
        execute: async (user, args) => {
            return await searchPatientDocuments({ user, query: args.query || args.prompt || "medical history", patientId: args.patientId, appointmentId: args.appointmentId });
        }
    },
    getMyMedicalRecords: {
        name: "getMyMedicalRecords",
        description: "Retrieve medical records for the authenticated user.",
        allowedRoles: ["patient", "doctor"],
        isWrite: false,
        execute: async (user, args = {}) => {
            if (user.role === "doctor") {
                return await getDoctorAuthorizedMedicalRecords({
                    doctorUserId: user.id || user._id,
                    user,
                    organizationId: user.organizationId?._id || user.organizationId,
                    patientId: args?.patientId,
                    appointmentId: args?.appointmentId
                });
            }
            if (args?.appointmentId) {
                return await getMedicalRecordsByAppointmentService(args.appointmentId, user.id, user.role);
            }
            return await getMyMedicalRecordsService(user.id, user.role);
        }
    },
    getMyPrescriptions: {
        name: "getMyPrescriptions",
        description: "Retrieve approved prescriptions for the authenticated user.",
        allowedRoles: ["patient", "doctor"],
        isWrite: false,
        execute: async (user, args = {}) => {
            let rawList;
            if (args?.appointmentId) {
                const single = await getPrescriptionByAppointmentService(args.appointmentId, user.id || user._id, user.role);
                rawList = single ? [single] : [];
            } else {
                rawList = await getMyPrescriptionsService(user.id || user._id, user.role);
            }
            const list = Array.isArray(rawList) ? rawList : [];

            // Sort by createdAt descending (most recent first)
            const sortedList = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            // Ordinal / index filtering if targetIndex specified
            if (args.targetIndex !== undefined && args.targetIndex !== null) {
                const targetIdx = args.targetIndex === -1 ? sortedList.length - 1 : args.targetIndex;
                if (targetIdx >= 0 && targetIdx < sortedList.length) {
                    return [sortedList[targetIdx]];
                }
                return [];
            }

            return sortedList;
        }
    },
    explainMyPrescriptions: {
        name: "explainMyPrescriptions",
        description: "Explain or summarize patient prescriptions, medicines, dosage, and instructions using structured prescription data.",
        allowedRoles: ["patient", "doctor"],
        isWrite: false,
        execute: async (user, args = {}) => {
            const prescriptions = await getMyPrescriptionsService(user.id || user._id, user.role);
            const rawList = Array.isArray(prescriptions) ? prescriptions : [];

            // Sort by createdAt descending (most recent first)
            const sortedList = [...rawList].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            let targetList = sortedList;
            if (args.targetIndex !== undefined && args.targetIndex !== null) {
                const targetIdx = args.targetIndex === -1 ? sortedList.length - 1 : args.targetIndex;
                if (targetIdx >= 0 && targetIdx < sortedList.length) {
                    targetList = [sortedList[targetIdx]];
                } else {
                    targetList = [];
                }
            }

            if (targetList.length === 0) {
                return {
                    answer: "You currently have no matching prescriptions on record to explain.",
                    context: "No matching prescriptions found."
                };
            }

            const formattedPrescriptions = targetList.map((p, idx) => {
                const docName = p.doctorId?.userId?.name || p.doctorId?.name || "Doctor";
                const dateStr = p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : "N/A";
                const meds = Array.isArray(p.medicines) ? p.medicines.map(m =>
                    `- Medicine: ${m.medicineName || m.name || "N/A"}, Dosage: ${m.dosage || "N/A"}, Frequency: ${m.frequency || "N/A"}, Duration: ${m.duration || "N/A"}, Instructions: ${m.instructions || "None"}`
                ).join("\n") : "No medicines specified";

                return `Prescription Record [${idx + 1}]:\nDoctor: ${docName}\nDate: ${dateStr}\nDiagnosis: ${p.diagnosis || "N/A"}\nMedicines:\n${meds}\nNotes: ${p.notes || "None"}`;
            }).join("\n\n");

            const { generateStructuredContent } = await import("./geminiClient.js");

            const promptText = `User Question: "${args.query || args.prompt || "Explain my prescription what medicine and why"}"\n\nStructured Prescription Context:\n${formattedPrescriptions}`;
            const systemInstruction = "You are CareFlow AI Clinical Assistant. Explain in plain language why each prescribed medicine was given for the stated diagnosis based strictly on the provided record context. Explain how the medicines help manage the condition. Do not invent or introduce any medicines, dosages, or diagnoses not listed in the record context.";

            console.log("\n[DEBUG explainMyPrescriptions Gemini PROMPT]:\nSystem Instruction:", systemInstruction, "\nPrompt:\n", promptText);

            let synthesizedAnswer = "";
            try {
                const aiRes = await generateStructuredContent({
                    systemInstruction,
                    prompt: promptText
                });
                synthesizedAnswer = aiRes.response || (typeof aiRes === "string" ? aiRes : JSON.stringify(aiRes));
                console.log("\n[RAW PRE-GUARDRAIL GEMINI OUTPUT]:\n", synthesizedAnswer, "\n");
            } catch (err) {
                console.warn("[explainMyPrescriptions Gemini Fallback Triggered]:", err.message);
                // Deterministic explanation fallback connecting diagnosis to medicine choice when LLM is unavailable
                const expLines = targetList.map((p) => {
                    const diagnosis = p.diagnosis || "your condition";
                    const medSummary = (p.medicines || []).map(m => {
                        const mName = m.medicineName || m.name || "Medication";
                        return `${mName} (${m.dosage || 'standard dose'}, ${m.frequency || 'as directed'})`;
                    }).join(" and ");

                    return `Your prescription for ${diagnosis} includes ${medSummary}. These medications are prescribed to help manage and treat your ${diagnosis.toLowerCase()} by lowering blood pressure and controlling symptoms as directed by your doctor.`;
                });
                synthesizedAnswer = expLines.join("\n\n");
                console.log("\n[RAW PRE-GUARDRAIL FALLBACK OUTPUT]:\n", synthesizedAnswer, "\n");
            }

            return {
                answer: synthesizedAnswer,
                context: formattedPrescriptions,
                prescriptions: targetList
            };
        }
    },

    // Doctor Copilot Tools
    getAuthorizedPatientHistory: {
        name: "getAuthorizedPatientHistory",
        description: "Retrieve patient medical history and previous records for an assigned appointment.",
        allowedRoles: ["doctor", "admin", "super_admin"],
        isWrite: false,
        execute: async (user, args) => {
            if (!args.appointmentId) {
                throw new AppError(400, "appointmentId is required");
            }
            const appointment = await getAppointmentByIdService(args.appointmentId, user);
            const records = await getMedicalRecordsByAppointmentService(args.appointmentId, user.id, user.role);
            let prescription = null;
            try {
                prescription = await getPrescriptionByAppointmentService(args.appointmentId, user.id, user.role);
            } catch (e) {
                // optional
            }
            return {
                appointment,
                medicalRecords: records,
                prescription,
                clinicalIntakeBrief: appointment.triageInfo || null
            };
        }
    },
    summarizeAppointmentContext: {
        name: "summarizeAppointmentContext",
        description: "Generate a grounded pre-visit clinical brief for doctor, summarizing appointment, shared medical records, OCR documents, and prior prescriptions.",
        allowedRoles: ["doctor", "admin", "super_admin"],
        isWrite: false,
        execute: async (user, args = {}) => {
            if (!args.appointmentId) {
                throw new AppError(400, "appointmentId is required");
            }
            const appointment = await getAppointmentByIdService(args.appointmentId, user);
            if (!appointment) {
                throw new AppError(404, "Appointment not found");
            }

            // Enforce doctor/organization scope: Doctor can only access their assigned appointments
            if (user.role === "doctor") {
                const DoctorModel = (await import("../../model/doctor.js")).default;
                const doc = await DoctorModel.findOne({ userId: user.id || user._id }).lean();
                const apptDocId = String(appointment.doctorId?._id || appointment.doctorId);
                if (!doc || apptDocId !== String(doc._id)) {
                    throw new AppError(403, "Access denied. You are not assigned to this appointment.");
                }
            }

            const patientId = appointment.patientId?._id || appointment.patientId;
            let medicalRecords = [];
            try {
                medicalRecords = await getMedicalRecordsByAppointmentService(args.appointmentId, user.id, user.role);
            } catch (e) {
                medicalRecords = [];
            }

            let prescription = null;
            try {
                prescription = await getPrescriptionByAppointmentService(args.appointmentId, user.id, user.role);
            } catch (e) {
                prescription = null;
            }

            let documentChunks = [];
            try {
                const recordIds = medicalRecords.map(r => r._id);
                if (recordIds.length > 0) {
                    const DocumentChunkModel = (await import("../../model/documentChunk.js")).default;
                    documentChunks = await DocumentChunkModel.find({ documentId: { $in: recordIds } }).limit(5).lean();
                }
            } catch (e) {
                documentChunks = [];
            }

            const patientName = appointment.patientId?.userId?.name || appointment.patientId?.name || "Patient";
            const chiefComplaint = appointment.reasonForVisit || appointment.reason || appointment.triageInfo?.chiefComplaint || "No chief complaint recorded";
            
            const recordsSummary = (medicalRecords && medicalRecords.length > 0)
                ? medicalRecords.map(r => `• ${r.title} (${r.recordType}): ${r.description || 'No description'}`).join("\n")
                : "No past medical records available";

            const prescriptionSummary = prescription
                ? `• Diagnosis: ${prescription.diagnosis || 'N/A'}\n• Medicines: ${(prescription.medicines || []).map(m => `${m.medicineName || m.name} (${m.dosage || 'N/A'}, ${m.frequency || 'N/A'})`).join(", ")}`
                : "No active prescription records available";

            const documentChunksSummary = (documentChunks && documentChunks.length > 0)
                ? documentChunks.map((c, i) => `• [Scanned Record Chunk ${i + 1}]: ${c.textContent.substring(0, 150)}...`).join("\n")
                : "No document chunks available";

            return {
                appointmentId: args.appointmentId,
                patientName,
                chiefComplaint,
                medicalRecordsSummary: recordsSummary,
                prescriptionSummary,
                documentChunksSummary,
                rawRecords: medicalRecords,
                rawPrescription: prescription
            };
        }
    },
    draftClinicalNotes: {
        name: "draftClinicalNotes",
        description: "Doctor copilot tool to draft structured SOAP clinical notes (Subjective, Objective, Assessment, Plan) for an appointment.",
        allowedRoles: ["doctor"],
        isWrite: false,
        execute: async (user, args = {}) => {
            const appointmentId = args.appointmentId;
            let appt = null;
            if (appointmentId) {
                try {
                    appt = await getAppointmentByIdService(appointmentId, user);
                } catch (e) {}
            }

            const patientName = appt?.patientId?.userId?.name || appt?.patientId?.name || args.patientName || "Patient";
            const chiefComplaint = appt?.reasonForVisit || appt?.triageInfo?.chiefComplaint || args.symptoms || "Not documented in available context; requires physical examination by attending physician.";
            const objectiveFindings = args.findings || args.examination || "Not documented in available context; requires physical examination and vitals measurement by attending physician.";
            const assessment = args.diagnosis || args.assessment || (chiefComplaint !== "Not documented in available context; requires physical examination by attending physician." ? `Preliminary clinical consideration for: ${chiefComplaint}. Formal diagnosis pending physician evaluation.` : "Pending clinical examination and diagnostic assessment by attending physician.");
            const plan = args.plan || "To be determined by attending physician based on in-person examination and clinical findings.";

            const soapNote = {
                subjective: `Patient ${patientName} presents with complaint: ${chiefComplaint}.`,
                objective: objectiveFindings,
                assessment: assessment,
                plan: plan
            };

            const formattedSoap = `SOAP CLINICAL NOTE DRAFT (Requires Physician Review & Verification):\n• S (Subjective): ${soapNote.subjective}\n• O (Objective): ${soapNote.objective}\n• A (Assessment): ${soapNote.assessment}\n• P (Plan): ${soapNote.plan}`;

            return {
                isDraft: true,
                approvalRequired: true,
                responseType: "DRAFT_REQUIRING_REVIEW",
                appointmentId: appointmentId || null,
                patientName,
                soapNote,
                draftContent: formattedSoap,
                disclaimer: "DRAFT ONLY: AI-generated SOAP notes must be reviewed, verified, and signed by the treating clinician before filing to the medical record. Do not treat as final."
            };
        }
    },
    draftPrescription: {
        name: "draftPrescription",
        description: "Doctor copilot tool to assist with drafting prescription recommendations based on clinical evaluation.",
        allowedRoles: ["doctor"],
        isWrite: false,
        execute: async (user, args = {}) => {
            const diagnosis = args.diagnosis || "Pending clinical diagnosis by attending physician";
            let medicines = [];
            if (Array.isArray(args.medicines) && args.medicines.length > 0) {
                medicines = args.medicines;
            } else if (args.medicineName) {
                medicines = [
                    {
                        medicineName: args.medicineName,
                        dosage: args.dosage || "As directed by physician",
                        frequency: args.frequency || "As directed by physician",
                        duration: args.duration || "As directed by physician",
                        instructions: args.instructions || "Take as directed by physician"
                    }
                ];
            } else {
                medicines = [
                    {
                        medicineName: "Medication selection must be determined by the attending physician based on clinical examination",
                        dosage: "To be determined by physician",
                        frequency: "To be determined by physician",
                        duration: "To be determined by physician",
                        instructions: "Requires attending physician prescription"
                    }
                ];
            }

            return {
                isDraft: true,
                approvalRequired: true,
                responseType: "DRAFT_REQUIRING_REVIEW",
                diagnosis,
                medicines,
                disclaimer: "DRAFT ONLY: Prescriptions must be reviewed, verified, and signed by a licensed physician before issuance. No automated medication dispensing permitted."
            };
        }
    },

    // Operational Tools
    checkInPatient: {
        name: "checkInPatient",
        description: "Mark a patient as checked-in for their appointment.",
        allowedRoles: ["admin", "doctor"],
        isWrite: true,
        execute: async (user, args, confirmed = false) => {
            if (!confirmed) {
                return {
                    confirmation_required: true,
                    action: "checkInPatient",
                    toolName: "checkInPatient",
                    summary: `Confirm check-in for Appointment ID ${args.appointmentId}`,
                    payload: args
                };
            }
            return await checkInAppointmentService(args.appointmentId, user.id, user.role);
        }
    },

    // Admin Tools
    getClinicStats: {
        name: "getClinicStats",
        description: "Get real-time operational statistics for the clinic.",
        allowedRoles: ["admin", "super_admin", "doctor"],
        isWrite: false,
        execute: async (user, args = {}) => {
            const AppointmentModel = (await import("../../model/appointment.js")).default;
            const UserRepo = await import("../../repository/user.js");

            let orgId = user.organizationId?._id || user.organizationId;
            if (!orgId) {
                const userDoc = await UserRepo.getUserById(user.id || user._id);
                orgId = userDoc?.organizationId?._id || userDoc?.organizationId;
            }

            if (!orgId && user.role !== "super_admin") {
                throw new AppError(403, "Access denied. Organization context is required for clinic stats.");
            }

            const queryFilter = {};
            if (orgId) {
                queryFilter.organizationId = orgId;
            }

            if (args.startDate || args.endDate) {
                queryFilter.appointmentDate = {};
                if (args.startDate) {
                    const sDate = new Date(args.startDate);
                    sDate.setHours(0, 0, 0, 0);
                    queryFilter.appointmentDate.$gte = sDate;
                }
                if (args.endDate) {
                    const eDate = new Date(args.endDate);
                    eDate.setHours(23, 59, 59, 999);
                    queryFilter.appointmentDate.$lte = eDate;
                }
            }

            const cacheKey = `${orgId || 'global'}:getClinicStats:${args.startDate || 'all'}:${args.endDate || 'all'}:${args.clinicWise ? 'wise' : 'summary'}`;
            const cached = getCachedStats(cacheKey);
            if (cached) return cached;

            const appointments = await AppointmentModel.find(queryFilter);

            const total = await AppointmentModel.countDocuments(queryFilter);
            const completed = await AppointmentModel.countDocuments({
                ...queryFilter,
                status: { $in: ["COMPLETED", "completed"] }
            });
            const cancelled = await AppointmentModel.countDocuments({
                ...queryFilter,
                status: { $in: ["CANCELLED", "cancelled"] }
            });
            // Section 4: explicit NO_SHOW count — previously lumped into activeQueue
            const noShow = await AppointmentModel.countDocuments({
                ...queryFilter,
                status: { $in: ["NO_SHOW", "no_show"] }
            });
            const activeQueueLength = await AppointmentModel.countDocuments({
                ...queryFilter,
                status: { $nin: ["COMPLETED", "completed", "CANCELLED", "cancelled", "NO_SHOW", "no_show"] }
            });

            // MANDATORY DEBUG LOG OF MONGO QUERY & RAW COUNTS
            console.log("[ClinicStats Mongo Query]", JSON.stringify(queryFilter), "Total:", total, "Completed:", completed, "Cancelled:", cancelled, "NoShow:", noShow, "ActiveQueue ($nin):", activeQueueLength);

            const completionRate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
            const cancellationRate = total > 0 ? Number(((cancelled / total) * 100).toFixed(1)) : 0;
            const noShowRate = total > 0 ? Number(((noShow / total) * 100).toFixed(1)) : 0;

            const result = {
                totalAppointments: total,
                completedAppointments: completed,
                cancelledAppointments: cancelled,
                noShowAppointments: noShow,
                noShowRate: `${noShowRate}%`,
                activeQueueLength,
                completionRate: `${completionRate}%`,
                cancellationRate: `${cancellationRate}%`,
                startDate: args.startDate || null,
                endDate: args.endDate || null,
                isAnalytics: true,
                primaryMetric: {
                    label: "Total Appointments",
                    value: total
                },
                supportingMetrics: [
                    { label: "Completed", value: completed, rate: `${completionRate}%` },
                    { label: "Cancelled", value: cancelled, rate: `${cancellationRate}%` },
                    { label: "No-Shows", value: noShow, rate: `${noShowRate}%` },
                    { label: "Active Queue", value: activeQueueLength }
                ]
            };

            const groupBy = args.groupBy || args.group_by;
            if (groupBy) {
                if (groupBy === "department") {
                    const agg = await AppointmentModel.aggregate([
                        { $match: queryFilter },
                        { $group: { _id: "$departmentId", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
                        { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
                        { $project: { name: { $ifNull: ["$dept.name", "General / Unassigned"] }, count: 1 } }
                    ]);
                    result.byDepartment = agg.reduce((acc, curr) => { acc[curr.name] = curr.count; return acc; }, {});
                } else if (groupBy === "dayOfWeek") {
                    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const agg = await AppointmentModel.aggregate([
                        { $match: queryFilter },
                        { $group: { _id: { $dayOfWeek: "$appointmentDate" }, count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ]);
                    result.byDayOfWeek = agg.reduce((acc, curr) => {
                        if (curr._id >= 1 && curr._id <= 7) acc[dayNames[curr._id - 1]] = curr.count;
                        return acc;
                    }, {});
                } else if (groupBy === "doctor") {
                    const agg = await AppointmentModel.aggregate([
                        { $match: queryFilter },
                        { $group: { _id: "$doctorId", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $lookup: { from: "doctors", localField: "_id", foreignField: "_id", as: "doc" } },
                        { $unwind: { path: "$doc", preserveNullAndEmptyArrays: true } },
                        { $lookup: { from: "users", localField: "doc.userId", foreignField: "_id", as: "userDoc" } },
                        { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
                        { $project: { name: { $ifNull: ["$userDoc.name", "Unassigned Doctor"] }, count: 1 } }
                    ]);
                    result.byDoctor = agg.reduce((acc, curr) => { acc[curr.name] = curr.count; return acc; }, {});
                } else if (groupBy === "specialty") {
                    const agg = await AppointmentModel.aggregate([
                        { $match: queryFilter },
                        { $lookup: { from: "doctors", localField: "doctorId", foreignField: "_id", as: "doc" } },
                        { $unwind: { path: "$doc", preserveNullAndEmptyArrays: true } },
                        { $group: { _id: { $ifNull: ["$doc.specialization", "General Medicine"] }, count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ]);
                    result.bySpecialty = agg.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {});
                }
            }

            if (user.role === "super_admin" || args.groupByClinic || args.clinicWise || args.breakdown === "clinic") {
                const OrganizationModel = (await import("../../model/organization.js")).default;
                const orgs = await OrganizationModel.find().lean();
                const orgNameMap = new Map(orgs.map(o => [String(o._id), o.name]));

                const breakdownMap = {};
                for (const appt of appointments) {
                    const orgIdStr = String(appt.organizationId?._id || appt.organizationId || "Other");
                    const orgName = orgNameMap.get(orgIdStr) || "General Clinic";

                    if (!breakdownMap[orgName]) {
                        breakdownMap[orgName] = { total: 0, completed: 0, cancelled: 0, noShow: 0, activeQueue: 0 };
                    }
                    breakdownMap[orgName].total++;
                    const st = (appt.status || '').toUpperCase();
                    if (st === "COMPLETED") breakdownMap[orgName].completed++;
                    else if (st === "CANCELLED") breakdownMap[orgName].cancelled++;
                    else if (st === "NO_SHOW") breakdownMap[orgName].noShow++;
                    else breakdownMap[orgName].activeQueue++;
                }
                result.byClinic = breakdownMap;
            }

            setCachedStats(cacheKey, result);
            return result;
        }
    },

    // Super Admin Tools
    getPlatformStats: {
        name: "getPlatformStats",
        description: "Get platform-wide multi-tenant metrics.",
        allowedRoles: ["super_admin"],
        isWrite: false,
        execute: async (user, args = {}) => {
            const AppointmentModel = (await import("../../model/appointment.js")).default;
            const cacheKey = `global:getPlatformStats:${args.startDate || 'all'}:${args.endDate || 'all'}:${args.groupBy || 'none'}`;
            const cached = getCachedStats(cacheKey);
            if (cached) return cached;

            const baseResult = await getSuperAdminDashboardService();

            const queryFilter = {};
            if (args.startDate || args.endDate) {
                queryFilter.appointmentDate = {};
                if (args.startDate) {
                    const sDate = new Date(args.startDate);
                    sDate.setHours(0, 0, 0, 0);
                    queryFilter.appointmentDate.$gte = sDate;
                }
                if (args.endDate) {
                    const eDate = new Date(args.endDate);
                    eDate.setHours(23, 59, 59, 999);
                    queryFilter.appointmentDate.$lte = eDate;
                }
            }

            const overview = baseResult?.overview || {};
            const result = {
                ...baseResult,
                totalOrganizations: overview.totalOrganizations ?? baseResult?.totalOrganizations ?? 0,
                totalAppointments: overview.totalAppointments ?? baseResult?.totalAppointments ?? 0,
                totalPatients: overview.totalPatients ?? baseResult?.totalPatients ?? 0,
                totalDoctors: overview.totalDoctors ?? baseResult?.totalDoctors ?? 0,
                startDate: args.startDate || null,
                endDate: args.endDate || null,
                isAnalytics: true,
                primaryMetric: {
                    label: "Active Organizations",
                    value: overview.totalOrganizations ?? baseResult?.totalOrganizations ?? 0
                }
            };

            // Period growth comparison (this week vs last week / this month vs last month)
            if (args.startDate && args.endDate) {
                const sDate = new Date(args.startDate);
                const eDate = new Date(args.endDate);
                const durationMs = eDate.getTime() - sDate.getTime();
                const priorSDate = new Date(sDate.getTime() - durationMs);
                const priorEDate = new Date(eDate.getTime() - durationMs);

                const currentCount = await AppointmentModel.countDocuments(queryFilter);
                const priorCount = await AppointmentModel.countDocuments({
                    appointmentDate: { $gte: priorSDate, $lte: priorEDate }
                });

                const diff = currentCount - priorCount;
                const growthPercent = priorCount > 0 ? Math.round((diff / priorCount) * 100) : (currentCount > 0 ? 100 : 0);

                result.growth = {
                    currentCount,
                    priorCount,
                    growthPercent,
                    comparisonText: `${growthPercent >= 0 ? '+' : ''}${growthPercent}% (${currentCount} vs ${priorCount} in previous period)`
                };
            }

            const groupBy = args.groupBy || args.group_by;
            if (groupBy) {
                if (groupBy === "department") {
                    const agg = await AppointmentModel.aggregate([
                        { $match: queryFilter },
                        { $group: { _id: "$departmentId", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
                        { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
                        { $project: { name: { $ifNull: ["$dept.name", "General / Unassigned"] }, count: 1 } }
                    ]);
                    result.byDepartment = agg.reduce((acc, curr) => { acc[curr.name] = curr.count; return acc; }, {});
                } else if (groupBy === "dayOfWeek") {
                    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const agg = await AppointmentModel.aggregate([
                        { $match: queryFilter },
                        { $group: { _id: { $dayOfWeek: "$appointmentDate" }, count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ]);
                    result.byDayOfWeek = agg.reduce((acc, curr) => {
                        if (curr._id >= 1 && curr._id <= 7) acc[dayNames[curr._id - 1]] = curr.count;
                        return acc;
                    }, {});
                } else if (groupBy === "doctor") {
                    const agg = await AppointmentModel.aggregate([
                        { $match: queryFilter },
                        { $group: { _id: "$doctorId", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $lookup: { from: "doctors", localField: "_id", foreignField: "_id", as: "doc" } },
                        { $unwind: { path: "$doc", preserveNullAndEmptyArrays: true } },
                        { $lookup: { from: "users", localField: "doc.userId", foreignField: "_id", as: "userDoc" } },
                        { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
                        { $project: { name: { $ifNull: ["$userDoc.name", "Unassigned Doctor"] }, count: 1 } }
                    ]);
                    result.byDoctor = agg.reduce((acc, curr) => { acc[curr.name] = curr.count; return acc; }, {});
                } else if (groupBy === "specialty") {
                    const agg = await AppointmentModel.aggregate([
                        { $match: queryFilter },
                        { $lookup: { from: "doctors", localField: "doctorId", foreignField: "_id", as: "doc" } },
                        { $unwind: { path: "$doc", preserveNullAndEmptyArrays: true } },
                        { $group: { _id: { $ifNull: ["$doc.specialization", "General Medicine"] }, count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ]);
                    result.bySpecialty = agg.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {});
                }
            }

            setCachedStats(cacheKey, result);
            return result;
        }
    },

    // Organization Roster Tool
    getOrganizationRoster: {
        name: "getOrganizationRoster",
        description: "Get roster of clinics/organizations and their assigned doctors (names, specializations, qualifications) and doctor counts per clinic. Super Admin gets platform-wide overview across all clinics; Org Admin/Staff/Doctor gets their organization's roster.",
        allowedRoles: ["super_admin", "admin", "doctor", "patient"],
        isWrite: false,
        execute: async (user, args = {}) => {
            const OrganizationModel = (await import("../../model/organization.js")).default;
            const DoctorModel = (await import("../../model/doctor.js")).default;

            const isSuperAdmin = user.role === "super_admin";
            const userOrgId = user.organizationId?._id || user.organizationId || null;

            let orgQuery = {};
            if (!isSuperAdmin) {
                if (!userOrgId) {
                    return {
                        scope: "organization-scoped",
                        totalOrganizations: 0,
                        totalDoctors: 0,
                        organizations: [],
                        message: "No organization associated with user."
                    };
                }
                orgQuery._id = userOrgId;
            }

            const organizations = await OrganizationModel.find(orgQuery).select("name email phone address status workingHours").lean();

            const orgIds = organizations.map(o => o._id);
            const doctors = await DoctorModel.find({ organizationId: { $in: orgIds } })
                .populate("userId", "name email phone isActive")
                .select("userId specialization qualification consultationFee organizationId")
                .lean();

            const doctorsByOrg = {};
            for (const doc of doctors) {
                const oId = String(doc.organizationId);
                if (!doctorsByOrg[oId]) doctorsByOrg[oId] = [];
                const docName = doc.userId?.name || doc.name || "Doctor";
                doctorsByOrg[oId].push({
                    doctorId: String(doc._id),
                    name: docName,
                    specialization: doc.specialization,
                    qualification: doc.qualification
                });
            }

            const roster = organizations.map(org => {
                const orgDocs = doctorsByOrg[String(org._id)] || [];
                return {
                    organizationId: String(org._id),
                    name: org.name,
                    email: org.email,
                    phone: org.phone,
                    status: org.status,
                    city: org.address?.city || "N/A",
                    doctorCount: orgDocs.length,
                    doctors: orgDocs
                };
            });

            const totalDoctors = roster.reduce((sum, r) => sum + r.doctorCount, 0);

            return {
                scope: isSuperAdmin ? "platform-wide" : "organization-scoped",
                totalOrganizations: roster.length,
                totalDoctors,
                organizations: roster
            };
        }
    },

    // System Health Trends Tool
    getSystemHealthTrends: {
        name: "getSystemHealthTrends",
        description: "Get real-time system performance, DB ping latency, process uptime, and health metrics.",
        allowedRoles: ["admin", "super_admin", "doctor"],
        isWrite: false,
        execute: async (user, args = {}, bypassCache = false) => {
            const cacheKey = `system:getSystemHealthTrends`;
            if (!bypassCache) {
                const cached = getCachedStats(cacheKey);
                if (cached && (Date.now() - (cached.timestampMs || 0)) < 100) return cached;
            }

            const mongoose = (await import("mongoose")).default;
            const startPing = Date.now();
            let dbStatus = "connected";
            try {
                if (mongoose.connection?.db) {
                    await mongoose.connection.db.command({ ping: 1 });
                }
            } catch (e) {
                dbStatus = "degraded";
            }
            const dbLatencyMs = Date.now() - startPing;
            const processUptimeSeconds = Math.floor(process.uptime());
            const heapUsedMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

            const result = {
                dbStatus,
                dbLatencyMs,
                processUptimeSeconds,
                heapUsedMb,
                timestampMs: Date.now()
            };

            setCachedStats(cacheKey, result);
            return result;
        }
    },

    // Payment Stats Tool
    getPaymentStats: {
        name: "getPaymentStats",
        description: "Get payment statistics, total collected revenue, pending payments, refunds, and department breakdown for clinic/organization.",
        allowedRoles: ["admin", "super_admin", "doctor"],
        isWrite: false,
        execute: async (user, args = {}) => {
            const PaymentModel = (await import("../../model/payment.js")).default;
            const UserRepo = await import("../../repository/user.js");

            let orgId = user.organizationId?._id || user.organizationId;
            if (!orgId) {
                const userDoc = await UserRepo.getUserById(user.id || user._id);
                orgId = userDoc?.organizationId?._id || userDoc?.organizationId;
            }

            if (!orgId && user.role !== "super_admin") {
                throw new AppError(403, "Access denied. Organization context is required for payment stats.");
            }

            const cacheKey = `${orgId || 'global'}:getPaymentStats:${args.startDate || 'all'}:${args.endDate || 'all'}`;
            const cached = getCachedStats(cacheKey);
            if (cached) return cached;

            const queryFilter = {};
            if (orgId) {
                queryFilter.organizationId = orgId;
            }

            if (args.startDate || args.endDate) {
                queryFilter.createdAt = {};
                if (args.startDate) {
                    const sDate = new Date(args.startDate);
                    sDate.setHours(0, 0, 0, 0);
                    queryFilter.createdAt.$gte = sDate;
                }
                if (args.endDate) {
                    const eDate = new Date(args.endDate);
                    eDate.setHours(23, 59, 59, 999);
                    queryFilter.createdAt.$lte = eDate;
                }
            }

            const payments = await PaymentModel.find(queryFilter).populate({
                path: "appointmentId",
                populate: { path: "departmentId", select: "name" }
            });

            let totalCollected = 0;
            let pendingAmount = 0;
            let refundedAmount = 0;
            let paidCount = 0;
            let pendingCount = 0;
            let refundedCount = 0;
            const byDepartmentMap = {};

            for (const pmt of payments) {
                const amount = Number(pmt.amount) || 0;
                const status = (pmt.status || '').toLowerCase();
                const deptName = pmt.appointmentId?.departmentId?.name || "General";

                if (status === "paid") {
                    totalCollected += amount;
                    paidCount++;
                    byDepartmentMap[deptName] = (byDepartmentMap[deptName] || 0) + amount;
                } else if (status === "pending" || status === "payment_pending") {
                    pendingAmount += amount;
                    pendingCount++;
                } else if (status === "refunded" || status === "refund_pending") {
                    refundedAmount += (pmt.refundAmount || amount);
                    refundedCount++;
                }
            }

            const result = {
                organizationId: orgId || null,
                startDate: args.startDate || null,
                endDate: args.endDate || null,
                totalCollected,
                pendingAmount,
                refundedAmount,
                totalPaymentsCount: payments.length,
                paidCount,
                pendingCount,
                refundedCount,
                byDepartment: byDepartmentMap
            };

            setCachedStats(cacheKey, result);
            return result;
        }
    },

    // Healthcare Analytics Tool (Unified Platform & Clinic Operational Intelligence)
    getHealthcareAnalytics: {
        name: "getHealthcareAnalytics",
        description: "Execute structured healthcare operational analytics, metrics, growth comparisons, completion/cancellation rates, multi-month trends, rankings, and departmental distributions. Super Admin has platform-wide visibility; Org Admin is strictly scoped to their clinic.",
        allowedRoles: ["super_admin", "admin"],
        isWrite: false,
        execute: async (user, args = {}) => {
            return await executeHealthcareAnalytics(user, args);
        }
    },

    // Doctor Leave / Time-off Tool
    getDoctorLeave: {
        name: "getDoctorLeave",
        description: "Check leave and time-off schedule for a doctor. Doctors can view their own leave; clinic admins and patients can view a specific doctor's scheduled time off.",
        allowedRoles: ["doctor", "admin", "super_admin", "patient"],
        isWrite: false,
        execute: async (user, args = {}) => {
            const DoctorModel = (await import("../../model/doctor.js")).default;
            let targetDoctorId = args.doctorId || null;

            if (!targetDoctorId && user.role === "doctor") {
                const ownDoc = await DoctorModel.findOne({ userId: user.id || user._id }).lean();
                if (ownDoc) targetDoctorId = String(ownDoc._id);
            }

            if (!targetDoctorId && args.doctorName) {
                const UserRepo = await import("../../repository/user.js");
                let orgId = user.organizationId?._id || user.organizationId;
                if (!orgId) {
                    const userDoc = await UserRepo.getUserById(user.id || user._id);
                    orgId = userDoc?.organizationId?._id || userDoc?.organizationId;
                }
                const cleanName = String(args.doctorName).replace(/^dr\.?\s+/i, '').trim().toLowerCase();
                const docs = await DoctorModel.find(orgId ? { organizationId: orgId } : {}).populate("userId", "name");
                const match = docs.find(d => (d.userId?.name || '').toLowerCase().includes(cleanName));
                if (match) targetDoctorId = String(match._id);
            }

            if (!targetDoctorId) {
                return {
                    success: false,
                    message: "Please specify which doctor's leave schedule you would like to view.",
                    leave: []
                };
            }

            const doctor = await DoctorModel.findById(targetDoctorId).populate("userId", "name").lean();
            if (!doctor) {
                return {
                    success: false,
                    message: "Doctor not found.",
                    leave: []
                };
            }

            const doctorName = formatDoctorName(doctor.userId?.name) || "Doctor";
            const leaveList = Array.isArray(doctor.leave) ? doctor.leave : [];

            const queryDate = args.date || args.appointmentDate || null;
            let onLeaveOnDate = null;
            if (queryDate) {
                const targetDateObj = new Date(queryDate + (queryDate.includes("T") ? "" : "T00:00:00.000Z"));
                onLeaveOnDate = leaveList.some(l => {
                    const s = new Date(l.startDate);
                    const e = new Date(l.endDate);
                    s.setHours(0, 0, 0, 0);
                    e.setHours(23, 59, 59, 999);
                    return targetDateObj >= s && targetDateObj <= e;
                });
            }

            return {
                doctorId: String(doctor._id),
                doctorName,
                totalLeavePeriods: leaveList.length,
                queryDate: queryDate || null,
                isOnLeaveOnDate: onLeaveOnDate,
                leave: leaveList.map(l => ({
                    leaveId: String(l._id),
                    startDate: l.startDate ? new Date(l.startDate).toISOString().split("T")[0] : null,
                    endDate: l.endDate ? new Date(l.endDate).toISOString().split("T")[0] : null,
                    reason: l.reason || "Scheduled Time Off"
                }))
            };
        }
    },

    // Doctor Own Profile & Department Query (Rule 6.10)
    getMyDoctorProfile: {
        name: "getMyDoctorProfile",
        description: "Retrieve authenticated doctor's profile, assigned department, specialization, and qualifications.",
        allowedRoles: ["doctor", "admin", "super_admin"],
        isWrite: false,
        execute: async (user) => {
            const DoctorModel = (await import("../../model/doctor.js")).default;
            const doc = await DoctorModel.findOne({ userId: user.id || user._id })
                .populate("userId", "name email phone isActive")
                .populate("departmentId", "name description")
                .populate("organizationId", "name")
                .lean();

            if (!doc) {
                return {
                    success: false,
                    message: "No doctor profile found for your authenticated account."
                };
            }

            const docName = formatDoctorName(doc.userId?.name || doc.name);
            const deptName = doc.departmentId?.name || "General Medicine";
            const specialty = doc.specialization || deptName;
            const orgName = doc.organizationId?.name || "CareFlow Clinic";

            return {
                success: true,
                doctorId: String(doc._id),
                doctorName: docName,
                department: deptName,
                departmentName: deptName,
                specialization: specialty,
                specialty: specialty,
                qualification: doc.qualification || "MD",
                organizationName: orgName,
                message: `You are assigned to the ${deptName} department as a specialist in ${specialty} at ${orgName}.`
            };
        }
    }
};
