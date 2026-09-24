import { Router } from "express";

import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";

import {
    createAppointmentController,
    validateSlotController,
    getMyAppointmentsController,
    cancelAppointmentController,

    getDoctorTodayAppointmentsController,
    getDoctorUpcomingAppointmentsController,
    getDoctorCompletedAppointmentsController,
    getDoctorCancelledAppointmentsController,
    cancelAppointmentByDoctorController,
    completeAppointmentController,

    getAllClinicAppointmentsController,
    getClinicAppointmentStatsController,

    getAppointmentController,
    updateOnlineMeetingController,
    getOnlineMeetingController
} from "../controller/appointment.js";

const route = Router();

route.post(
    "/validate-slot",
    authentication,
    authorization("patient", "doctor", "organization_admin", "admin", "super_admin"),
    validateSlotController
);

route.post(
    "/",
    authentication,
    authorization("patient"),
    createAppointmentController
);

route.get(
    "/my",
    authentication,
    authorization("patient"),
    getMyAppointmentsController
);

route.get(
    "/doctor/today",
    authentication,
    authorization("doctor"),
    getDoctorTodayAppointmentsController
);

route.get(
    "/doctor/upcoming",
    authentication,
    authorization("doctor"),
    getDoctorUpcomingAppointmentsController
);

route.get(
    "/doctor/completed",
    authentication,
    authorization("doctor"),
    getDoctorCompletedAppointmentsController
);

route.get(
    "/doctor/cancelled",
    authentication,
    authorization("doctor"),
    getDoctorCancelledAppointmentsController
);

route.get(
    "/admin",
    authentication,
    authorization("organization_admin", "admin", "super_admin"),
    getAllClinicAppointmentsController
);

route.get(
    "/admin/stats",
    authentication,
    authorization("organization_admin", "admin", "super_admin"),
    getClinicAppointmentStatsController
);

route.patch(
    "/:id/cancel",
    authentication,
    authorization("patient"),
    cancelAppointmentController
);

route.patch(
    "/:id/doctor-cancel",
    authentication,
    authorization("doctor"),
    cancelAppointmentByDoctorController
);

route.patch(
    "/:id/complete",
    authentication,
    authorization("doctor"),
    completeAppointmentController
);

route.patch(
    "/:id/meeting",
    authentication,
    authorization("doctor"),
    updateOnlineMeetingController
);

route.get(
    "/:id/meeting",
    authentication,
    authorization("patient", "doctor", "organization_admin", "admin", "super_admin"),
    getOnlineMeetingController
);

route.get(
    "/:id/meeting-access",
    authentication,
    authorization("patient", "doctor", "organization_admin", "admin", "super_admin"),
    getOnlineMeetingController
);

route.get(
    "/:id",
    authentication,
    authorization("patient", "doctor", "organization_admin", "admin", "super_admin"),
    getAppointmentController
);

export default route;