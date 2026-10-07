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
            "MEDICATION_REMINDER",
            "MEDICATION_DUE",
            "FOLLOW_UP_REMINDER",
            "PAYMENT_SUCCESSFUL",
            "PAYMENT_FAILED",
            "PRESCRIPTION_ISSUED",
            "MEDICAL_RECORD_SHARED",
            "SYSTEM_ALERT"
        ],
        default: "SYSTEM_ALERT"
    },
    relatedEntityType: {
        type: String,
        default: null
    },
    relatedEntityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    scheduledFor: {
        type: Date,
        default: null
    },
    sentAt: {
        type: Date,
        default: null
    },
    readAt: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ["PENDING", "SENT", "READ", "FAILED"],
        default: "SENT"
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
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ userId: 1, type: 1, relatedEntityId: 1, scheduledFor: 1 });

const NotificationModel = mongoose.model("notification", notificationSchema);
export default NotificationModel;
