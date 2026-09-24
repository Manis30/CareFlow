import OrganizationModel from "../model/organization.js";
import { AppError } from "./errorHandler.js";

const checkOrganizationApproved = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        if (req.user.role === "super_admin") {
            return next();
        }

        const organizationId = req.user.organizationId;
        if (!organizationId) {
            return next();
        }

        const org = await OrganizationModel.findById(organizationId);
        if (!org) {
            throw new AppError(404, "Organization not found");
        }

        const isApproved = ["APPROVED", "ACTIVE", "approved"].includes(org.status);
        if (!isApproved) {
            throw new AppError(403, `Organization is currently ${org.status || "inactive"}`);
        }

        next();
    } catch (error) {
        next(error);
    }
};

export default checkOrganizationApproved;
