import mongoose from "mongoose";

const medicationScheduleSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "patient",
            required: true,
            index: true
        },
        prescriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "prescription",
            default: null,
            index: true
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "doctor",
            default: null
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "organization",
            default: null
        },
        medicineName: {
            type: String,
            required: true,
            trim: true
        },
        dosage: {
            type: String,
            required: true,
            trim: true
        },
        frequency: {
            type: String,
            default: null
        },
        timesPerDay: {
            type: Number,
            default: 1
        },
        timesOfDay: {
            type: [String],
            default: ["09:00"]
        },
        withFood: {
            type: String,
            enum: ["before_food", "with_food", "after_food", "unspecified", null],
            default: "unspecified"
        },
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            default: null
        },
        instructions: {
            type: String,
            default: null
        },
        status: {
            type: String,
            enum: ["PROPOSED", "DOCTOR_APPROVED", "ACTIVE", "COMPLETED", "CANCELLED"],
            default: "PROPOSED",
            index: true
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            default: null
        },
        approvedAt: {
            type: Date,
            default: null
        },
        rejectionReason: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

medicationScheduleSchema.index({ patientId: 1, status: 1 });
medicationScheduleSchema.index({ status: 1, startDate: 1, endDate: 1 });

const MedicationScheduleModel = mongoose.model("medicationSchedule", medicationScheduleSchema);
export default MedicationScheduleModel;
