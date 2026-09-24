import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "conversation",
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
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "appointment",
            default: null
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true
        },
        senderRole: {
            type: String,
            enum: ["super_admin", "superadmin", "organization_admin", "admin", "doctor", "patient"],
            required: true
        },
        message: {
            type: String,
            trim: true,
            default: ""
        },
        attachment: {
            url: { type: String, default: null },
            publicId: { type: String, default: null }
        }
    },
    {
        timestamps: true
    }
);

chatSchema.index({ conversationId: 1, createdAt: 1 });
chatSchema.index({ patientId: 1, doctorId: 1, createdAt: 1 });

const ChatModel = mongoose.model("chat", chatSchema);

export default ChatModel;
