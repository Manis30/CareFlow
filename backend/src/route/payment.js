import { Router } from "express";

import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";

import {
    getMyPaymentsController,
    getAppointmentPaymentController,
    createRazorpayOrderController,
    verifyRazorpayPaymentController,
    getClinicPaymentsController,
    createOnlineBookingOrderController,
    verifyAndCreateOnlineAppointmentController
} from "../controller/payment.js";

const route = Router();

route.post(
    "/create-booking-order",
    authentication,
    authorization("patient"),
    createOnlineBookingOrderController
);

route.post(
    "/verify-booking-payment",
    authentication,
    authorization("patient"),
    verifyAndCreateOnlineAppointmentController
);

route.get(
    "/organization",
    authentication,
    authorization("admin", "organization_admin", "org_admin"),
    getClinicPaymentsController
);

route.get(
    "/my",
    authentication,
    authorization("patient"),
    getMyPaymentsController
);

route.get(
    "/appointment/:appointmentId",
    authentication,
    authorization("patient"),
    getAppointmentPaymentController
);

route.post(
    "/:appointmentId/create-order",
    authentication,
    authorization("patient"),
    createRazorpayOrderController
);

route.post(
    "/verify",
    authentication,
    authorization("patient"),
    verifyRazorpayPaymentController
);

export default route;