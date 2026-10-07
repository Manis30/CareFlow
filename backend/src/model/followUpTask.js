import mongoose from "mongoose";

const followUpTaskSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "patient",
            required: true,
            index: true
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "doctor",
            required: true,
            index: true
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "organization",
            required: true
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "appointment",
            default: null
        },
        followUpDate: {
            type: Date,
            required: true,
            index: true
        },
        reason: {
            type: String,
            required: true,
            trim: true
        },
        instructions: {
            type: String,
            default: null
        },
        status: {
            type: String,
            enum: ["PENDING", "COMPLETED", "CANCELLED"],
            default: "PENDING",
            index: true
        },
        remindedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

followUpTaskSchema.index({ patientId: 1, followUpDate: 1 });
followUpTaskSchema.index({ doctorId: 1, followUpDate: 1 });

const FollowUpTaskModel = mongoose.model("followUpTask", followUpTaskSchema);
export default FollowUpTaskModel;
