import mongoose from "mongoose";
const paymentSchema = new mongoose.Schema(
    {
        businessId: {
            type: String,
            unique: true,
            sparse: true,
            index: true
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "appointment",
            required: true,
            unique: true
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
            ref: "doctor"
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        paymentMethod: {
            type: String,
            default: "cash"
        },
        status: {
            type: String,
            enum: [
                "CREATED",
                "PAYMENT_PENDING",
                "PAID",
                "PAYMENT_FAILED",
                "REFUND_PENDING",
                "REFUNDED",
                "pending",
                "paid",
                "failed"
            ],
            default: "PAYMENT_PENDING"
        },
        razorpayOrderId: {
            type: String,
            default: null
        },
        razorpayPaymentId: {
            type: String,
            default: null
        },
        razorpaySignature: {
            type: String,
            default: null
        },
        transactionId: {
            type: String,
            default: null
        },
        paidAt: {
            type: Date,
            default: null
        },
        failureReason: {
            type: String,
            default: null
        },
        refundId: {
            type: String,
            default: null
        },
        refundAmount: {
            type: Number,
            default: 0
        },
        refundReason: {
            type: String,
            default: null
        },
        refundedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);
const PaymentModel = mongoose.model(
    "payment",
    paymentSchema
);
export default PaymentModel;