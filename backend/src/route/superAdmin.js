import { Router } from "express";
import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import {
    getAllOrganizationsPlatformController,
    getOrganizationByIdController,
    approveOrganizationController,
    rejectOrganizationController,
    suspendOrganizationController,
    activateOrganizationController,
    getDoctorsPlatformController,
    getDoctorByIdPlatformController,
    getPatientsPlatformController,
    getAppointmentsPlatformController,
    getPaymentsPlatformController,
    getSuperAdminDashboardController,
    getRegionalClinicalPerformanceController,
    getOrganizationAnalyticsPlatformController,
    getPatientAnalyticsPlatformController,
    getAppointmentAnalyticsPlatformController
} from "../controller/superAdmin.js";

const route = Router();

route.use(authentication, authorization("super_admin"));

route.get("/dashboard", getSuperAdminDashboardController);
route.get("/regional-performance", getRegionalClinicalPerformanceController);

route.get("/organizations/analytics", getOrganizationAnalyticsPlatformController);
route.get("/organizations", getAllOrganizationsPlatformController);
route.get("/organizations/:id", getOrganizationByIdController);
route.patch("/organizations/:id/approve", approveOrganizationController);
route.patch("/organizations/:id/reject", rejectOrganizationController);
route.patch("/organizations/:id/suspend", suspendOrganizationController);
route.patch("/organizations/:id/activate", activateOrganizationController);

route.get("/doctors", getDoctorsPlatformController);
route.get("/doctors/:id", getDoctorByIdPlatformController);
route.get("/patients/analytics", getPatientAnalyticsPlatformController);
route.get("/patients", getPatientsPlatformController);
route.get("/appointments/analytics", getAppointmentAnalyticsPlatformController);
route.get("/appointments", getAppointmentsPlatformController);
route.get("/payments", getPaymentsPlatformController);

export default route;
