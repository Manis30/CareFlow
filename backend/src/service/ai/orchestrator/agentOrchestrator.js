import { screenEmergencySymptoms, screenMedicationMissedDoseSafety } from "../deterministicSafety.js";
import { sanitizeUntrustedInput } from "../promptProtection.js";
import { checkGroundingGuardrail } from "../groundingGuardrail.js";
import { planWorkflowStep } from "./workflowPlanner.js";
import { executeOrchestratedTool, computeToolFingerprint } from "./toolExecutor.js";
import { resolveBookingState } from "./bookingStateResolver.js";
import AIAuditLogModel from "../../../model/aiAuditLog.js";
import { saveAIChatMessageService, getAIChatHistoryService, PURE_DATA_TOOLS, templatePureDataResponse } from "../aiGateway.js";
import { createPendingConfirmation, consumePendingConfirmation } from "../pendingConfirmation.js";
import { normalizeRole } from "../roleNormalizer.js";
import { getAgentForTool } from "../agents/index.js";
import { formatDoctorName } from "../../../util/formatters.js";
import { generateStructuredContent } from "../geminiClient.js";
import { buildCanonicalResponse, RESPONSE_TYPES, normalizeResponseType } from "../responseContract.js";

const ROLE_AGENT_MAPPING = {
    patient: "AppointmentAgent",
    doctor: "ClinicalIntelligenceAgent",
    admin: "ClinicOperationsAgent",
    super_admin: "AnalyticsAgent"
};

const resolveAgentType = (toolName, role) => {
    if (toolName) {
        const agent = getAgentForTool(toolName);
        if (agent) return agent.type;
    }
    return ROLE_AGENT_MAPPING[role] || "AppointmentAgent";
};

const resolveDisclaimer = (toolName) => {
    if (toolName) {
        const agent = getAgentForTool(toolName);
        if (agent?.disclaimer) return agent.disclaimer;
    }
    return "CareFlow AI assistance is grounded in authorized CareFlow data.";
};

const MAX_STEPS = Number(process.env.AI_AGENT_MAX_STEPS || 6);

const buildConversationContext = (messages = [], maxTurns = 8) => {
    if (!messages?.length) return "";
    return `\n\n--- Recent CareFlow conversation ---\n${messages.slice(-maxTurns).map(m => {
        const role = m.role === "user" ? "User" : "CareFlow AI";
        return `${role}: ${(m.text || "").slice(0, 1000)}`;
    }).join("\n")}\n--- End conversation ---`;
};

const extractLastDoctorListFromHistory = (messages = []) => {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (Array.isArray(m.doctorList) && m.doctorList.length) return m.doctorList;
        if (Array.isArray(m.agentState?.doctors) && m.agentState.doctors.length) return m.agentState.doctors;
        for (const tc of (m.toolCallsUsed || [])) {
            if (Array.isArray(tc.doctorList) && tc.doctorList.length) return tc.doctorList;
        }
    }
    return null;
};

const extractAgentStateFromHistory = (messages = []) => {
    let recovered = null;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role === "assistant" && m.agentState && typeof m.agentState === "object") {
            if (m.agentState.stage === "COMPLETED") return null;
            recovered = { ...m.agentState };
            break;
        }
    }
    if (!recovered) return null;

    if (!recovered.symptoms || !recovered.reason) {
        for (const m of messages) {
            if (m.role === "user" && m.text && !m.text.startsWith("Please book") && !m.text.startsWith("confirmed")) {
                if (!recovered.symptoms) recovered.symptoms = m.text;
                if (!recovered.reason) recovered.reason = m.text;
                if (!recovered.reasonForVisit) recovered.reasonForVisit = m.text;
                break;
            }
        }
    }
    return recovered;
};

const doctorName = d => formatDoctorName(d?.name || d?.userId?.name) || "Doctor";
const doctorId = d => String(d?.doctorId || d?._id || d?.id || "");

const formatDoctors = (doctors = []) => doctors.map((d, i) =>
    `${i + 1}. ${doctorName(d)}${d.specialization ? ` — ${d.specialization}` : ""}`
).join("\n");

const formatSlots = (slots = []) => slots.map((s, i) => {
    const start = String(s.startTime || s.start || "").slice(0, 5);
    const end = String(s.endTime || s.end || "").slice(0, 5);
    return `${i + 1}. ${start}${end ? `–${end}` : ""}`;
}).join("\n");

const saveAssistantMessage = async (userId, orgId, payload) => {
    if (!userId) return;
    try {
        const toSave = { ...payload };
        if (!toSave.doctorList && payload.agentState?.doctors) {
            toSave.doctorList = payload.agentState.doctors;
        }
        await saveAIChatMessageService(userId, orgId || null, toSave);
    } catch (_) { }
};

/**
 * Grounded healthcare intelligence synthesis engine.
 * Synthesizes final grounded natural-language answers from authoritative tool observations.
 */
const synthesizeGroundedResponse = async ({
    rawPrompt,
    toolTrace,
    user,
    conversationContext = "",
    agentState = null,
    specializedAgentType = "ClinicalIntelligenceAgent"
}) => {
    const lastTool = toolTrace[toolTrace.length - 1];
    const userRole = user?.role || "patient";

    const isAnalytics = toolTrace.some(t =>
        t.toolName === "getHealthcareAnalytics" ||
        t.toolName === "getPlatformStats" ||
        t.toolName === "getClinicStats" ||
        t.toolName === "getPaymentStats" ||
        t.toolName === "getSystemHealthTrends"
    );

    const isPreVisitBrief = toolTrace.some(t =>
        t.toolName === "summarizeAppointmentContext" ||
        t.toolName === "getAuthorizedPatientHistory" ||
        t.toolName === "getPreVisitBrief"
    );

    const isConsultationSelection = toolTrace.some(t =>
        t.toolName === "draftClinicalNotes" && t.result?.needsSelection
    );

    const isDraftRequiringReview = toolTrace.some(t =>
        (t.toolName === "draftClinicalNotes" && !t.result?.needsSelection) ||
        t.toolName === "draftPrescription"
    );

    const isSharedRecordDiscovery = toolTrace.some(t =>
        t.toolName === "getSharedMedicalRecords"
    );

    const isPatientDiscovery = toolTrace.some(t =>
        t.toolName === "getDoctorAuthorizedPatients"
    );

    const responseType = isAnalytics
        ? "ANALYTICS"
        : isPreVisitBrief
            ? "PRE_VISIT_BRIEF"
            : isConsultationSelection
                ? "CLARIFICATION"
                : isDraftRequiringReview
                    ? "DRAFT_REQUIRING_REVIEW"
                    : (isSharedRecordDiscovery || isPatientDiscovery)
                        ? "CLARIFICATION"
                        : toolTrace.some(t => t.toolName === "searchMyDocuments" || t.toolName === "searchPatientDocuments" || t.toolName === "getMyMedicalRecords")
                            ? "GROUNDED_RECORD"
                            : "LIVE_DATA";

    const evidenceSummary = toolTrace.map((t, idx) => {
        let resStr;
        try {
            resStr = JSON.stringify(t.result, null, 2);
        } catch (_) {
            resStr = String(t.result);
        }
        return `[Observation ${idx + 1} - Tool: ${t.toolName}]:\n${resStr.slice(0, 4000)}`;
    }).join("\n\n");

    const systemInstruction = `You are CareFlow AI, a stateful, grounded healthcare intelligence assistant.
Synthesize a professional, accurate, and completely grounded response to the user's inquiry based strictly on the authoritative tool observations provided.

STRICT GROUNDING & CLINICAL RULES:
1. ONLY make statements directly substantiated by the tool observations. Never invent or assume missing data.
2. For clinical queries (patient/doctor):
   - Never fabricate vitals, physical findings, diagnosis, treatment plans, or medications.
   - If information is not in the records, explicitly state: "I couldn't find additional relevant information in the authorized records."
3. For analytics queries (admin/super_admin):
   - Explain the real metrics from the observations. You may perform factual arithmetic (e.g. differences or percentages), but NEVER invent causal claims or reasons (do not say "because doctors are more efficient" unless the data explicitly says so).
4. Always format doctor names using "Dr. <Name>". Never output "Dr. Dr. ...".
5. Do not output raw JSON or code blocks. Present your answer naturally and clearly in clean text.
6. If the request was multi-part, ensure all parts are addressed based on the observations.`;

    const prompt = `User Role: ${userRole}
${conversationContext ? `Conversation Context:\n${conversationContext}\n` : ""}
User Inquiry: ${rawPrompt}

Authoritative CareFlow Tool Observations:
${evidenceSummary}

Synthesize a clear, grounded response addressing the user's inquiry strictly based on the observations above:`;

    let synthesizedText = null;
    try {
        const aiRes = await generateStructuredContent({
            systemInstruction,
            prompt,
            timeoutMs: 12000
        });
        synthesizedText = aiRes?.response || (typeof aiRes === "string" ? aiRes : null);
    } catch (e) {
        console.warn("[GroundedSynthesis Warning] LLM generation failed, falling back to deterministic template:", e.message);
    }

    // 1. Tool failure must NEVER claim success or be fabricated
    if (lastTool.result && lastTool.result.success === false) {
        const errorMsg = lastTool.result.message || lastTool.result.error || "The requested CareFlow operation could not be completed.";
        return buildCanonicalResponse({
            agentType: specializedAgentType,
            toolUsed: lastTool.toolName,
            result: lastTool.result,
            aiResponse: errorMsg,
            responseType: RESPONSE_TYPES.ERROR,
            statusCode: lastTool.result.statusCode || 400,
            agentState
        });
    }

    const sharedTool = toolTrace.find(t => t.toolName === "getSharedMedicalRecords");
    const patientDiscTool = toolTrace.find(t => t.toolName === "getDoctorAuthorizedPatients");
    if (sharedTool && (sharedTool.result?.response || sharedTool.result?.message)) {
        synthesizedText = sharedTool.result.response || sharedTool.result.message;
    } else if (patientDiscTool && (patientDiscTool.result?.response || patientDiscTool.result?.message)) {
        synthesizedText = patientDiscTool.result.response || patientDiscTool.result.message;
    } else if (synthesizedText) {
        const guardrail = checkGroundingGuardrail(synthesizedText, evidenceSummary);
        if (!guardrail.isGrounded) {
            console.warn("[GroundedSynthesis Guardrail] Ungrounded items detected:", guardrail.ungroundedItems);
            const pureFallback = templatePureDataResponse(lastTool.toolName, lastTool.result, userRole, lastTool.toolArgs);
            synthesizedText = (pureFallback && !pureFallback.startsWith("{")) ? pureFallback : (lastTool.result?.message || lastTool.result?.summary || synthesizedText);
        }
    }

    if (!synthesizedText || !synthesizedText.trim()) {
        if (toolTrace.length === 1 && PURE_DATA_TOOLS.includes(lastTool.toolName)) {
            synthesizedText = templatePureDataResponse(lastTool.toolName, lastTool.result, userRole, lastTool.toolArgs);
        } else {
            synthesizedText = toolTrace.map(t => templatePureDataResponse(t.toolName, t.result, userRole, t.toolArgs)).filter(Boolean).join("\n\n");
        }
    }

    const citations = [];
    for (const t of toolTrace) {
        if (Array.isArray(t.result?.citations)) {
            citations.push(...t.result.citations);
        }
    }

    const disclaimer = resolveDisclaimer(lastTool.toolName);
    const primaryResult = toolTrace.length === 1 ? lastTool.result : { trace: toolTrace.map(t => ({ tool: t.toolName, result: t.result })) };

    const lastResultState = lastTool?.result?.agentState;
    const mergedAgentState = {
        ...(lastResultState || {}),
        ...(agentState || {})
    };
    const finalAgentState = Object.keys(mergedAgentState).length > 0 ? mergedAgentState : (agentState || lastResultState || null);

    return makePayload({
        agentType: specializedAgentType,
        toolUsed: toolTrace.map(t => t.toolName).join(", "),
        result: primaryResult,
        aiResponse: synthesizedText,
        disclaimer,
        citations: citations.length ? [...new Set(citations)] : undefined,
        analyticsPayload: isAnalytics ? (lastTool.result || primaryResult) : undefined,
        agentState: finalAgentState
    }, responseType);
};

const makePayload = (base, responseType = "LIVE_DATA") => {
    const canonicalType = normalizeResponseType(responseType);
    return buildCanonicalResponse({
        ...base,
        responseType: canonicalType,
        metadata: {
            ...(base.metadata || {}),
            legacyType: responseType
        }
    });
};

/**
 * Real result-aware CareFlow agent.
 *
 * LLM responsibilities:
 *   - understand natural language
 *   - identify goal
 *   - extract parameters
 *   - resolve conversational references
 *
 * Application responsibilities:
 *   - maintain state
 *   - execute authorized tools
 *   - enforce tenant isolation
 *   - never invent DB values
 *   - gate writes behind confirmation
 *   - revalidate writes
 *
 * This separation is deliberate: natural language is semantic, while security and
 * state-changing behavior are deterministic and testable.
 */
export const runOrchestratedWorkflow = async (user, requestData = {}) => {
    const startTime = Date.now();
    let userRole = "patient";
    try {
        userRole = normalizeRole(user?.role);
    } catch {
        return buildCanonicalResponse({
            responseType: RESPONSE_TYPES.ERROR,
            statusCode: 403,
            aiResponse: "Access denied. CareFlow AI is available only to Patient, Doctor, Admin, and Super Admin roles."
        });
    }
    const agentType = ROLE_AGENT_MAPPING[userRole];

    if (!agentType) {
        return buildCanonicalResponse({
            responseType: RESPONSE_TYPES.ERROR,
            statusCode: 403,
            aiResponse: "Access denied. CareFlow AI is available only to Patient, Doctor, Admin, and Super Admin roles."
        });
    }

    const userId = user?._id || user?.id;
    const orgId = user?.organizationId?._id || user?.organizationId || null;
    const rawPrompt = String(requestData?.message || "").trim();
    const confirmed = requestData?.confirmed === true;

    // A confirmation request is an explicit action continuation. It must use the
    // already-present, verified payload; it is not reinterpreted as a fresh question.
    const explicitToolName = requestData?.toolName || null;
    const explicitToolArgs = requestData?.toolArgs || {};

    if (userId && rawPrompt) {
        await saveAssistantMessage(userId, orgId, { role: "user", text: rawPrompt });
    }

    // Load persistent conversational state before planning.
    let chatHistory = [];
    let agentState = null;
    let resolvedContext = null;

    if (userId) {
        try {
            const historyDoc = await getAIChatHistoryService(userId, orgId || null);
            chatHistory = (historyDoc?.messages || []).slice(-20);
            const lastDoctorList = extractLastDoctorListFromHistory(chatHistory);
            agentState = extractAgentStateFromHistory(chatHistory);
            if (lastDoctorList) {
                resolvedContext = { lastDoctorList };
            }
        } catch (_) { }
    }

    // Emergency screening is deterministic and always happens before LLM/tool work.
    if (userRole === "patient" && rawPrompt) {
        const emergencyResult = screenEmergencySymptoms(rawPrompt);
        if (emergencyResult.isEmergency) {
            const response = buildCanonicalResponse({
                responseType: RESPONSE_TYPES.EMERGENCY,
                agentType,
                aiResponse: emergencyResult.escalationMessage,
                metadata: {
                    isEmergency: true,
                    detectedKeyword: emergencyResult.detectedKeyword
                }
            });

            await AIAuditLogModel.create({
                userId,
                organizationId: orgId,
                role: userRole,
                agentType,
                promptSummary: rawPrompt.slice(0, 100),
                status: "EMERGENCY_ESCALATION",
                modelUsed: "DeterministicSafety",
                latencyMs: Date.now() - startTime
            }).catch(() => { });

            await saveAssistantMessage(userId, orgId, {
                role: "assistant",
                text: response.aiResponse,
                responseType: "EMERGENCY_ESCALATION",
                isEmergency: true
            });

            return response;
        }
    }

    // Medication Missed-Dose Clinical Safety Check (Rule 15)
    if (rawPrompt) {
        const missedDoseSafety = screenMedicationMissedDoseSafety(rawPrompt);
        if (missedDoseSafety && missedDoseSafety.triggered) {
            const response = buildCanonicalResponse({
                responseType: RESPONSE_TYPES.ANSWER,
                agentType,
                aiResponse: missedDoseSafety.warning,
                metadata: {
                    isMissedDoseQuery: true
                }
            });

            await AIAuditLogModel.create({
                userId,
                organizationId: orgId,
                role: userRole,
                agentType,
                promptSummary: rawPrompt.slice(0, 100),
                status: "SUCCESS",
                modelUsed: "DeterministicClinicalSafety",
                latencyMs: Date.now() - startTime
            }).catch(() => { });

            await saveAssistantMessage(userId, orgId, {
                role: "assistant",
                text: response.aiResponse,
                responseType: "CLINICAL_SAFETY_ALERT"
            });

            return response;
        }
    }

    // Confirmation path: server-side verified single-use execution.
    // Client MUST supply confirmationId. Client CANNOT supply arbitrary toolName or toolArgs.
    if (confirmed) {
        const confirmationId = requestData?.confirmationId;
        if (!confirmationId) {
            return buildCanonicalResponse({
                responseType: RESPONSE_TYPES.ERROR,
                agentType,
                statusCode: 400,
                aiResponse: "A valid server-side confirmationId is required to complete this action."
            });
        }

        try {
            const pendingAction = await consumePendingConfirmation(confirmationId, userId);

            const execution = await executeOrchestratedTool(
                user,
                pendingAction.toolName,
                pendingAction.canonicalArgs,
                true
            );

            const result = execution.result || execution;
            const responseText = result?.message ||
                result?.aiResponse ||
                `The ${pendingAction.toolName} action was completed successfully.`;

            const specializedAgentType = resolveAgentType(pendingAction.toolName, userRole);
            const disclaimer = resolveDisclaimer(pendingAction.toolName);

            const response = makePayload({
                agentType: specializedAgentType,
                toolUsed: pendingAction.toolName,
                result,
                aiResponse: responseText,
                disclaimer,
                confirmed: true,
                confirmationId
            }, "ACTION_COMPLETED");

            await AIAuditLogModel.create({
                userId,
                organizationId: orgId,
                role: userRole,
                agentType: specializedAgentType,
                promptSummary: `Confirmed action: ${pendingAction.toolName}`,
                toolUsed: pendingAction.toolName,
                toolArgs: pendingAction.canonicalArgs,
                confirmed: true,
                status: "SUCCESS",
                latencyMs: Date.now() - startTime
            }).catch(() => { });

            await saveAssistantMessage(userId, orgId, {
                role: "assistant",
                text: responseText,
                responseType: "ACTION_COMPLETED",
                confirmed: true,
                confirmationId,
                agentState: { stage: "COMPLETED" }
            });

            return response;
        } catch (error) {
            const status = error?.statusCode || error?.status || 500;
            await AIAuditLogModel.create({
                userId,
                organizationId: orgId,
                role: userRole,
                agentType,
                promptSummary: `Confirmation execution failed: ${confirmationId}`,
                confirmed: true,
                status: "ERROR",
                errorMessage: error.message,
                latencyMs: Date.now() - startTime
            }).catch(() => { });

            return buildCanonicalResponse({
                responseType: status === 409 ? RESPONSE_TYPES.BOOKING_FAILED : RESPONSE_TYPES.ERROR,
                agentType,
                statusCode: status,
                aiResponse: error.message || "Confirmation failed."
            });
        }
    }

    const promptMessage = sanitizeUntrustedInput(rawPrompt);
    const conversationContext = buildConversationContext(chatHistory);
    const toolTrace = [];

    // If this is a new turn, the previous agent state is still useful. If the previous
    // state was already completed, don't accidentally continue the old goal.
    if (agentState?.stage === "COMPLETED") agentState = null;

    // =========================================================================
    // SHARED MEDICAL RECORD SELECTION RESOLVER — runs BEFORE booking resolution
    // When doctor is choosing a shared record: "1", "second one", "all", etc.
    // =========================================================================
    if (userRole === "doctor" && (agentState?.stage === "SELECT_SHARED_RECORD" || (agentState?.stage === "RECORD_SELECTED" && /^(all|all of them|review all|check all|\d+|first|second|third|fourth|fifth|record \d+)/i.test(promptMessage.trim())))) {
        try {
            const { resolveSharedRecordSelection } = await import("../../doctorCopilot.js");
            const sharedRes = await resolveSharedRecordSelection(user, {
                selection: promptMessage,
                query: promptMessage,
                agentState
            });
            if (sharedRes?.handled) {
                const finalState = sharedRes.agentState || agentState;
                const respPayload = makePayload({
                    agentType,
                    aiResponse: sharedRes.aiResponse,
                    toolUsed: "searchPatientDocuments",
                    result: sharedRes.searchResult,
                    agentState: finalState,
                    citations: sharedRes.citations || [],
                    hasLowConfidenceWarning: sharedRes.hasLowConfidenceWarning || false
                }, "GROUNDED_RECORD");

                await saveAssistantMessage(userId, orgId, {
                    role: "assistant",
                    text: sharedRes.aiResponse,
                    responseType: "GROUNDED_RECORD",
                    agentState: finalState,
                    citations: sharedRes.citations || []
                });
                return respPayload;
            }
        } catch (selErr) {
            console.error("[SharedRecordSelection] Error:", selErr.message);
        }
    }

    // =========================================================================
    // DOCTOR CONSULTATION SELECTION RESOLVER — Context Priority 2
    // When doctor is choosing a consultation for clinical notes: "1", "2", patient name, etc.
    // =========================================================================
    if (userRole === "doctor" && agentState?.stage === "SELECT_CONSULTATION") {
        try {
            const { resolveDoctorConsultationSelection } = await import("../../doctorCopilot.js");
            const consultSel = await resolveDoctorConsultationSelection(user, {
                selection: promptMessage,
                prompt: promptMessage,
                agentState
            });
            if (consultSel?.handled) {
                const finalState = consultSel.agentState || agentState;
                const respPayload = makePayload({
                    agentType,
                    aiResponse: consultSel.aiResponse,
                    toolUsed: "draftClinicalNotes",
                    result: consultSel.result,
                    agentState: finalState
                }, "DRAFT_REQUIRING_REVIEW");

                await saveAssistantMessage(userId, orgId, {
                    role: "assistant",
                    text: consultSel.aiResponse,
                    responseType: "DRAFT_REQUIRING_REVIEW",
                    agentState: finalState
                });
                return respPayload;
            }
        } catch (cSelErr) {
            console.error("[ConsultationSelection] Error:", cSelErr.message);
        }
    }

    // =========================================================================
    // DOCTOR PATIENT SELECTION RESOLVER — Context Priority 3
    // When doctor is choosing an authorized patient: "Rajasekaran", "1", "second one", etc.
    // =========================================================================
    if (userRole === "doctor" && (agentState?.stage === "SELECT_PATIENT" || (Array.isArray(agentState?.authorizedPatients) && agentState.authorizedPatients.length > 0 && !agentState?.patientId))) {
        try {
            const { resolveDoctorPatientSelection } = await import("../../doctorCopilot.js");
            const patientSel = await resolveDoctorPatientSelection(user, {
                selection: promptMessage,
                prompt: promptMessage,
                agentState
            });
            if (patientSel?.handled) {
                const finalState = patientSel.agentState || agentState;
                const respType = patientSel.isAmbiguous ? "CLARIFICATION" : (patientSel.responseType || "CLARIFICATION");
                const respPayload = makePayload({
                    agentType,
                    aiResponse: patientSel.aiResponse,
                    toolUsed: patientSel.toolUsed || "lookupDoctorPatient",
                    result: patientSel.result || patientSel.resolvedPatient || null,
                    agentState: finalState
                }, respType);

                await saveAssistantMessage(userId, orgId, {
                    role: "assistant",
                    text: patientSel.aiResponse,
                    responseType: respType,
                    agentState: finalState
                });
                return respPayload;
            }
        } catch (patErr) {
            console.error("[PatientSelection] Error:", patErr.message);
        }
    }

    // =========================================================================
    // BOOKING STATE RESOLVER — runs BEFORE generic intent routing.
    // Deterministic state machine has absolute priority:
    //   SELECT_DOCTOR + any input = doctor selection
    //   SELECT_DATE   + any input = date selection
    //   SELECT_SLOT   + any input = slot selection
    // Only falls through to the planner when not in an active booking stage.
    // =========================================================================
    const ACTIVE_BOOKING_STAGES = new Set(["SELECT_DOCTOR", "SELECT_DATE", "SELECT_SLOT", "CONFIRM_BOOKING"]);
    if (agentState && ACTIVE_BOOKING_STAGES.has(agentState.stage)) {
        let bookingResolution = null;
        try {
            bookingResolution = await resolveBookingState(promptMessage, agentState, user, resolvedContext);
        } catch (bsrErr) {
            console.error("[BookingStateResolver] Error:", bsrErr.message);
        }

        if (bookingResolution?.handled) {
            // Update local agentState so downstream save includes the new state.
            if (bookingResolution.agentState) agentState = bookingResolution.agentState;

            // If the resolver wants to execute a tool (getDoctorAvailability or createAppointmentHold)
            if (bookingResolution.action === "EXECUTE_TOOL") {
                // ── BOOKING EXECUTION (CONFIRM_BOOKING → confirmed) ──────────────────────
                if (bookingResolution.toolName === "createAppointmentHold") {
                    let toolExecution;
                    try {
                        toolExecution = await executeOrchestratedTool(
                            user,
                            "createAppointmentHold",
                            { ...bookingResolution.toolArgs, confirmed: true },
                            true // confirmed = true
                        );
                    } catch (bookErr) {
                        // On failure: NEVER mutate the booking state or search new doctors.
                        // Re-lock agentState to CONFIRM_BOOKING with original values.
                        const lockedState = { ...(bookingResolution.agentState || agentState), stage: "CONFIRM_BOOKING" };
                        agentState = lockedState;
                        const docName = formatDoctorName(lockedState.doctorName) || "the selected doctor";
                        const failMsg = `Your offline consultation with ${docName} for ${lockedState.appointmentDate} at ${lockedState.startTime} could not be completed: ${bookErr.message}. The appointment has NOT been created. Please reply "yes" to retry or "cancel" to cancel.`;

                        await saveAssistantMessage(userId, orgId, {
                            role: "assistant",
                            text: failMsg,
                            responseType: "ERROR",
                            agentState: lockedState
                        });
                        return makePayload({ agentType, aiResponse: failMsg, agentState: lockedState }, "ERROR");
                    }

                    const result = toolExecution.result || toolExecution;
                    const docName = formatDoctorName(agentState?.doctorName) || "the selected doctor";
                    const successMsg = result?.message ||
                        `Your offline consultation with ${docName} is confirmed for ${agentState?.appointmentDate} from ${agentState?.startTime} to ${agentState?.endTime}.`;

                    const finalState = { ...(agentState || {}), stage: "COMPLETED" };

                    // Dispatch real-time update event for appointment lists
                    const successResp = makePayload({
                        agentType,
                        toolUsed: "createAppointmentHold",
                        result,
                        aiResponse: successMsg,
                        agentState: finalState
                    }, "ACTION_COMPLETED");

                    await saveAssistantMessage(userId, orgId, {
                        role: "assistant",
                        text: successMsg,
                        responseType: "ACTION_COMPLETED",
                        agentState: finalState
                    });
                    return successResp;
                }

                // ── AVAILABILITY FETCH (SELECT_DATE) ─────────────────────────────────────
                let toolExecution;
                try {
                    toolExecution = await executeOrchestratedTool(
                        user,
                        bookingResolution.toolName,
                        bookingResolution.toolArgs || {},
                        false
                    );
                } catch (toolErr) {
                    const resp = {
                        success: false,
                        agentType,
                        responseType: "ERROR",
                        aiResponse: `I couldn't fetch availability: ${toolErr.message}`,
                        agentState
                    };
                    await saveAssistantMessage(userId, orgId, { role: "assistant", text: resp.aiResponse, responseType: "ERROR", agentState });
                    return resp;
                }

                const result = toolExecution.result || toolExecution;
                // getDoctorAvailability returns { doctors: [{ availableSlots: [...] }] }
                // Extract slots for the specific doctor we selected
                let slots = [];
                if (Array.isArray(result?.availableSlots)) {
                    slots = result.availableSlots;
                } else if (Array.isArray(result?.slots)) {
                    slots = result.slots;
                } else if (Array.isArray(result?.doctors) && result.doctors.length > 0) {
                    // Find the matching doctor entry (or use first)
                    const docEntry = result.doctors.find(d => String(d.doctorId) === String(agentState?.doctorId)) || result.doctors[0];
                    slots = Array.isArray(docEntry?.availableSlots) ? docEntry.availableSlots : [];
                }

                if (agentState) {
                    agentState.availableSlots = slots;
                    agentState.stage = "SELECT_SLOT";
                }

                const docName = formatDoctorName(agentState?.doctorName) || "the selected doctor";
                let slotText;
                if (slots.length === 0) {
                    slotText = `${docName} has no available slots on ${agentState?.appointmentDate}. Please choose another date.`;
                    if (agentState) agentState.stage = "SELECT_DATE";
                } else {
                    const slotList = slots.map((s, i) => {
                        const start = String(s.startTime || s.start || "").slice(0, 5);
                        const end = String(s.endTime || s.end || "").slice(0, 5);
                        return `${i + 1}. ${start}${end ? `–${end}` : ""}`;
                    }).join("\n");
                    slotText = `${docName} is available on ${agentState?.appointmentDate}. Please choose a slot:\n${slotList}`;
                }

                const resp = makePayload({
                    agentType,
                    toolUsed: bookingResolution.toolName,
                    result,
                    aiResponse: slotText,
                    agentState
                }, "LIVE_DATA");

                await saveAssistantMessage(userId, orgId, {
                    role: "assistant",
                    text: slotText,
                    responseType: "LIVE_DATA",
                    agentState
                });
                return resp;
            }

            // CONFIRMATION_REQUIRED from SELECT_SLOT resolution (shows booking card before execution)
            if (bookingResolution.responseType === "CONFIRMATION_REQUIRED") {
                const canonicalBookingArgs = {
                    doctorId: String(agentState?.doctorId || bookingResolution.toolArgs?.doctorId),
                    appointmentDate: agentState?.appointmentDate || bookingResolution.toolArgs?.appointmentDate,
                    startTime: agentState?.startTime || bookingResolution.toolArgs?.startTime,
                    endTime: agentState?.endTime || bookingResolution.toolArgs?.endTime,
                    // AI bookings: offline consultation, cash payment (pay at clinic)
                    consultationType: "offline",
                    paymentMethod: "cash",
                    reason: agentState?.symptoms || agentState?.reason || agentState?.reasonForVisit || "Appointment requested through CareFlow AI",
                    reasonForVisit: agentState?.symptoms || agentState?.reasonForVisit || agentState?.reason || "Appointment requested through CareFlow AI"
                };

                const pending = await createPendingConfirmation({
                    userId,
                    role: userRole,
                    organizationId: orgId,
                    toolName: "createAppointmentHold",
                    canonicalArgs: canonicalBookingArgs,
                    displayPayload: { ...canonicalBookingArgs, doctorName: agentState?.doctorName },
                    summary: bookingResolution.aiResponse
                });

                const confirmation = {
                    success: true,
                    agentType,
                    responseType: "CONFIRMATION_REQUIRED",
                    aiResponse: bookingResolution.aiResponse,
                    requiresConfirmation: true,
                    confirmationRequired: true,
                    confirmationId: pending.confirmationId,
                    toolName: "createAppointmentHold",
                    toolUsed: "createAppointmentHold",
                    payload: pending.displayPayload,
                    summary: bookingResolution.aiResponse,
                    agentState: { ...(agentState || {}), stage: "CONFIRM_BOOKING" }
                };

                await saveAssistantMessage(userId, orgId, {
                    role: "assistant",
                    text: bookingResolution.aiResponse,
                    responseType: "CONFIRMATION_REQUIRED",
                    isConfirmationCard: true,
                    confirmationId: pending.confirmationId,
                    confirmationPayload: {
                        confirmationId: pending.confirmationId,
                        summary: bookingResolution.aiResponse,
                        toolName: "createAppointmentHold",
                        payload: pending.displayPayload
                    },
                    agentState: confirmation.agentState
                });

                return confirmation;
            }

            // Standard RESPOND (SELECT_DOCTOR selection, clarification, cancellation, error)
            const resp = makePayload({
                agentType,
                aiResponse: bookingResolution.aiResponse,
                agentState
            }, bookingResolution.responseType || "CLARIFICATION");

            await saveAssistantMessage(userId, orgId, {
                role: "assistant",
                text: bookingResolution.aiResponse,
                responseType: resp.responseType,
                agentState
            });
            return resp;
        }

        // CONFIRM_BOOKING guard: if the resolver didn't handle the message (e.g. user sent
        // something ambiguous while awaiting confirmation), NEVER fall through to the generic
        // planner. The planner would re-classify symptoms → search doctors → mutate the
        // booking state and show a different doctor. Instead, re-surface the booking summary.
        if (agentState?.stage === "CONFIRM_BOOKING") {
            const docName = formatDoctorName(agentState.doctorName) || "the selected doctor";
            const confirmMsg = `Your offline consultation with ${docName} on ${agentState.appointmentDate} from ${agentState.startTime} to ${agentState.endTime} is ready to confirm. Please reply "yes" to confirm or "cancel" to cancel.`;

            const resp = makePayload({
                agentType,
                aiResponse: confirmMsg,
                agentState
            }, "CLARIFICATION");

            await saveAssistantMessage(userId, orgId, {
                role: "assistant",
                text: confirmMsg,
                responseType: "CLARIFICATION",
                agentState
            });
            return resp;
        }
    }

    let currentPrompt = promptMessage;
    let latestPlan = null;
    const executedFingerprints = new Set();

    for (let step = 0; step < MAX_STEPS; step++) {
        try {
            latestPlan = await planWorkflowStep(
                currentPrompt,
                user,
                toolTrace,
                conversationContext,
                resolvedContext,
                agentState
            );
        } catch (error) {
            return {
                success: false,
                agentType,
                responseType: "ERROR",
                aiResponse: "I couldn't safely plan that CareFlow request right now.",
                error: "PLANNER_FAILED"
            };
        }

        if (latestPlan && "agentState" in latestPlan) {
            agentState = latestPlan.agentState !== null ? latestPlan.agentState : (agentState || null);
        }

        // Planner can intentionally pause for user input/confirmation.
        if (latestPlan.action === "RESPOND") {
            let responseText = latestPlan.aiResponse || latestPlan.clarificationQuestion ||
                "Could you clarify what you'd like me to do?";

            // If the planner has real doctor data, render it directly.
            const doctors = latestPlan.result?.doctors ||
                latestPlan.result?.availability?.doctors || [];
            const slots = latestPlan.result?.availableSlots || [];

            if (latestPlan.responseType === "CLARIFICATION" &&
                latestPlan.missingRequiredFields?.includes("doctorId") &&
                doctors.length) {
                responseText += `\n\n${formatDoctors(doctors)}`;
            }

            if (latestPlan.responseType === "LIVE_DATA" && slots.length) {
                responseText += `\n\n${formatSlots(slots)}`;
            }

            if (latestPlan.responseType === "CONFIRMATION_REQUIRED") {
                const canonicalBookingArgs = {
                    doctorId: String(agentState?.doctorId || latestPlan.toolArgs?.doctorId),
                    appointmentDate: agentState?.appointmentDate || latestPlan.toolArgs?.appointmentDate,
                    startTime: agentState?.startTime || latestPlan.toolArgs?.startTime,
                    endTime: agentState?.endTime || latestPlan.toolArgs?.endTime,
                    // AI bookings: offline consultation, cash payment (pay at clinic)
                    consultationType: "offline",
                    paymentMethod: "cash",
                    reason: agentState?.symptoms || agentState?.reason || agentState?.reasonForVisit || latestPlan.toolArgs?.reason || "Appointment requested through CareFlow AI",
                    reasonForVisit: agentState?.symptoms || agentState?.reasonForVisit || agentState?.reason || latestPlan.toolArgs?.reasonForVisit || "Appointment requested through CareFlow AI"
                };

                const pending = await createPendingConfirmation({
                    userId,
                    role: userRole,
                    organizationId: orgId,
                    toolName: "createAppointmentHold",
                    canonicalArgs: canonicalBookingArgs,
                    displayPayload: {
                        ...canonicalBookingArgs,
                        doctorName: agentState?.doctorName
                    },
                    summary: responseText
                });

                const confirmation = {
                    success: true,
                    agentType,
                    responseType: "CONFIRMATION_REQUIRED",
                    aiResponse: responseText,
                    requiresConfirmation: true,
                    confirmationRequired: true,
                    confirmationId: pending.confirmationId,
                    toolName: "createAppointmentHold",
                    toolUsed: "createAppointmentHold",
                    payload: pending.displayPayload,
                    summary: responseText,
                    result: latestPlan.result || null,
                    agentState: { ...(agentState || {}), stage: "CONFIRM_BOOKING" }
                };

                await saveAssistantMessage(userId, orgId, {
                    role: "assistant",
                    text: responseText,
                    responseType: "CONFIRMATION_REQUIRED",
                    isConfirmationCard: true,
                    confirmationId: pending.confirmationId,
                    confirmationPayload: {
                        confirmationId: pending.confirmationId,
                        summary: responseText,
                        toolName: "createAppointmentHold",
                        payload: pending.displayPayload
                    },
                    agentState: confirmation.agentState
                });

                return confirmation;
            }

            if (toolTrace.length > 0 && (agentState?.goal !== "BOOK_APPOINTMENT" || !["SELECT_DOCTOR", "SELECT_DATE", "SELECT_SLOT", "CONFIRM_BOOKING"].includes(agentState?.stage))) {
                const synthesized = await synthesizeGroundedResponse({
                    rawPrompt,
                    toolTrace,
                    user,
                    conversationContext,
                    agentState,
                    specializedAgentType: resolveAgentType(toolTrace[toolTrace.length - 1].toolName, userRole)
                });

                await saveAssistantMessage(userId, orgId, {
                    role: "assistant",
                    text: synthesized.aiResponse,
                    responseType: synthesized.responseType,
                    citations: synthesized.citations || [],
                    analyticsPayload: synthesized.analyticsPayload,
                    agentState: synthesized.agentState || agentState
                });
                return synthesized;
            }

            const response = makePayload({
                agentType,
                aiResponse: responseText,
                result: latestPlan.result,
                toolUsed: latestPlan.toolName || null,
                agentState
            }, latestPlan.responseType || "CLARIFICATION");

            await saveAssistantMessage(userId, orgId, {
                role: "assistant",
                text: responseText,
                responseType: response.responseType,
                toolCallsUsed: toolTrace.map(t => ({
                    toolName: t.toolName,
                    doctorList: t.result?.doctors?.map(d => ({
                        doctorId: doctorId(d),
                        name: doctorName(d)
                    })).filter(d => d.doctorId)
                })).filter(t => t.doctorList?.length),
                doctorList: doctors.length ? doctors.map(d => ({
                    doctorId: doctorId(d),
                    name: doctorName(d)
                })).filter(d => d.doctorId) : (agentState?.doctors || undefined),
                agentState
            });

            return response;
        }

        if (!latestPlan.toolName) {
            return buildCanonicalResponse({
                responseType: RESPONSE_TYPES.ERROR,
                agentType,
                aiResponse: "I couldn't determine a safe CareFlow action for that request."
            });
        }

        const fingerprint = computeToolFingerprint(latestPlan.toolName, latestPlan.toolArgs);
        const isRepeatException = latestPlan.confirmed ||
            latestPlan.toolArgs?.forceRefresh === true ||
            latestPlan.toolName === "createAppointmentHold" ||
            latestPlan.toolName === "validateAppointmentSlot";

        if (executedFingerprints.has(fingerprint) && !isRepeatException) {
            console.log(`[AgentOrchestrator] Duplicate tool execution protected: ${fingerprint}`);
            break;
        }
        executedFingerprints.add(fingerprint);

        // Phase 5: Restrict document search if a shared record was previously selected (Part A10)
        if (userRole === "doctor" && agentState?.stage === "RECORD_SELECTED" && latestPlan?.toolArgs) {
            if (latestPlan.toolName === "searchPatientDocuments" || latestPlan.toolName === "searchMyDocuments") {
                if (agentState.selectedRecordId === "all" && Array.isArray(agentState.sharedMedicalRecords)) {
                    latestPlan.toolArgs.recordIds = agentState.sharedMedicalRecords.map(r => r.id);
                } else if (agentState.selectedRecordId && agentState.selectedRecordId !== "all") {
                    latestPlan.toolArgs.recordId = agentState.selectedRecordId;
                }
                if (agentState.patientId) {
                    latestPlan.toolArgs.patientId = agentState.patientId;
                }
            }
        }

        let execution;
        try {
            execution = await executeOrchestratedTool(
                user,
                latestPlan.toolName,
                latestPlan.toolArgs || {},
                false
            );
        } catch (error) {
            const obs = error.observation || {
                toolName: latestPlan.toolName,
                success: false,
                data: null,
                error: error.message,
                source: "CareFlow Service Layer",
                metadata: {}
            };
            toolTrace.push({
                step: step + 1,
                toolName: latestPlan.toolName,
                args: latestPlan.toolArgs || {},
                result: null,
                observation: obs
            });

            await AIAuditLogModel.create({
                userId,
                organizationId: orgId,
                role: userRole,
                agentType,
                promptSummary: rawPrompt.slice(0, 100),
                toolUsed: latestPlan.toolName,
                toolArgs: latestPlan.toolArgs,
                stepCount: step + 1,
                status: "ERROR",
                errorMessage: error.message,
                modelUsed: latestPlan.modelUsed,
                latencyMs: Date.now() - startTime
            }).catch(() => { });

            return buildCanonicalResponse({
                responseType: RESPONSE_TYPES.ERROR,
                agentType,
                toolUsed: latestPlan.toolName,
                toolObservations: toolTrace.map(t => t.observation),
                aiResponse: `I couldn't complete that CareFlow operation safely: ${error.message}`,
                statusCode: error.statusCode || 500
            });
        }

        if (execution.requiresConfirmation) {
            const pending = await createPendingConfirmation({
                userId,
                role: userRole,
                organizationId: orgId,
                toolName: latestPlan.toolName,
                canonicalArgs: execution.payload || latestPlan.toolArgs,
                displayPayload: execution.payload || latestPlan.toolArgs,
                summary: execution.summary
            });

            const confirmation = buildCanonicalResponse({
                responseType: RESPONSE_TYPES.CONFIRMATION_REQUIRED,
                agentType,
                aiResponse: execution.summary,
                requiresConfirmation: true,
                confirmationRequired: true,
                confirmationId: pending.confirmationId,
                toolUsed: latestPlan.toolName,
                toolName: latestPlan.toolName,
                payload: execution.payload,
                summary: execution.summary,
                result: execution,
                agentState
            });

            await saveAssistantMessage(userId, orgId, {
                role: "assistant",
                text: execution.summary,
                responseType: "CONFIRMATION_REQUIRED",
                isConfirmationCard: true,
                confirmationId: pending.confirmationId,
                confirmationPayload: {
                    confirmationId: pending.confirmationId,
                    summary: execution.summary,
                    toolName: latestPlan.toolName,
                    payload: execution.payload
                },
                agentState
            });

            return confirmation;
        }

        const result = execution.result;
        toolTrace.push({
            step: step + 1,
            toolName: latestPlan.toolName,
            args: latestPlan.toolArgs || {},
            result,
            observation: execution.observation
        });

        // Keep the semantic state synchronized with authoritative observations.
        if (latestPlan && "agentState" in latestPlan) {
            agentState = latestPlan.agentState;
        }
        if (latestPlan.toolName === "classifySpecialtyFromSymptoms") {
            agentState = {
                ...(agentState || {}),
                goal: "BOOK_APPOINTMENT",
                stage: "SELECT_DOCTOR",
                symptoms: result?.symptoms || rawPrompt,
                reason: result?.symptoms || rawPrompt,
                reasonForVisit: result?.symptoms || rawPrompt,
                specialty: result?.specialty || agentState?.specialty,
                doctors: result?.doctors || agentState?.doctors
            };
        }
        if ((latestPlan.toolName === "searchDoctors" || latestPlan.toolName === "getDoctors") && Array.isArray(result?.doctors)) {
            agentState = {
                ...(agentState || {}),
                stage: "SELECT_DOCTOR",
                doctors: result.doctors.map(d => ({
                    doctorId: String(d.doctorId || d._id || d.id || ""),
                    name: d.name || d.userId?.name || "Doctor",
                    specialization: d.specialization || agentState?.specialty
                })).filter(d => d.doctorId)
            };
        }

        if (userRole === "doctor") {
            const resolvedPatientId = result?.patientId || latestPlan.toolArgs?.patientId;
            const resolvedPatientName = result?.patientName || latestPlan.toolArgs?.patientName;
            const resolvedAppointmentId = result?.appointmentId || latestPlan.toolArgs?.appointmentId;
            if (resolvedPatientId || resolvedPatientName || resolvedAppointmentId) {
                agentState = {
                    ...(agentState || {}),
                    ...(resolvedPatientId ? { patientId: String(resolvedPatientId) } : {}),
                    ...(resolvedPatientName ? { patientName: String(resolvedPatientName) } : {}),
                    ...(resolvedAppointmentId ? { appointmentId: String(resolvedAppointmentId) } : {})
                };
            }

            if (latestPlan.toolName === "getDoctorAuthorizedPatients" || result?.authorizedPatients || (result?.patients && !agentState?.patientId)) {
                const pts = result?.authorizedPatients || (Array.isArray(result?.patients) ? result.patients.map((p, idx) => ({
                    patientId: String(p.patientId || p._id),
                    name: p.name,
                    displayName: p.name,
                    index: idx + 1
                })) : []);
                if (pts.length > 0) {
                    agentState = {
                        ...(agentState || {}),
                        stage: "SELECT_PATIENT",
                        authorizedPatients: pts
                    };
                }
            }

            if (latestPlan.toolName === "getSharedMedicalRecords" || result?.sharedMedicalRecords || result?.records) {
                const recs = result?.records || result?.sharedMedicalRecords || result?.agentState?.sharedMedicalRecords;
                if (Array.isArray(recs) && recs.length > 0) {
                    agentState = {
                        ...(agentState || {}),
                        stage: "SELECT_SHARED_RECORD",
                        sharedMedicalRecords: recs,
                        patientId: result?.patientId || agentState?.patientId
                    };
                }
            }
        }

        await AIAuditLogModel.create({
            userId,
            organizationId: orgId,
            role: userRole,
            agentType,
            promptSummary: rawPrompt.slice(0, 100),
            toolUsed: latestPlan.toolName,
            toolArgs: latestPlan.toolArgs,
            confirmationRequired: false,
            confirmed: false,
            status: "SUCCESS",
            modelUsed: latestPlan.modelUsed || "CareFlow-Agent",
            confidence: latestPlan.confidence,
            latencyMs: Date.now() - startTime
        }).catch(() => { });

        // Both booking and non-booking agent workflows continue observing tool results.
        // The planner will decide on the next step whether more tools are required or to RESPOND.
        currentPrompt = promptMessage;
        continue;
    }

    if (toolTrace.length > 0 && (agentState?.goal !== "BOOK_APPOINTMENT" || !["SELECT_DOCTOR", "SELECT_DATE", "SELECT_SLOT", "CONFIRM_BOOKING"].includes(agentState?.stage))) {
        const synthesized = await synthesizeGroundedResponse({
            rawPrompt,
            toolTrace,
            user,
            conversationContext,
            agentState,
            specializedAgentType: resolveAgentType(toolTrace[toolTrace.length - 1].toolName, userRole)
        });

        await saveAssistantMessage(userId, orgId, {
            role: "assistant",
            text: synthesized.aiResponse,
            responseType: synthesized.responseType,
            citations: synthesized.citations || [],
            analyticsPayload: synthesized.analyticsPayload,
            agentState: synthesized.agentState || agentState
        });

        return synthesized;
    }

    return buildCanonicalResponse({
        responseType: RESPONSE_TYPES.ERROR,
        agentType,
        aiResponse: "I couldn't safely complete the request within the agent's step limit. Please continue from the last confirmed step.",
        agentState
    });
};
