export class AppError extends Error {
    constructor(statusCode, message, reason = null, existingAppointment = null) {
        super(message);
        this.statusCode = statusCode;
        this.reason = reason;
        this.existingAppointment = existingAppointment;
    }
}

const errorHandler = (err, req, res, next) => {
    // Convert Mongo E11000 duplicate key errors to HTTP 409 DOCTOR_BUSY
    if (err.code === 11000 || (err.message && String(err.message).includes('E11000'))) {
        return res.status(409).json({
            success: false,
            reason: 'DOCTOR_BUSY',
            message: 'This appointment slot is no longer available. Please select another available time.'
        });
    }

    // Convert Mongoose ValidationError to HTTP 400 Bad Request
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors || {}).map((val) => val.message).join(', ');
        return res.status(400).json({
            success: false,
            message: message || err.message || 'Validation Error'
        });
    }

    // Convert Mongoose CastError to HTTP 400 Bad Request
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: `Invalid ${err.path}: ${err.value}`
        });
    }

    const statuscode = err.statusCode || 500;
    
    if (statuscode >= 500 && process.env.SENTRY_DSN) {
        console.error(`[SENTRY ERROR CAPTURE - DSN: ${process.env.SENTRY_DSN}]:`, err.stack || err.message);
    }

    const responsePayload = {
        success: false,
        message: err.message || "Internal Server Error"
    };

    if (err.reason) {
        responsePayload.reason = err.reason;
    }
    if (err.existingAppointment) {
        responsePayload.existingAppointment = err.existingAppointment;
    }

    res.status(statuscode).json(responsePayload);
};
export default errorHandler;