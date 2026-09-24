import { verifyToken } from '../util/token.js';
import UserModel from '../model/user.js';

const authentication = async (req, res, next) => {
    try {
        const { accessToken: token } = req.cookies;
        if (!token) {
            return res.status(401).json({ success: false, message: "Access token required" });
        }
        const decoded = verifyToken(token, process.env.JWT_ACCESS_SECRET);
        const user = await UserModel.findById(decoded.id).select("-passwordHash -refreshTokenHash").lean();

        if (!user) {
            return res.status(401).json({ success: false, message: "User account not found" });
        }

        if (user.isActive === false) {
            return res.status(403).json({ success: false, message: "Your account has been deactivated. Please contact support." });
        }

        const isAuthRoute = req.originalUrl.includes('/force-reset-password') ||
                            req.originalUrl.includes('/logout') ||
                            req.originalUrl.includes('/me') ||
                            req.originalUrl.includes('/refresh');

        if (user.mustResetPassword === true && !isAuthRoute) {
            return res.status(403).json({
                success: false,
                message: "Password change required. Please complete first-time password reset.",
                mustResetPassword: true
            });
        }

        req.user = {
            id: user._id.toString(),
            role: user.role,
            organizationId: user.organizationId,
            mustResetPassword: user.mustResetPassword,
            isActive: user.isActive
        };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid or expired access token" });
    }
};

export default authentication;