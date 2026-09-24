import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "organization",
        default: null
    },
    userRole: {
        type: String,
        default: null
    },
    action: {
        type: String,
        required: true,
        enum: [
            "LOGIN",
            "LOGOUT",
            "MEDICAL_RECORD_VIEW",
            "MEDICAL_RECORD_DOWNLOAD",
            "MEDICAL_RECORD_SHARE",
            "MEDICAL_RECORD_REVOKE",
            "PRESCRIPTION_CREATE",
            "APPOINTMENT_CREATE",
            "APPOINTMENT_CANCEL",
            "ORGANIZATION_APPROVED",
            "ORGANIZATION_SUSPENDED",
            "AI_ACTION_EXECUTED"
        ]
    },
    resourceId: {
        type: String,
        default: null
    },
    resourceType: {
        type: String,
        default: null
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });

const AuditLogModel = mongoose.model("auditLog", auditLogSchema);
export default AuditLogModel;
