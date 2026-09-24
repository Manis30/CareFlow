import mongoose from "mongoose";

const medicalRecordSchema = new mongoose.Schema(
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
            required: false,
            default: null
        },
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "patient",
            required: true
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "appointment",
            default: null
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true
        },
        uploadedByRole: {
            type: String,
            enum: ["patient", "doctor", "admin"],
            required: true
        },
        recordType: {
            type: String,
            required: true,
            trim: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true,
            default: null
        },
        file: {
            url: {
                type: String,
                required: true
            },
            publicId: {
                type: String,
                required: true
            },
            resourceType: {
                type: String,
                default: "auto"
            }
        },
        visibility: {
            type: String,
            enum: ["private", "shared", "appointment"],
            default: "private"
        },
        sharedWith: [
            {
                doctorId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "doctor",
                    required: true
                },
                sharedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

medicalRecordSchema.index({ patientId: 1 });
medicalRecordSchema.index({ "sharedWith.doctorId": 1 });
medicalRecordSchema.index({ appointmentId: 1 });

const MedicalRecordModel = mongoose.model(
    "medicalRecord",
    medicalRecordSchema
);

export default MedicalRecordModel;
