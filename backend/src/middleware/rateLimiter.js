import rateLimit from "express-rate-limit";

// Auth rate limiter (max 10 login requests per 15 minutes per IP)
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts from this IP, please try again after 15 minutes."
    }
});

// AI Gateway rate limiter (max 30 requests per minute per IP)
export const aiGatewayRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "AI request rate limit exceeded. Please wait a moment before sending more requests."
    }
});
