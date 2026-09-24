import { BaseAgent } from "./baseAgent.js";
import { executeOrchestratedTool } from "../orchestrator/toolExecutor.js";
import { templatePureDataResponse } from "../aiGateway.js";

/**
 * ClinicOperationsAgent: Staff rosters, doctor department profiles, and shift/leave tracking.
 * 
 * Supported Tools:
 * - getOrganizationRoster
 * - getMyDoctorProfile
 * - getDoctorLeave
 */
export class ClinicOperationsAgent extends BaseAgent {
    constructor() {
        super({
            name: "Clinic Operations Agent",
            type: "ClinicOperationsAgent",
            description: "Manages clinic roster details, doctor department assignments, and leave schedules.",
            allowedRoles: ["admin", "super_admin", "doctor"],
            tools: [
                "getOrganizationRoster",
                "getMyDoctorProfile",
                "getDoctorLeave"
            ],
            disclaimer: "Clinic operations data is scoped strictly to authorized organizations."
        });
    }

    async execute(user, toolName, toolArgs = {}, confirmed = false) {
        this.validateAuthorization(user, toolName);

        const execution = await executeOrchestratedTool(user, toolName, toolArgs, confirmed);
        const result = execution.result;

        let aiResponse = "";
        if (toolName === "getMyDoctorProfile" || toolName === "getOrganizationRoster") {
            aiResponse = templatePureDataResponse(toolName, result);
        } else {
            aiResponse = typeof result === "string" ? result : (result?.message || result?.summary || JSON.stringify(result));
        }

        return this.formatResponse({
            toolUsed: toolName,
            result,
            aiResponse,
            responseType: "LIVE_DATA"
        });
    }
}

export const operationsAgent = new ClinicOperationsAgent();
