import mongoose from "mongoose";

const aiChatMessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ["user", "assistant", "system"],
        required: true
    },
    text: {
        type: String,
        required: true
    },
    citations: [{
        type: String
    }],
    toolCallsUsed: [{
        toolName: String,
        args: Object,
        resultSummary: String,
        doctorList: Array
    }],
    doctorList: [{
        doctorId: String,
        name: String,
        specialization: String,
        organizationId: String
    }],
    isConfirmationCard: {
        type: Boolean,
        default: false
    },
    confirmationPayload: {
        type: Object,
        default: null
    },
    responseType: {
        type: String,
        default: "live_data"
    },
    confirmationId: {
        type: String,
        default: null
    },
    isEmergency: {
        type: Boolean,
        default: false
    },
    confirmed: {
        type: Boolean,
        default: false
    },
    agentState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    structuredPayload: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { strict: false });

const aiChatHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "organization",
        required: false,
        default: null,
        index: true
    },
    messages: [aiChatMessageSchema]
}, {
    timestamps: true
});

aiChatHistorySchema.index({ userId: 1, organizationId: 1 });

const AIChatHistoryModel = mongoose.model("AIChatHistory", aiChatHistorySchema);

export default AIChatHistoryModel;
