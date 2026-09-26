import express from "express";

import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import upload from "../middleware/upload.js";
import {
    createDoctorController,
    getAllDoctorsController,
    getMyDoctorProfileController,
    updateMyAvailabilityController,
    getDoctorController,
    getDoctorAvailableSlotsController,
    updateDoctorController,
    deleteDoctorController,
    addDoctorLeaveController,
    getMyDoctorLeaveController,
    getDoctorLeaveController,
    deleteDoctorLeaveController
} from "../controller/doctor.js";

const route = express.Router();

route.post(
    "/",
    authentication,
    authorization("organization_admin", "admin"),
    upload.single("profileImage"),
    createDoctorController
);

route.get(
    "/",
    authentication,
    authorization("organization_admin", "admin", "patient", "super_admin"),
    getAllDoctorsController
);

route.get(
    "/me",
    authentication,
    authorization("doctor"),
    getMyDoctorProfileController
);

route.patch(
    "/me/availability",
    authentication,
    authorization("doctor"),
    updateMyAvailabilityController
);

// Section 6: Doctor Leave Routes (doctor-only write access)
route.post(
    "/me/leave",
    authentication,
    authorization("doctor"),
    addDoctorLeaveController
);

route.get(
    "/me/leave",
    authentication,
    authorization("doctor"),
    getMyDoctorLeaveController
);

route.delete(
    "/me/leave/:leaveId",
    authentication,
    authorization("doctor"),
    deleteDoctorLeaveController
);


route.get(
    "/:id/available-slots",
    authentication,
    authorization("patient", "doctor", "organization_admin", "admin", "super_admin"),
    getDoctorAvailableSlotsController
);

route.get(
    "/:id/leave",
    authentication,
    authorization("organization_admin", "admin", "super_admin", "doctor"),
    getDoctorLeaveController
);

route.get(
    "/:id",
    authentication,
    authorization("organization_admin", "admin", "super_admin", "patient", "doctor"),
    getDoctorController
);

route.patch(
    "/:id",
    authentication,
    authorization("organization_admin", "admin"),
    upload.single("profileImage"),
    updateDoctorController
);

route.delete(
    "/:id",
    authentication,
    authorization("organization_admin", "admin"),
    deleteDoctorController
);

export default route;