import mongoose from "mongoose";

const doseLogSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "patient",
            required: true,
            index: true
        },
        scheduleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "medicationSchedule",
            required: true,
            index: true
        },
        scheduledTime: {
            type: Date,
            required: true,
            index: true
        },
        takenTime: {
            type: Date,
            default: null
        },
        status: {
            type: String,
            enum: ["TAKEN", "MISSED", "SKIPPED", "SNOOZED"],
            required: true,
            index: true
        },
        snoozedUntil: {
            type: Date,
            default: null
        },
        notes: {
            type: String,
            default: null
        },
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true
        }
    },
    {
        timestamps: true
    }
);

doseLogSchema.index({ scheduleId: 1, scheduledTime: 1 });
doseLogSchema.index({ patientId: 1, scheduledTime: -1 });

const DoseLogModel = mongoose.model("doseLog", doseLogSchema);
export default DoseLogModel;
