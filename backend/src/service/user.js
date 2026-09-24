import { register, getUserByEmail, getUserById, updateUser, findUserByField } from "../repository/user.js";
import { comparePassword, hashPassword } from "../util/bcrypt.js";
import { createToken, verifyToken, tokenHash } from "../util/token.js";
import { AppError } from "../middleware/errorHandler.js";
import crypto from 'crypto';
import deleteFromCloudinary from "../util/deleteFromCloudinary.js";

export const registerService = async (data) => {
    if (data.role === "super_admin") {
        throw new AppError(403, "Public registration of super admin is not allowed");
    }
    data.passwordHash = await hashPassword(data.password);
    if (data.mustResetPassword !== true) {
        data.mustResetPassword = false;
    }
    return await register(data);
};

export const loginService = async (email, password) => {
    const user = await getUserByEmail(email);
    if (!user) {
        throw new AppError(401, "Invalid email or password");
    }

    if (user.isActive === false) {
        throw new AppError(403, "Your account has been deactivated. Please contact support.");
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
        throw new AppError(401, "Invalid email or password");
    }

    const accessToken = createToken({ id: user._id, role: user.role, organizationId: user.organizationId }, process.env.JWT_ACCESS_SECRET, '15m');
    const refreshToken = createToken({ id: user._id }, process.env.JWT_REFRESH_SECRET, '30d');
    const refreshTokenHash = await tokenHash(refreshToken);
    const updatedUser = await updateUser(user._id, { refreshTokenHash });
    return { updatedUser, accessToken, refreshToken };
};

export const refreshService = async (token) => {
    if (!token) {
        throw new AppError(401, 'Refresh Token required');
    }
    const verifyRefreshToken = verifyToken(token, process.env.JWT_REFRESH_SECRET);
    const user = await getUserById(verifyRefreshToken.id);

    if (!user || user.isActive === false) {
        throw new AppError(403, "User account is inactive or deleted");
    }

    const isTokenValid = await tokenHash(token, user.refreshTokenHash);
    if (isTokenValid != user.refreshTokenHash) {
        throw new AppError(401, "Invalid refresh token");
    }
    const accessToken = createToken({ id: verifyRefreshToken.id, role: user.role, organizationId: user.organizationId }, process.env.JWT_ACCESS_SECRET, '15m');
    const refreshToken = createToken({ id: verifyRefreshToken.id }, process.env.JWT_REFRESH_SECRET, '30d');
    const refreshTokenHash = await tokenHash(refreshToken);
    const updatedUser = await updateUser(verifyRefreshToken.id, { refreshTokenHash });
    return { accessToken, refreshToken, updatedUser };
};

export const forgotPasswordService = async (email) => {
    const user = await getUserByEmail(email);
    if (!user) {
        // Return null without throwing error to prevent email enumeration
        return null;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    await updateUser(user._id, { resetTokenHash, resetTokenExpiry });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/reset-password?token=${rawToken}`;
    
    const { sendPasswordResetEmail } = await import("./email.js");
    await sendPasswordResetEmail(email, resetLink);

    return { rawToken, resetLink };
};

export const resetPasswordService = async (rawToken, password) => {
    if (!rawToken || !password) {
        throw new AppError(400, "Reset token and new password are required");
    }

    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    let findUser = await findUserByField({ resetTokenHash: hashedToken });

    // Fallback search for legacy unhashed tokens if any
    if (!findUser) {
        findUser = await findUserByField({ resetTokenHash: rawToken });
    }

    if (!findUser || !findUser.resetTokenExpiry || findUser.resetTokenExpiry < new Date()) {
        throw new AppError(401, "Invalid or expired password reset link");
    }

    const passwordHash = await hashPassword(password);
    const updatedUser = await updateUser(findUser._id, {
        passwordHash,
        resetTokenHash: "",
        resetTokenExpiry: null,
        refreshTokenHash: "",
        mustResetPassword: false
    });

    return updatedUser;
};

export const forceResetPasswordService = async (userId, newPassword) => {
    if (!userId || !newPassword) {
        throw new AppError(400, "User ID and new password are required");
    }

    const user = await getUserById(userId);
    if (!user) {
        throw new AppError(404, "User profile not found");
    }

    const passwordHash = await hashPassword(newPassword);
    const updatedUser = await updateUser(userId, {
        passwordHash,
        mustResetPassword: false,
        refreshTokenHash: ""
    });

    return updatedUser;
};

export const logoutService = async (token) => {
    try {
        const user = verifyToken(token, process.env.JWT_REFRESH_SECRET);
        if (user?.id) {
            await updateUser(user.id, { refreshTokenHash: "" });
        }
    } catch (e) {
        // Ignore token verification errors during logout
    }
};

export const updateProfileImageService = async (userId, image) => {
    const existingUser = await getUserById(userId);
    if (existingUser?.profileImage?.publicId) {
        try {
            await deleteFromCloudinary(existingUser.profileImage.publicId);
        } catch (err) {
            console.error("Failed to delete previous profile image from Cloudinary:", err.message);
        }
    }

    return await updateUser(userId, {
        profileImage: {
            url: image.url,
            publicId: image.publicId
        }
    });
};

export const updateProfileService = async (userId, data) => {
    const updateData = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.phone) updateData.phone = data.phone.trim();
    if (data.email) updateData.email = data.email.trim();
    return await updateUser(userId, updateData);
};

export const getMeService = async (userId) => {
    return await getUserById(userId);
};