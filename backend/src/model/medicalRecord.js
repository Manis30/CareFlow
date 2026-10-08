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
            },
            mimeType: {
                type: String,
                default: null
            },
            fileName: {
                type: String,
                default: null
            },
            fileExtension: {
                type: String,
                default: null
            },
            fileCategory: {
                type: String,
                enum: ["document", "image", "other"],
                default: "document"
            },
            fileSize: {
                type: Number,
                default: 0
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
        ],
        extractedText: {
            type: String,
            default: null
        },
        ocrConfidence: {
            type: Number,
            default: null
        },
        ocrStatus: {
            type: String,
            enum: ["PENDING", "PROCESSING", "COMPLETED", "LOW_CONFIDENCE", "UNAVAILABLE"],
            default: "PENDING"
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

medicalRecordSchema.virtual("fileUrl").get(function () {
    return this.file?.url;
});

medicalRecordSchema.index({ patientId: 1 });
medicalRecordSchema.index({ "sharedWith.doctorId": 1 });
medicalRecordSchema.index({ appointmentId: 1 });

const MedicalRecordModel = mongoose.model(
    "medicalRecord",
    medicalRecordSchema
);

export default MedicalRecordModel;
