import { Router } from "express";
import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import upload from "../middleware/upload.js";
import {
    createOrganizationController,
    getAllOrganizationController,
    getOrganizationController,
    updateOrganizationController,
    deleteOrganizationController,
    getMyOrganizationController,
    updateMyOrganizationController,
    updateMyOrganizationLogoController,
    removeMyOrganizationLogoController,
    getOrganizationCitiesController,
    getActiveOrganizationsController
} from "../controller/organization.js";

const route = Router();

// GET /organization/cities - Patient/Public distinct city lookup
route.get(
    "/cities",
    authentication,
    authorization("patient", "doctor", "organization_admin", "admin", "super_admin", "superadmin"),
    getOrganizationCitiesController
);

// GET /organization/active - Patient active organization lookup by city
route.get(
    "/active",
    authentication,
    authorization("patient", "doctor", "organization_admin", "admin", "super_admin", "superadmin"),
    getActiveOrganizationsController
);

// GET /organization/my - Organization Admin own clinic lookup
route.get(
    "/my",
    authentication,
    authorization("organization_admin", "admin"),
    getMyOrganizationController
);

// PATCH /organization/my - Organization Admin own clinic update
route.patch(
    "/my",
    authentication,
    authorization("organization_admin", "admin"),
    updateMyOrganizationController
);

// PATCH /organization/my/logo - Organization Admin logo upload/update
route.patch(
    "/my/logo",
    authentication,
    authorization("organization_admin", "admin"),
    upload.single("file"),
    updateMyOrganizationLogoController
);

// DELETE /organization/my/logo - Organization Admin logo removal
route.delete(
    "/my/logo",
    authentication,
    authorization("organization_admin", "admin"),
    removeMyOrganizationLogoController
);

// Super Admin listing all organizations
route.get(
    "/",
    authentication,
    authorization("super_admin", "superadmin"),
    getAllOrganizationController
);

// Super Admin creating new Organization and initial Admin
route.post(
    "/",
    authentication,
    authorization("super_admin", "superadmin"),
    upload.single("file"),
    createOrganizationController
);

// Individual organization lookup (Super Admin or scoped Organization Admin)
route.get(
    "/:id",
    authentication,
    authorization("super_admin", "superadmin", "organization_admin", "admin"),
    getOrganizationController
);

// Individual organization update (Super Admin or scoped Organization Admin)
route.patch(
    "/:id",
    authentication,
    authorization("super_admin", "superadmin", "organization_admin", "admin"),
    updateOrganizationController
);

// Super Admin suspend organization
route.delete(
    "/:id",
    authentication,
    authorization("super_admin", "superadmin"),
    deleteOrganizationController
);

export default route;