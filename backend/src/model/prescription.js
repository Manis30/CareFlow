import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
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
    duration: {
        type: String,
        default: null
    },
    instructions: {
        type: String,
        default: null
    }
});

const prescriptionSchema = new mongoose.Schema(
    {
        businessId: {
            type: String,
            unique: true,
            sparse: true,
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
            required: true,
            unique: true
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "doctor",
            required: true
        },
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "patient",
            required: true
        },
        diagnosis: {
            type: String,
            required: true,
            trim: true
        },
        medicines: {
            type: [medicineSchema],
            default: []
        },
        notes: {
            type: String,
            trim: true,
            default: null
        }
    },
    {
        timestamps: true
    }
);

prescriptionSchema.index({ doctorId: 1 });
prescriptionSchema.index({ patientId: 1 });

const PrescriptionModel = mongoose.model(
    "prescription",
    prescriptionSchema
);

export default PrescriptionModel;
