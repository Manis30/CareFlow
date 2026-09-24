import { TOOL_DEFINITIONS } from "../tools.js";
import { AppError } from "../../../middleware/errorHandler.js";

/**
 * Tool Executor engine for CareFlow AI Shared Orchestrator.
 * Enforces role-based permissions, tenant isolation, and confirmation gates.
 */
const TOOL_NAME_ALIASES = {
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
    "EXPLAIN_PRESCRIPTIONS": "explainMyPrescriptions",
    "explainMyPrescriptions": "explainMyPrescriptions",
    "GET_MEDICAL_RECORDS": "getMyMedicalRecords",
    "getMyMedicalRecords": "getMyMedicalRecords",
    "SEARCH_DOCUMENTS": "searchMyDocuments",
    "searchMyDocuments": "searchMyDocuments",
    "ASK_DOCUMENT": "searchMyDocuments",
    "SEARCH_DOCTORS": "searchDoctors",
    "searchDoctors": "searchDoctors",
    "GET_ORGANIZATION_ROSTER": "getOrganizationRoster",
    "getOrganizationRoster": "getOrganizationRoster",
    "GET_SYSTEM_HEALTH_TRENDS": "getSystemHealthTrends",
    "getSystemHealthTrends": "getSystemHealthTrends",
    "GET_AUTHORIZED_PATIENT_HISTORY": "getAuthorizedPatientHistory",
    "getAuthorizedPatientHistory": "getAuthorizedPatientHistory"
};

/**
 * Tool Executor engine for CareFlow AI Shared Orchestrator.
 * Enforces role-based permissions, tenant isolation, and confirmation gates.
 */
export const executeOrchestratedTool = async (user, toolName, toolArgs = {}, confirmed = false) => {
    const canonicalToolName = TOOL_NAME_ALIASES[toolName] || toolName;

    if (!canonicalToolName || !TOOL_DEFINITIONS[canonicalToolName]) {
        throw new AppError(400, `Unknown or unregistered tool: '${toolName}'`);
    }

    const tool = TOOL_DEFINITIONS[canonicalToolName];
    const rawRole = user?.role || "patient";
    const userRole = rawRole === "organization_admin" ? "admin" : rawRole;

    // 1. Explicit Role Permission Check (No blanket bypass)
    const allowed = tool.allowedRoles || [];
    if (!allowed.includes(userRole)) {
        throw new AppError(403, `Role '${userRole}' is not authorized to execute tool '${canonicalToolName}'`);
    }

    // 2. Strict Tenant Isolation Enforcement
    // Organization Admins and Doctors are strictly scoped to their own organizationId.
    // Patients are healthcare consumers booking with active network doctors across approved clinics.
    const userOrgId = user?.organizationId?._id || user?.organizationId || null;
    if ((userRole === "admin" || userRole === "doctor" || userRole === "organization_admin") && userOrgId) {
        toolArgs.organizationId = String(userOrgId);
    }

    // 3. Write Gate Check: If write tool and unconfirmed, halt and return CONFIRMATION_REQUIRED payload
    if (tool.isWrite && !confirmed) {
        const previewResult = await tool.execute(user, toolArgs, false);
        return {
            requiresConfirmation: true,
            confirmationRequired: true,
            action: canonicalToolName,
            toolName: canonicalToolName,
            summary: previewResult.summary || `Confirmation required to execute ${canonicalToolName}`,
            payload: previewResult.payload || toolArgs,
            responseType: "CONFIRMATION_REQUIRED"
        };
    }

    // 4. Execution (Read-only or Confirmed Write)
    const result = await tool.execute(user, toolArgs, confirmed);
    return {
        requiresConfirmation: false,
        result
    };
};
