import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
    {
        conversationType: {
            type: String,
            enum: [
                "PATIENT_DOCTOR",
                "SUPER_ADMIN_ORGANIZATION_ADMIN",
                "SUPER_ADMIN_ORG_ADMIN",
                "ORGANIZATION_ADMIN_DOCTOR",
                "ORG_ADMIN_DOCTOR"
            ],
            default: "PATIENT_DOCTOR",
            required: true
        },
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "patient",
            default: null
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "doctor",
            default: null
        },
        organizationAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            default: null
        },
        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            default: null
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "organization",
            default: null
        },
        lastMessage: {
            messageId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "chat"
            },
            content: {
                type: String,
                default: ""
            },
            type: {
                type: String,
                default: "TEXT"
            },
            senderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "user"
            },
            sentAt: {
                type: Date,
                default: null
            }
        },
        lastMessageAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Partial unique compound indexes for each conversationType
conversationSchema.index(
    { conversationType: 1, patientId: 1, doctorId: 1 },
    { unique: true, partialFilterExpression: { conversationType: "PATIENT_DOCTOR" } }
);

conversationSchema.index(
    { conversationType: 1, superAdminId: 1, organizationAdminId: 1 },
    { unique: true, partialFilterExpression: { conversationType: { $in: ["SUPER_ADMIN_ORG_ADMIN", "SUPER_ADMIN_ORGANIZATION_ADMIN"] } } }
);

conversationSchema.index(
    { conversationType: 1, organizationAdminId: 1, doctorId: 1 },
    { unique: true, partialFilterExpression: { conversationType: { $in: ["ORG_ADMIN_DOCTOR", "ORGANIZATION_ADMIN_DOCTOR"] } } }
);

conversationSchema.index({ lastMessageAt: -1 });

const ConversationModel = mongoose.model("conversation", conversationSchema);

export default ConversationModel;
