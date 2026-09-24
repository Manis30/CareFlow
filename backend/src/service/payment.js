import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import { AppError } from "../middleware/errorHandler.js";
import { formatDoctorName } from "../util/formatters.js";
import { generateBusinessId } from "../util/idGenerator.js";

import {
    createPayment,
    getPaymentByAppointmentId,
    updatePaymentByAppointmentId,
    getPaymentsByPatientId
} from "../repository/payment.js";

import {
    findAppointment
} from "../repository/appointment.js";

import {
    getPatientByUserId
} from "../repository/patient.js";
import { getDoctorById } from "../repository/doctor.js";
import { getOrCreateGeneralDepartment } from "../repository/department.js";
import { createAppointment, getAppointmentById, updateMeetingDetails } from "../repository/appointment.js";
import { checkDoctorSlotConflict, validateAppointmentSlot } from "./appointment.js";
import AppointmentModel from "../model/appointment.js";
import PaymentModel from "../model/payment.js";
export const initializePaymentService = async (appointment,
    amount,
    paymentMethod
) => {

    const existingPayment =
        await getPaymentByAppointmentId(
            appointment._id
        );

    if (existingPayment) {
        return existingPayment;
    }

    return await createPayment({
        businessId: generateBusinessId("PAY"),
        appointmentId: appointment._id,
        organizationId: appointment.organizationId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId?._id || appointment.doctorId,
        amount,
        paymentMethod,
        status: "pending"
    });
};
export const getMyPaymentsService = async (
    userId
) => {

    const patient =
        await getPatientByUserId(userId);

    if (!patient) {

        throw new AppError(
            404,
            "Patient profile not found"
        );
    }

    return await getPaymentsByPatientId(
        patient._id
    );
};
export const getAppointmentPaymentService = async (
    appointmentId,
    userId
) => {

    const patient =
        await getPatientByUserId(userId);

    if (!patient) {

        throw new AppError(
            404,
            "Patient profile not found"
        );
    }

    const appointment =
        await findAppointment({
            _id: appointmentId,
            patientId: patient._id
        });

    if (!appointment) {

        throw new AppError(
            404,
            "Appointment not found"
        );
    }

    const payment =
        await getPaymentByAppointmentId(
            appointmentId
        );

    if (!payment) {

        throw new AppError(
            404,
            "Payment not found"
        );
    }

    return payment;
};
export const completeCashPaymentService = async (
    appointmentId
) => {

    const payment =
        await getPaymentByAppointmentId(
            appointmentId
        );

    if (!payment) {

        return null;
    }

    if (
        payment.paymentMethod === "cash" &&
        payment.status === "pending"
    ) {

        return await updatePaymentByAppointmentId(
            appointmentId,
            {
                status: "paid",
                paidAt: new Date()
            }
        );
    }

    return payment;
};
export const createRazorpayOrderService = async (
    appointmentId,
    userId
) => {
    const patient =
        await getPatientByUserId(userId);
    if (!patient) {
        throw new AppError(
            404,
            "Patient profile not found"
        );
    }


    const appointment =
        await findAppointment({
            _id: appointmentId,
            patientId: patient._id
        });

    if (!appointment) {
        throw new AppError(
            404,
            "Appointment not found"
        );
    }
    if (appointment.status === "cancelled") {
        throw new AppError(
            400,
            "Cannot initiate payment for a cancelled appointment."
        );
    }
    let payment =
        await getPaymentByAppointmentId(
            appointmentId
        );

    if (!payment) {
        payment = await initializePaymentService(
            appointment,
            appointment.doctorId?.consultationFee ?? appointment.consultationFee ?? 0,
            "online"
        );
    }
    if (payment.status === "paid") {
        throw new AppError(
            400,
            "This appointment is already paid"
        );
    }
    if (payment.paymentMethod !== "online") {
        throw new AppError(
            400,
            "This appointment is configured for cash payment"
        );
    }
    const order =
        await razorpay.orders.create({

            amount: Math.round(
                payment.amount * 100
            ),

            currency: "INR",

            receipt: `appointment_${appointmentId}`

        });


    const updatedPayment =
        await updatePaymentByAppointmentId(
            appointmentId,
            {
                status: "pending",

                razorpayOrderId: order.id,

                razorpayPaymentId: null,

                razorpaySignature: null,

                paidAt: null
            }
        );


    return {
        payment: updatedPayment,

        order: {
            id: order.id,
            amount: order.amount,
            currency: order.currency
        }
    };
};
export const verifyRazorpayPaymentService = async (
    data,
    userId
) => {

    const {
        appointmentId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    } = data;


    const patient =
        await getPatientByUserId(userId);

    if (!patient) {

        throw new AppError(
            404,
            "Patient profile not found"
        );
    }


    const appointment =
        await findAppointment({
            _id: appointmentId,
            patientId: patient._id
        });

    if (!appointment) {
        throw new AppError(
            404,
            "Appointment not found"
        );
    }

    if (appointment.status === "cancelled") {
        throw new AppError(
            400,
            "Cannot process payment for a cancelled appointment."
        );
    }


    const payment =
        await getPaymentByAppointmentId(
            appointmentId
        );

    if (!payment) {

        throw new AppError(
            404,
            "Payment not found"
        );
    }


    if (payment.status === "paid") {
        return await updatePaymentByAppointmentId(appointmentId, { status: "paid" });
    }

    if (payment.paymentMethod !== "online") {
        throw new AppError(
            400,
            "This appointment is not configured for online payment"
        );
    }

    if (payment.razorpayOrderId && payment.razorpayOrderId !== razorpayOrderId) {
        throw new AppError(
            400,
            "Invalid Razorpay order ID"
        );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;
    if (!secret) {
        throw new AppError(500, "Razorpay secret is not configured in server environment.");
    }

    const generatedSignature =
        crypto
            .createHmac(
                "sha256",
                secret
            )
            .update(
                `${razorpayOrderId}|${razorpayPaymentId}`
            )
            .digest("hex");

    if (
        generatedSignature !== razorpaySignature
    ) {
        await updatePaymentByAppointmentId(
            appointmentId,
            {
                status: "failed"
            }
        );

        throw new AppError(
            400,
            "Payment verification failed: Invalid signature"
        );
    }

    const updatedPayment = await updatePaymentByAppointmentId(
        appointmentId,
        {
            status: "paid",
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            paidAt: new Date()
        }
    );

    // Update appointment paymentStatus, status, and generate Jitsi meeting if online
    appointment.paymentStatus = "paid";
    appointment.status = "booked";

    if (appointment.consultationType === "online" && (!appointment.meeting || !appointment.meeting.meetingUrl)) {
        const { createJitsiMeeting } = await import("./meetingService.js");
        const jitsiMeeting = createJitsiMeeting(appointment._id.toString());
        appointment.meeting = jitsiMeeting;
        appointment.onlineMeeting = {
            provider: jitsiMeeting.provider,
            meetingLink: jitsiMeeting.meetingUrl,
            roomName: jitsiMeeting.roomName
        };
    }

    await appointment.save();

    return updatedPayment;
};

export const getClinicPaymentsService = async (organizationId, filterOptions = 'all') => {
    if (!organizationId) {
        throw new AppError(400, "Organization ID is required");
    }

    let statusFilter = 'all';
    let departmentIdFilter = '';
    let doctorIdFilter = '';

    if (typeof filterOptions === 'string') {
        statusFilter = filterOptions;
    } else if (typeof filterOptions === 'object' && filterOptions !== null) {
        statusFilter = filterOptions.status || 'all';
        departmentIdFilter = filterOptions.departmentId || '';
        doctorIdFilter = filterOptions.doctorId || '';
    }

    const AppointmentModel = (await import("../model/appointment.js")).default;
    const PaymentModel = (await import("../model/payment.js")).default;
    const DoctorModel = (await import("../model/doctor.js")).default;

    // Load all doctors in the organization and build an ID-to-Name map
    const allOrgDoctors = await DoctorModel.find({ organizationId }).populate("userId", "name email").lean();
    const doctorNameMap = new Map();
    for (const doc of allOrgDoctors) {
        const dName = doc.userId?.name || doc.name;
        if (dName) {
            doctorNameMap.set(String(doc._id), dName);
            if (doc.userId?._id) {
                doctorNameMap.set(String(doc.userId._id), dName);
            }
        }
    }

    // Sync/auto-heal payment records for any appointments missing a Payment record or doctorId link
    const orgAppointments = await AppointmentModel.find({ organizationId })
        .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
        .lean();

    for (const appt of orgAppointments) {
        const docId = appt.doctorId?._id || appt.doctorId;
        const existingPmt = await PaymentModel.findOne({ appointmentId: appt._id }).lean();

        if (!existingPmt) {
            // NEVER auto-create payment records for cancelled appointments or unpaid appointments
            const apptStatus = String(appt.status || '').toLowerCase();
            const consultStatus = String(appt.consultationStatus || '').toLowerCase();
            if (apptStatus === 'cancelled' || consultStatus === 'cancelled' || appt.paymentStatus !== 'paid') {
                continue;
            }
            const isPaid = appt.paymentStatus === 'paid';
            await PaymentModel.create({
                businessId: generateBusinessId("PAY"),
                appointmentId: appt._id,
                organizationId: appt.organizationId,
                patientId: appt.patientId,
                doctorId: docId,
                amount: Number(appt.doctorId?.consultationFee) || 0,
                paymentMethod: appt.consultationType === 'online' ? 'online' : 'cash',
                status: isPaid ? 'paid' : (appt.paymentStatus || 'pending'),
                paidAt: isPaid ? (appt.updatedAt || appt.createdAt) : null,
                createdAt: appt.createdAt
            }).catch(() => null);
        } else if (!existingPmt.doctorId && docId) {
            await PaymentModel.updateOne({ _id: existingPmt._id }, { $set: { doctorId: docId } }).catch(() => null);
        }
    }

    const filter = { organizationId };
    if (statusFilter && statusFilter !== 'all') {
        filter.status = statusFilter.toLowerCase();
    }
    if (doctorIdFilter) {
        filter.doctorId = doctorIdFilter;
    }

    const payments = await PaymentModel.find(filter)
        .populate({
            path: "appointmentId",
            populate: [
                { path: "patientId", populate: { path: "userId", select: "name email phone profileImage" } },
                { path: "doctorId", populate: { path: "userId", select: "name email phone profileImage" } },
                { path: "departmentId", select: "name" }
            ]
        })
        .populate({
            path: "patientId",
            populate: { path: "userId", select: "name email phone profileImage" }
        })
        .populate({
            path: "doctorId",
            populate: { path: "userId", select: "name email phone profileImage" }
        })
        .sort({ paidAt: -1, createdAt: -1 });

    const defaultFallbackName = allOrgDoctors[0]?.userId?.name || allOrgDoctors[0]?.name || "Medical Specialist";

    const mappedPayments = payments.map((pmt) => {
        const appt = pmt.appointmentId || {};
        const patientObj = pmt.patientId?.userId || pmt.patientId || appt.patientId?.userId || appt.patientId || {};

        const docIdStr = String(
            pmt.doctorId?._id || pmt.doctorId ||
            appt.doctorId?._id || appt.doctorId || ''
        );

        const rawDoctorName =
            doctorNameMap.get(docIdStr) ||
            pmt.doctorId?.userId?.name ||
            pmt.doctorId?.name ||
            appt.doctorId?.userId?.name ||
            appt.doctorId?.name ||
            appt.doctorName ||
            pmt.doctorName ||
            defaultFallbackName;

        const doctorObj = pmt.doctorId || appt.doctorId || {};
        const isPaid = pmt.status === 'paid';
        const deptObj = appt.departmentId || {};

        return {
            _id: pmt._id,
            appointmentId: appt._id || pmt.appointmentId,
            patientName: patientObj.name || "Patient",
            doctorName: formatDoctorName(rawDoctorName, defaultFallbackName),
            doctorId: String(doctorObj._id || pmt.doctorId || docIdStr),
            departmentId: String(deptObj._id || appt.departmentId || ''),
            departmentName: deptObj.name || null,
            appointmentDate: appt.appointmentDate || pmt.createdAt,
            startTime: appt.startTime || null,
            endTime: appt.endTime || null,
            consultationType: appt.consultationType || "online",
            amount: Number(pmt.amount) || 0,
            status: pmt.status,
            paymentMethod: pmt.paymentMethod || "online",
            paidAt: pmt.paidAt || (isPaid ? pmt.createdAt : null),
            createdAt: pmt.createdAt,
            razorpayPaymentId: pmt.razorpayPaymentId || pmt.razorpayOrderId || null
        };
    });

    if (departmentIdFilter) {
        return mappedPayments.filter((pmt) => pmt.departmentId === String(departmentIdFilter));
    }

    return mappedPayments;
};

export const createOnlineBookingOrderService = async (data, userId) => {
    const patient = await getPatientByUserId(userId);
    if (!patient) {
        throw new AppError(404, "Patient profile not found");
    }

    if (!data.doctorId) {
        throw new AppError(400, "Doctor selection is required");
    }

    const doctor = await getDoctorById(data.doctorId, data.organizationId);
    if (!doctor) {
        throw new AppError(404, "Selected doctor was not found");
    }

    // Validate past time
    const appointmentDateTime = new Date(`${data.appointmentDate}T${data.startTime}`);
    if (appointmentDateTime <= new Date()) {
        throw new AppError(400, "Cannot book an appointment in the past");
    }

    // Validate Slot Availability (Both Doctor & Patient Conflicts)
    const slotValidation = await validateAppointmentSlot({
        doctorId: doctor._id,
        patientId: patient._id,
        appointmentDate: data.appointmentDate,
        startTime: data.startTime,
        endTime: data.endTime
    });

    if (!slotValidation.available) {
        throw new AppError(
            409,
            slotValidation.message,
            slotValidation.reason,
            slotValidation.existingAppointment
        );
    }

    // System-wide Department Resolution
    let resolvedDeptId = doctor.departmentId?._id || doctor.departmentId || data.departmentId;
    if (!resolvedDeptId) {
        const orgId = doctor.organizationId?._id || doctor.organizationId || data.organizationId;
        const generalDept = await getOrCreateGeneralDepartment(orgId);
        if (generalDept) {
            resolvedDeptId = generalDept._id;
        }
    }

    const amount = doctor.consultationFee || 500;
    const razorpayKeyId = process.env.RAZORPAY_KEY || process.env.RAZORPAY_KEY_ID || "rzp_test_TSMeN2ZVVnNzVP";
    const mode = data.consultationType || data.consultationMode || "online";

    // Create Razorpay Order ONLY (NO APPOINTMENT OR PAYMENT RECORD CREATED IN DB YET!)
    const order = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `bk_${Date.now().toString().slice(-8)}`
    });

    return {
        order: {
            id: order.id,
            amount: order.amount,
            currency: order.currency
        },
        razorpayKeyId,
        bookingPayload: {
            doctorId: doctor._id.toString(),
            departmentId: resolvedDeptId ? resolvedDeptId.toString() : null,
            organizationId: (doctor.organizationId?._id || doctor.organizationId || data.organizationId).toString(),
            consultationType: mode,
            appointmentDate: data.appointmentDate,
            startTime: data.startTime,
            endTime: data.endTime,
            reason: data.reason ? data.reason.trim() : "",
            amount
        }
    };
};

export const verifyAndCreateOnlineAppointmentService = async (data, userId) => {
    const { bookingPayload, razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

    if (!bookingPayload || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new AppError(400, "Incomplete payment verification payload");
    }

    const patient = await getPatientByUserId(userId);
    if (!patient) {
        throw new AppError(404, "Patient profile not found");
    }

    // 1. IDEMPOTENCY CHECK: Return existing appointment if this payment ID was already processed
    const existingPayment = await PaymentModel.findOne({ razorpayPaymentId });
    if (existingPayment && existingPayment.appointmentId) {
        const existingAppt = await AppointmentModel.findById(existingPayment.appointmentId);
        if (existingAppt) {
            console.log(`[CareFlow Payment Idempotency] Returning existing appointment ${existingAppt._id} for payment ${razorpayPaymentId}`);
            return existingAppt;
        }
    }

    // 2. VERIFY RAZORPAY HMAC SIGNATURE
    const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;
    if (!secret) {
        throw new AppError(500, "Razorpay secret is not configured in server environment.");
    }
    const generatedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

    if (generatedSignature !== razorpaySignature) {
        throw new AppError(400, "Payment verification failed. Invalid Razorpay signature.");
    }

    // 3. RE-CHECK SLOT AVAILABILITY CONFLICT BEFORE APPOINTMENT CREATION
    const slotValidation = await validateAppointmentSlot({
        doctorId: bookingPayload.doctorId,
        patientId: patient._id,
        appointmentDate: bookingPayload.appointmentDate,
        startTime: bookingPayload.startTime,
        endTime: bookingPayload.endTime
    });

    if (!slotValidation.available) {
        await PaymentModel.create({
            businessId: generateBusinessId("PAY"),
            patientId: patient._id,
            doctorId: bookingPayload.doctorId,
            organizationId: bookingPayload.organizationId,
            amount: bookingPayload.amount || 500,
            paymentMethod: "online",
            status: "refund_required",
            transactionId: razorpayPaymentId,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            paidAt: new Date()
        });
        throw new AppError(
            409,
            slotValidation.message,
            slotValidation.reason,
            slotValidation.existingAppointment
        );
    }

    // 4. CREATE APPOINTMENT (STRICTLY ONLY AFTER VERIFIED PAYMENT!)
    const appointment = await createAppointment({
        organizationId: bookingPayload.organizationId,
        patientId: patient._id,
        doctorId: bookingPayload.doctorId,
        departmentId: bookingPayload.departmentId,
        consultationType: bookingPayload.consultationType || bookingPayload.consultationMode || "online",
        appointmentDate: bookingPayload.appointmentDate,
        startTime: bookingPayload.startTime,
        endTime: bookingPayload.endTime,
        reason: bookingPayload.reason,
        status: "booked",
        paymentStatus: "paid"
    });

    // 5. CREATE CONFIRMED PAID PAYMENT RECORD
    await PaymentModel.create({
        businessId: generateBusinessId("PAY"),
        appointmentId: appointment._id,
        patientId: patient._id,
        doctorId: bookingPayload.doctorId,
        organizationId: bookingPayload.organizationId,
        amount: bookingPayload.amount || 500,
        paymentMethod: "online",
        status: "paid",
        transactionId: razorpayPaymentId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        paidAt: new Date()
    });

    // 6. GENERATE ONLINE CONSULTATION MEETING DETAILS
    try {
        await updateMeetingDetails(appointment._id, {
            meetingLink: `${process.env.CLIENT_URL || "http://localhost:5173"}/meeting/${appointment._id}`,
            roomId: appointment._id.toString()
        });
    } catch (mErr) {
        console.error("[CareFlow Meeting Link Error]:", mErr.message);
    }

    const finalAppt = await getAppointmentById(appointment._id);
    return finalAppt || appointment;
};