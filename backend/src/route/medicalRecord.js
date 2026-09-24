import { Router } from "express";
import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import upload from "../middleware/upload.js";
import {
    uploadMedicalRecordController,
    getMyMedicalRecordsController,
    getMedicalRecordByIdController,
    shareMedicalRecordController,
    revokeMedicalRecordController,
    getMedicalRecordsByAppointmentController,
    updateMedicalRecordController,
    deleteMedicalRecordController
} from "../controller/medicalRecord.js";

const route = Router();

route.use(authentication);

route.post(
    "/",
    authorization("patient", "doctor"),
    upload.single("file"),
    uploadMedicalRecordController
);

route.get(
    "/my",
    authorization("patient", "doctor"),
    getMyMedicalRecordsController
);

route.get(
    "/appointment/:appointmentId",
    authorization("patient", "doctor"),
    getMedicalRecordsByAppointmentController
);

route.get(
    "/:id",
    authorization("patient", "doctor"),
    getMedicalRecordByIdController
);

route.patch(
    "/:id",
    authorization("patient"),
    updateMedicalRecordController
);

route.delete(
    "/:id",
    authorization("patient"),
    deleteMedicalRecordController
);

route.post(
    "/:id/share",
    authorization("patient"),
    shareMedicalRecordController
);

route.patch(
    "/:id/revoke",
    authorization("patient"),
    revokeMedicalRecordController
);

export default route;
