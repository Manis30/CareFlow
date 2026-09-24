import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
    {
        businessId: {
            type: String,
            unique: true,
            sparse: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            unique: true
        },
        dateOfBirth: {
            type: Date,
            default: null
        },
        gender: {
            type: String,
            enum: ["male", "female", "other"],
            default: null
        },

        bloodGroup: {
            type: String,
            enum: [
                "A+",
                "A-",
                "B+",
                "B-",
                "AB+",
                "AB-",
                "O+",
                "O-"
            ],
            default: null
        },

        address: {
            street: {
                type: String,
                default: null
            },

            city: {
                type: String,
                default: null
            },

            district: {
                type: String,
                default: null
            },

            state: {
                type: String,
                default: null
            },

            pincode: {
                type: String,
                default: null
            }
        },

        emergencyContact: {
            name: {
                type: String,
                default: null
            },

            phone: {
                type: String,
                default: null
            },

            relationship: {
                type: String,
                default: null
            }
        },

        allergies: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true
    }
);

const PatientModel = mongoose.model(
    "patient",
    patientSchema
);

export default PatientModel;