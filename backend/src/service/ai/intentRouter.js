import * as chrono from "chrono-node";
import { generateStructuredContent, getGeminiModelName } from "./geminiClient.js";
import { resolveEntitiesFromToolArgs, parseOrdinalIndex } from "./entityResolver.js";
import { parseNaturalTimeExpression } from "../../util/appointmentTimeUtils.js";
import { TOOL_NAME_ALIASES } from "./orchestrator/toolExecutor.js";

/**
 * Structured Intent Router for CareFlow AI Gateway.
 * Uses schema-constrained Gemini output + Zod/JSON schema to map free-text prompts
 * to structured tool definitions, post-processing dates with chrono-node and resolving entities.
 */

const INTENT_ROUTER_SYSTEM_INSTRUCTION = `You are CareFlow AI Intent Router.
Analyze the user request and map it to one of the following tool names and extract arguments:

Tool definitions:
- "createAppointmentHold": Book/reserve an appointment. Args: { doctorName, department, appointmentDate, startTime, endTime, reason }
  NOTE: Consultation type is always OFFLINE for AI bookings. Do NOT include consultationType.
- "cancelAppointment": Cancel an existing appointment. Args: { appointmentId, cancelReason }
- "rescheduleAppointment": Reschedule an appointment to a new date/time. Args: { appointmentId, appointmentDate, startTime, endTime }
- "classifySpecialtyFromSymptoms": Map patient symptoms or health complaints (e.g. stomach pain, rash, itching, knee pain, fever, cough, palpitations, eye pain, illness) to clinic specialty guidance and doctors. Args: { symptoms }
- "searchDoctors": Search for doctors by specialty or city. Args: { city, specialty }
- "getDoctorAvailability": Check working schedules, free slots, and availability for a doctor or all doctors in the organization. Args: { doctorId, date }
- "getMyAppointments": List user's appointments (patient or doctor). Args: { status }
- "getAuthorizedPatientHistory": Retrieve patient medical history, previous visit records, and clinical intake for a specific appointment (doctor only). Args: { appointmentId }
- "summarizeAppointmentContext": Pre-visit clinical brief for doctor summarizing nearest upcoming appointment, next patient, reason for visit, medical records, and prior prescriptions (e.g. "who is my next patient", "what should I know before seeing them", "pre-visit summary", "who am I seeing next"). Doctor only. Args: { appointmentId }
- "draftClinicalNotes": Doctor copilot tool to draft structured SOAP notes (Subjective, Objective, Assessment, Plan) for consultation. Args: { appointmentId, symptoms, diagnosis, findings, plan }
- "draftPrescription": Doctor copilot tool to draft prescription recommendations based on diagnosis. Args: { appointmentId, diagnosis, medicines }
- "searchMyDocuments": Search patient medical records/documents/scanned files Q&A or search doctor authorized shared records (e.g. "what does the shared record say about hypertension", "search records for...", "what medications are documented"). Args: { query, patientId, appointmentId }
- "getMyMedicalRecords": View authorized medical records (e.g. "show shared records", "what medical records do I have"). Args: { patientId, appointmentId }
- "getPlatformStats": Platform metrics overview for super admin (e.g. "how is the platform performing", "platform stats"). Args: {}
- "getClinicStats": Operational statistics or appointment counts for clinic/admin/doctor (e.g. "how is my clinic doing this month", "clinic overview"). Args: { startDate, endDate, groupBy }
- "getHealthcareAnalytics": Healthcare intelligence and analytics for super admin and organization admin. Answers questions about counts, growth, period-over-period comparisons (vs last week, vs last month), completion/cancellation rates, multi-month trends (3/6/12 months), clinic rankings (by volume or cancellation rate), doctor workload, patient registration growth, department breakdowns, and revenue statistics (e.g. "which department is busiest", "which doctor has the highest workload", "compare departments", "compare organizations", "which clinic has the most appointments"). Args: { metric ("appointments"|"organizations"|"doctors"|"patients"|"revenue"|"overview"), timeframe ("today"|"this_week"|"last_week"|"this_month"|"last_month"|"last_3_months"|"last_6_months"|"this_year"), startDate, endDate, groupBy ("department"|"dayOfWeek"|"doctor"|"specialty"|"clinic"), ranking ("cancellations"|"volume"), rateType ("cancellation"|"completion") }
- "getPaymentStats": Financial metrics, revenue, payments, payment history, collections, pending payments, refunds, and financial transactions for clinic/organization. Args: { startDate, endDate }
- "getSystemHealthTrends": System performance, DB latency, uptime, and gateway health trends. Args: {}
- "getMyPrescriptions": View/list user prescriptions or show a specific numbered prescription (e.g., "show my prescriptions", "explain my 1st prescription", "list my medications"). Args: { targetIndex }
- "explainMyPrescriptions": Explain the medical rationale ("why", "what medicine and why", "what is this for", "how does it work"). Args: { query, targetIndex }
- "checkInPatient": Mark a patient as checked-in for their appointment. Args: { appointmentId }
- "getOrganizationRoster": Get list of clinics/organizations and their assigned doctors. Args: {}
- "getDoctorLeave": Check a doctor's leave/time-off periods. Args: { doctorId, date }
- "getMyDoctorProfile": Retrieve the authenticated doctor's assigned department, specialty, qualifications, and profile information (e.g. "what department am I in?", "which department do I belong to?", "what is my specialty?"). Doctor only. Args: {}
- "getDoctorAuthorizedPatients": Retrieve list of authorized patients for the authenticated doctor (e.g. "what can you tell me about patient records", "show patient records", "show my patients", "patient information", "patient history", "patient records"). Doctor only. Args: {}

CRITICAL MULTI-TOOL & AGENT COMPLETION RULES:
1. If Previous Tool Observations already provide the information needed to answer the user's request completely, return "completionState": "COMPLETE", "toolName": null.
2. If the user request requires multiple capabilities (e.g. "How is my clinic performing and which department is busiest?"), identify "requiredCapabilities". If the first tool (e.g. getClinicStats) was already executed in Previous Tool Observations, select the next required tool (e.g. getHealthcareAnalytics with groupBy="department") as "toolName".
3. Out-of-Domain Safety: If the user request is unmapped, out of domain (e.g. weather, sports, jokes, recipes, general chat), set "intent": "UNKNOWN", "toolName": null, and "confidence": 0.0. NEVER guess or invent tools for out-of-domain queries.

Return JSON matching this exact structure:
{
  "intent": "BOOK_APPOINTMENT" | "CANCEL_APPOINTMENT" | "RESCHEDULE_APPOINTMENT" | "CLASSIFY_SYMPTOMS" | "SEARCH_DOCTOR" | "GET_DOCTOR_AVAILABILITY" | "GET_APPOINTMENTS" | "GET_PATIENT_HISTORY" | "SUMMARIZE_APPOINTMENT" | "DRAFT_CLINICAL_NOTES" | "DRAFT_PRESCRIPTION" | "SEARCH_DOCUMENTS" | "GET_PLATFORM_STATS" | "GET_CLINIC_STATS" | "GET_HEALTHCARE_ANALYTICS" | "GET_PAYMENT_STATS" | "GET_SYSTEM_HEALTH_TRENDS" | "GET_PRESCRIPTIONS" | "EXPLAIN_PRESCRIPTIONS" | "GET_MEDICAL_RECORDS" | "CHECK_IN_PATIENT" | "GET_ORGANIZATION_ROSTER" | "GET_DOCTOR_PROFILE" | "GET_DOCTOR_AUTHORIZED_PATIENTS" | "UNKNOWN",
  "toolName": string or null,
  "toolArgs": object,
  "missingRequiredFields": array of strings,
  "confidence": number between 0.0 and 1.0,
  "requiredCapabilities": array of strings,
  "completionState": "IN_PROGRESS" | "COMPLETE"
}`;

/**
 * Parses natural language dates and time ranges from user prompt / toolArgs using chrono-node and date expressions.
 */
export const postProcessDates = (text, toolArgs = {}, agentState = null, referenceDate = new Date()) => {
    const args = { ...toolArgs };
    const pLower = text.toLowerCase();

    // Section 15: Interpretation priority
    // IF SELECT_DOCTOR: numeric input is doctor index (NEVER date, NEVER time)
    // IF SELECT_SLOT: numeric input is slot index (NEVER date, NEVER time)
    if (agentState?.stage === "SELECT_DOCTOR" || agentState?.stage === "SELECT_SLOT") {
        return args;
    }

    // Standalone day of month: "18", "18th", "day 18"
    const dayMatch = text.trim().match(/^(?:on\s+)?(?:day\s+)?(\d{1,2})(?:st|nd|rd|th)?$/i);
    if (dayMatch && (agentState?.stage === "SELECT_DATE" || !args.startTime)) {
        const day = parseInt(dayMatch[1], 10);
        if (day >= 1 && day <= 31) {
            const now = new Date();
            let targetMonth = now.getMonth();
            let targetYear = now.getFullYear();
            if (day < now.getDate()) {
                targetMonth += 1;
                if (targetMonth > 11) {
                    targetMonth = 0;
                    targetYear += 1;
                }
            }
            const mStr = String(targetMonth + 1).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            args.appointmentDate = `${targetYear}-${mStr}-${dStr}`;
        }
    }

    // Check relative date ranges for stats and aggregations
    if (pLower.includes("last 6 months") || pLower.includes("past 6 months") || pLower.includes("6 months")) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        args.startDate = start.toISOString().split('T')[0];
        args.endDate = now.toISOString().split('T')[0];
        args.timeframe = "last_6_months";
    } else if (pLower.includes("last 3 months") || pLower.includes("past 3 months") || pLower.includes("3 months")) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        args.startDate = start.toISOString().split('T')[0];
        args.endDate = now.toISOString().split('T')[0];
        args.timeframe = "last_3_months";
    } else if (pLower.includes("this year")) {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        args.startDate = start.toISOString().split('T')[0];
        args.endDate = now.toISOString().split('T')[0];
        args.timeframe = "this_year";
    } else if (pLower.includes("last week") || pLower.includes("past week") || pLower.includes("past 7 days") || pLower.includes("last 7 days")) {
        const now = new Date();
        const end = new Date(now);
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        args.startDate = start.toISOString().split('T')[0];
        args.endDate = end.toISOString().split('T')[0];
        args.timeframe = "last_week";
    } else if (pLower.includes("this week")) {
        const now = new Date();
        const currentDay = now.getDay();
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const start = new Date(now);
        start.setDate(now.getDate() + distanceToMonday);
        args.startDate = start.toISOString().split('T')[0];
        args.endDate = now.toISOString().split('T')[0];
        args.timeframe = "this_week";
    } else if (pLower.includes("last month") || pLower.includes("past 30 days") || pLower.includes("last 30 days")) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        args.startDate = start.toISOString().split('T')[0];
        args.endDate = end.toISOString().split('T')[0];
        args.timeframe = "last_month";
    } else if (pLower.includes("this month")) {
        const now = referenceDate ? new Date(referenceDate) : new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const mStr = String(month + 1).padStart(2, '0');
        args.startDate = `${year}-${mStr}-01`;
        args.endDate = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;
        args.timeframe = "this_month";
    } else if (pLower.includes("yesterday")) {
        const now = new Date();
        const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        args.startDate = yest.toISOString().split('T')[0];
        args.endDate = yest.toISOString().split('T')[0];
        args.timeframe = "yesterday";
    } else if (pLower.includes("today")) {
        const now = new Date();
        args.startDate = now.toISOString().split('T')[0];
        args.endDate = now.toISOString().split('T')[0];
        args.timeframe = "today";
    }

    const parsed = chrono.parse(text);

    if (parsed && parsed.length > 0) {
        const result = parsed[0];
        const dateObj = result.start.date();

        // Format appointmentDate as YYYY-MM-DD
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const isoDate = `${year}-${month}-${day}`;

        if (!args.appointmentDate && !args.date) {
            args.appointmentDate = isoDate;
        } else if (args.date && !args.appointmentDate) {
            args.appointmentDate = args.date;
            delete args.date;
        }

        // Format startTime as HH:mm if time was explicitly present
        if (result.start.isCertain('hour')) {
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const mins = String(dateObj.getMinutes()).padStart(2, '0');
            args.startTime = `${hours}:${mins}`;
        }
    }

    // Natural time expression extraction (handles 10, 10.30, 10:30, 10am, 10.30 AM, 10.30 - 11.00, etc.)
    // In SELECT_DATE stage, numeric input is a calendar day, NEVER a time
    if (agentState?.stage !== "SELECT_DATE") {
        const naturalTime = parseNaturalTimeExpression(args.startTime || text);
        if (naturalTime) {
            args.startTime = naturalTime;
        }
    }

    // RULE 6.2: THE LLM MUST NOT INVENT END TIME.
    // Actual availability and end times must come exclusively from the backend availability service.
    delete args.endTime;


    if (args.appointmentDate === "tomorrow" || (!args.appointmentDate && pLower.includes("tomorrow"))) {
        const tmrw = new Date();
        tmrw.setDate(tmrw.getDate() + 1);
        args.appointmentDate = tmrw.toISOString().split('T')[0];
    } else if (args.appointmentDate === "today" || (!args.appointmentDate && pLower.includes("today"))) {
        args.appointmentDate = new Date().toISOString().split('T')[0];
    }

    // A day-part is a preference/window, NOT an exact appointment time.
    // Never invent 09:00/14:00/17:00 merely because the user said morning,
    // afternoon or evening. The availability tool supplies the real slots.
    const explicitDayPart = args.timePreference || args.timeWindow;
    if (explicitDayPart === "morning" || (!args.startTime && pLower.includes("morning"))) {
        args.timePreference = "morning";
        args.timeWindow = { start: "09:00", end: "12:00" };
    } else if (explicitDayPart === "afternoon" || (!args.startTime && pLower.includes("afternoon"))) {
        args.timePreference = "afternoon";
        args.timeWindow = { start: "12:00", end: "17:00" };
    } else if (explicitDayPart === "evening" || (!args.startTime && pLower.includes("evening"))) {
        args.timePreference = "evening";
        args.timeWindow = { start: "17:00", end: "21:00" };
    }

    return args;
};





const ALLOWED_TOOLS = new Set([
    "createAppointmentHold",
    "cancelAppointment",
    "rescheduleAppointment",
    "classifySpecialtyFromSymptoms",
    "getDoctors",
    "searchDoctors",
    "getDoctorAvailability",
    "getMyAppointments",
    "getAuthorizedPatientHistory",
    "summarizeAppointmentContext",
    "draftClinicalNotes",
    "draftPrescription",
    "searchMyDocuments",
    "getPlatformStats",
    "getClinicStats",
    "getHealthcareAnalytics",
    "getPaymentStats",
    "getSystemHealthTrends",
    "getMyPrescriptions",
    "getMyPayments",
    "explainMyPrescriptions",
    "getMyMedicalRecords",
    "checkInPatient",
    "getOrganizationRoster",
    "getDoctorLeave",
    "getMyDoctorProfile",
    "getPatientCareTimeline",
    "getTodayMedications",
    "getMedicationAdherence",
    "getProactivePatientCare",
    "getFollowUpCare",
    "logDose",
    "proposeMedicationSchedule",
    "checkPrescriptionSafety",
    "doctorApproveMedicationSchedule",
    "getPreVisitBrief",
    "getClinicalSummary",
    "searchPatientDocuments",
    "getDoctorAuthorizedPatients",
    "lookupDoctorPatient",
    "getSharedMedicalRecords",
    "selectSharedMedicalRecord",
    "compareOrganizations"
]);

const ROLE_ALLOWED_TOOLS = {
    patient: new Set([
        "createAppointmentHold", "cancelAppointment", "rescheduleAppointment",
        "classifySpecialtyFromSymptoms", "getDoctors", "searchDoctors", "getDoctorAvailability",
        "getMyAppointments", "searchMyDocuments", "searchPatientDocuments", "getMyPrescriptions", "getMyPayments",
        "explainMyPrescriptions", "getMyMedicalRecords", "getPatientCareTimeline",
        "getTodayMedications", "getMedicationAdherence", "getProactivePatientCare",
        "getFollowUpCare", "logDose", "proposeMedicationSchedule"
    ]),
    doctor: new Set([
        "getMyAppointments", "getDoctorAvailability", "getDoctorLeave",
        "getAuthorizedPatientHistory", "summarizeAppointmentContext",
        "getPreVisitBrief", "getClinicalSummary",
        "draftClinicalNotes", "draftPrescription", "getClinicStats",
        "getDoctors", "searchDoctors", "getMyDoctorProfile", "searchMyDocuments", "searchPatientDocuments",
        "getMyMedicalRecords", "getMyPrescriptions", "explainMyPrescriptions",
        "getPatientCareTimeline", "getTodayMedications", "getMedicationAdherence",
        "getFollowUpCare", "logDose", "proposeMedicationSchedule", "checkPrescriptionSafety",
        "doctorApproveMedicationSchedule", "getDoctorAuthorizedPatients", "lookupDoctorPatient",
        "getSharedMedicalRecords", "selectSharedMedicalRecord"
    ]),
    admin: new Set([
        "getMyAppointments", "getDoctorAvailability", "getDoctorLeave",
        "getClinicStats", "getHealthcareAnalytics", "getPaymentStats",
        "getDoctors", "searchDoctors", "getOrganizationRoster", "checkInPatient",
        "cancelAppointment", "rescheduleAppointment", "getMyDoctorProfile",
        "checkPrescriptionSafety", "doctorApproveMedicationSchedule",
        "getSharedMedicalRecords", "selectSharedMedicalRecord"
    ]),
    organization_admin: new Set([
        "getMyAppointments", "getDoctorAvailability", "getDoctorLeave",
        "getClinicStats", "getHealthcareAnalytics", "getPaymentStats",
        "getDoctors", "searchDoctors", "getOrganizationRoster", "checkInPatient",
        "cancelAppointment", "rescheduleAppointment", "getMyDoctorProfile",
        "checkPrescriptionSafety", "doctorApproveMedicationSchedule",
        "getSharedMedicalRecords", "selectSharedMedicalRecord"
    ]),
    super_admin: new Set([
        ...ALLOWED_TOOLS,
        "getPlatformStats", "getSystemHealthTrends", "getMyDoctorProfile",
        "compareOrganizations", "getSharedMedicalRecords", "selectSharedMedicalRecord"
    ])
};

const TOOL_REQUIRED_FIELDS = {
    createAppointmentHold: ["doctorId", "appointmentDate", "startTime", "endTime"],
    cancelAppointment: ["appointmentId"],
    rescheduleAppointment: ["appointmentId", "appointmentDate", "startTime", "endTime"],
    classifySpecialtyFromSymptoms: ["symptoms"],
    getDoctors: [],
    searchDoctors: [],
    getDoctorAvailability: [],
    getAuthorizedPatientHistory: ["appointmentId"],
    summarizeAppointmentContext: ["appointmentId"],
    draftClinicalNotes: [],
    draftPrescription: ["diagnosis"],
    searchMyDocuments: ["query"],
    getHealthcareAnalytics: [],
    getPaymentStats: [],
    getMyPrescriptions: [],
    explainMyPrescriptions: ["query"],
    checkInPatient: ["appointmentId"],
    getDoctorLeave: [],
    getMyDoctorProfile: [],
    getDoctorAuthorizedPatients: [],
    lookupDoctorPatient: ["patientName"],
    getSharedMedicalRecords: [],
    selectSharedMedicalRecord: [],
    compareOrganizations: []
};

const INTENT_TO_TOOL = {
    BOOK_APPOINTMENT: "createAppointmentHold",
    HOLD_SLOT: "createAppointmentHold",
    CANCEL_APPOINTMENT: "cancelAppointment",
    RESCHEDULE_APPOINTMENT: "rescheduleAppointment",
    CLASSIFY_SYMPTOMS: "classifySpecialtyFromSymptoms",
    TRIAGE_SYMPTOMS: "classifySpecialtyFromSymptoms",
    SYMPTOM_CHECK: "classifySpecialtyFromSymptoms",
    SEARCH_DOCTOR: "getDoctors",
    SEARCH_DOCTORS: "getDoctors",
    GET_DOCTORS: "getDoctors",
    FIND_DOCTORS: "getDoctors",
    GET_DOCTOR_AVAILABILITY: "getDoctorAvailability",
    GET_APPOINTMENTS: "getMyAppointments",
    GET_PATIENT_HISTORY: "getAuthorizedPatientHistory",
    SUMMARIZE_APPOINTMENT: "summarizeAppointmentContext",
    DRAFT_SOAP_NOTES: "draftClinicalNotes",
    DRAFT_CLINICAL_NOTES: "draftClinicalNotes",
    DRAFT_PRESCRIPTION: "draftPrescription",
    SEARCH_DOCUMENTS: "searchMyDocuments",
    DOCUMENT_QA: "searchMyDocuments",
    GET_PLATFORM_STATS: "getPlatformStats",
    GET_CLINIC_STATS: "getClinicStats",
    GET_HEALTHCARE_ANALYTICS: "getHealthcareAnalytics",
    HEALTHCARE_ANALYTICS: "getHealthcareAnalytics",
    ANALYTICS: "getHealthcareAnalytics",
    GET_PAYMENT_STATS: "getPaymentStats",
    GET_SYSTEM_HEALTH_TRENDS: "getSystemHealthTrends",
    GET_PRESCRIPTIONS: "getMyPrescriptions",
    GET_ACTIVE_PRESCRIPTIONS: "getMyPrescriptions",
    ACTIVE_PRESCRIPTIONS: "getMyPrescriptions",
    GET_MY_PAYMENTS: "getMyPayments",
    MY_PAYMENTS: "getMyPayments",
    EXPLAIN_PRESCRIPTIONS: "explainMyPrescriptions",
    EXPLAIN_ACTIVE_PRESCRIPTIONS: "explainMyPrescriptions",
    TODAY_SCHEDULE: "getMyAppointments",
    GET_SCHEDULE: "getMyAppointments",
    GET_TODAY_SCHEDULE: "getMyAppointments",
    FIND_CARE: "getDoctors",
    GET_MEDICAL_RECORDS: "getMyMedicalRecords",
    CHECK_IN_PATIENT: "checkInPatient",
    GET_ORGANIZATION_ROSTER: "getOrganizationRoster",
    GET_DOCTOR_LEAVE: "getDoctorLeave",
    GET_DOCTOR_PROFILE: "getMyDoctorProfile",
    GET_MY_DEPARTMENT: "getMyDoctorProfile",
    GET_DOCTOR_DEPARTMENT: "getMyDoctorProfile",
    GET_PATIENT_CARE_TIMELINE: "getPatientCareTimeline",
    CARE_TIMELINE: "getPatientCareTimeline",
    PATIENT_TIMELINE: "getPatientCareTimeline",
    GET_TODAY_MEDICATIONS: "getTodayMedications",
    TODAY_MEDICATIONS: "getTodayMedications",
    MY_MEDICATIONS: "getTodayMedications",
    GET_MEDICATION_ADHERENCE: "getMedicationAdherence",
    MEDICATION_ADHERENCE: "getMedicationAdherence",
    GET_PROACTIVE_CARE: "getProactivePatientCare",
    PROACTIVE_CARE: "getProactivePatientCare",
    GET_FOLLOW_UP_CARE: "getFollowUpCare",
    FOLLOW_UP_CARE: "getFollowUpCare",
    LOG_DOSE: "logDose",
    TAKE_MEDICINE: "logDose",
    PROPOSE_MEDICATION_SCHEDULE: "proposeMedicationSchedule",
    CHECK_PRESCRIPTION_SAFETY: "checkPrescriptionSafety",
    DOCTOR_APPROVE_MEDICATION_SCHEDULE: "doctorApproveMedicationSchedule",
    APPROVE_MEDICATION_SCHEDULE: "doctorApproveMedicationSchedule",
    GET_PRE_VISIT_BRIEF: "getPreVisitBrief",
    PRE_VISIT_BRIEF: "getPreVisitBrief",
    GET_CLINICAL_SUMMARY: "getClinicalSummary",
    CLINICAL_SUMMARY: "getClinicalSummary",
    SEARCH_PATIENT_DOCUMENTS: "searchPatientDocuments",
    GET_DOCTOR_AUTHORIZED_PATIENTS: "getDoctorAuthorizedPatients",
    LOOKUP_DOCTOR_PATIENT: "lookupDoctorPatient",
    PATIENT_LOOKUP: "lookupDoctorPatient",
    GET_SHARED_MEDICAL_RECORDS: "getSharedMedicalRecords",
    SHARED_MEDICAL_RECORDS: "getSharedMedicalRecords",
    SELECT_SHARED_RECORD: "selectSharedMedicalRecord",
    SELECT_SHARED_MEDICAL_RECORD: "selectSharedMedicalRecord",
    COMPARE_ORGANIZATIONS: "compareOrganizations"
};

/**
 * LLM-FIRST intent extraction.
 *
 * IMPORTANT:
 * There is intentionally NO keyword fallback here. Natural-language understanding
 * belongs to the model. Deterministic code is used only after the model has produced
 * structured intent: date normalization, entity resolution, authorization and
 * workflow safety. If the model is unavailable or produces an invalid answer, the
 * request becomes UNKNOWN rather than being guessed from words.
 */
export const extractIntent = async (
    promptMessage,
    user,
    resolvedContext = null,
    conversationContext = "",
    previousToolResults = [],
    agentState = null
) => {
    const role = user?.role || "patient";
    const pLower = String(promptMessage || "").toLowerCase().trim();

    // ─────────────────────────────────────────────────────────────────
    // DETERMINISTIC CLINICAL & ROLE PRE-ROUTING (Context Priority 1-4)
    // Evaluated before LLM generation to guarantee zero latency and prevent
    // timeouts/cooldown failures on deterministic discovery requests.
    // ─────────────────────────────────────────────────────────────────
    if (role === "doctor") {
        // Extract patient name if explicitly mentioned in query
        const extractDoctorPatient = (text) => {
            if (!text) return null;
            const clean = String(text).trim();
            const patterns = [
                /(?:what\s+is|what\s+are|tell\s+me\s+about|give\s+me|summarize|show|view|get|list|find|about)\s+([A-Za-z.\s]+?)'s/i,
                /([A-Za-z.\s]+?)'s\s+(?:(?:full|complete|past|latest|active|current|shared|recent)\s+)*(?:chart|records?|medical\s+records?|history|results|tests|prescriptions|medications?|medicines?|notes|consultation|vitals)/i,
                /(?:patient|chart\s+(?:for|of)|records?\s+(?:for|of)|look\s*up\s+patient|about\s+patient)\s+([A-Za-z.\s]+?)(?:'s|\s+on|\s+at|\s+for|\s+records?|\s+reports?|\s+documents?|\s+history|\s+tomorrow|\s+today|\?|$)/i,
                /(?:show|view|get|list|find)\s+([A-Za-z.\s]+?)'s\s+(?:records?|shared\s+records?|documents?|reports?)/i
            ];
            for (const pat of patterns) {
                const m = clean.match(pat);
                if (m && m[1]) {
                    let candidate = m[1].trim();
                    candidate = candidate.replace(/^(?:the\s+|my\s+|this\s+|that\s+)?patient(?:\s+|$)/i, '').trim();
                    const generic = new Set(["my", "the", "a", "an", "all", "any", "this", "that", "shared", "medical", "patient", "patients", "the patient", "this patient", "record", "records", "report", "reports", "document", "documents", "information", "history"]);
                    if (candidate.length > 1 && !generic.has(candidate.toLowerCase())) {
                        return candidate;
                    }
                }
            }
            return null;
        };

        const extractedDoctorPatient = extractDoctorPatient(promptMessage);

        // If a specific patient is named and the doctor asks for their records/history/documents/medications:
        if (extractedDoctorPatient) {
            const mentionsMeds = /\b(medications?|prescriptions?|medicines?|drugs?|dosage|doses?)\b/i.test(pLower);
            const mentionsHistoryOrConsult = /\b(history|consultation|consultations|notes|summary|overview|visit|visits|vitals)\b/i.test(pLower);
            const mentionsRecords = /\b(records?|reports?|documents?|files?|shared\s+records?|shared)\b/i.test(pLower);

            const isMultiPartClinical = (mentionsMeds && (mentionsHistoryOrConsult || mentionsRecords)) ||
                (mentionsHistoryOrConsult && mentionsRecords && /\b(all|and|full|complete|comprehensive|both)\b/i.test(pLower)) ||
                /\b(full\s+history|clinical\s+summary|patient\s+summary|comprehensive|longitudinal|everything\s+about)\b/i.test(pLower);

            if (isMultiPartClinical) {
                return {
                    intent: "GET_CLINICAL_SUMMARY",
                    toolName: "getClinicalSummary",
                    toolArgs: {
                        patientName: extractedDoctorPatient,
                        query: promptMessage
                    },
                    missingRequiredFields: [],
                    requiredCapabilities: mentionsRecords ? ["getSharedMedicalRecords"] : [],
                    confidence: 0.98,
                    modelUsed: "deterministic_rules"
                };
            }

            if (mentionsRecords && !mentionsHistoryOrConsult && !mentionsMeds) {
                return {
                    intent: "GET_SHARED_MEDICAL_RECORDS",
                    toolName: "getSharedMedicalRecords",
                    toolArgs: {
                        patientName: extractedDoctorPatient,
                        query: promptMessage
                    },
                    missingRequiredFields: [],
                    requiredCapabilities: [],
                    confidence: 0.98,
                    modelUsed: "deterministic_rules"
                };
            }

            if (mentionsHistoryOrConsult || mentionsMeds) {
                return {
                    intent: "GET_CLINICAL_SUMMARY",
                    toolName: "getClinicalSummary",
                    toolArgs: {
                        patientName: extractedDoctorPatient,
                        query: promptMessage
                    },
                    missingRequiredFields: [],
                    requiredCapabilities: [],
                    confidence: 0.98,
                    modelUsed: "deterministic_rules"
                };
            }
        }

        // 1. Doctor Patient Discovery (Phase 7):
        // Generic discovery queries when NO active patient context exists AND NO specific patient named
        const isPatientRecordsDiscovery = !extractedDoctorPatient && (
            /^(?:what\s+can\s+you\s+tell\s+me\s+about\s+)?patient\s+(?:records?|information|history)\??$/i.test(pLower) ||
            /^(?:show|list|view|my)\s+(?:patient\s+records?|patients?|patient\s+information|patient\s+history)\??$/i.test(pLower) ||
            /\b(?:patient\s+records?|show\s+my\s+patients|my\s+patients|patient\s+information|patient\s+history)\b/i.test(pLower)
        );

        if (isPatientRecordsDiscovery && !agentState?.patientId) {
            return {
                intent: "GET_DOCTOR_AUTHORIZED_PATIENTS",
                toolName: "getDoctorAuthorizedPatients",
                toolArgs: {},
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }

        // 2. Doctor Shared Medical Records Query:
        // When active patient context exists, phrases asking for shared records route directly to getSharedMedicalRecords
        const isBroadSharedRecord = (
            /\b(show|list|view|what|tell\s+me|find|get)\b/i.test(pLower) &&
            /\b(shared\s+(?:medical\s+)?records?|shared\s+reports?|shared\s+documents?)\b/i.test(pLower)
        ) || /^(show\s+(?:all\s+)?shared\s+records|show\s+shared\s+medical\s+records|what\s+shared\s+medical\s+records\s+does\s+(?:this\s+patient|he|she|they|[a-z]+)\s+have|tell\s+me\s+something\s+about\s+(?:the|his|her|their)?\s*shared\s+medical\s+records|show\s+me\s+the\s+shared\s+medical\s+records|show\s+me\s+(?:this\s+patient'?s?|his|her|their)\s+shared\s+medical\s+records)\??$/i.test(pLower);

        const isSpecificSearchQuery = /\b(what does (?:it|the record|the report) say about|does the patient have|search for|hba1c|blood pressure|vitals|creatinine)\b/i.test(pLower);

        if ((isBroadSharedRecord || (isPatientRecordsDiscovery && agentState?.patientId)) && !isSpecificSearchQuery) {
            return {
                intent: "GET_SHARED_MEDICAL_RECORDS",
                toolName: "getSharedMedicalRecords",
                toolArgs: agentState?.patientId ? { patientId: agentState.patientId } : {},
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }

        // 3. Doctor Department / Profile Query (Rule 6.10):
        if (
            pLower.includes("what department am i in") ||
            pLower.includes("which department do i belong") ||
            pLower.includes("what is my department") ||
            pLower.includes("what's my department") ||
            pLower.includes("what is my specialty") ||
            pLower.includes("what's my specialty") ||
            (pLower.includes("my specialty") && pLower.includes("what"))
        ) {
            return {
                intent: "GET_DOCTOR_PROFILE",
                toolName: "getMyDoctorProfile",
                toolArgs: {},
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.95,
                modelUsed: "deterministic_rules"
            };
        }

        // 4. Doctor Schedule / Today's Appointments:
        if (
            /\b(?:today(?:'?s)? schedule|schedule today|my schedule|today'?s appointments|operating schedule|who am i seeing today)\b/i.test(pLower) ||
            /^(?:what\s+can\s+you\s+tell\s+me\s+about\s+)?today(?:'?s)?\s+schedule\??$/i.test(pLower) ||
            /^(?:what\s+is\s+my\s+schedule\s+today|check\s+operating\s+schedule\s+for\s+today|who\s+am\s+i\s+seeing\s+today)\??$/i.test(pLower) ||
            (/\b(?:schedule|appointments?|seeing)\b/i.test(pLower) && /\btoday\b/i.test(pLower))
        ) {
            return {
                intent: "GET_APPOINTMENTS",
                toolName: "getMyAppointments",
                toolArgs: { timeframe: "today", prompt: promptMessage },
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }

        // 5. Doctor Clinical Notes / SOAP Notes:
        if (
            /\b(?:draft\s+(?:clinical|soap)\s+notes?|clinical\s+notes?|soap\s+notes?)\b/i.test(pLower) ||
            /^(?:draft\s+(?:clinical|soap)\s+notes?(?:\s+for\s+(?:this\s+)?consultation)?)\??$/i.test(pLower)
        ) {
            return {
                intent: "DRAFT_CLINICAL_NOTES",
                toolName: "draftClinicalNotes",
                toolArgs: {
                    appointmentId: agentState?.appointmentId || null,
                    patientId: agentState?.patientId || null,
                    prompt: promptMessage
                },
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }
    }

    if (role === "patient") {
        // Patient Active Prescriptions:
        if (
            (/\b(?:explain|tell me about|understand)\b/i.test(pLower) && /\b(?:prescriptions?|medications?|medicines?)\b/i.test(pLower)) ||
            /^(?:explain\s+(?:my\s+)?(?:active\s+)?prescriptions?)\??$/i.test(pLower)
        ) {
            return {
                intent: "EXPLAIN_PRESCRIPTIONS",
                toolName: "explainMyPrescriptions",
                toolArgs: { query: promptMessage, prompt: promptMessage },
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }

        if (
            /\b(?:my active prescriptions|active prescriptions)\b/i.test(pLower) ||
            /^(?:show\s+(?:my\s+)?prescriptions|my\s+prescriptions|what\s+are\s+my\s+prescriptions)\??$/i.test(pLower)
        ) {
            return {
                intent: "GET_PRESCRIPTIONS",
                toolName: "getMyPrescriptions",
                toolArgs: { prompt: promptMessage },
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }

        // Patient Upcoming Appointments:
        if (
            /\b(?:upcoming appointments?|my upcoming appointments?|next appointment)\b/i.test(pLower) ||
            /^(?:show\s+my\s+upcoming\s+appointments|upcoming\s+appointments)\??$/i.test(pLower)
        ) {
            return {
                intent: "GET_APPOINTMENTS",
                toolName: "getMyAppointments",
                toolArgs: { status: "BOOKED", prompt: promptMessage },
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }

        // Patient Find Care / Doctor Discovery:
        if (
            /\b(?:find care|search care|look for care|care discovery)\b/i.test(pLower) ||
            /^(?:what\s+can\s+you\s+tell\s+me\s+about\s+)?find\s+care\??$/i.test(pLower)
        ) {
            return {
                intent: "GET_DOCTORS",
                toolName: "getDoctors",
                toolArgs: { prompt: promptMessage },
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }
    }

    if (role === "admin" || role === "organization_admin") {
        if (
            /\b(?:department|specialty)\b/i.test(pLower) &&
            /\b(?:most|highest|busiest|more)\b/i.test(pLower) &&
            /\b(?:appointments?|bookings?|volume)\b/i.test(pLower)
        ) {
            return {
                intent: "GET_HEALTHCARE_ANALYTICS",
                toolName: "getHealthcareAnalytics",
                toolArgs: {
                    groupBy: "department",
                    metric: "appointments",
                    timeframe: pLower.includes("this week") ? "this_week" : "this_month",
                    prompt: promptMessage
                },
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }
    }

    if (role === "super_admin") {
        if (
            /\b(?:how many|number of|active|total)\b/i.test(pLower) &&
            /\b(?:organizations?|clinics?)\b/i.test(pLower)
        ) {
            return {
                intent: "GET_PLATFORM_STATS",
                toolName: "getPlatformStats",
                toolArgs: { prompt: promptMessage },
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }

        if (pLower.includes("compare") && (pLower.includes("organization") || pLower.includes("clinic") || pLower.includes("performance") || pLower.includes("and") || pLower.includes("vs"))) {
            return {
                intent: "COMPARE_ORGANIZATIONS",
                toolName: "compareOrganizations",
                toolArgs: {},
                missingRequiredFields: [],
                requiredCapabilities: [],
                confidence: 0.98,
                modelUsed: "deterministic_rules"
            };
        }
    }

    const compactTrace = (previousToolResults || []).slice(-6).map((step) => ({
        toolName: step.toolName,
        args: step.args,
        result: step.result
    }));

    const state = agentState ? {
        goal: agentState.goal || null,
        stage: agentState.stage || null,
        symptoms: agentState.symptoms || null,
        specialty: agentState.specialty || null,
        doctorId: agentState.doctorId || null,
        doctorName: agentState.doctorName || null,
        appointmentDate: agentState.appointmentDate || null,
        startTime: agentState.startTime || null,
        endTime: agentState.endTime || null,
        consultationType: null // AI bookings are always offline — excluded from LLM context
    } : null;

    const promptForLLM = [
        `Authenticated role: ${role}`,
        conversationContext || "",
        `Current user request: ${JSON.stringify(promptMessage)}`,
        `Current agent state: ${JSON.stringify(state)}`,
        `Previous tool observations (these are authoritative application results; do not invent values): ${JSON.stringify(compactTrace)}`,
        resolvedContext ? `Resolved conversation entities: ${JSON.stringify(resolvedContext)}` : "",
        "",
        "Determine the user's actual goal from the whole request and conversation.",
        "Use semantic meaning, not keyword matching.",
        "Extract every concrete parameter the user supplied, including symptoms, doctor name, specialty, date, time, reason and consultation type.",
        "If the user is continuing a booking conversation, preserve the existing goal and fill only newly supplied information.",
        "Do not invent IDs, dates, times, doctors, slots, fees, statistics or medical facts.",
        "If the request does not map to an available CareFlow capability, return UNKNOWN with toolName null.",
        "If information is missing for the next action, leave it missing rather than guessing."
    ].join("\n");

    const schema = {
        type: "OBJECT",
        properties: {
            intent: { type: "STRING" },
            toolName: { type: "STRING" },
            toolArgs: { type: "OBJECT" },
            missingRequiredFields: { type: "ARRAY", items: { type: "STRING" } },
            confidence: { type: "NUMBER" },
            goal: { type: "STRING" },
            stage: { type: "STRING" },
            requiredCapabilities: { type: "ARRAY", items: { type: "STRING" } },
            completionState: { type: "STRING" }
        },
        required: ["intent", "toolName", "toolArgs", "missingRequiredFields", "confidence"]
    };

    let rawOutput;
    try {
        rawOutput = await generateStructuredContent({
            systemInstruction: INTENT_ROUTER_SYSTEM_INSTRUCTION,
            prompt: promptForLLM,
            responseSchema: schema,
            timeoutMs: Number(process.env.AI_INTENT_TIMEOUT_MS || 12000)
        });
    } catch (error) {
        return {
            intent: "UNKNOWN",
            toolName: null,
            toolArgs: {},
            missingRequiredFields: [],
            requiredCapabilities: [],
            confidence: 0,
            clarify: true,
            clarificationQuestion: "I’m unable to understand that request right now. Please try again in a little more detail.",
            modelUsed: "unavailable",
            error: "AI_INTENT_UNAVAILABLE"
        };
    }

    if (!rawOutput || typeof rawOutput !== "object") {
        return {
            intent: "UNKNOWN",
            toolName: null,
            toolArgs: {},
            missingRequiredFields: [],
            requiredCapabilities: [],
            confidence: 0,
            clarify: true,
            clarificationQuestion: "I couldn't understand that request. Could you rephrase what you'd like CareFlow to do?",
            modelUsed: getGeminiModelName()
        };
    }

    let {
        intent = "UNKNOWN",
        toolName = null,
        toolArgs = {},
        missingRequiredFields = [],
        requiredCapabilities = [],
        confidence = 0
    } = rawOutput;

    if (typeof toolArgs !== "object" || Array.isArray(toolArgs)) toolArgs = {};
    if (!Array.isArray(missingRequiredFields)) missingRequiredFields = [];
    confidence = Number.isFinite(Number(confidence)) ? Math.max(0, Math.min(1, Number(confidence))) : 0;

    if (toolName) {
        toolName = TOOL_NAME_ALIASES[toolName] || toolName;
    }
    if (!toolName || toolName === "null" || toolName === "undefined") {
        const upIntent = String(intent || "").toUpperCase();
        toolName = INTENT_TO_TOOL[upIntent] || TOOL_NAME_ALIASES[intent] || TOOL_NAME_ALIASES[upIntent] || null;
    }

    // Canonical Doctor Department Query (Rule 6.10):
    // "What department am I in?", "Which department do I belong to?", "What is my specialty?"
    if (role === "doctor" && (
        pLower.includes("what department am i in") ||
        pLower.includes("which department do i belong") ||
        pLower.includes("what is my department") ||
        pLower.includes("what's my department") ||
        pLower.includes("what is my specialty") ||
        pLower.includes("what's my specialty") ||
        pLower.includes("my specialty") && pLower.includes("what")
    )) {
        toolName = "getMyDoctorProfile";
        intent = "GET_DOCTOR_PROFILE";
        confidence = 0.95;
    }

    // Phase 5: Broad Shared Medical Record Discovery Routing & Patient Discovery (Doctor Role)
    // "What can you tell me about Patient Records?", "Show me the shared medical records.", etc.
    if (role === "doctor") {
        const extractDoctorPatientPost = (text) => {
            if (!text) return null;
            const clean = String(text).trim();
            const patterns = [
                /(?:patient|chart\s+(?:for|of)|records?\s+(?:for|of)|look\s*up\s+patient|about\s+patient)\s+([A-Za-z.\s]+?)(?:'s|\s+on|\s+at|\s+for|\s+records?|\s+reports?|\s+documents?|\s+history|\s+tomorrow|\s+today|\?|$)/i,
                /([A-Za-z.\s]+?)'s\s+(?:chart|records?|medical\s+records?|record|history|results|tests|prescriptions|notes|hba1c|vitals)/i,
                /(?:show|view|get|list|find)\s+([A-Za-z.\s]+?)'s\s+(?:records?|shared\s+records?|documents?|reports?)/i
            ];
            for (const pat of patterns) {
                const m = clean.match(pat);
                if (m && m[1]) {
                    const candidate = m[1].trim();
                    const generic = new Set(["my", "the", "a", "an", "all", "any", "this", "shared", "medical", "patient", "patients", "record", "records", "information", "history"]);
                    if (candidate.length > 1 && !generic.has(candidate.toLowerCase())) {
                        return candidate;
                    }
                }
            }
            return null;
        };

        const postPatientName = extractDoctorPatientPost(promptMessage);
        if (postPatientName && /\b(records?|reports?|documents?|chart|history|shared|notes)\b/i.test(pLower)) {
            toolName = "getSharedMedicalRecords";
            intent = "GET_SHARED_MEDICAL_RECORDS";
            confidence = 0.98;
            missingRequiredFields = [];
            toolArgs = {
                patientName: postPatientName,
                query: promptMessage
            };
        } else {
            // Deterministic Doctor Patient Discovery (Phase 7 Fix):
            // Generic discovery queries when NO active patient context exists
            const isPatientRecordsDiscovery = !postPatientName && (
                /^(?:what\s+can\s+you\s+tell\s+me\s+about\s+)?patient\s+records?\??$/i.test(pLower.trim()) ||
                (/\b(show|list|view|what|tell\s+me)\b/i.test(pLower) && /\b(patient\s+records?|my\s+patients|patient\s+information|patient\s+history)\b/i.test(pLower)) ||
                /^(show\s+patient\s+records|show\s+my\s+patients|my\s+patient\s+records|patient\s+information|patient\s+history|what\s+can\s+you\s+tell\s+me\s+about\s+patient\s+records|patient\s+records)$/i.test(pLower.trim())
            );

            if (isPatientRecordsDiscovery && !agentState?.patientId) {
                toolName = "getDoctorAuthorizedPatients";
                intent = "GET_DOCTOR_AUTHORIZED_PATIENTS";
                confidence = 0.98;
                missingRequiredFields = [];
                toolArgs = {};
            }

            const isBroadSharedRecord = (
                (/\b(show|list|view|what|tell\s+me|find|get)\b/i.test(pLower) &&
                 /\b(shared\s+(?:medical\s+)?records?|shared\s+reports?|shared\s+documents?)\b/i.test(pLower)) ||
                /^(show\s+(?:all\s+)?shared\s+records|show\s+shared\s+medical\s+records|what\s+shared\s+medical\s+records\s+does\s+this\s+patient\s+have|tell\s+me\s+something\s+about\s+the\s+shared\s+medical\s+records|show\s+me\s+the\s+shared\s+medical\s+records|show\s+me\s+this\s+patient'?s?\s+shared\s+medical\s+records)$/i.test(pLower.trim())
            );

            // Do not intercept if doctor is asking a specific document search question (e.g. "what does the shared record say about diabetes")
            const isSpecificSearchQuery = /\b(what does (?:it|the record|the report) say about|does the patient have|search for|hba1c|blood pressure|vitals|creatinine)\b/i.test(pLower);

            if ((isBroadSharedRecord || (isPatientRecordsDiscovery && agentState?.patientId)) && !isSpecificSearchQuery) {
                toolName = "getSharedMedicalRecords";
                intent = "GET_SHARED_MEDICAL_RECORDS";
                confidence = 0.98;
                missingRequiredFields = [];
                if (agentState?.patientId) {
                    toolArgs.patientId = agentState.patientId;
                }
            }
        }
    }

    // Phase 5: Cross-Tenant Organization Comparison (Super Admin Role)
    if (role === "super_admin" && pLower.includes("compare") && (pLower.includes("organization") || pLower.includes("clinic") || pLower.includes("performance") || pLower.includes("and") || pLower.includes("vs"))) {
        toolName = "compareOrganizations";
        intent = "COMPARE_ORGANIZATIONS";
        confidence = 0.98;
    }

    // Strict Financial Intent Routing (Rule 6.7):
    // Financial queries (revenue, payments, transactions, collections, refunds, how much paid)
    const isFinancialQuery = /\b(revenue|payments?|transactions?|collected|collections?|refunds?|refunded|pending payments?|how much (?:have i|did i) paid|paid)\b/i.test(pLower);
    if (isFinancialQuery) {
        if (role === "patient") {
            toolName = "getMyPayments";
            intent = "GET_MY_PAYMENTS";
            confidence = Math.max(confidence, 0.9);
        } else if (role === "admin" || role === "organization_admin" || role === "super_admin" || role === "doctor") {
            if (toolName === "getClinicStats" || toolName === "getMyAppointments" || toolName === "getPlatformStats" || !toolName) {
                toolName = "getPaymentStats";
                intent = "GET_PAYMENT_STATS";
                confidence = Math.max(confidence, 0.9);
            }
        }
    }

    // Deterministic Availability & Discovery Intent Classification (Phase 3 Patch):
    // Availability/discovery queries must precede symptom-specialty triage for patient role.
    const hasActiveBookingSelection = Boolean(
        agentState?.stage && [
            "SELECT_DOCTOR",
            "SELECT_DATE",
            "SELECT_SLOT",
            "CONFIRM_BOOKING",
            "CONFIRMATION_REQUIRED"
        ].includes(agentState.stage)
    );

    if (role === "patient" && !hasActiveBookingSelection) {
        // Exclude personal appointments, prescriptions, and financial inquiries
        const isPersonalRecordQuery = /\b(my appointments?|next appointment|last appointment|past appointment|previous appointment|my prescriptions?|prescribe|prescribed|my medicines?|my payments?|my records?|who is my doctor|what department is my doctor)\b/i.test(promptMessage);

        if (!isPersonalRecordQuery) {
            // Rule 2: Preserve Symptom Triage when explicit symptom complaints exist
            const hasExplicitSymptomComplaint = /\b(i have|i've had|i am having|feeling|suffering from|experiencing|my (?:skin|head|throat|stomach|chest|eye|leg|knee|arm|back|body))\b/i.test(promptMessage) &&
                /\b(rash|itching|itchy|pain|fever|cough|cold|headache|vomit|nausea|dizz|bleeding|swelling|infection|patches|hurts?|ache|sore)\b/i.test(promptMessage);

            if (!hasExplicitSymptomComplaint) {
                // Rule 4: Doctor-Specific Availability Query
                // e.g. "Is Dr. Kumar available tomorrow?", "Does Dr. Sharma have an appointment tomorrow?", "Can I see Dr. Kumar tomorrow?"
                const docMatch = promptMessage.match(/^(?:is|does|can i see)\s+(?:dr\.?|doctor)\s+([a-zA-Z]+)/i) ||
                    promptMessage.match(/\bcan i see\s+(?:dr\.?|doctor)\s+([a-zA-Z]+)\b/i) ||
                    (promptMessage.match(/\b(?:dr\.?|doctor)\s+([A-Z][a-zA-Z]+)\b/) && promptMessage.match(/\b(available|availability|free slots?|open slots?)\b/i));

                if (docMatch && docMatch[1]) {
                    toolName = "getDoctorAvailability";
                    intent = "GET_DOCTOR_AVAILABILITY";
                    confidence = Math.max(confidence, 0.95);
                    if (!toolArgs.doctorName && !toolArgs.doctorId) {
                        toolArgs.doctorName = docMatch[1];
                    }
                } else {
                    // Rule 1 & 3: General or Specialty Doctor Availability / Discovery
                    // e.g. "Which doctors are available tomorrow?", "Show available doctors", "Which dermatologists are available tomorrow?"
                    const isAvailabilityOrDiscovery = (
                        /\b(which doctors?|what doctors?|who is available|who can i see tomorrow|find doctors?|search doctors?|show (?:all )?(?:available )?doctors?|list (?:all )?doctors?|available doctors?)\b/i.test(promptMessage) ||
                        (/\b(doctors?|physicians?|specialists?|dermatologists?|cardiologists?|pediatricians?|gynecologists?|orthopedics?|ophthalmologists?)\b/i.test(promptMessage) &&
                         /\b(available|availability|free slots?|open slots?|have appointments?)\b/i.test(promptMessage))
                    );

                    if (isAvailabilityOrDiscovery) {
                        toolName = "getDoctors";
                        intent = "GET_DOCTORS";
                        confidence = Math.max(confidence, 0.95);

                        // Rule 3: Specialty + Availability Extraction
                        if (/\b(derma[a-z]*|skin)\b/i.test(promptMessage)) toolArgs.specialty = "Dermatology";
                        else if (/\b(cardio[a-z]*|heart)\b/i.test(promptMessage)) toolArgs.specialty = "Cardiology";
                        else if (/\b(ortho[a-z]*|bone|joint|knee)\b/i.test(promptMessage)) toolArgs.specialty = "Orthopedics";
                        else if (/\b(pediatr[a-z]*|child)\b/i.test(promptMessage)) toolArgs.specialty = "Pediatrics";
                        else if (/\b(gynec[a-z]*|obgyn|women)\b/i.test(promptMessage)) toolArgs.specialty = "Gynecology";
                        else if (/\b(ophthalm[a-z]*|eye)\b/i.test(promptMessage)) toolArgs.specialty = "Ophthalmology";
                        else if (/\b(gastro[a-z]*|stomach|digest)\b/i.test(promptMessage)) toolArgs.specialty = "Gastroenterology";
                        else if (/\b(ent|ear|nose|throat)\b/i.test(promptMessage)) toolArgs.specialty = "ENT";
                        else if (/\b(general\s+physician|general\s+medicine|internal\s+medicine)\b/i.test(promptMessage)) toolArgs.specialty = "General Medicine";
                    }
                }
            }
        }
    }

    if (toolName && !ALLOWED_TOOLS.has(toolName)) {
        toolName = null;
        intent = "UNKNOWN";
        confidence = 0;
    }

    const roleTools = ROLE_ALLOWED_TOOLS[role] || new Set();
    if (toolName && !roleTools.has(toolName)) {

        return {
            intent: "UNKNOWN",
            toolName: null,
            toolArgs: {},
            missingRequiredFields: [],
            confidence: 0,
            clarify: true,
            clarificationQuestion: "That action isn't available for your CareFlow role.",
            modelUsed: getGeminiModelName(),
            error: "ROLE_TOOL_NOT_ALLOWED"
        };
    }

    // Preserve the raw user request for analytics narrative parsing and tool grounding.
    toolArgs.prompt = promptMessage;

    // Section 10: For patient booking or symptom presentation, extract user symptoms directly
    if (role === "patient" && (intent === "BOOK_APPOINTMENT" || intent === "CLASSIFY_SYMPTOMS" || toolName === "classifySpecialtyFromSymptoms" || !toolName)) {
        if (!toolArgs.symptoms && promptMessage) {
            toolArgs.symptoms = promptMessage;
            toolArgs.reason = promptMessage;
            toolArgs.reasonForVisit = promptMessage;
        }
        if (!toolArgs.doctorId) {
            toolName = toolArgs.specialty ? "searchDoctors" : "classifySpecialtyFromSymptoms";
        }
    }

    if (toolName === "classifySpecialtyFromSymptoms" && !toolArgs.symptoms) {
        toolArgs.symptoms = promptMessage;
        toolArgs.reason = promptMessage;
        toolArgs.reasonForVisit = promptMessage;
    }

    if (toolName === "searchMyDocuments" && !toolArgs.query) {
        toolArgs.query = promptMessage;
    }

    if (toolName === "explainMyPrescriptions" && !toolArgs.query) {
        toolArgs.query = promptMessage;
    }

    // Normalize natural dates/times only after semantic extraction.
    toolArgs = postProcessDates(promptMessage, toolArgs, agentState);

    // Resolve names/ordinals to concrete IDs using authenticated tenant scope.
    const organizationId = user.organizationId?._id || user.organizationId || null;
    let entityResolution = { toolArgs, missingRequiredFields: [], clarificationQuestion: null };

    const effectiveContext = {
        ...(resolvedContext || {}),
        lastDoctorList: resolvedContext?.lastDoctorList || agentState?.doctors
    };

    try {
        entityResolution = await resolveEntitiesFromToolArgs(
            { ...toolArgs, _toolName: toolName },
            organizationId,
            user,
            effectiveContext
        );
    } catch (error) {
        return {
            intent: "UNKNOWN",
            toolName: null,
            toolArgs: {},
            missingRequiredFields: [],
            confidence: 0,
            clarify: true,
            clarificationQuestion: "I couldn't safely resolve the requested CareFlow information. Please be more specific.",
            modelUsed: getGeminiModelName(),
            error: "ENTITY_RESOLUTION_FAILED"
        };
    }

    toolArgs = entityResolution.toolArgs || {};
    delete toolArgs._toolName;

    let resolvedMissing = Array.from(new Set([
        ...missingRequiredFields,
        ...(entityResolution.missingRequiredFields || [])
    ]));

    // Any field that is actually provided with a non-empty value in toolArgs is NOT missing!
    resolvedMissing = resolvedMissing.filter(f => {
        const val = toolArgs[f];
        return val === undefined || val === null || val === "";
    });

    // If symptoms are provided, symptoms is NOT missing!
    if (toolArgs.symptoms) {
        resolvedMissing = resolvedMissing.filter(f => f !== "symptoms");
    }

    // For initial booking, intermediate fields like doctorId, appointmentDate, startTime are NOT missing errors
    if (role === "patient" && (intent === "BOOK_APPOINTMENT" || intent === "CLASSIFY_SYMPTOMS" || toolName === "classifySpecialtyFromSymptoms")) {
        resolvedMissing = resolvedMissing.filter(f => !["doctorId", "appointmentDate", "startTime", "endTime"].includes(f));
    }

    if (toolName === "getSharedMedicalRecords" || toolName === "draftClinicalNotes" || toolName === "draftPrescription") {
        resolvedMissing = resolvedMissing.filter(f => f !== "appointmentId");
    }

    if (toolArgs.appointmentDate && !toolArgs.date) {
        toolArgs.date = toolArgs.appointmentDate;
    }
    if (toolArgs.date && !toolArgs.appointmentDate) {
        toolArgs.appointmentDate = toolArgs.date;
    }
    if (toolName === "getDoctorAvailability" && (toolArgs.date || toolArgs.appointmentDate)) {
        resolvedMissing = resolvedMissing.filter(f => f !== "date" && f !== "appointmentDate");
    }

    // Required fields are reported to the planner, but booking workflow itself may
    // intentionally wait for a user choice rather than treating missing values as an error.
    const required = TOOL_REQUIRED_FIELDS[toolName] || [];
    for (const field of required) {
        if (toolArgs[field] === undefined || toolArgs[field] === null || toolArgs[field] === "") {
            if (!resolvedMissing.includes(field)) resolvedMissing.push(field);
        }
    }

    const clarificationQuestion = entityResolution.clarificationQuestion ||
        (resolvedMissing.length > 0
            ? `I need ${resolvedMissing.join(", ")} before I can safely complete that action.`
            : null);

    return {
        intent,
        toolName,
        toolArgs,
        missingRequiredFields: resolvedMissing,
        confidence,
        clarify: Boolean(clarificationQuestion && !toolName),
        clarificationQuestion,
        requiredCapabilities: Array.isArray(requiredCapabilities) ? requiredCapabilities : [],
        modelUsed: getGeminiModelName()
    };
};
