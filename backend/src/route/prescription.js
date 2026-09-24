import { Router } from "express";
import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import {
    createPrescriptionController,
    getMyPrescriptionsController,
    getPrescriptionByAppointmentController,
    getPrescriptionByIdController,
    updatePrescriptionController
} from "../controller/prescription.js";

const route = Router();

route.use(authentication);

route.get(
    "/my",
    authorization("patient", "doctor"),
    getMyPrescriptionsController
);

route.get(
    "/appointment/:appointmentId",
    authorization("patient", "doctor"),
    getPrescriptionByAppointmentController
);

route.post(
    "/:appointmentId",
    authorization("doctor"),
    createPrescriptionController
);

route.get(
    "/:id",
    authorization("patient", "doctor"),
    getPrescriptionByIdController
);

route.patch(
    "/:id",
    authorization("doctor"),
    updatePrescriptionController
);

export default route;
