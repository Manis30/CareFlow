import { BaseAgent } from "./baseAgent.js";
import { executeOrchestratedTool } from "../orchestrator/toolExecutor.js";

/**
 * MedicalDocumentAgent: Scoped document retrieval, OCR Q&A, and prescription explanations.
 * 
 * Supported Tools:
 * - searchMyDocuments
 * - getMyMedicalRecords
 * - getMyPrescriptions
 * - explainMyPrescriptions
 */
export class MedicalDocumentAgent extends BaseAgent {
    constructor() {
        super({
            name: "Medical Document Agent",
            type: "MedicalDocumentAgent",
            description: "Answers patient and doctor questions grounded in verified medical records and prescriptions.",
            allowedRoles: ["patient", "doctor", "super_admin"],
            tools: [
                "searchMyDocuments",
                "getMyMedicalRecords",
                "getMyPrescriptions",
                "explainMyPrescriptions"
            ],
            disclaimer: "CareFlow AI document extraction is grounded directly in verified patient records."
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
        const citations = result?.citations || (result?.recordId ? [{ recordId: result.recordId, title: result.title }] : []);

        return this.formatResponse({
            toolUsed: toolName,
            result,
            citations,
            aiResponse: typeof result === "string" ? result : (result?.answer || result?.message || result?.summary || JSON.stringify(result)),
            responseType: "GROUNDED_RECORD"
        });
    }
}

export const documentAgent = new MedicalDocumentAgent();
