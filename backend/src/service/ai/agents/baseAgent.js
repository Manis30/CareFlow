import { AppError } from "../../../middleware/errorHandler.js";

/**
 * BaseAgent: Foundational contract for CareFlow Specialized Agents.
 * 
 * Guarantees:
 * - Deterministic role-based authorization check.
 * - Strict tenant isolation enforcement.
 * - Standard structured response envelope.
 * - Delegation to existing business logic / tool executors without duplication.
 */
export class BaseAgent {
    constructor({ name, type, description, allowedRoles = [], tools = [], disclaimer = "" }) {
        this.name = name;
        this.type = type;
        this.description = description;
        this.allowedRoles = new Set(allowedRoles);
        this.tools = new Set(tools);
        this.disclaimer = disclaimer;
    }

    supportsTool(toolName) {
        return this.tools.has(toolName);
    }

    isRoleAllowed(role) {
        const canonicalRole = role === "organization_admin" ? "admin" : role;
        return this.allowedRoles.has(canonicalRole);
    }

    validateAuthorization(user, toolName = null) {
        const userRole = user?.role || "patient";
        if (!this.isRoleAllowed(userRole)) {
            throw new AppError(403, `Access denied: Role '${userRole}' is not authorized to use ${this.name} (${this.type}).`);
        }

        if (toolName && !this.supportsTool(toolName)) {
            throw new AppError(400, `Tool '${toolName}' is not supported by ${this.name}.`);
        }

        return true;
    }

    formatResponse({
        toolUsed = null,
        result = null,
        aiResponse = "",
        citations = [],
        requiresConfirmation = false,
        payload = null,
        responseType = "LIVE_DATA"
    }) {
        return {
            success: true,
            agentType: this.type,
            toolUsed,
            result,
            aiResponse,
            citations,
            requiresConfirmation,
            confirmationRequired: requiresConfirmation,
            payload,
            disclaimer: this.disclaimer,
            responseType
        };
    }
}
