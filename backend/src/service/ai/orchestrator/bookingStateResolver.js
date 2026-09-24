import { formatDoctorName } from "../../../util/formatters.js";

/**
 * Deterministic Booking State Resolver for CareFlow AI.
 * 
 * Rules:
 * 1. For active booking workflows, deterministic booking state has absolute priority over generic LLM intent.
 * 2. Interpretation Priority:
 *    - IF SELECT_DOCTOR: input = doctor selection (by name or number/ordinal)
 *    - IF SELECT_DATE: input = calendar day of active booking month
 *    - IF SELECT_SLOT: input = slot selection (by slot index/ordinal or exact time)
 * 3. Never invent database values, slots, dates, or doctors.
 */

const normalizeString = (str) => {
    return String(str || "")
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const cleanDoctorSearchToken = (str) => {
    return normalizeString(str)
        .replace(/\b(?:i\s+want|i\s+would\s+like|i'd\s+like|book\s+with|see|select|choose|consult\s+with|please\s+book|appointment\s+with)\b/gi, "")
        .replace(/\b(?:dr\.?|doctor)\b/gi, "")
        .trim();
};

const parseOrdinal = (text) => {
    const norm = normalizeString(text);
    
    // Explicit numbers: "1", "2", "3", "#1", "doctor 1", "slot 1"
    const numMatch = norm.match(/(?:doctor|dr|slot|option|number|#)?\s*(\d+)(?:st|nd|rd|th)?(?:\s*(?:doctor|slot|one))?/i);
    if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (Number.isFinite(val) && val >= 1) return val - 1; // 0-indexed
    }

    // Word ordinals
    if (/\b(?:first|1st|first\s+(?:one|doctor|slot))\b/i.test(norm)) return 0;
    if (/\b(?:second|2nd|second\s+(?:one|doctor|slot))\b/i.test(norm)) return 1;
    if (/\b(?:third|3rd|third\s+(?:one|doctor|slot))\b/i.test(norm)) return 2;
    if (/\b(?:fourth|4th|fourth\s+(?:one|doctor|slot))\b/i.test(norm)) return 3;
    if (/\b(?:fifth|5th|fifth\s+(?:one|doctor|slot))\b/i.test(norm)) return 4;

    return null;
};

export const resolveBookingState = async (userMessage, agentState, user, resolvedContext = null) => {
    if (!agentState || !agentState.stage || agentState.stage === "COMPLETED") {
        return null;
    }

    const stage = agentState.stage;
    const text = String(userMessage || "").trim();
    if (!text) return null;

    // Reset or cancellation handling
    if (/\b(?:cancel|stop|reset|restart|start\s+over|nevermind|abort|quit)\b/i.test(text)) {
        return {
            handled: true,
            action: "RESPOND",
            responseType: "LIVE_DATA",
            aiResponse: "I have cancelled the booking process. How else can I assist you with your CareFlow needs today?",
            agentState: null
        };
    }

    // Diagnostic logging per Section 14
    console.log(`[BookingStateResolver] stage=${stage} doctorId=${agentState.doctorId || 'null'} doctorName=${agentState.doctorName || 'null'} appointmentDate=${agentState.appointmentDate || 'null'} availableSlots=${agentState.availableSlots?.length || 0} message="${text}"`);

    // =========================================================================
    // 1. SELECT_DOCTOR STAGE
    // =========================================================================
    if (stage === "SELECT_DOCTOR") {
        const doctorList = Array.isArray(agentState.doctors) && agentState.doctors.length
            ? agentState.doctors
            : Array.isArray(resolvedContext?.lastDoctorList) && resolvedContext.lastDoctorList.length
                ? resolvedContext.lastDoctorList
                : [];

        if (!doctorList.length) {
            return null; // Fallback to planner if no doctor list exists
        }

        let selected = null;

        // Check 1: Ordinal index ("1", "first", "second", "doctor 2", etc.)
        const ordIndex = parseOrdinal(text);
        if (ordIndex !== null && doctorList[ordIndex]) {
            selected = doctorList[ordIndex];
        }

        // Check 2: Doctor name matching ("yamuna", "dr yamuna", "I want Yamuna")
        if (!selected) {
            const queryClean = cleanDoctorSearchToken(text);
            if (queryClean.length >= 2) {
                const matches = doctorList.filter(d => {
                    const rawName = d.name || d.userId?.name || "";
                    const cleanDoc = cleanDoctorSearchToken(rawName);
                    if (cleanDoc === queryClean) return true;
                    if (cleanDoc.includes(queryClean)) return true;
                    
                    // Substring token match (e.g. "yamuna" matches "s yamuna")
                    const docTokens = cleanDoc.split(/\s+/);
                    const queryTokens = queryClean.split(/\s+/);
                    return queryTokens.some(qt => qt.length >= 3 && docTokens.includes(qt));
                });

                if (matches.length === 1) {
                    selected = matches[0];
                } else if (matches.length > 1) {
                    const options = matches.map((m, i) => `${i + 1}. ${formatDoctorName(m.name)} (${m.specialization})`).join("\n");
                    return {
                        handled: true,
                        action: "RESPOND",
                        responseType: "CLARIFICATION",
                        aiResponse: `Multiple doctors match that name. Please choose one by number:\n${options}`,
                        missingRequiredFields: ["doctorId"],
                        agentState
                    };
                }
            }
        }

        if (selected) {
            const docId = String(selected.doctorId || selected._id || selected.id);
            const docName = formatDoctorName(selected.name || selected.userId?.name || "Doctor");
            const nextState = {
                ...agentState,
                stage: "SELECT_DATE",
                doctorId: docId,
                doctorName: docName,
                selectedDoctor: {
                    doctorId: docId,
                    name: docName,
                    specialization: selected.specialization || agentState.specialty,
                    organizationId: selected.organizationId || agentState.organizationId
                },
                // Invalidate downstream
                appointmentDate: null,
                availableSlots: null,
                selectedSlot: null,
                startTime: null,
                endTime: null
            };

            return {
                handled: true,
                action: "RESPOND",
                responseType: "CLARIFICATION",
                aiResponse: `${docName} selected. Which date would you like your appointment?`,
                missingRequiredFields: ["appointmentDate"],
                agentState: nextState
            };
        }

        // If user typed something that didn't match any doctor in this list,
        // let the generic planner check if they changed their query or asked for something else
        return null;
    }

    // =========================================================================
    // 2. SELECT_DATE STAGE
    // =========================================================================
    if (stage === "SELECT_DATE") {
        if (!agentState.doctorId) {
            agentState.stage = "SELECT_DOCTOR";
            return null;
        }

        let resolvedDate = null;
        const now = new Date();
        const pLower = text.toLowerCase().trim();

        // Check 1: Standalone day of month ("18", "18th", "day 18")
        const dayMatch = text.match(/^(?:on\s+)?(?:day\s+)?(\d{1,2})(?:st|nd|rd|th)?$/i);
        if (dayMatch) {
            const day = parseInt(dayMatch[1], 10);
            if (day >= 1 && day <= 31) {
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
                resolvedDate = `${targetYear}-${mStr}-${dStr}`;
            }
        }

        // Check 2: Relative dates
        if (!resolvedDate) {
            if (pLower === "today") {
                resolvedDate = now.toISOString().split('T')[0];
            } else if (pLower === "tomorrow") {
                const tmrw = new Date(now);
                tmrw.setDate(tmrw.getDate() + 1);
                resolvedDate = tmrw.toISOString().split('T')[0];
            } else if (/^(?:this\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(pLower)) {
                const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const targetDayIdx = dayNames.findIndex(dn => pLower.includes(dn));
                if (targetDayIdx !== -1) {
                    const diff = (targetDayIdx + 7 - now.getDay()) % 7 || 7;
                    const d = new Date(now);
                    d.setDate(d.getDate() + diff);
                    resolvedDate = d.toISOString().split('T')[0];
                }
            } else if (/^next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(pLower)) {
                const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const targetDayIdx = dayNames.findIndex(dn => pLower.includes(dn));
                if (targetDayIdx !== -1) {
                    const diff = ((targetDayIdx + 7 - now.getDay()) % 7 || 7) + 7;
                    const d = new Date(now);
                    d.setDate(d.getDate() + diff);
                    resolvedDate = d.toISOString().split('T')[0];
                }
            }
        }

        // Check 3: Month name with day ("September 18", "18 September", "Sep 18")
        if (!resolvedDate) {
            const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
            const shortMonthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
            
            const mMatch = pLower.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?/i) ||
                           pLower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
            
            if (mMatch) {
                let monthStr = "";
                let dayNum = 1;
                if (isNaN(parseInt(mMatch[1], 10))) {
                    monthStr = mMatch[1].slice(0, 3).toLowerCase();
                    dayNum = parseInt(mMatch[2], 10);
                } else {
                    dayNum = parseInt(mMatch[1], 10);
                    monthStr = mMatch[2].slice(0, 3).toLowerCase();
                }

                const mIdx = shortMonthNames.indexOf(monthStr);
                if (mIdx !== -1 && dayNum >= 1 && dayNum <= 31) {
                    let y = now.getFullYear();
                    if (mIdx < now.getMonth() || (mIdx === now.getMonth() && dayNum < now.getDate())) {
                        y += 1;
                    }
                    resolvedDate = `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                }
            }
        }

        // Check 4: Direct YYYY-MM-DD
        if (!resolvedDate && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
            resolvedDate = text;
        }

        if (resolvedDate) {
            const nextState = {
                ...agentState,
                appointmentDate: resolvedDate,
                stage: "SELECT_SLOT",
                availableSlots: null,
                selectedSlot: null,
                startTime: null,
                endTime: null
            };

            // Execute getDoctorAvailability tool to fetch real slots
            return {
                handled: true,
                action: "EXECUTE_TOOL",
                toolName: "getDoctorAvailability",
                toolArgs: {
                    doctorId: nextState.doctorId,
                    date: nextState.appointmentDate
                },
                intent: "GET_DOCTOR_AVAILABILITY",
                agentState: nextState
            };
        }

        return null;
    }

    // =========================================================================
    // 3. SELECT_SLOT STAGE
    // =========================================================================
    if (stage === "SELECT_SLOT") {
        const slots = Array.isArray(agentState.availableSlots) ? agentState.availableSlots : [];
        if (!slots.length) {
            // Need availability first
            if (agentState.doctorId && agentState.appointmentDate) {
                return {
                    handled: true,
                    action: "EXECUTE_TOOL",
                    toolName: "getDoctorAvailability",
                    toolArgs: {
                        doctorId: agentState.doctorId,
                        date: agentState.appointmentDate
                    },
                    intent: "GET_DOCTOR_AVAILABILITY",
                    agentState
                };
            }
            return null;
        }

        let selected = null;

        // Check 1: Ordinal / Number index ("1", "2", "second one", "slot 2", etc.)
        const ordIndex = parseOrdinal(text);
        if (ordIndex !== null && slots[ordIndex]) {
            selected = slots[ordIndex];
        }

        // Check 2: Direct time match ("10:30", "10:30 AM", "10.30")
        if (!selected) {
            const timeMatch = text.match(/(\d{1,2})[:.](\d{2})(?:\s*(am|pm))?/i);
            if (timeMatch) {
                let h = parseInt(timeMatch[1], 10);
                const m = timeMatch[2];
                const meridiem = (timeMatch[3] || "").toLowerCase();
                if (meridiem === "pm" && h < 12) h += 12;
                if (meridiem === "am" && h === 12) h = 0;
                const normTime = `${String(h).padStart(2, '0')}:${m}`;

                selected = slots.find(s => {
                    const sStart = String(s.startTime || s.start || "").slice(0, 5);
                    return sStart === normTime;
                });
            }
        }

        // Check 3: Morning / Afternoon preference
        if (!selected) {
            if (/\bmorning\b/i.test(text)) {
                selected = slots.find(s => {
                    const h = parseInt(String(s.startTime || s.start || "").slice(0, 2), 10);
                    return Number.isFinite(h) && h < 12;
                });
            } else if (/\bafternoon\b/i.test(text)) {
                selected = slots.find(s => {
                    const h = parseInt(String(s.startTime || s.start || "").slice(0, 2), 10);
                    return Number.isFinite(h) && h >= 12;
                });
            }
        }

        if (selected) {
            const startTime = String(selected.startTime || selected.start || "").slice(0, 5);
            const endTime = String(selected.endTime || selected.end || "").slice(0, 5);

            if (!endTime) {
                return {
                    handled: true,
                    action: "RESPOND",
                    responseType: "ERROR",
                    aiResponse: "The selected availability slot did not include a valid end time. Please select another slot.",
                    agentState
                };
            }

            const docDisplayName = formatDoctorName(agentState.doctorName) || "the selected doctor";
            const nextState = {
                ...agentState,
                stage: "CONFIRM_BOOKING",
                startTime,
                endTime,
                selectedSlot: selected
            };

            const fullReason = nextState.symptoms || nextState.reason || nextState.reasonForVisit || "Appointment requested through CareFlow AI";

            return {
                handled: true,
                action: "RESPOND",
                responseType: "CONFIRMATION_REQUIRED",
                requiresConfirmation: true,
                aiResponse: `I found a real available slot with ${docDisplayName} on ${nextState.appointmentDate} from ${startTime} to ${endTime}. Would you like me to book this offline consultation?`,
                toolName: "createAppointmentHold",
                toolArgs: {
                    doctorId: nextState.doctorId,
                    appointmentDate: nextState.appointmentDate,
                    startTime,
                    endTime,
                    consultationType: "offline",
                    paymentMethod: "cash",
                    reason: fullReason,
                    reasonForVisit: fullReason
                },
                agentState: nextState
            };
        }

        // Slot choice wasn't matched from available slots
        const docDisplayName = formatDoctorName(agentState.doctorName) || "the selected doctor";
        return {
            handled: true,
            action: "RESPOND",
            responseType: "CLARIFICATION",
            aiResponse: `That time isn't available with ${docDisplayName} on ${agentState.appointmentDate}. Please choose one of the available slots.`,
            agentState
        };
    }

    // =========================================================================
    // 4. CONFIRM_BOOKING STAGE
    // =========================================================================
    if (stage === "CONFIRM_BOOKING") {
        // Detect user confirmation intent
        const isConfirmed = /^\s*(?:yes|yeah|yep|yup|sure|ok|okay|confirm|book\s*it|book|go\s*ahead|proceed|do\s*it|correct|right|sounds\s*good|absolutely|definitely|please|great|fine)\s*[!.]?\s*$/i.test(text);

        const docName = formatDoctorName(agentState.doctorName) || "the selected doctor";
        const bookingSummary = `${docName} — ${agentState.appointmentDate}, ${agentState.startTime}–${agentState.endTime} (Offline)`;

        if (isConfirmed) {
            // Re-use locked state values — LLM/client cannot change these
            const fullReason = agentState.symptoms || agentState.reason || agentState.reasonForVisit || "Appointment requested through CareFlow AI";
            return {
                handled: true,
                action: "EXECUTE_TOOL",
                toolName: "createAppointmentHold",
                toolArgs: {
                    doctorId: agentState.doctorId,
                    appointmentDate: agentState.appointmentDate,
                    startTime: agentState.startTime,
                    endTime: agentState.endTime,
                    consultationType: "offline",
                    paymentMethod: "cash",
                    reason: fullReason,
                    reasonForVisit: fullReason
                },
                intent: "CONFIRM_BOOKING",
                confirmed: true,
                agentState: { ...agentState, stage: "BOOKING" }
            };
        }

        // Not a clear confirmation — re-surface the booking summary
        return {
            handled: true,
            action: "RESPOND",
            responseType: "CLARIFICATION",
            aiResponse: `Ready to book: ${bookingSummary}. Reply "yes" to confirm or "cancel" to cancel.`,
            agentState
        };
    }

    return null;
};
