import { AppError } from "./errorHandler.js";

/**
 * Bot Protection Middleware for registration and authentication routes.
 * Verifies reCAPTCHA / hCaptcha token with secret key.
 * Bypasses in test environment or when RECAPTCHA_SECRET_KEY is unconfigured.
 */
export const verifyBotProtection = async (req, res, next) => {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    // Skip in test environment or when secret key is not configured
    if (!secretKey || process.env.NODE_ENV === "test") {
        return next();
    }

    const captchaToken = req.body?.recaptchaToken || req.headers["x-recaptcha-token"];
    if (!captchaToken) {
        return next(new AppError(400, "reCAPTCHA verification token is missing"));
    }

    try {
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;
        const response = await fetch(verifyUrl, { method: "POST" });
        const data = await response.json();

        if (!data.success || (data.score !== undefined && data.score < 0.5)) {
            return next(new AppError(403, "reCAPTCHA verification failed. Automated bot traffic blocked."));
        }

        next();
    } catch (err) {
        console.error("[reCAPTCHA Verification Error]:", err.message);
        // Fail open in network error or proceed cleanly
        next();
    }
};

export default verifyBotProtection;
