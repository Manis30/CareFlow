import { AppError } from "../middleware/errorHandler.js";
import { normalizeTimeTo24h, timeToMinutes } from "./timeUtils.js";

const validateDoctorAvailability = (availableInput, workingHours = []) => {
    let available = availableInput;

    // Parse JSON string if received via multipart/form-data
    if (typeof available === "string") {
        try {
            available = JSON.parse(available);
        } catch (e) {
            throw new AppError(400, "Invalid JSON format for doctor availability");
        }
    }

    if (!available || !Array.isArray(available)) {
        throw new AppError(400, "Doctor availability must be an array");
    }

    if (available.length === 0) {
        throw new AppError(400, "Doctor availability must contain at least one day schedule");
    }

    for (const item of available) {
        if (!item || typeof item !== "object") continue;

        const rawDay = item.day || item.dayOfWeek || item.dayName || "";
        const dayName = rawDay.toLowerCase().trim();
        if (!dayName) {
            throw new AppError(400, "Day name is required in doctor availability");
        }

        const rawOpen = item.open || item.start || item.startTime || "";
        const rawClose = item.close || item.end || item.endTime || "";
        const isEnabled = item.enabled !== false && item.isOpen !== false && item.isAvailable !== false;

        // Normalize 24h strings onto item
        item.day = dayName;
        item.open = normalizeTimeTo24h(rawOpen);
        item.start = item.open || null;
        item.close = normalizeTimeTo24h(rawClose);
        item.end = item.close || null;
        item.isOpen = isEnabled;
        item.enabled = isEnabled;
        item.isAvailable = isEnabled;

        const clinicDay = Array.isArray(workingHours)
            ? workingHours.find((wh) => wh.day && wh.day.toLowerCase().trim() === dayName)
            : null;

        const isClinicOpen = clinicDay
            ? (clinicDay.enabled !== false && clinicDay.isOpen !== false && clinicDay.status !== "CLOSED")
            : true;

        if (clinicDay && !isClinicOpen && isEnabled) {
            throw new AppError(
                400,
                `Doctor cannot be available on ${dayName} because the clinic is closed`
            );
        }

        if (!isEnabled) {
            continue;
        }

        if (!item.open || !item.close) {
            throw new AppError(
                400,
                `Start and end times are required for ${dayName}`
            );
        }

        const doctorStart = timeToMinutes(item.open);
        const doctorEnd = timeToMinutes(item.close);

        if (doctorStart === null || doctorEnd === null) {
            throw new AppError(
                400,
                `Invalid time format for ${dayName}`
            );
        }

        if (doctorStart >= doctorEnd) {
            throw new AppError(
                400,
                "Availability end time must be after the start time."
            );
        }

        if (clinicDay && isClinicOpen) {
            const rawClinicOpen = clinicDay.open || clinicDay.start || "";
            const rawClinicClose = clinicDay.close || clinicDay.end || clinicDay.clode || "";

            const clinicOpen = normalizeTimeTo24h(rawClinicOpen);
            const clinicClose = normalizeTimeTo24h(rawClinicClose);

            const clinicStart = timeToMinutes(clinicOpen);
            const clinicEnd = timeToMinutes(clinicClose);

            if (clinicStart !== null && doctorStart < clinicStart) {
                throw new AppError(
                    400,
                    `Doctor availability on ${dayName} cannot start before clinic opens at ${clinicOpen}`
                );
            }

            if (clinicEnd !== null && doctorEnd > clinicEnd) {
                throw new AppError(
                    400,
                    `Doctor availability on ${dayName} cannot end after clinic closes at ${clinicClose}`
                );
            }
        }
    }

    return true;
};

export default validateDoctorAvailability;