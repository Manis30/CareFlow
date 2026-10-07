/**
 * Canonical Response Contract (Section 20)
 * Eliminates ad-hoc response envelopes and ambiguity for client drawers.
 */
export const RESPONSE_TYPES = Object.freeze({
    ANSWER: "ANSWER",
    CLARIFICATION: "CLARIFICATION",
    TOOL_PROGRESS: "TOOL_PROGRESS",
    CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
    BOOKING_SUCCESS: "BOOKING_SUCCESS",
    BOOKING_FAILED: "BOOKING_FAILED",
    EMERGENCY: "EMERGENCY",
    ERROR: "ERROR"
});

/**
 * Maps legacy/internal response types to canonical contract types
 */
export const normalizeResponseType = (type) => {
    switch (type) {
        case "EMERGENCY_ESCALATION":
        case "EMERGENCY":
            return RESPONSE_TYPES.EMERGENCY;
        case "CONFIRMATION_REQUIRED":
            return RESPONSE_TYPES.CONFIRMATION_REQUIRED;
        case "ACTION_COMPLETED":
        case "BOOKING_SUCCESS":
            return RESPONSE_TYPES.BOOKING_SUCCESS;
        case "CONFLICT":
        case "BOOKING_FAILED":
            return RESPONSE_TYPES.BOOKING_FAILED;
        case "CLARIFICATION":
            return RESPONSE_TYPES.CLARIFICATION;
        case "TOOL_PROGRESS":
            return RESPONSE_TYPES.TOOL_PROGRESS;
        case "ERROR":
            return RESPONSE_TYPES.ERROR;
        case "LIVE_DATA":
        case "ANALYTICS":
        case "GROUNDED_RECORD":
        case "CLINICAL_COPILOT":
        case "PRE_VISIT_BRIEF":
        case "ANSWER":
        default:
            return RESPONSE_TYPES.ANSWER;
    }
};

/**
 * Creates a normalized canonical agent response envelope.
 */
export const buildCanonicalResponse = ({
    responseType = RESPONSE_TYPES.ANSWER,
    aiResponse = "",
    agentType = "AppointmentAgent",
    toolUsed = null,
    toolObservations = [],
    result = null,
    agentState = null,
    confirmationId = null,
    confirmationPayload = null,
    citations = [],
    missingRequiredFields = [],
    disclaimer = "",
    statusCode = 200,
    metadata = {}
}) => {
    const canonicalType = normalizeResponseType(responseType);
    const isSuccess = canonicalType !== RESPONSE_TYPES.ERROR && canonicalType !== RESPONSE_TYPES.BOOKING_FAILED;

    return {
        success: isSuccess,
        responseType: canonicalType,
        aiResponse: String(aiResponse || "").trim(),
        agentType,
        toolUsed,
        toolObservations,
        result,
        agentState,
        confirmationId,
        confirmationPayload: confirmationPayload || (confirmationId ? { confirmationId, summary: aiResponse, payload: result } : null),
        requiresConfirmation: canonicalType === RESPONSE_TYPES.CONFIRMATION_REQUIRED,
        confirmationRequired: canonicalType === RESPONSE_TYPES.CONFIRMATION_REQUIRED,
        citations: Array.isArray(citations) ? citations : [],
        missingRequiredFields: Array.isArray(missingRequiredFields) ? missingRequiredFields : [],
        disclaimer,
        statusCode,
        metadata
    };
};
