import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "organization",
        default: null
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: [
            "APPOINTMENT_BOOKED",
            "APPOINTMENT_CONFIRMED",
            "APPOINTMENT_CANCELLED",
            "APPOINTMENT_REMINDER",
            "PAYMENT_SUCCESSFUL",
            "PAYMENT_FAILED",
            "PRESCRIPTION_ISSUED",
            "MEDICAL_RECORD_SHARED",
            "SYSTEM_ALERT"
        ],
        default: "SYSTEM_ALERT"
    },
    read: {
        type: Boolean,
        default: false
    },
    metaData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const NotificationModel = mongoose.model("notification", notificationSchema);
export default NotificationModel;
