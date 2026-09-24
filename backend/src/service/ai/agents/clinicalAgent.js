import { BaseAgent } from "./baseAgent.js";
import { executeOrchestratedTool } from "../orchestrator/toolExecutor.js";

/**
 * ClinicalIntelligenceAgent: Doctor copilot for intake summaries, SOAP notes, and prescriptions.
 * 
 * Supported Tools:
 * - getAuthorizedPatientHistory
 * - summarizeAppointmentContext
 * - draftClinicalNotes
 * - draftPrescription
 * - checkInPatient
 */
export class ClinicalIntelligenceAgent extends BaseAgent {
    constructor() {
        super({
            name: "Clinical Intelligence Agent",
            type: "ClinicalIntelligenceAgent",
            description: "Doctor-facing copilot for pre-visit briefs, clinical notes drafting, and prescriptions.",
            allowedRoles: ["doctor", "super_admin"],
            tools: [
                "getAuthorizedPatientHistory",
                "summarizeAppointmentContext",
                "draftClinicalNotes",
                "draftPrescription",
                "checkInPatient"
            ],
            disclaimer: "CareFlow AI clinical outputs are for physician assistance only and do not replace independent professional medical judgment."
        });
    }

    async execute(user, toolName, toolArgs = {}, confirmed = false) {
        this.validateAuthorization(user, toolName);

        const execution = await executeOrchestratedTool(user, toolName, toolArgs, confirmed);

        if (execution.requiresConfirmation) {
            return this.formatResponse({
                toolUsed: toolName,
                requiresConfirmation: true,
                payload: execution.payload,
                result: execution,
                aiResponse: execution.summary || `Confirmation required for ${toolName}.`,
                responseType: "CONFIRMATION_REQUIRED"
            });
        }

        const result = execution.result;
        let responseType = "CLINICAL_COPILOT";
        if (toolName === "summarizeAppointmentContext") responseType = "PRE_VISIT_BRIEF";

        return this.formatResponse({
            toolUsed: toolName,
            result,
            aiResponse: typeof result === "string" ? result : (result?.message || result?.summary || result?.notes || JSON.stringify(result)),
            responseType
        });
    }
}

export const clinicalAgent = new ClinicalIntelligenceAgent();
