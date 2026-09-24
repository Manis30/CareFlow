import { extractIntent } from "../intentRouter.js";
import { resolveEntitiesFromToolArgs, parseOrdinalIndex } from "../entityResolver.js";
import { formatDoctorName } from "../../../util/formatters.js";

/**
 * Result-aware planner.
 *
 * The LLM performs natural-language understanding and proposes the user's goal.
 * The planner then constrains the next action using REAL observations from CareFlow.
 * This prevents a model from inventing a doctor/slot or jumping directly to a write.
 */

const getDoctorResults = (result) => Array.isArray(result?.doctors) ? result.doctors : [];
const getAvailableSlots = (result, timeWindow = null) => {
    const all = getDoctorResults(result).flatMap((doctor) =>
        (doctor.availableSlots || []).map((slot) => ({
            ...slot,
            doctorId: doctor.doctorId,
            doctorName: doctor.doctorName,
            specialization: doctor.specialization,
            date: doctor.date || result.date
        }))
    );

    if (!timeWindow?.start || !timeWindow?.end) return all;

    const toMinutes = value => {
        const [h, m] = String(value || "").slice(0, 5).split(":").map(Number);
        return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
    };

    const start = toMinutes(timeWindow.start);
    const end = toMinutes(timeWindow.end);
    if (start === null || end === null) return all;

    return all.filter(slot => {
        const slotStart = toMinutes(slot.startTime || slot.start);
        return slotStart !== null && slotStart >= start && slotStart < end;
    });
};

const hasTime = (state) => Boolean(state?.startTime);
const hasDate = (state) => Boolean(state?.appointmentDate);
const hasDoctor = (state) => Boolean(state?.doctorId);

const NON_BOOKING_INTENTS = new Set([
    "GET_APPOINTMENTS",
    "GET_PATIENT_RECORDS",
    "GET_PRESCRIPTIONS",
    "EXPLAIN_PRESCRIPTIONS",
    "GET_MEDICAL_RECORDS",
    "SEARCH_DOCUMENTS",
    "GET_ORGANIZATION_ROSTER",
    "GET_PAYMENT_STATS",
    "GET_HEALTHCARE_ANALYTICS",
    "GET_PLATFORM_STATS",
    "GET_SYSTEM_HEALTH_TRENDS",
    "GET_CLINIC_STATS",
    "SUMMARIZE_APPOINTMENT",
    "GET_MY_DOCTOR_PROFILE",
    "GET_DOCTOR_PROFILE",
    "GET_MY_DEPARTMENT",
    "ASK_DOCUMENT",
    "DOCTOR_LEAVE",
    "CHECK_IN_PATIENT",
    "DRAFT_CLINICAL_NOTES",
    "DRAFT_PRESCRIPTION"
]);

const bookingGoal = (state, intent) => {
    if (!intent) return Boolean(state?.goal === "BOOK_APPOINTMENT" && state?.stage !== "COMPLETED");
    if (NON_BOOKING_INTENTS.has(intent)) return false;
    if (intent === "BOOK_APPOINTMENT" || intent === "HOLD_SLOT") return true;
    return Boolean(state?.goal === "BOOK_APPOINTMENT" && state?.stage !== "COMPLETED");
};

const buildBookingStateFromTrace = (state, trace = []) => {
    const next = { ...(state || {}) };

    for (const step of trace) {
        const r = step?.result;
        if (!r) continue;

        if (step.toolName === "classifySpecialtyFromSymptoms") {
            if (r.specialty) next.specialty = r.specialty;
            if (r.symptoms) {
                next.symptoms = r.symptoms;
                next.reason = r.symptoms;
                next.reasonForVisit = r.symptoms;
            }
        }

        if (step.toolName === "searchDoctors") {
            if (r.specialty) next.specialty = r.specialty;
            if (Array.isArray(r.doctors)) {
                next.doctors = r.doctors.map(d => ({
                    doctorId: String(d.doctorId || d._id || d.id || ""),
                    name: d.name || d.userId?.name || "Doctor",
                    specialization: d.specialization || r.specialty
                })).filter(d => d.doctorId);
            }
        }

        if (step.toolName === "getDoctorAvailability") {
            next.availability = r;
        }
    }

    return next;
};

const selectExactSlot = (availability, desiredStartTime) => {
    if (!availability || !desiredStartTime) return null;

    const normalized = String(desiredStartTime).slice(0, 5);
    const slots = getAvailableSlots(availability);

    return slots.find(slot => {
        const start = String(slot.startTime || slot.start || "").slice(0, 5);
        return start === normalized;
    }) || null;
};

/**
 * Decide the next step after observing previous tools.
 *
 * This is intentionally state/result driven. It never searches the source code
 * for words such as "stomach", "rash", "book", etc. The semantic meaning is
 * supplied by extractIntent() and actual CareFlow tool results drive the next action.
 */
export const planWorkflowStep = async (
    promptMessage,
    user,
    previousToolResults = [],
    conversationContext = "",
    resolvedContext = null,
    agentState = null
) => {
    const trace = previousToolResults || [];
    const extracted = await extractIntent(
        promptMessage,
        user,
        resolvedContext,
        conversationContext,
        trace,
        agentState
    );

    if (extracted.error === "AI_INTENT_UNAVAILABLE") {
        return {
            action: "RESPOND",
            responseType: "ERROR",
            aiResponse: extracted.clarificationQuestion,
            ...extracted
        };
    }

    let state = buildBookingStateFromTrace(agentState, trace);
    if (state?.stage === "COMPLETED" || (extracted.intent && NON_BOOKING_INTENTS.has(extracted.intent))) {
        state = null;
    }
    const isBooking = bookingGoal(state, extracted.intent);
    if (!isBooking) {
        state = null;
    }

    if (isBooking) {
        state.goal = "BOOK_APPOINTMENT";

        // Resolve entity references (e.g. ordinal doctor index, doctor names from database)
        let resolvedArgs = extracted.toolArgs || {};
        try {
            const resolved = await resolveEntitiesFromToolArgs(
                resolvedArgs,
                user?.organizationId?._id || user?.organizationId || null,
                user,
                resolvedContext
            );
            if (resolved?.toolArgs) {
                resolvedArgs = { ...resolvedArgs, ...resolved.toolArgs };
            }
        } catch (_) {}

        const a = resolvedArgs;

        // Section 9: Doctor Change Detection
        const isDoctorChanged = (a.doctorId && state.doctorId && String(a.doctorId) !== String(state.doctorId)) ||
            (a.doctorName && state.doctorName && String(a.doctorName).toLowerCase() !== String(state.doctorName).toLowerCase()) ||
            Boolean(promptMessage && /\b(?:switch|change|different|another)\s+(?:to\s+)?(?:doctor|physician|dr)\b/i.test(promptMessage));

        if (isDoctorChanged) {
            state.doctorId = a.doctorId || null;
            state.doctorName = a.doctorName || null;
            state.startTime = null;
            state.endTime = null;
            state.availability = null;
            state.availableSlots = null;
        }

        // Section 9: Date Change Detection
        const isDateChanged = (a.appointmentDate && state.appointmentDate && String(a.appointmentDate) !== String(state.appointmentDate)) ||
            Boolean(promptMessage && /\b(?:different|another|change)\s+date\b/i.test(promptMessage)) ||
            Boolean(promptMessage && /\b(?:tomorrow|today|next\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(promptMessage) && state.appointmentDate && a.appointmentDate && String(a.appointmentDate) !== String(state.appointmentDate));

        if (isDateChanged) {
            if (a.appointmentDate) state.appointmentDate = a.appointmentDate;
            state.startTime = null;
            state.endTime = null;
            state.availability = null;
            state.availableSlots = null;
        }

        const existingFullReason = state.symptoms || state.reason || state.reasonForVisit;
        for (const field of [
            "symptoms", "specialty", "doctorId", "doctorName",
            "appointmentDate", "startTime", "endTime", "consultationType",
            "reason", "reasonForVisit", "city", "timePreference", "timeWindow"
        ]) {
            if (isDoctorChanged && (field === "startTime" || field === "endTime")) continue;
            if (isDateChanged && (field === "startTime" || field === "endTime")) continue;
            if (a[field] !== undefined && a[field] !== null && a[field] !== "") {
                // Preserve full original reported reason/symptoms across turns
                if ((field === "reason" || field === "reasonForVisit" || field === "symptoms") && existingFullReason && String(a[field]).length < existingFullReason.length) {
                    state[field] = existingFullReason;
                } else {
                    state[field] = a[field];
                }
            }
        }
        if (existingFullReason) {
            if (!state.symptoms) state.symptoms = existingFullReason;
            if (!state.reason) state.reason = existingFullReason;
            if (!state.reasonForVisit) state.reasonForVisit = existingFullReason;
        }

        // If the user supplied a doctor/date/time in the same turn, we can start
        // at availability rather than redundantly showing every doctor.
        if (!state.symptoms && !state.specialty && !state.doctorId && !state.doctors?.length) {
            return {
                action: "RESPOND",
                responseType: "CLARIFICATION",
                aiResponse: "Sure — I can help book an appointment. What would you like to be seen for, or which doctor would you like to see?",
                intent: "BOOK_APPOINTMENT",
                toolName: null,
                toolArgs: {},
                missingRequiredFields: ["symptoms_or_doctor"],
                agentState: state
            };
        }

        // 1) We have symptoms but no specialty observation yet.
        const hasClassification = trace.some(s => s.toolName === "classifySpecialtyFromSymptoms");
        if ((state.symptoms || (!state.doctorId && !state.specialty && extracted.intent === "BOOK_APPOINTMENT")) && !hasClassification && !state.doctorId && !state.specialty) {
            state.stage = "CLASSIFY_SPECIALTY";
            return {
                action: "EXECUTE_TOOL",
                toolName: "classifySpecialtyFromSymptoms",
                toolArgs: { symptoms: state.symptoms || promptMessage, prompt: promptMessage },
                intent: "CLASSIFY_SYMPTOMS",
                confidence: extracted.confidence,
                modelUsed: extracted.modelUsed,
                agentState: state
            };
        }

        // 2) We have specialty but no doctor selection/list.
        const hasDoctorSearch = trace.some(s => s.toolName === "searchDoctors");
        if (!hasDoctorSearch && !state.doctorId) {
            state.stage = "SELECT_DOCTOR";
            return {
                action: "EXECUTE_TOOL",
                toolName: "searchDoctors",
                toolArgs: {
                    specialty: state.specialty || a.specialty,
                    city: state.city,
                    prompt: promptMessage
                },
                intent: "SEARCH_DOCTOR",
                confidence: extracted.confidence,
                modelUsed: extracted.modelUsed,
                agentState: state
            };
        }

        // 3) If doctors were returned but user did not select one, show them and stop.
        const doctorSearch = [...trace].reverse().find(s => s.toolName === "searchDoctors");
        const doctors = state.doctors || getDoctorResults(doctorSearch?.result).map(d => ({
            doctorId: String(d.doctorId || d._id || d.id || ""),
            name: d.name || d.userId?.name || "Doctor",
            specialization: d.specialization || state.specialty
        })).filter(d => d.doctorId);

        if (!state.doctorId && doctors.length > 0) {
            return {
                action: "RESPOND",
                responseType: "CLARIFICATION",
                aiResponse: `I found ${doctors.length} suitable doctor${doctors.length === 1 ? "" : "s"}. Please choose one by name or number.`,
                result: { doctors },
                intent: "BOOK_APPOINTMENT",
                toolName: null,
                toolArgs: {},
                missingRequiredFields: ["doctorId"],
                agentState: { ...state, stage: "SELECT_DOCTOR", doctors }
            };
        }

        if (state.doctorId && state.doctors?.length && !state.doctorName) {
            const selected = state.doctors.find(d => String(d.doctorId) === String(state.doctorId));
            if (selected) state.doctorName = selected.name;
        }

        if (!state.doctorId) {
            return {
                action: "RESPOND",
                responseType: "CLARIFICATION",
                aiResponse: "I couldn't find a doctor matching that request in your organization. Would you like to try another specialty or doctor?",
                intent: "BOOK_APPOINTMENT",
                toolName: null,
                toolArgs: {},
                missingRequiredFields: ["doctorId"],
                agentState: { ...state, stage: "SELECT_DOCTOR" }
            };
        }

        // 4) Availability requires a real date. Never invent tomorrow/afternoon here;
        // date extraction belongs to the LLM + chrono post-processing.
        if (!state.appointmentDate) {
            return {
                action: "RESPOND",
                responseType: "CLARIFICATION",
                aiResponse: "Which date would you like the appointment?",
                intent: "BOOK_APPOINTMENT",
                toolName: null,
                toolArgs: {},
                missingRequiredFields: ["appointmentDate"],
                agentState: { ...state, stage: "SELECT_DATE" }
            };
        }

        const availabilityStep = [...trace].reverse().find(s => s.toolName === "getDoctorAvailability");
        const availabilityMatchesDate =
            availabilityStep?.result?.date === state.appointmentDate &&
            String(availabilityStep?.args?.doctorId || availabilityStep?.args?.candidateDoctorIds?.[0] || "") === String(state.doctorId);

        if (!availabilityMatchesDate) {
            state.stage = "SELECT_SLOT";
            return {
                action: "EXECUTE_TOOL",
                toolName: "getDoctorAvailability",
                toolArgs: {
                    doctorId: state.doctorId,
                    date: state.appointmentDate,
                    appointmentDate: state.appointmentDate,
                    prompt: promptMessage
                },
                intent: "GET_DOCTOR_AVAILABILITY",
                confidence: extracted.confidence,
                modelUsed: extracted.modelUsed,
                agentState: state
            };
        }

        const slots = getAvailableSlots(availabilityStep.result, state.timeWindow);
        if (slots.length === 0) {
            const docDisplayName = formatDoctorName(state.doctorName) || "the selected doctor";
            return {
                action: "RESPOND",
                responseType: "CLARIFICATION",
                aiResponse: `${docDisplayName} has no available slots on ${state.appointmentDate}. Please choose another date.`,
                result: availabilityStep.result,
                intent: "BOOK_APPOINTMENT",
                toolName: null,
                toolArgs: {},
                missingRequiredFields: ["appointmentDate"],
                agentState: { ...state, stage: "SELECT_DATE" }
            };
        }

        // 5) If user gave a slot ordinal (e.g. "second one", "slot 2", "2") or time in SELECT_SLOT stage:
        if (!state.startTime && (state.stage === "SELECT_SLOT" || promptMessage)) {
            const ordIdx = parseOrdinalIndex(promptMessage);
            if (ordIdx !== null && slots[ordIdx]) {
                state.startTime = String(slots[ordIdx].startTime || slots[ordIdx].start || "").slice(0, 5);
                state.endTime = String(slots[ordIdx].endTime || slots[ordIdx].end || "").slice(0, 5);
            }
        }

        if (state.startTime) {
            const exact = selectExactSlot(availabilityStep.result, state.startTime);
            if (!exact) {
                const docDisplayName = formatDoctorName(state.doctorName) || "the selected doctor";
                return {
                    action: "RESPOND",
                    responseType: "CLARIFICATION",
                    aiResponse: `That time isn't available with ${docDisplayName} on ${state.appointmentDate}. Please choose one of the available slots.`,
                    result: { availability: availabilityStep.result },
                    intent: "BOOK_APPOINTMENT",
                    toolName: null,
                    toolArgs: {},
                    missingRequiredFields: ["startTime"],
                    agentState: { ...state, stage: "SELECT_SLOT", availableSlots: slots }
                };
            }

            state.startTime = String(exact.startTime || exact.start || "").slice(0, 5);
            state.endTime = String(exact.endTime || exact.end || "").slice(0, 5);

            if (!state.endTime) {
                return {
                    action: "RESPOND",
                    responseType: "ERROR",
                    aiResponse: "The selected availability slot did not include a valid end time, so I won't create a booking with an invented time.",
                    result: exact,
                    intent: "BOOK_APPOINTMENT",
                    toolName: null,
                    toolArgs: {},
                    agentState: state
                };
            }

            state.stage = "CONFIRM_BOOKING";
            const docDisplayName = formatDoctorName(state.doctorName) || "the selected doctor";

            // The planner asks for confirmation; it does not call the write tool.
            return {
                action: "RESPOND",
                responseType: "CONFIRMATION_REQUIRED",
                aiResponse: `I found a real available slot with ${docDisplayName} on ${state.appointmentDate} from ${state.startTime} to ${state.endTime}. Would you like me to book it?`,
                requiresConfirmation: true,
                toolName: "createAppointmentHold",
                toolArgs: {
                    doctorId: state.doctorId,
                    appointmentDate: state.appointmentDate,
                    startTime: state.startTime,
                    endTime: state.endTime,
                    // AI bookings are ALWAYS offline — server-enforced
                    consultationType: "offline",
                    paymentMethod: "offline",
                    reason: state.symptoms || state.reason || state.reasonForVisit || "Appointment requested through CareFlow AI",
                    reasonForVisit: state.symptoms || state.reasonForVisit || state.reason || "Appointment requested through CareFlow AI"
                },
                agentState: state
            };
        }

        // 6) No time selected yet: return real slots for the UI/conversation.
        state.stage = "SELECT_SLOT";
        const docDisplayName = formatDoctorName(state.doctorName) || "the selected doctor";
        return {
            action: "RESPOND",
            responseType: "LIVE_DATA",
            aiResponse: `${docDisplayName} is available on ${state.appointmentDate}. Please choose one of the available slots.`,
            result: { availability: availabilityStep.result, availableSlots: slots },
            intent: "BOOK_APPOINTMENT",
            toolName: null,
            toolArgs: {},
            missingRequiredFields: ["startTime"],
            agentState: state
        };
    }

    // Non-booking requests: multi-tool handling & repetition prevention
    if (!extracted.toolName || extracted.completionState === "COMPLETE") {
        return {
            action: "RESPOND",
            responseType: "LIVE_DATA",
            aiResponse: extracted.clarificationQuestion || null,
            ...extracted,
            agentState: state
        };
    }

    // If summarizeAppointmentContext lacks appointmentId (e.g. no upcoming appointments):
    if (extracted.toolName === "summarizeAppointmentContext" && !extracted.toolArgs?.appointmentId) {
        return {
            action: "RESPOND",
            responseType: "LIVE_DATA",
            aiResponse: extracted.clarificationQuestion || "You do not have any upcoming appointments scheduled on your calendar at this time.",
            ...extracted,
            agentState: state
        };
    }

    // If required arguments are missing and a clarification question exists:
    if (Array.isArray(extracted.missingRequiredFields) && extracted.missingRequiredFields.length > 0 && extracted.clarificationQuestion) {
        return {
            action: "RESPOND",
            responseType: "CLARIFICATION",
            aiResponse: extracted.clarificationQuestion,
            ...extracted,
            agentState: state
        };
    }

    // Check if the planned tool was already executed with equivalent arguments
    const isAlreadyRun = trace.some(step =>
        step.toolName === extracted.toolName &&
        (!extracted.toolArgs || Object.keys(extracted.toolArgs).filter(k => k !== 'prompt').every(k => String(step.args?.[k]) === String(extracted.toolArgs[k])))
    );

    if (isAlreadyRun) {
        // Prevent infinite tool execution loops
        // If additional capabilities were identified, check for the next unexecuted capability
        if (Array.isArray(extracted.requiredCapabilities) && extracted.requiredCapabilities.length > 0) {
            const nextUnexecuted = extracted.requiredCapabilities.find(cap => !trace.some(t => t.toolName === cap));
            if (nextUnexecuted) {
                return {
                    action: "EXECUTE_TOOL",
                    toolName: nextUnexecuted,
                    toolArgs: extracted.toolArgs || {},
                    intent: extracted.intent,
                    confidence: extracted.confidence,
                    modelUsed: extracted.modelUsed,
                    agentState: state
                };
            }
        }

        // All required capabilities executed -> ready for grounded synthesis
        return {
            action: "RESPOND",
            responseType: "LIVE_DATA",
            intent: extracted.intent,
            confidence: extracted.confidence,
            modelUsed: extracted.modelUsed,
            agentState: state
        };
    }

    return {
        action: "EXECUTE_TOOL",
        toolName: extracted.toolName,
        toolArgs: extracted.toolArgs || {},
        intent: extracted.intent,
        confidence: extracted.confidence,
        modelUsed: extracted.modelUsed,
        missingRequiredFields: extracted.missingRequiredFields || [],
        clarify: extracted.clarify || false,
        clarificationQuestion: extracted.clarificationQuestion || null,
        agentState: state
    };
};
