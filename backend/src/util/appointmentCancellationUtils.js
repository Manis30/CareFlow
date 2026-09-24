import { getAppointmentStartDateTime } from './appointmentTimeUtils.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Validates whether an appointment is eligible for cancellation according to CareFlow business rules:
 * 1. Already cancelled -> 409 ALREADY_CANCELLED
 * 2. Completed -> 409 APPOINTMENT_COMPLETED
 * 3. Paid appointment -> 409 PAID_APPOINTMENT (Paid appointments cannot be cancelled)
 * 4. Appointment already started -> 409 APPOINTMENT_STARTED
 * 5. Cancellation deadline (within 24 hours of start time) -> 409 CANCELLATION_WINDOW_CLOSED
 * @param {Object} appointment
 * @returns {boolean} returns true if eligible
 */
export const validateCancellationEligibility = (appointment) => {
    if (!appointment) {
        throw new AppError(404, "Appointment not found");
    }

    // Rule 3: Already Cancelled
    if (appointment.status === "cancelled") {
        throw new AppError(
            409,
            "This appointment has already been cancelled.",
            "ALREADY_CANCELLED"
        );
    }

    // Rule 2: Completed
    if (appointment.status === "completed" || appointment.consultationStatus === "completed") {
        throw new AppError(
            409,
            "Completed appointments cannot be cancelled.",
            "APPOINTMENT_COMPLETED"
        );
    }

    // Rule 1: Paid Appointments Cannot Be Cancelled
    if (appointment.paymentStatus === "paid") {
        throw new AppError(
            409,
            "Paid appointments cannot be cancelled.",
            "PAID_APPOINTMENT"
        );
    }

    // Session Started
    if (appointment.status === "in_progress" || appointment.consultationStatus === "in_progress" || appointment.consultationStartedAt) {
        throw new AppError(
            409,
            "This appointment can no longer be cancelled because the appointment time has already started.",
            "APPOINTMENT_STARTED"
        );
    }

    const appointmentStart = getAppointmentStartDateTime(
        appointment.appointmentDate,
        appointment.startTime
    );

    if (appointmentStart) {
        const now = new Date();
        const cancellationDeadline = new Date(
            appointmentStart.getTime() - 24 * 60 * 60 * 1000
        );

        // Rule 5: Appointment Already Started
        if (now >= appointmentStart) {
            throw new AppError(
                409,
                "This appointment can no longer be cancelled because the appointment time has already started.",
                "APPOINTMENT_STARTED"
            );
        }

        // Rule 4: 24-Hour Cancellation Window Closed
        if (now >= cancellationDeadline) {
            throw new AppError(
                409,
                "Appointments can only be cancelled more than 24 hours before the scheduled time.",
                "CANCELLATION_WINDOW_CLOSED"
            );
        }
    }

    return true;
};
