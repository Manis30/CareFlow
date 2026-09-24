import { appointmentAgent } from "./appointmentAgent.js";
import { clinicalAgent } from "./clinicalAgent.js";
import { documentAgent } from "./documentAgent.js";
import { analyticsAgent } from "./analyticsAgent.js";
import { operationsAgent } from "./operationsAgent.js";

export {
    appointmentAgent,
    clinicalAgent,
    documentAgent,
    analyticsAgent,
    operationsAgent
};

export const AGENT_REGISTRY = {
    AppointmentAgent: appointmentAgent,
    ClinicalIntelligenceAgent: clinicalAgent,
    MedicalDocumentAgent: documentAgent,
    AnalyticsAgent: analyticsAgent,
    ClinicOperationsAgent: operationsAgent
};

/**
 * Resolves the specialized agent responsible for a specific tool.
 */
export const getAgentForTool = (toolName) => {
    for (const agent of Object.values(AGENT_REGISTRY)) {
        if (agent.supportsTool(toolName)) {
            return agent;
        }
    }
    return null;
};

/**
 * Resolves the specialized agent by agentType name.
 */
export const getAgentByType = (agentType) => {
    return AGENT_REGISTRY[agentType] || null;
};
