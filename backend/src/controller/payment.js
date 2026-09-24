import {
    getMyPaymentsService,
    getAppointmentPaymentService,
    createRazorpayOrderService,
    verifyRazorpayPaymentService,
    getClinicPaymentsService,
    createOnlineBookingOrderService,
    verifyAndCreateOnlineAppointmentService
} from "../service/payment.js";

export const createOnlineBookingOrderController = async (req, res) => {
    const result = await createOnlineBookingOrderService(req.body, req.user.id);
    res.status(200).json({
        success: true,
        message: "Razorpay booking order created successfully",
        data: result
    });
};

export const verifyAndCreateOnlineAppointmentController = async (req, res) => {
    const result = await verifyAndCreateOnlineAppointmentService(req.body, req.user.id);
    res.status(200).json({
        success: true,
        message: "Payment verified and appointment booked successfully",
        data: result
    });
};

export const getMyPaymentsController = async (
    req,
    res
) => {
    const result =
        await getMyPaymentsService(
            req.user.id
        );
    res.status(200).json({
        success: true,
        data: result
    });
};
export const createRazorpayOrderController = async (
    req,
    res
) => {
    const result =
        await createRazorpayOrderService(
            req.params.appointmentId,
            req.user.id
        );

    const razorpayKeyId = process.env.RAZORPAY_KEY || process.env.RAZORPAY_KEY_ID || "rzp_test_TSMeN2ZVVnNzVP";

    res.status(200).json({
        success: true,
        message: "Razorpay order created successfully",
        data: {
            ...result,
            orderId: result.order.id,
            amount: result.order.amount,
            currency: result.order.currency,
            razorpayKeyId,
            key: razorpayKeyId
        }
    });
};
export const verifyRazorpayPaymentController = async (
    req,
    res
) => {

    const result =
        await verifyRazorpayPaymentService(
            req.body,
            req.user.id
        );

    res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: result
    });
};
export const getAppointmentPaymentController = async (
    req,
    res
) => {
    const result =
        await getAppointmentPaymentService(
            req.params.appointmentId,
            req.user.id
        );
    res.status(200).json({
        success: true,
        data: result
    });
};

export const getClinicPaymentsController = async (req, res) => {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
        throw new AppError(400, "Organization not found for this admin");
    }

    const { status, departmentId, doctorId } = req.query;
    const result = await getClinicPaymentsService(organizationId, { status, departmentId, doctorId });
    res.status(200).json({
        success: true,
        data: result
    });
};