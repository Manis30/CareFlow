import crypto from "crypto";
import { TOOL_DEFINITIONS } from "../tools.js";
import { AppError } from "../../../middleware/errorHandler.js";
import { normalizeRole } from "../roleNormalizer.js";

/**
 * Tool Executor engine for CareFlow AI Shared Orchestrator.
 * Enforces role-based permissions, tenant isolation, structured observation contract,
 * and tool repetition protection. (Rule 6, Rule 9, Section 5, 16, 24)
 */
export const TOOL_NAME_ALIASES = Object.freeze({
    "BOOK_APPOINTMENT": "createAppointmentHold",
    "bookAppointment": "createAppointmentHold",
    "createAppointment": "createAppointmentHold",
    "CANCEL_APPOINTMENT": "cancelAppointment",
    "cancelAppointment": "cancelAppointment",
    "RESCHEDULE_APPOINTMENT": "rescheduleAppointment",
    "rescheduleAppointment": "rescheduleAppointment",
    "CHECK_IN_PATIENT": "checkInPatient",
    "checkInPatient": "checkInPatient",
    "CLASSIFY_SYMPTOMS": "classifySpecialtyFromSymptoms",
    "classifySpecialtyFromSymptoms": "classifySpecialtyFromSymptoms",
    "SUMMARIZE_APPOINTMENT": "summarizeAppointmentContext",
    "summarizeAppointmentContext": "summarizeAppointmentContext",
    "DRAFT_SOAP_NOTES": "draftClinicalNotes",
    "DRAFT_CLINICAL_NOTES": "draftClinicalNotes",
    "draftClinicalNotes": "draftClinicalNotes",
    "DRAFT_PRESCRIPTION": "draftPrescription",
    "draftPrescription": "draftPrescription",
    "GET_HEALTHCARE_ANALYTICS": "getHealthcareAnalytics",
    "getHealthcareAnalytics": "getHealthcareAnalytics",
    "GET_DOCTOR_LEAVE": "getDoctorLeave",
    "getDoctorLeave": "getDoctorLeave",
    "GET_DOCTOR_AVAILABILITY": "getDoctorAvailability",
    "getDoctorAvailability": "getDoctorAvailability",
    "GET_CLINIC_STATS": "getClinicStats",
    "getClinicStats": "getClinicStats",
    "GET_PLATFORM_STATS": "getPlatformStats",
    "getPlatformStats": "getPlatformStats",
    "GET_PAYMENT_STATS": "getPaymentStats",
    "getPaymentStats": "getPaymentStats",
    "price_analysis_tool": "getHealthcareAnalytics",
    "price_analysis": "getHealthcareAnalytics",
    "GET_DOCTOR_PROFILE": "getMyDoctorProfile",
    "getMyDoctorProfile": "getMyDoctorProfile",
    "GET_MY_DEPARTMENT": "getMyDoctorProfile",
    "GET_APPOINTMENTS": "getMyAppointments",
    "getMyAppointments": "getMyAppointments",
    "GET_PRESCRIPTIONS": "getMyPrescriptions",
    "getMyPrescriptions": "getMyPrescriptions",
    "GET_MY_PAYMENTS": "getMyPayments",
    "getMyPayments": "getMyPayments",
    "EXPLAIN_PRESCRIPTIONS": "explainMyPrescriptions",
    "explainMyPrescriptions": "explainMyPrescriptions",
    "GET_MEDICAL_RECORDS": "getMyMedicalRecords",
    "getMyMedicalRecords": "getMyMedicalRecords",
    "SEARCH_DOCUMENTS": "searchMyDocuments",
    "searchMyDocuments": "searchMyDocuments",
    "ASK_DOCUMENT": "searchMyDocuments",
    "SEARCH_DOCTORS": "searchDoctors",
    "searchDoctors": "searchDoctors",
    "GET_DOCTORS": "getDoctors",
    "getDoctors": "getDoctors",
    "GET_ORGANIZATION_ROSTER": "getOrganizationRoster",
    "getOrganizationRoster": "getOrganizationRoster",
    "GET_SYSTEM_HEALTH_TRENDS": "getSystemHealthTrends",
    "getSystemHealthTrends": "getSystemHealthTrends",
    "GET_AUTHORIZED_PATIENT_HISTORY": "getAuthorizedPatientHistory",
    "getAuthorizedPatientHistory": "getAuthorizedPatientHistory",
    "GET_PATIENT_CARE_TIMELINE": "getPatientCareTimeline",
    "getPatientCareTimeline": "getPatientCareTimeline",
    "GET_TODAY_MEDICATIONS": "getTodayMedications",
    "getTodayMedications": "getTodayMedications",
    "GET_MEDICATION_ADHERENCE": "getMedicationAdherence",
    "getMedicationAdherence": "getMedicationAdherence",
    "GET_PROACTIVE_CARE": "getProactivePatientCare",
    "getProactivePatientCare": "getProactivePatientCare",
    "GET_FOLLOW_UP_CARE": "getFollowUpCare",
    "getFollowUpCare": "getFollowUpCare",
    "LOG_DOSE": "logDose",
    "logDose": "logDose",
    "PROPOSE_MEDICATION_SCHEDULE": "proposeMedicationSchedule",
    "proposeMedicationSchedule": "proposeMedicationSchedule",
    "CHECK_PRESCRIPTION_SAFETY": "checkPrescriptionSafety",
    "checkPrescriptionSafety": "checkPrescriptionSafety",
    "doctorApproveMedicationSchedule": "doctorApproveMedicationSchedule",
    "DOCTOR_APPROVE_MEDICATION_SCHEDULE": "doctorApproveMedicationSchedule"
});

/**
 * Computes a deterministic tool-call fingerprint for repetition protection (Section 16).
 */
export const computeToolFingerprint = (toolName, toolArgs = {}) => {
    const canonicalName = TOOL_NAME_ALIASES[toolName] || toolName;
    const cleanArgs = {};
    for (const [k, v] of Object.entries(toolArgs || {})) {
        if (k !== "prompt" && v !== undefined && v !== null) {
            cleanArgs[k] = String(v);
        }
    }
    const sortedKeyPairs = Object.keys(cleanArgs).sort().map(k => `${k}:${cleanArgs[k]}`).join("|");
    return `${canonicalName}#${sortedKeyPairs}`;
};

/**
 * Executes an orchestrated tool with strict validation and standard structured observation contract.
 */
export const executeOrchestratedTool = async (user, toolName, toolArgs = {}, confirmed = false) => {
    const startTime = Date.now();
    const canonicalToolName = TOOL_NAME_ALIASES[toolName] || toolName;

    if (!canonicalToolName || !TOOL_DEFINITIONS[canonicalToolName]) {
        throw new AppError(400, `Unknown or unregistered tool: '${toolName}'`);
    }

    const tool = TOOL_DEFINITIONS[canonicalToolName];
    const userRole = normalizeRole(user?.role);

    // 1. Explicit Role Permission Check (Section 24)
    const allowed = tool.allowedRoles || [];
    if (!allowed.includes(userRole)) {
        throw new AppError(403, `Role '${userRole}' is not authorized to execute tool '${canonicalToolName}'`);
    }

    // 2. Strict Tenant Isolation Enforcement (Section 6, 24)
    // Organization Admins and Doctors are strictly scoped to their own organizationId.
    // Patient access is identity-scoped.
    const userOrgId = user?.organizationId?._id || user?.organizationId || null;
    if ((userRole === "admin" || userRole === "doctor") && userOrgId) {
        toolArgs.organizationId = String(userOrgId);
    }

    // 3. Write Gate Check: If write tool and unconfirmed, halt and return CONFIRMATION_REQUIRED payload
    if (tool.isWrite && !confirmed) {
        const previewResult = await tool.execute(user, toolArgs, false);
        const observation = {
            toolName: canonicalToolName,
            success: true,
            data: previewResult,
            error: null,
            source: "CareFlow Confirmation Gate",
            metadata: {
                isWrite: true,
                confirmed: false,
                durationMs: Date.now() - startTime
            }
        };

        return {
            requiresConfirmation: true,
            confirmationRequired: true,
            action: canonicalToolName,
            toolName: canonicalToolName,
            summary: previewResult.summary || `Confirmation required to execute ${canonicalToolName}`,
            payload: previewResult.payload || toolArgs,
            responseType: "CONFIRMATION_REQUIRED",
            observation,
            result: previewResult
        };
    }

    // 4. Execution (Read-only or Confirmed Write)
    try {
        const result = await tool.execute(user, toolArgs, confirmed);
        const durationMs = Date.now() - startTime;
        const observation = {
            toolName: canonicalToolName,
            success: true,
            data: result,
            error: null,
            source: "CareFlow Service Layer",
            metadata: {
                isWrite: Boolean(tool.isWrite),
                confirmed: Boolean(confirmed),
                durationMs
            }
        };

        return {
            requiresConfirmation: false,
            result,
            observation,
            durationMs
        };
    } catch (err) {
        const durationMs = Date.now() - startTime;
        const observation = {
            toolName: canonicalToolName,
            success: false,
            data: null,
            error: err.message,
            source: "CareFlow Service Layer",
            metadata: {
                isWrite: Boolean(tool.isWrite),
                confirmed: Boolean(confirmed),
                durationMs
            }
        };

        throw Object.assign(err, { observation });
    }
};
