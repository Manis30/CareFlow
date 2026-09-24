import {
    registerService,
    loginService,
    refreshService,
    logoutService,
    forgotPasswordService,
    resetPasswordService,
    forceResetPasswordService,
    updateProfileImageService,
    updateProfileService,
    getMeService
} from "../service/user.js";
import { AppError } from "../middleware/errorHandler.js";
import uploadToCloudinary from "../util/uploadToCloudinary.js";
import sanitizeUser from "../util/sanitizeUser.js";

export const getMeController = async (req, res) => {
    const result = await getMeService(req.user.id);
    res.status(200).json({ success: true, data: sanitizeUser(result) });
};

export const updateProfileController = async (req, res) => {
    const result = await updateProfileService(req.user.id, req.body);
    res.status(200).json({ success: true, message: "Profile updated successfully", data: sanitizeUser(result) });
};

export const registerController = async (req, res) => {
    const data = req.body;
    let result;
    if (data.role === 'patient' || !data.role || data.dateOfBirth || data.bloodGroup || data.allergies) {
        const { createPatientService } = await import('../service/patient.js');
        result = await createPatientService(data, req.file);
    } else {
        result = await registerService(data);
    }

    if (result.accessToken && result.refreshToken) {
        res.cookie('accessToken', result.accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
    }

    const userData = sanitizeUser(result.user || result.updatedUser || result);

    res.status(201).json({
        success: true,
        message: "Registration successful",
        data: userData,
        user: userData,
        patient: result.patient || null,
        accessToken: result.accessToken || null,
        refreshToken: result.refreshToken || null
    });
};

export const loginController = async (req, res) => {
    const { email, password } = req.body;
    const result = await loginService(email, password);
    res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
    });
    res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
    res.status(200).json({ success: true, data: sanitizeUser(result.updatedUser) });
};

export const refreshController = async (req, res) => {
    const { refreshToken } = req.cookies;
    const result = await refreshService(refreshToken);
    res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
    });
    res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
    res.status(200).json({ success: true, message: "Access Token created", data: sanitizeUser(result.updatedUser) });
};

export const logoutController = async (req, res) => {
    const { refreshToken } = req.cookies;
    await logoutService(refreshToken);
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    res.status(204).send("Logout successfully");
};

export const forgotPasswordController = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new AppError(400, "Email address is required");
    }
    await forgotPasswordService(email);
    res.status(200).json({
        success: true,
        message: "If an account exists for this email, a password reset link has been sent."
    });
};

export const resetPasswordController = async (req, res) => {
    const { resetToken, token, password, newPassword } = req.body;
    const rawToken = resetToken || token;
    const pass = password || newPassword;
    if (!rawToken) {
        throw new AppError(400, "Reset token is required");
    }
    if (!pass) {
        throw new AppError(400, "New password is required");
    }
    await resetPasswordService(rawToken, pass);
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    res.status(200).json({ success: true, message: "Password updated successfully. Please sign in again with your new password." });
};

export const forceResetPasswordController = async (req, res) => {
    const { newPassword, password } = req.body;
    const pass = newPassword || password;
    if (!pass) {
        throw new AppError(400, "New password is required");
    }
    await forceResetPasswordService(req.user.id, pass);
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    res.status(200).json({
        success: true,
        message: "Password updated successfully. Please sign in again with your new password."
    });
};

export const test = (req, res) => {
    res.send("test done successfully");
};

export const updateProfileImageController = async (req, res) => {
    if (!req.file) {
        throw new AppError(400, "Profile image is required");
    }
    const userId = req.user.id;
    const image = await uploadToCloudinary(
        req.file.buffer,
        "careflow/profile-images"
    );
    const result = await updateProfileImageService(userId, image);
    res.status(200).json({
        success: true,
        message: "Profile image updated successfully",
        data: sanitizeUser(result)
    });
};