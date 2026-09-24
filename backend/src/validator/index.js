import { z } from "zod";

// User / Auth Schemas
export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters")
});

export const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phone: z.string().optional(),
    role: z.enum(["patient", "doctor", "admin", "super_admin"]).optional()
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters")
});

// Appointment Schemas
export const createAppointmentSchema = z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    departmentId: z.string().optional(),
    organizationId: z.string().optional(),
    consultationType: z.enum(["online", "offline"]),
    appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Appointment date must be YYYY-MM-DD"),
    startTime: z.string().min(1, "Start time is required"),
    reason: z.string().optional(),
    triageInfo: z.object({
        chiefComplaint: z.string().optional(),
        severity: z.enum(["low", "moderate", "high", "emergency"]).optional(),
        hpiSummary: z.string().optional(),
        recommendedDepartment: z.string().optional(),
        isEmergency: z.boolean().optional()
    }).optional()
});

export const cancelAppointmentSchema = z.object({
    cancelReason: z.string().min(3, "Cancellation reason must be provided")
});

// Prescription Schema
export const createPrescriptionSchema = z.object({
    appointmentId: z.string().min(1, "Appointment ID is required"),
    diagnosis: z.string().min(2, "Diagnosis is required"),
    medicines: z.array(z.object({
        medicineName: z.string().min(1, "Medicine name is required"),
        dosage: z.string().min(1, "Dosage is required"),
        frequency: z.string().optional(),
        duration: z.string().optional(),
        instructions: z.string().optional()
    })).min(1, "At least one medicine is required"),
    notes: z.string().optional()
});

// AI Gateway Request Schema
export const aiGatewayRequestSchema = z.object({
    agentType: z.enum([
        "PatientAssistant",
        "DoctorCopilot",
        "ClinicOpsAgent",
        "SuperAdminIntelligence"
    ]).optional(),
    message: z.string().optional(),
    toolName: z.string().optional(),
    toolArgs: z.record(z.any()).optional(),
    confirmed: z.boolean().optional(),
    confirmationId: z.string().optional(),
    context: z.record(z.any()).optional()
});
