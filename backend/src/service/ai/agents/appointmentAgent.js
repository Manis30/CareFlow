import { BaseAgent } from "./baseAgent.js";
import { executeOrchestratedTool } from "../orchestrator/toolExecutor.js";

/**
 * AppointmentAgent: Specialized agent for scheduling, doctor search, triage, and slot booking.
 * 
 * Supported Tools:
 * - classifySpecialtyFromSymptoms
 * - searchDoctors
 * - getDoctorAvailability
 * - createAppointmentHold
 * - cancelAppointment
 * - rescheduleAppointment
 * - getMyAppointments
 * - getDoctorLeave
 */
export class AppointmentAgent extends BaseAgent {
    constructor() {
        super({
            name: "Appointment Agent",
            type: "AppointmentAgent",
            description: "Manages clinic appointment bookings, triage classification, slot searches, and reschedules.",
            allowedRoles: ["patient", "doctor", "admin", "super_admin"],
            tools: [
                "classifySpecialtyFromSymptoms",
                "searchDoctors",
                "getDoctorAvailability",
                "createAppointmentHold",
                "cancelAppointment",
                "rescheduleAppointment",
                "getMyAppointments",
                "getDoctorLeave"
            ],
            disclaimer: "CareFlow appointments are subject to clinic scheduling and doctor confirmation."
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
        return this.formatResponse({
            toolUsed: toolName,
            result,
            aiResponse: typeof result === "string" ? result : (result?.message || result?.summary || JSON.stringify(result)),
            responseType: confirmed ? "ACTION_COMPLETED" : "LIVE_DATA"
        });
    }
}

export const appointmentAgent = new AppointmentAgent();
