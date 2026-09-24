import { BaseAgent } from "./baseAgent.js";
import { executeOrchestratedTool } from "../orchestrator/toolExecutor.js";
import { templatePureDataResponse } from "../aiGateway.js";

/**
 * AnalyticsAgent: Executive intelligence, financial metrics, and operational trends.
 * 
 * Supported Tools:
 * - getHealthcareAnalytics
 * - getPlatformStats
 * - getClinicStats
 * - getPaymentStats
 * - getSystemHealthTrends
 */
export class AnalyticsAgent extends BaseAgent {
    constructor() {
        super({
            name: "Analytics Agent",
            type: "AnalyticsAgent",
            description: "Computes financial summaries, clinic volume trends, department analytics, and platform metrics.",
            allowedRoles: ["super_admin", "admin", "doctor"],
            tools: [
                "getHealthcareAnalytics",
                "getPlatformStats",
                "getClinicStats",
                "getPaymentStats",
                "getSystemHealthTrends"
            ],
            disclaimer: "CareFlow operational analytics are computed directly from authorized database records."
        });
    }

    async execute(user, toolName, toolArgs = {}, confirmed = false) {
        this.validateAuthorization(user, toolName);

        const execution = await executeOrchestratedTool(user, toolName, toolArgs, confirmed);
        const result = execution.result;
        const templated = templatePureDataResponse(toolName, result);

        return this.formatResponse({
            toolUsed: toolName,
            result,
            aiResponse: templated,
            responseType: "ANALYTICS"
        });
    }
}

export const analyticsAgent = new AnalyticsAgent();
