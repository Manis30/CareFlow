import { Router } from "express";
import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import {
    getTodayMedicationsController,
    recordDoseLogController,
    getMedicationSchedulesController,
    approveMedicationScheduleController,
    getMedicationAdherenceController
} from "../controller/medication.js";

const route = Router();

route.use(authentication);

route.get(
    "/today",
    authorization("patient"),
    getTodayMedicationsController
);

route.post(
    "/dose",
    authorization("patient"),
    recordDoseLogController
);

route.get(
    "/schedules",
    authorization("patient", "doctor", "admin", "super_admin"),
    getMedicationSchedulesController
);

route.patch(
    "/schedules/:id/approval",
    authorization("doctor", "admin"),
    approveMedicationScheduleController
);

route.get(
    "/adherence",
    authorization("patient", "doctor", "admin", "super_admin"),
    getMedicationAdherenceController
);

export default route;
