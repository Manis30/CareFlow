import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
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
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "patient",
            required: true
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "doctor",
            required: true
        },
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "department",
            required: true
        },
        consultationType: {
            type: String,
            enum: ["online", "offline"],
            required: true
        },
        appointmentDate: {
            type: Date,
            required: true
        },
        startTime: {
            type: String,
            required: true
        },
        endTime: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: [
                "BOOKED",
                "CONFIRMED",
                "CHECKED_IN",
                "WAITING",
                "IN_PROGRESS",
                "COMPLETED",
                "CANCELLED",
                "NO_SHOW",
                "HELD",
                "booked",
                "in_progress",
                "completed",
                "cancelled",
                "no_show"
            ],
            default: "BOOKED"
        },
        holdExpiresAt: {
            type: Date,
            default: null
        },
        triageInfo: {
            chiefComplaint: { type: String, default: null },
            severity: { type: String, enum: ["low", "moderate", "high", "emergency"], default: "low" },
            hpiSummary: { type: String, default: null },
            recommendedDepartment: { type: String, default: null },
            isEmergency: { type: Boolean, default: false }
        },
        consultationStatus: {
            type: String,
            enum: [
                "scheduled",
                "in_progress",
                "completed",
                "cancelled"
            ],
            default: "scheduled"
        },
        consultationStartedAt: {
            type: Date,
            default: null
        },
        completedAt: {
            type: Date,
            default: null
        },
        paymentStatus: {
            type: String,
            enum: [
                "AVAILABLE",
                "HELD",
                "PAYMENT_PENDING",
                "PAID",
                "CONFIRMED",
                "pending",
                "paid",
                "failed"
            ],
            default: "pending"
        },
        reason: {
            type: String,
            trim: true,
            default: null
        },
        reasonForVisit: {
            type: String,
            trim: true,
            default: null
        },
        cancelReason: {
            type: String,
            trim: true,
            default: null
        },
        cancelledBy: {
            type: String,
            enum: [
                "patient",
                "doctor",
                "admin",
                "receptionist",
                "organization_admin",
                "super_admin",
                "PATIENT",
                "DOCTOR",
                "RECEPTIONIST",
                "ORG_ADMIN",
                "SUPER_ADMIN"
            ],
            default: null
        },
        cancelledAt: {
            type: Date,
            default: null
        },
        onlineMeeting: {
            provider: {
                type: String,
                default: null
            },
            meetingLink: {
                type: String,
                default: null
            },
            roomName: {
                type: String,
                default: null
            }
        },
        meeting: {
            provider: { type: String, default: null },
            roomName: { type: String, default: null },
            meetingUrl: { type: String, default: null },
            status: { type: String, default: "scheduled" }
        },
        // Section 6: Flagged when a doctor adds leave that overlaps this appointment.
        // Human must explicitly reschedule or cancel — no auto-cancel.
        needsRescheduling: { type: Boolean, default: false }
    },
    {
        timestamps: true
    }
);

appointmentSchema.index(
    {
        doctorId: 1,
        appointmentDate: 1,
        startTime: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: { $in: ["booked", "BOOKED", "in_progress", "IN_PROGRESS", "confirmed", "CONFIRMED", "held", "HELD"] }
        }
    }
);

appointmentSchema.index(
    {
        patientId: 1,
        appointmentDate: 1,
        startTime: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: { $in: ["booked", "BOOKED", "in_progress", "IN_PROGRESS", "confirmed", "CONFIRMED", "held", "HELD"] }
        }
    }
);

const AppointmentModel = mongoose.model(
    "appointment",
    appointmentSchema
);

export default AppointmentModel;