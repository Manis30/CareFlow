import { normalizeRole } from "../util/canonicalRole.js";

const authorization = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const userRole = normalizeRole(req.user.role);
        const allowedRoles = roles.map(r => normalizeRole(r));

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to access this resource"
            });
        }
        next();
    };
};

export default authorization;