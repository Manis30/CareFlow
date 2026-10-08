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
    deleteMedicalRecordController,
    previewMedicalRecordController,
    downloadMedicalRecordController,
    summarizeMedicalRecordController,
    extractMedicalRecordFindingsController,
    askMedicalRecordQuestionController
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

// Preview and Download endpoints with multi-role authorization
route.get(
    "/:id/preview",
    authorization("patient", "doctor", "admin", "super_admin"),
    previewMedicalRecordController
);

route.get(
    "/:id/download",
    authorization("patient", "doctor", "admin", "super_admin"),
    downloadMedicalRecordController
);

route.get(
    "/:id",
    authorization("patient", "doctor", "admin", "super_admin"),
    getMedicalRecordByIdController
);

// Record-Scoped AI Intelligence Endpoints
route.post(
    "/:id/ai/summarize",
    authorization("patient", "doctor", "admin", "super_admin"),
    summarizeMedicalRecordController
);

route.post(
    "/:id/ai/extract",
    authorization("patient", "doctor", "admin", "super_admin"),
    extractMedicalRecordFindingsController
);

route.post(
    "/:id/ai/ask",
    authorization("patient", "doctor", "admin", "super_admin"),
    askMedicalRecordQuestionController
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
