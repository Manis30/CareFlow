import express from "express";
import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import {
    createPatientController,
    getMyPatientProfileController,
    updateMyPatientProfileController,
    getPatientController
} from "../controller/patient.js";
import upload from "../middleware/upload.js";

const route = express.Router();

route.post(
    "/",
    upload.single("profileImage"),
    createPatientController
);

route.get(
    "/",
    authentication,
    authorization("patient"),
    getMyPatientProfileController
);

route.patch(
    "/",
    authentication,
    authorization("patient"),
    upload.single("profileImage"),
    updateMyPatientProfileController
);

route.get(
    "/:id",
    authentication,
    authorization("organization_admin", "admin", "doctor", "super_admin"),
    getPatientController
);

export default route;