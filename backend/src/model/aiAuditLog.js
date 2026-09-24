import mongoose from "mongoose";

const aiAuditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "organization",
        default: null
    },
    role: {
        type: String,
        required: true,
        enum: ["patient", "doctor", "admin", "organization_admin", "super_admin"]
    },
    agentType: {
        type: String,
        required: true,
        enum: [
            "AppointmentAgent",
            "ClinicalIntelligenceAgent",
            "MedicalDocumentAgent",
            "AnalyticsAgent",
            "ClinicOperationsAgent",
            "PatientAssistant",
            "DoctorCopilot",
            "ClinicOpsAgent",
            "SuperAdminIntelligence"
        ]
    },
    promptSummary: {
        type: String,
        default: null
    },
    toolUsed: {
        type: String,
        default: null
    },
    toolArgs: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    confirmationRequired: {
        type: Boolean,
        default: false
    },
    confirmed: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["SUCCESS", "DENIED", "ERROR", "CONFIRMATION_PENDING", "CONFIRMED", "EMERGENCY_ESCALATION"],
        default: "SUCCESS"
    },
    modelUsed: {
        type: String,
        default: null
    },
    confidence: {
        type: Number,
        default: null
    },
    clarifyingQuestionTriggered: {
        type: Boolean,
        default: false
    },
    latencyMs: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

aiAuditLogSchema.index({ userId: 1, createdAt: -1 });
aiAuditLogSchema.index({ organizationId: 1, createdAt: -1 });
aiAuditLogSchema.index({ agentType: 1 });

const AIAuditLogModel = mongoose.model("aiAuditLog", aiAuditLogSchema);
export default AIAuditLogModel;
