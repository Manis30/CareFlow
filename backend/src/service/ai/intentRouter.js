import * as chrono from "chrono-node";
import { generateStructuredContent, getGeminiModelName } from "./geminiClient.js";
import { resolveEntitiesFromToolArgs, parseOrdinalIndex } from "./entityResolver.js";
import { parseNaturalTimeExpression } from "../../util/appointmentTimeUtils.js";

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

CRITICAL MULTI-TOOL & AGENT COMPLETION RULES:
1. If Previous Tool Observations already provide the information needed to answer the user's request completely, return "completionState": "COMPLETE", "toolName": null.
2. If the user request requires multiple capabilities (e.g. "How is my clinic performing and which department is busiest?"), identify "requiredCapabilities". If the first tool (e.g. getClinicStats) was already executed in Previous Tool Observations, select the next required tool (e.g. getHealthcareAnalytics with groupBy="department") as "toolName".
3. Out-of-Domain Safety: If the user request is unmapped, out of domain (e.g. weather, sports, jokes, recipes, general chat), set "intent": "UNKNOWN", "toolName": null, and "confidence": 0.0. NEVER guess or invent tools for out-of-domain queries.

Return JSON matching this exact structure:
{
  "intent": "BOOK_APPOINTMENT" | "CANCEL_APPOINTMENT" | "RESCHEDULE_APPOINTMENT" | "CLASSIFY_SYMPTOMS" | "SEARCH_DOCTOR" | "GET_DOCTOR_AVAILABILITY" | "GET_APPOINTMENTS" | "GET_PATIENT_HISTORY" | "SUMMARIZE_APPOINTMENT" | "DRAFT_CLINICAL_NOTES" | "DRAFT_PRESCRIPTION" | "SEARCH_DOCUMENTS" | "GET_PLATFORM_STATS" | "GET_CLINIC_STATS" | "GET_HEALTHCARE_ANALYTICS" | "GET_PAYMENT_STATS" | "GET_SYSTEM_HEALTH_TRENDS" | "GET_PRESCRIPTIONS" | "EXPLAIN_PRESCRIPTIONS" | "GET_MEDICAL_RECORDS" | "CHECK_IN_PATIENT" | "GET_ORGANIZATION_ROSTER" | "GET_DOCTOR_PROFILE" | "UNKNOWN",
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
export const postProcessDates = (text, toolArgs = {}, agentState = null) => {
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
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        args.startDate = start.toISOString().split('T')[0];
        args.endDate = end.toISOString().split('T')[0];
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
    "explainMyPrescriptions",
    "getMyMedicalRecords",
    "checkInPatient",
    "getOrganizationRoster",
    "getDoctorLeave",
    "getMyDoctorProfile"
]);

const ROLE_ALLOWED_TOOLS = {
    patient: new Set([
        "createAppointmentHold", "cancelAppointment", "rescheduleAppointment",
        "classifySpecialtyFromSymptoms", "searchDoctors", "getDoctorAvailability",
        "getMyAppointments", "searchMyDocuments", "getMyPrescriptions",
        "explainMyPrescriptions", "getMyMedicalRecords"
    ]),
    doctor: new Set([
        "getMyAppointments", "getDoctorAvailability", "getDoctorLeave",
        "getAuthorizedPatientHistory", "summarizeAppointmentContext",
        "draftClinicalNotes", "draftPrescription", "getClinicStats",
        "searchDoctors", "getMyDoctorProfile", "searchMyDocuments",
        "getMyMedicalRecords", "getMyPrescriptions", "explainMyPrescriptions"
    ]),
    admin: new Set([
        "getMyAppointments", "getDoctorAvailability", "getDoctorLeave",
        "getClinicStats", "getHealthcareAnalytics", "getPaymentStats",
        "searchDoctors", "getOrganizationRoster", "checkInPatient",
        "cancelAppointment", "rescheduleAppointment", "getMyDoctorProfile"
    ]),
    organization_admin: new Set([
        "getMyAppointments", "getDoctorAvailability", "getDoctorLeave",
        "getClinicStats", "getHealthcareAnalytics", "getPaymentStats",
        "searchDoctors", "getOrganizationRoster", "checkInPatient",
        "cancelAppointment", "rescheduleAppointment", "getMyDoctorProfile"
    ]),
    super_admin: new Set([
        ...ALLOWED_TOOLS,
        "getPlatformStats", "getSystemHealthTrends", "getMyDoctorProfile"
    ])
};

const TOOL_REQUIRED_FIELDS = {
    createAppointmentHold: ["doctorId", "appointmentDate", "startTime", "endTime"],
    cancelAppointment: ["appointmentId"],
    rescheduleAppointment: ["appointmentId", "appointmentDate", "startTime", "endTime"],
    classifySpecialtyFromSymptoms: ["symptoms"],
    searchDoctors: [],
    getDoctorAvailability: ["date"],
    getAuthorizedPatientHistory: ["appointmentId"],
    summarizeAppointmentContext: ["appointmentId"],
    draftClinicalNotes: ["appointmentId"],
    draftPrescription: ["appointmentId", "diagnosis"],
    searchMyDocuments: ["query"],
    getHealthcareAnalytics: [],
    getPaymentStats: [],
    getMyPrescriptions: [],
    explainMyPrescriptions: ["query"],
    checkInPatient: ["appointmentId"],
    getDoctorLeave: [],
    getMyDoctorProfile: []
};

const INTENT_TO_TOOL = {
    BOOK_APPOINTMENT: "createAppointmentHold",
    HOLD_SLOT: "createAppointmentHold",
    CANCEL_APPOINTMENT: "cancelAppointment",
    RESCHEDULE_APPOINTMENT: "rescheduleAppointment",
    CLASSIFY_SYMPTOMS: "classifySpecialtyFromSymptoms",
    TRIAGE_SYMPTOMS: "classifySpecialtyFromSymptoms",
    SYMPTOM_CHECK: "classifySpecialtyFromSymptoms",
    SEARCH_DOCTOR: "searchDoctors",
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
    EXPLAIN_PRESCRIPTIONS: "explainMyPrescriptions",
    GET_MEDICAL_RECORDS: "getMyMedicalRecords",
    CHECK_IN_PATIENT: "checkInPatient",
    GET_ORGANIZATION_ROSTER: "getOrganizationRoster",
    GET_DOCTOR_LEAVE: "getDoctorLeave",
    GET_DOCTOR_PROFILE: "getMyDoctorProfile",
    GET_MY_DEPARTMENT: "getMyDoctorProfile",
    GET_DOCTOR_DEPARTMENT: "getMyDoctorProfile"
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
        confidence = 0
    } = rawOutput;

    if (typeof toolArgs !== "object" || Array.isArray(toolArgs)) toolArgs = {};
    if (!Array.isArray(missingRequiredFields)) missingRequiredFields = [];
    confidence = Number.isFinite(Number(confidence)) ? Math.max(0, Math.min(1, Number(confidence))) : 0;

    toolName = toolName && toolName !== "null" && toolName !== "undefined"
        ? String(toolName)
        : INTENT_TO_TOOL[String(intent).toUpperCase()] || null;

    // Canonical Doctor Department Query (Rule 6.10):
    // "What department am I in?", "Which department do I belong to?", "What is my specialty?"
    const pLower = promptMessage.toLowerCase();
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

    // Strict Financial Intent Routing (Rule 6.7):
    // Financial queries (revenue, payments, transactions, collections, refunds) MUST use payment/revenue analytics.
    const isFinancialQuery = /\b(revenue|payments?|transactions?|collected|collections?|refunds?|refunded|pending payments?)\b/i.test(pLower);
    if (isFinancialQuery) {
        if (toolName === "getClinicStats" || toolName === "getMyAppointments" || toolName === "getPlatformStats" || !toolName) {
            if (role === "admin" || role === "organization_admin" || role === "super_admin" || role === "doctor") {
                toolName = "getPaymentStats";
                intent = "GET_PAYMENT_STATS";
                confidence = Math.max(confidence, 0.9);
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

    // If symptoms are provided, symptoms is NOT missing!
    if (toolArgs.symptoms) {
        resolvedMissing = resolvedMissing.filter(f => f !== "symptoms");
    }

    // For initial booking, intermediate fields like doctorId, appointmentDate, startTime are NOT missing errors
    if (role === "patient" && (intent === "BOOK_APPOINTMENT" || intent === "CLASSIFY_SYMPTOMS" || toolName === "classifySpecialtyFromSymptoms")) {
        resolvedMissing = resolvedMissing.filter(f => !["doctorId", "appointmentDate", "startTime", "endTime"].includes(f));
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
        modelUsed: getGeminiModelName()
    };
};
