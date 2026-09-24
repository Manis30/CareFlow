/**
 * Checks whether an appointment is eligible for cancellation in the UI according to CareFlow rules:
 * 1. Paid appointments (paymentStatus === 'paid') -> CANNOT be cancelled
 * 2. Completed appointments (status === 'completed' or consultationStatus === 'completed') -> CANNOT be cancelled
 * 3. Already cancelled appointments (status === 'cancelled') -> CANNOT be cancelled
 * 4. Appointment already started (now >= startDateTime) -> CANNOT be cancelled
 * 5. Cancellation deadline (within 24 hours of start time) -> CANNOT be cancelled
 * 
 * @param {Object} appointment
 * @returns {Object} { canCancel: boolean, reason: string|null, message: string|null }
 */
export const checkCancellationEligibility = (appointment) => {
  if (!appointment) {
    return {
      canCancel: false,
      reason: 'NOT_FOUND',
      message: 'Appointment not found.'
    };
  }

  // Rule 3: Already Cancelled
  if (appointment.status === 'cancelled') {
    return {
      canCancel: false,
      reason: 'ALREADY_CANCELLED',
      message: 'This appointment has already been cancelled.'
    };
  }

  // Rule 2: Completed
  if (appointment.status === 'completed' || appointment.consultationStatus === 'completed') {
    return {
      canCancel: false,
      reason: 'APPOINTMENT_COMPLETED',
      message: 'Completed appointments cannot be cancelled.'
    };
  }

  // Rule 1: Paid Appointment
  if (appointment.paymentStatus === 'paid') {
    return {
      canCancel: false,
      reason: 'PAID_APPOINTMENT',
      message: 'Paid appointments cannot be cancelled.'
    };
  }

  // Session Started
  if (appointment.status === 'in_progress' || appointment.consultationStatus === 'in_progress' || appointment.consultationStartedAt) {
    return {
      canCancel: false,
      reason: 'APPOINTMENT_STARTED',
      message: 'This appointment can no longer be cancelled because the appointment time has already started.'
    };
  }

  if (appointment.status !== 'booked') {
    return {
      canCancel: false,
      reason: 'INVALID_STATUS',
      message: 'Only active booked appointments can be cancelled.'
    };
  }

  // Calculate appointmentStart and cancellationDeadline
  let startDateTime = null;
  if (appointment.appointmentDate) {
    const baseDate = new Date(appointment.appointmentDate);
    if (!isNaN(baseDate.getTime())) {
      let hours = 0;
      let minutes = 0;
      if (appointment.startTime && typeof appointment.startTime === 'string') {
        const cleanStr = appointment.startTime.trim();
        const isPM = /pm/i.test(cleanStr);
        const isAM = /am/i.test(cleanStr);
        const numbersOnly = cleanStr.replace(/[^0-9:]/g, '');
        const parts = numbersOnly.split(':');
        if (parts.length >= 1) {
          hours = parseInt(parts[0], 10) || 0;
          if (isPM && hours < 12) hours += 12;
          if (isAM && hours === 12) hours = 0;
        }
        if (parts.length >= 2) {
          minutes = parseInt(parts[1], 10) || 0;
        }
      }
      const y = baseDate.getUTCFullYear();
      const m = baseDate.getUTCMonth();
      const d = baseDate.getUTCDate();
      startDateTime = new Date(Date.UTC(y, m, d, hours, minutes, 0, 0));
    }
  }

  if (startDateTime) {
    const now = new Date();
    const cancellationDeadline = new Date(startDateTime.getTime() - 24 * 60 * 60 * 1000);

    // Rule 5: Appointment Already Started
    if (now >= startDateTime) {
      return {
        canCancel: false,
        reason: 'APPOINTMENT_STARTED',
        message: 'This appointment can no longer be cancelled because the appointment time has already started.'
      };
    }

    // Rule 4: 24-Hour Cancellation Window Closed
    if (now >= cancellationDeadline) {
      return {
        canCancel: false,
        reason: 'CANCELLATION_WINDOW_CLOSED',
        message: 'Appointments can only be cancelled more than 24 hours before the scheduled time.'
      };
    }
  }

  return {
    canCancel: true,
    reason: null,
    message: null
  };
};
