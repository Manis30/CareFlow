import mongoose from "mongoose";

/**
 * AIPendingConfirmation Model (Rule 8)
 * Persists all server-side AI confirmations to MongoDB with atomic consumption and TTL.
 * Replaces in-memory Map to guarantee multi-instance reliability and prevent double-booking.
 */
const aiPendingConfirmationSchema = new mongoose.Schema({
    confirmationId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    role: {
        type: String,
        required: true,
        enum: ["super_admin", "admin", "doctor", "patient"]
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "organization",
        default: null
    },
    toolName: {
        type: String,
        required: true
    },
    canonicalArgs: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    displayPayload: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    summary: {
        type: String,
        default: ""
    },
    actionHash: {
        type: String,
        default: null
    },
    consumed: {
        type: Boolean,
        default: false,
        index: true
    },
    consumedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // MongoDB TTL index: documents expire automatically when expiresAt is reached
    }
}, {
    timestamps: true
});

aiPendingConfirmationSchema.index({ confirmationId: 1, userId: 1, consumed: 1 });

const AIPendingConfirmationModel = mongoose.model("AIPendingConfirmation", aiPendingConfirmationSchema);

export default AIPendingConfirmationModel;
