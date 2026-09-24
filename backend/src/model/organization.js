import mongoose from "mongoose";

const organizationSchema = mongoose.Schema({
    businessId: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, trim: true, required: true },
    email: { type: String, required: true, trim: true, unique: true },
    phone: { type: String, required: true, trim: true },
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        district: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true, default: "India" },
        pincode: { type: String, trim: true },
        latitude: { type: Number, default: 11.9401 },
        longitude: { type: Number, default: 79.4861 },
        mapUrl: { type: String, trim: true }
    },
    workingHours: [
        {   
            day: { type: String, enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"], required: true },
            status: { type: String, enum: ["OPEN", "HALF_DAY", "CLOSED", "NOT_CONFIGURED"], default: "OPEN" },
            isOpen: { type: Boolean, default: true },
            open: { type: String, default: "09:00 AM" },
            close: { type: String, default: "09:00 PM" },
            clode: { type: String, default: "09:00 PM" } // legacy typo fallback
        }
    ],
    status: {
        type: String,
        enum: ['PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'approved', 'suspended'],
        default: 'APPROVED'
    },
    suspensionReason: {
        type: String,
        default: null
    },
    organizationLogo: {
        url: { type: String, default: null },
        publicId: { type: String, default: null }
    }
}, {
    timestamps: true
});

const OrganizationModel = mongoose.model('organization', organizationSchema);
export default OrganizationModel;