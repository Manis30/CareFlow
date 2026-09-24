import { AppError } from '../middleware/errorHandler.js';
import { formatDoctorName } from '../util/formatters.js';
import {
    getAppointmentStartDateTime,
    normalizeCancelReason,
    parseTimeToMinutes,
    doTimeRangesOverlap,
    formatDateKey
} from '../util/appointmentTimeUtils.js';

import {
    createAppointment,
    getAppointmentById,
    getAppointmentsByPatientId,
    getAppointmentsByDoctorId,
    getClinicAppointments,
    updateAppointmentById,
    findAppointment,
    getClinicAppointmentStats,
    updateMeetingDetails
} from "../repository/appointment.js";

import {
    getPatientByUserId
} from "../repository/patient.js";

import {
    getDoctorById,
    getDoctorByUserId
} from "../repository/doctor.js";
import { getOrCreateGeneralDepartment } from "../repository/department.js";
import DoctorModel from "../model/doctor.js";
import AppointmentModel from "../model/appointment.js";
import { initializePaymentService, completeCashPaymentService } from './payment.js';
import { invalidateStatsCache } from './ai/cache.js';
import { createNotificationService } from './notification.js';
const getDayFromDate = (date) => {

    const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ];

    const d = new Date(date);

    return days[d.getDay()];

};

/**
 * Checks if a doctor has an existing non-cancelled appointment that overlaps with [startTime, endTime] on appointmentDate.
 * @param {string|ObjectId} doctorId
 * @param {string|Date} appointmentDate
 * @param {string} startTime
 * @param {string} endTime
 * @returns {Promise<boolean>} returns true if a conflict exists
 */
export const checkDoctorSlotConflict = async (doctorId, appointmentDate, startTime, endTime) => {
    const reqStart = parseTimeToMinutes(startTime);
    const reqEnd = parseTimeToMinutes(endTime);
    const targetDateKey = formatDateKey(appointmentDate);

    if (reqStart === null || reqEnd === null || !targetDateKey) return false;

    const activeAppts = await AppointmentModel.find({
        doctorId,
        status: { $ne: "cancelled" }
    });

    return activeAppts.some((appt) => {
        if (!appt.appointmentDate) return false;
        const apptDateKey = formatDateKey(appt.appointmentDate);
        if (apptDateKey !== targetDateKey) return false;

        const apptStart = parseTimeToMinutes(appt.startTime);
        const apptEnd = parseTimeToMinutes(appt.endTime);

        return doTimeRangesOverlap(reqStart, reqEnd, apptStart, apptEnd);
    });
};

/**
 * Checks if a patient already has another active appointment overlapping with [startTime, endTime] on appointmentDate.
 * @param {string|ObjectId} patientId
 * @param {string|Date} appointmentDate
 * @param {string} startTime
 * @param {string} endTime
 * @returns {Promise<Object|null>} returns patient's own overlapping appointment details if conflict exists, else null
 */
export const checkPatientScheduleConflict = async (patientId, appointmentDate, startTime, endTime) => {
    const reqStart = parseTimeToMinutes(startTime);
    const reqEnd = parseTimeToMinutes(endTime);
    const targetDateKey = formatDateKey(appointmentDate);

    if (reqStart === null || reqEnd === null || !targetDateKey || !patientId) return null;

    const patientAppts = await AppointmentModel.find({
        patientId,
        status: { $ne: "cancelled" }
    })
        .populate({
            path: "doctorId",
            populate: { path: "userId", select: "name" }
        })
        .populate("organizationId", "name clinicName");

    for (const appt of patientAppts) {
        if (!appt.appointmentDate) continue;
        const apptDateKey = formatDateKey(appt.appointmentDate);
        if (apptDateKey !== targetDateKey) continue;

        const apptStart = parseTimeToMinutes(appt.startTime);
        const apptEnd = parseTimeToMinutes(appt.endTime);

        if (doTimeRangesOverlap(reqStart, reqEnd, apptStart, apptEnd)) {
            const rawDocName = appt.doctorId?.userId?.name || appt.doctorId?.name || "another doctor";
            const docName = formatDoctorName(rawDocName);
            const orgName = appt.organizationId?.name || appt.organizationId?.clinicName || appt.organizationId?.organizationName || "Healthcare Facility";
            
            return {
                appointmentId: appt._id?.toString(),
                doctorId: appt.doctorId?._id?.toString() || appt.doctorId?.toString(),
                doctorName: docName,
                organizationId: appt.organizationId?._id?.toString() || appt.organizationId?.toString(),
                organizationName: orgName,
                startTime: appt.startTime,
                endTime: appt.endTime,
                consultationType: appt.consultationType || "online"
            };
        }
    }

    return null;
};

/**
 * Central Slot Validation Helper
 * Performs TWO separate conflict checks:
 * 1. DOCTOR_BUSY check
 * 2. PATIENT_BUSY check
 * @param {Object} params - { doctorId, patientId, appointmentDate, startTime, endTime }
 * @returns {Promise<Object>} { available: true } OR { available: false, reason, message, existingAppointment? }
 */
export const validateAppointmentSlot = async (...args) => {
    let doctorId, patientId, appointmentDate, startTime, endTime;
    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        ({ doctorId, patientId, appointmentDate, startTime, endTime } = args[0]);
    } else {
        [doctorId, appointmentDate, startTime, endTime, patientId] = args;
    }

    if (!doctorId || !appointmentDate || !startTime || !endTime) {
        throw new AppError(400, "Incomplete slot validation parameters");
    }

    // 0. DOCTOR LEAVE CHECK (Section 6 write-time guard)
    const doctorDoc = await DoctorModel.findById(doctorId).lean();
    if (doctorDoc && Array.isArray(doctorDoc.leave) && doctorDoc.leave.length > 0) {
        const targetDateObj = new Date(appointmentDate + "T00:00:00.000Z");
        const isOnLeave = doctorDoc.leave.some(l => {
            const leaveStart = new Date(l.startDate);
            const leaveEnd = new Date(l.endDate);
            leaveStart.setHours(0, 0, 0, 0);
            leaveEnd.setHours(23, 59, 59, 999);
            return targetDateObj >= leaveStart && targetDateObj <= leaveEnd;
        });
        if (isOnLeave) {
            return {
                available: false,
                reason: "DOCTOR_ON_LEAVE",
                message: "Doctor is on leave on the selected date."
            };
        }
    }

    // 1. DOCTOR AVAILABILITY CONFLICT
    const isDocBusy = await checkDoctorSlotConflict(doctorId, appointmentDate, startTime, endTime);
    if (isDocBusy) {
        return {
            available: false,
            reason: "DOCTOR_BUSY",
            message: "This slot has already been booked by another patient."
        };
    }

    // 2. PATIENT SCHEDULE CONFLICT
    if (patientId) {
        const patientConflict = await checkPatientScheduleConflict(patientId, appointmentDate, startTime, endTime);
        if (patientConflict) {
            return {
                available: false,
                reason: "PATIENT_BUSY",
                message: "You already have an appointment during this time.",
                existingAppointment: {
                    doctorId: patientConflict.doctorId,
                    doctorName: patientConflict.doctorName,
                    organizationId: patientConflict.organizationId,
                    organizationName: patientConflict.organizationName,
                    startTime: patientConflict.startTime,
                    endTime: patientConflict.endTime,
                    consultationType: patientConflict.consultationType
                }
            };
        }
    }

    return {
        available: true
    };
};

export const validateAppointmentSlotService = validateAppointmentSlot;

export const createAppointmentService = async (
    userId,
    data
) => {
    const appointmentDateTime = new Date(
        `${data.appointmentDate}T${data.startTime}`
    );

    const currentDateTime = new Date();

    if (appointmentDateTime <= currentDateTime) {
        throw new AppError(
            400,
            "Cannot book an appointment in the past"
        );
    }
    let patient = null;
    if (data.patientId) {
        const PatientModel = (await import("../model/patient.js")).default;
        patient = await PatientModel.findById(data.patientId);
    }
    if (!patient) {
        patient = await getPatientByUserId(userId);
    }

    if (!patient) {
        throw new AppError(
            404,
            "Patient profile not found"
        );
    }
    if (!data.doctorId) {
        throw new AppError(
            400,
            "Doctor selection is required"
        );
    }

    const doctor = await getDoctorById(
        data.doctorId,
        data.organizationId
    );

    if (!doctor) {
        throw new AppError(
            404,
            "Selected doctor was not found"
        );
    }

    // System-wide Department Resolution:
    // 1. Check doctor.departmentId 2. Check data.departmentId 3. Organization General department fallback
    let resolvedDepartmentId = doctor.departmentId?._id || doctor.departmentId || data.departmentId;

    if (!resolvedDepartmentId) {
        const orgId = doctor.organizationId?._id || doctor.organizationId || data.organizationId;
        const generalDept = await getOrCreateGeneralDepartment(orgId);
        if (generalDept) {
            resolvedDepartmentId = generalDept._id;
        }
    }

    if (!resolvedDepartmentId) {
        throw new AppError(
            400,
            "Unable to resolve a valid department for this appointment."
        );
    }

    // Assign fallback department to doctor record if missing
    if (!doctor.departmentId && resolvedDepartmentId) {
        DoctorModel.findByIdAndUpdate(doctor._id, { departmentId: resolvedDepartmentId }).catch(() => { });
    }

    // Section 6: Check doctor leave (write-time guard)
    if (Array.isArray(doctor.leave) && doctor.leave.length > 0) {
        const targetDateObj = new Date(data.appointmentDate + "T00:00:00.000Z");
        const isOnLeave = doctor.leave.some(l => {
            const leaveStart = new Date(l.startDate);
            const leaveEnd = new Date(l.endDate);
            leaveStart.setHours(0, 0, 0, 0);
            leaveEnd.setHours(23, 59, 59, 999);
            return targetDateObj >= leaveStart && targetDateObj <= leaveEnd;
        });
        if (isOnLeave) {
            throw new AppError(
                409,
                "Doctor is on leave on the requested date. Bookings are not accepted during leave periods."
            );
        }
    }

    const appointmentDay = getDayFromDate(
        data.appointmentDate
    );
    const doctorAvailability = doctor.available.find(
        (availability) =>
            availability.day?.toLowerCase() === appointmentDay
    );
    if (!doctorAvailability) {
        throw new AppError(
            400,
            "Doctor has no availability configured for the selected day"
        );
    }
    if (!doctorAvailability.isAvailable) {
        throw new AppError(
            400,
            "Doctor is not available on the selected day"
        );
    }
    if (
        !doctorAvailability.open ||
        !doctorAvailability.close
    ) {
        throw new AppError(
            400,
            "Doctor availability hours are not configured"
        );
    }

    const reqStartMins = parseTimeToMinutes(data.startTime);
    const reqEndMins = parseTimeToMinutes(data.endTime);
    const docOpenMins = parseTimeToMinutes(doctorAvailability.open);
    const docCloseMins = parseTimeToMinutes(doctorAvailability.close);

    if (
        reqStartMins !== null && docOpenMins !== null && reqEndMins !== null && docCloseMins !== null &&
        (reqStartMins < docOpenMins || reqEndMins > docCloseMins)
    ) {
        throw new AppError(
            400,
            `Doctor is available only between ${doctorAvailability.open} and ${doctorAvailability.close}`
        );
    }
    try {
        const allowedPaymentMethods = [
            "online",
            "cash"
        ];

        if (!allowedPaymentMethods.includes(data.paymentMethod)) {
            throw new AppError(
                400,
                "Invalid payment method"
            );
        }

        // Validate Slot Availability (Both Doctor & Patient Conflicts)
        const slotValidation = await validateAppointmentSlot({
            doctorId: doctor._id,
            patientId: patient._id,
            appointmentDate: data.appointmentDate,
            startTime: data.startTime,
            endTime: data.endTime
        });

        if (!slotValidation.available) {
            throw new AppError(
                409,
                slotValidation.message,
                slotValidation.reason,
                slotValidation.existingAppointment
            );
        }

        const appointment = await createAppointment({
            organizationId: data.organizationId || doctor.organizationId,
            patientId: patient._id,
            doctorId: doctor._id,
            departmentId: resolvedDepartmentId,
            consultationType: data.consultationType,
            appointmentDate: data.appointmentDate,
            startTime: data.startTime,
            endTime: data.endTime,
            reason: data.reason || data.reasonForVisit,
            reasonForVisit: data.reasonForVisit || data.reason
        });
        invalidateStatsCache(data.organizationId || doctor.organizationId);
        await initializePaymentService(
            appointment,
            doctor.consultationFee,
            data.paymentMethod
        );
        return appointment;

    } catch (error) {
        if (error.code === 11000) {
            if (error.keyPattern?.doctorId) {

                throw new AppError(
                    409,
                    "This doctor is already booked at the selected time"
                );
            }
            if (error.keyPattern?.patientId) {

                throw new AppError(
                    409,
                    "You already have an appointment at the selected time"
                );
            }
        }
        throw error;
    }
};



export const getMyAppointmentsService = async (
    userId,
    userRoleOrStatus,
    statusFilter
) => {
    let role = "patient";
    let status = null;

    if (typeof userRoleOrStatus === "string" && ["patient", "doctor", "admin", "organization_admin", "super_admin"].includes(userRoleOrStatus.toLowerCase())) {
        role = userRoleOrStatus.toLowerCase();
        if (role === "organization_admin") role = "admin";
        status = statusFilter;
    } else {
        status = userRoleOrStatus;
    }

    const filter = {};
    if (status) {
        const allowedStatus = ["booked", "in_progress", "completed", "cancelled", "upcoming"];
        if (!allowedStatus.includes(status.toLowerCase())) {
            throw new AppError(400, "Invalid appointment status");
        }

        const sLower = status.toLowerCase();
        if (sLower === "booked" || sLower === "upcoming") {
            filter.status = { $in: ["booked", "in_progress", "BOOKED", "IN_PROGRESS"] };
        } else {
            filter.status = { $in: [status, sLower, status.toUpperCase()] };
        }
    }

    let rawResult = [];
    if (role === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            throw new AppError(404, "Doctor profile not found");
        }
        rawResult = await getAppointmentsByDoctorId(doctor._id, filter);
    } else if (role === "admin" || role === "organization_admin") {
        const UserRepo = await import("../repository/user.js");
        const userDoc = await UserRepo.getUserById(userId);
        const orgId = userDoc?.organizationId?._id || userDoc?.organizationId;
        if (!orgId) {
            throw new AppError(404, "Organization not found for user");
        }
        const clinicRes = await getClinicAppointments(orgId, filter);
        rawResult = clinicRes?.appointments || clinicRes || [];
    } else {
        const patient = await getPatientByUserId(userId);
        if (!patient) {
            throw new AppError(404, "Patient profile not found");
        }
        rawResult = await getAppointmentsByPatientId(patient._id, filter);
    }

    const apptList = Array.isArray(rawResult) ? rawResult : (rawResult?.appointments || []);
    return apptList.map(appt => {
        const apptObj = typeof appt.toObject === 'function' ? appt.toObject() : appt;
        const patientName = appt.patientId?.userId?.name || appt.patientId?.name || apptObj.patientName || "Unknown Patient";
        const rawDocName = appt.doctorId?.userId?.name || appt.doctorId?.name || apptObj.doctorName || "Specialist";
        const doctorName = formatDoctorName(rawDocName);
        const department = appt.departmentId?.name || apptObj.department || "General";
        const reasonForVisit = appt.reasonForVisit || appt.reason || appt.triageInfo?.chiefComplaint || apptObj.reasonForVisit || apptObj.reason || "Not specified";

        return {
            ...apptObj,
            patientName,
            doctorName,
            department,
            reasonForVisit
        };
    });
};

export const rescheduleAppointmentService = async (
    appointmentId,
    userId,
    userRole,
    data = {}
) => {
    const newDate = data.appointmentDate || data.date;
    const newStartTime = data.startTime;

    if (!appointmentId || !newDate || !newStartTime) {
        throw new AppError(400, "appointmentId, appointmentDate, and startTime are required for rescheduling");
    }

    let newEndTime = data.endTime;
    if (!newEndTime && newStartTime) {
        const parts = newStartTime.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const totalMins = h * 60 + m + 30;
        const endH = String(Math.floor(totalMins / 60)).padStart(2, '0');
        const endM = String(totalMins % 60).padStart(2, '0');
        newEndTime = `${endH}:${endM}`;
    }

    const appointment = await findAppointment({ _id: appointmentId });
    if (!appointment) {
        throw new AppError(404, "Appointment not found");
    }

    // Ownership / Authorization Check
    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        const appPatientId = appointment.patientId?._id?.toString() || appointment.patientId?.toString();
        if (!patient || appPatientId !== patient._id.toString()) {
            throw new AppError(403, "Access denied. You can only reschedule your own appointments.");
        }
    } else if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        const appDoctorId = appointment.doctorId?._id?.toString() || appointment.doctorId?.toString();
        if (!doctor || appDoctorId !== doctor._id.toString()) {
            throw new AppError(403, "Access denied. You can only reschedule appointments assigned to you.");
        }
    }

    // Status Eligibility Check
    const currentStatus = (appointment.status || '').toLowerCase();
    if (currentStatus === "cancelled" || currentStatus === "completed") {
        throw new AppError(400, `Cannot reschedule an appointment with status '${appointment.status}'`);
    }

    // Slot Conflict Check (excluding this appointment)
    const activeAppts = await AppointmentModel.find({
        doctorId: appointment.doctorId,
        _id: { $ne: appointment._id },
        status: { $nin: ["cancelled", "CANCELLED"] }
    });

    const reqStart = parseTimeToMinutes(newStartTime);
    const reqEnd = parseTimeToMinutes(newEndTime);
    const targetDateKey = formatDateKey(newDate);

    const hasDocConflict = activeAppts.some((appt) => {
        if (!appt.appointmentDate) return false;
        if (formatDateKey(appt.appointmentDate) !== targetDateKey) return false;
        const apptStart = parseTimeToMinutes(appt.startTime);
        const apptEnd = parseTimeToMinutes(appt.endTime);
        return doTimeRangesOverlap(reqStart, reqEnd, apptStart, apptEnd);
    });

    if (hasDocConflict) {
        throw new AppError(409, "This doctor is already booked at the selected time", "DOCTOR_BUSY");
    }

    try {
        const updated = await updateAppointmentById(appointmentId, {
            appointmentDate: newDate,
            startTime: newStartTime,
            endTime: newEndTime,
            status: "booked"
        });

        // Invalidate stats cache
        const orgId = appointment.organizationId?._id || appointment.organizationId;
        invalidateStatsCache(orgId);

        // Notify Patient & Doctor
        const patientUserId = appointment.patientId?.userId?._id || appointment.patientId?.userId || appointment.patientId;
        const doctorUserId = appointment.doctorId?.userId?._id || appointment.doctorId?.userId || appointment.doctorId;

        if (patientUserId) {
            createNotificationService({
                userId: patientUserId,
                organizationId: orgId,
                title: "Appointment Rescheduled",
                message: `Your appointment has been rescheduled to ${newDate} at ${newStartTime}.`,
                type: "APPOINTMENT_RESCHEDULED"
            }).catch(() => {});
        }

        if (doctorUserId) {
            createNotificationService({
                userId: doctorUserId,
                organizationId: orgId,
                title: "Appointment Rescheduled",
                message: `Appointment ${appointmentId} has been rescheduled to ${newDate} at ${newStartTime}.`,
                type: "APPOINTMENT_RESCHEDULED"
            }).catch(() => {});
        }

        return updated;
    } catch (err) {
        if (err.code === 11000) {
            throw new AppError(409, "This doctor is already booked at the selected time");
        }
        throw err;
    }
};


export const getAppointmentService = async (
    appointmentId,
    userOrUserId,
    roleParam,
    orgIdParam
) => {
    let user;
    if (userOrUserId && typeof userOrUserId === 'object') {
        user = {
            id: userOrUserId.id || userOrUserId._id,
            _id: userOrUserId.id || userOrUserId._id,
            role: userOrUserId.role,
            organizationId: userOrUserId.organizationId?._id || userOrUserId.organizationId
        };
    } else {
        user = {
            id: userOrUserId,
            _id: userOrUserId,
            role: roleParam,
            organizationId: orgIdParam
        };
    }

    const rawAppointment = await findAppointment({ _id: appointmentId });

    if (!rawAppointment) {
        throw new AppError(
            404,
            "Appointment not found"
        );
    }

    if (user.role === "patient") {
        const patient = await getPatientByUserId(
            user.id
        );

        if (!patient) {
            throw new AppError(
                404,
                "Patient profile not found"
            );
        }

        const appPatientId = rawAppointment.patientId?._id
            ? rawAppointment.patientId._id.toString()
            : rawAppointment.patientId?.toString();

        if (appPatientId !== patient._id.toString()) {
            throw new AppError(
                403,
                "Access denied. You can only view your own appointments."
            );
        }
    }

    if (user.role === "doctor") {
        const doctor = await getDoctorByUserId(
            user.id
        );

        if (!doctor) {
            throw new AppError(
                404,
                "Doctor profile not found"
            );
        }

        const appDoctorId = rawAppointment.doctorId?._id
            ? rawAppointment.doctorId._id.toString()
            : rawAppointment.doctorId?.toString();

        if (appDoctorId !== doctor._id.toString()) {
            throw new AppError(
                403,
                "Access denied. You can only view appointments assigned to you."
            );
        }
    }

    if (user.role === "admin" || user.role === "organization_admin" || user.role === "org_admin") {
        const appOrgId = rawAppointment.organizationId?._id
            ? rawAppointment.organizationId._id.toString()
            : rawAppointment.organizationId?.toString();

        if (user.organizationId && appOrgId !== user.organizationId.toString()) {
            throw new AppError(
                403,
                "Access denied. You can only view appointments belonging to your organization."
            );
        }
    }

    return rawAppointment;
};

import { validateCancellationEligibility } from '../util/appointmentCancellationUtils.js';
export { validateCancellationEligibility };

export const cancelAppointmentService = async (
    appointmentId,
    userId,
    cancelReason
) => {
    const cleanReason = normalizeCancelReason(cancelReason);
    if (!cleanReason) {
        throw new AppError(
            400,
            "Cancellation reason is required"
        );
    }

    const patient = await getPatientByUserId(userId);
    if (!patient) {
        throw new AppError(
            404,
            "Patient profile not found"
        );
    }

    const appointment = await findAppointment({
        _id: appointmentId,
        patientId: patient._id
    });

    validateCancellationEligibility(appointment);

    return await updateAppointmentById(
        appointmentId,
        {
            status: "cancelled",
            cancelReason: cleanReason,
            cancelledBy: "patient",
            cancelledAt: new Date()
        }
    );
};


export const getDoctorTodayAppointmentsService = async (
    userId
) => {
    console.log(userId, 'checl   ')
    const doctor = await getDoctorByUserId(userId);
    console.log('doctor data check', doctor)
    if (!doctor) {

        throw new AppError(
            404,
            "Doctor profile not found"
        );
    }


    const today = new Date();

    today.setHours(0, 0, 0, 0);


    const tomorrow = new Date(today);

    tomorrow.setDate(
        tomorrow.getDate() + 1
    );


    return await getAppointmentsByDoctorId(
        doctor._id,
        {
            appointmentDate: {
                $gte: today,
                $lt: tomorrow
            }
        }
    );
};


export const getDoctorUpcomingAppointmentsService = async (
    userId
) => {

    const doctor = await getDoctorByUserId(userId);

    if (!doctor) {

        throw new AppError(
            404,
            "Doctor profile not found"
        );
    }


    const tomorrow = new Date();

    tomorrow.setHours(0, 0, 0, 0);

    tomorrow.setDate(
        tomorrow.getDate() + 1
    );


    return await getAppointmentsByDoctorId(
        doctor._id,
        {
            appointmentDate: {
                $gte: tomorrow
            },
            status: { $in: ["BOOKED", "CONFIRMED", "booked", "confirmed"] }
        }
    );
};


export const getDoctorCompletedAppointmentsService = async (
    userId
) => {

    const doctor = await getDoctorByUserId(userId);

    if (!doctor) {

        throw new AppError(
            404,
            "Doctor profile not found"
        );
    }

    return await getAppointmentsByDoctorId(
        doctor._id,
        {
            status: { $in: ["COMPLETED", "completed"] }
        }
    );
};


export const getDoctorCancelledAppointmentsService = async (
    userId
) => {

    const doctor = await getDoctorByUserId(userId);

    if (!doctor) {

        throw new AppError(
            404,
            "Doctor profile not found"
        );
    }

    return await getAppointmentsByDoctorId(
        doctor._id,
        {
            status: { $in: ["CANCELLED", "cancelled"] }
        }
    );
};

export const cancelAppointmentByDoctorService = async (
    appointmentId,
    userId,
    cancelReason
) => {
    const cleanReason = normalizeCancelReason(cancelReason);
    if (!cleanReason) {
        throw new AppError(
            400,
            "Cancellation reason is required"
        );
    }

    const doctor = await getDoctorByUserId(userId);
    if (!doctor) {
        throw new AppError(
            404,
            "Doctor profile not found"
        );
    }

    const appointment = await findAppointment({
        _id: appointmentId,
        doctorId: doctor._id
    });

    validateCancellationEligibility(appointment);

    return await updateAppointmentById(
        appointmentId,
        {
            status: "cancelled",
            cancelReason: cleanReason,
            cancelledBy: "doctor",
            cancelledAt: new Date()
        }
    );
};

export const completeAppointmentService = async (
    appointmentId,
    userId
) => {

    const doctor = await getDoctorByUserId(userId);


    const appointment = await findAppointment({
        _id: appointmentId,
        doctorId: doctor._id
    });

    if (!appointment) {

        throw new AppError(
            404,
            "Appointment not found"
        );
    }


    if (appointment.status !== "booked") {

        throw new AppError(
            400,
            "Only booked appointments can be completed"
        );
    }
    const appointmentEndTime = new Date(appointment.appointmentDate);
    if (typeof appointment.endTime === 'string') {
        const timeMatch = appointment.endTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const period = timeMatch[3]?.toUpperCase();
            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            appointmentEndTime.setHours(hours, minutes, 0, 0);
        }
    }
    if (new Date() < appointmentEndTime) {
        throw new AppError(400, "Appointment cannot be completed before its scheduled end time");
    }
    const updatedAppointment =
        await updateAppointmentById(
            appointmentId,
            {
                status: "completed"
            }
        );

    await completeCashPaymentService(
        appointmentId
    );

    return updatedAppointment;
};

export const getAllClinicAppointmentsService = async (
    organizationId,
    query
) => {
    const filter = {};
    if (query.status) {
        const allowedStatus = [
            "booked",
            "in_progress",
            "completed",
            "cancelled"
        ];

        if (!allowedStatus.includes(query.status)) {
            throw new AppError(
                400,
                "Invalid appointment status"
            );
        }
        if (query.status === "booked") {
            filter.status = { $in: ["booked", "in_progress"] };
        } else {
            filter.status = query.status;
        }
    }
    if (query.doctorId) {
        filter.doctorId = query.doctorId;
    }
    if (query.departmentId) {
        filter.departmentId = query.departmentId;
    }
    if (query.patientId) {
        filter.patientId = query.patientId;
    }
    if (
        query.startDate ||
        query.endDate
    ) {
        filter.appointmentDate = {};

        if (query.startDate) {

            filter.appointmentDate.$gte =
                new Date(query.startDate);
        }
        if (query.endDate) {

            const endDate =
                new Date(query.endDate);

            endDate.setHours(
                23,
                59,
                59,
                999
            );

            filter.appointmentDate.$lte =
                endDate;
        }
    }
    const page = Math.max(
        Number(query.page) || 1,
        1
    );
    const limit = Math.min(
        Math.max(
            Number(query.limit) || 10,
            1
        ),
        2000
    );
    const result =
        await getClinicAppointments(
            organizationId,
            filter,
            page,
            limit
        )
    return result;

};
export const getClinicAppointmentStatsService = async (
    organizationId
) => {
    return await getClinicAppointmentStats(
        organizationId
    );
};

export const updateOnlineMeetingService = async (
    appointmentId,
    doctorUserId,
    meetingData
) => {
    const doctor = await getDoctorByUserId(doctorUserId);
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }

    const appointment = await getAppointmentById(appointmentId);
    if (!appointment) {
        throw new AppError(404, "Appointment not found");
    }

    const appDoctorId = appointment.doctorId._id
        ? appointment.doctorId._id.toString()
        : appointment.doctorId.toString();

    if (appDoctorId !== doctor._id.toString()) {
        throw new AppError(403, "Doctor is not assigned to this appointment");
    }

    if (appointment.consultationType !== "online") {
        throw new AppError(400, "Only online appointments can have a meeting link");
    }

    if (appointment.status === "cancelled") {
        throw new AppError(400, "Cannot add a meeting link to a cancelled appointment");
    }

    if (!meetingData.meetingLink || !meetingData.provider) {
        throw new AppError(400, "Meeting link and provider are required");
    }

    const onlineMeeting = {
        provider: meetingData.provider,
        meetingLink: meetingData.meetingLink
    };

    return await updateMeetingDetails(appointmentId, onlineMeeting);
};

export const getConsultationAccess = (appointment) => {
    if (!appointment) {
        return { allowed: false, reason: "APPOINTMENT_NOT_FOUND" };
    }

    if (appointment.status === "completed" || appointment.consultationStatus === "completed") {
        return { allowed: false, reason: "CONSULTATION_COMPLETED" };
    }

    if (appointment.status === "cancelled") {
        return { allowed: false, reason: "APPOINTMENT_CANCELLED" };
    }

    let startTimestamp = 0;
    let endTimestamp = 0;

    if (appointment.appointmentDate && appointment.startTime) {
        const datePart = new Date(appointment.appointmentDate).toISOString().split("T")[0];

        const parseTimeStr = (tStr) => {
            if (!tStr) return null;
            const match = String(tStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (!match) return null;
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const period = match[3]?.toUpperCase();
            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            return new Date(`${datePart}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`).getTime();
        };

        startTimestamp = parseTimeStr(appointment.startTime) || 0;
        endTimestamp = parseTimeStr(appointment.endTime) || (startTimestamp ? startTimestamp + 30 * 60 * 1000 : 0);
    }

    const now = Date.now();
    const joinAvailableAt = startTimestamp > 0 ? startTimestamp - (5 * 60 * 1000) : 0;

    if (startTimestamp > 0 && now < joinAvailableAt) {
        return {
            allowed: false,
            reason: "TOO_EARLY",
            joinAvailableAt: new Date(joinAvailableAt).toISOString(),
            startTime: appointment.startTime,
            appointmentDate: appointment.appointmentDate
        };
    }

    if (endTimestamp > 0 && now >= endTimestamp) {
        return {
            allowed: false,
            reason: "CONSULTATION_ENDED",
            endTime: appointment.endTime,
            appointmentDate: appointment.appointmentDate
        };
    }

    return { allowed: true, reason: "ACCESS_GRANTED" };
};

export const getOnlineMeetingService = async (
    appointmentId,
    user
) => {
    const appointment = await getAppointmentById(appointmentId);
    if (!appointment) {
        throw new AppError(404, "Appointment not found");
    }

    if (appointment.consultationType !== "online") {
        throw new AppError(400, "Only online appointments can have a video consultation meeting");
    }

    if (appointment.paymentStatus !== "paid") {
        throw new AppError(400, "Cannot join meeting for an unpaid appointment");
    }

    if (user.role === "patient") {
        const patient = await getPatientByUserId(user.id);
        const appPatientId = appointment.patientId?._id
            ? appointment.patientId._id.toString()
            : appointment.patientId?.toString();

        if (!patient || appPatientId !== patient._id.toString()) {
            throw new AppError(403, "Access denied. You can only access your own consultation meetings.");
        }
    } else if (user.role === "doctor") {
        const doctor = await getDoctorByUserId(user.id);
        const appDoctorId = appointment.doctorId?._id
            ? appointment.doctorId._id.toString()
            : appointment.doctorId?.toString();

        if (!doctor || appDoctorId !== doctor._id.toString()) {
            throw new AppError(403, "Access denied. You are not assigned to this consultation meeting.");
        }
    } else if (user.role !== "super_admin" && user.role !== "admin" && user.role !== "organization_admin" && user.role !== "org_admin") {
        throw new AppError(403, "Access denied. You are not authorized to view this meeting.");
    }

    // Evaluate Consultation Access Eligibility
    const access = getConsultationAccess(appointment);

    // Auto-complete if appointment end time has elapsed
    if (access.reason === "CONSULTATION_ENDED" && appointment.status !== "completed") {
        appointment.status = "completed";
        appointment.consultationStatus = "completed";
        appointment.completedAt = new Date();
        await appointment.save();
    }

    if (!access.allowed) {
        let msg = "Meeting is not accessible.";
        if (access.reason === "TOO_EARLY") {
            const diffMins = Math.ceil((new Date(access.joinAvailableAt).getTime() - Date.now()) / (60 * 1000));
            msg = `Consultation access opens 5 minutes before scheduled start time (in ~${diffMins} min${diffMins > 1 ? 's' : ''}).`;
        } else if (access.reason === "CONSULTATION_ENDED" || access.reason === "CONSULTATION_COMPLETED") {
            msg = "This consultation has ended. Scheduled appointment time is complete.";
        } else if (access.reason === "APPOINTMENT_CANCELLED") {
            msg = "This appointment has been cancelled.";
        }

        return {
            canJoin: false,
            appointmentId: appointment._id.toString(),
            appointmentDate: appointment.appointmentDate,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            reason: msg
        };
    }

    let needsSave = false;

    // Mark appointment in_progress on first successful join if currently booked
    if (appointment.status === "booked") {
        appointment.status = "in_progress";
        appointment.consultationStatus = "in_progress";
        if (!appointment.consultationStartedAt) {
            appointment.consultationStartedAt = new Date();
        }
        needsSave = true;
    }

    // Ensure permanent meeting object
    let meeting = appointment.meeting || appointment.onlineMeeting;
    if (!meeting || !meeting.roomName) {
        const { createMeetingSession } = await import("./meetingService.js");
        meeting = createMeetingSession(appointment._id.toString());
        appointment.meeting = meeting;
        appointment.onlineMeeting = {
            provider: meeting.provider,
            meetingLink: meeting.meetingUrl,
            roomName: meeting.roomName
        };
        needsSave = true;
    } else if (meeting.provider === "jitsi" || !meeting.provider || meeting.provider !== "careflow-webrtc") {
        meeting.provider = "careflow-webrtc";
        meeting.meetingUrl = `/meeting/${appointment._id}`;
        appointment.meeting = meeting;
        appointment.onlineMeeting = {
            provider: "careflow-webrtc",
            meetingLink: `/meeting/${appointment._id}`,
            roomName: meeting.roomName
        };
        needsSave = true;
    }

    if (needsSave) {
        await appointment.save();
    }

    const doctorUser = appointment.doctorId?.userId || {};
    const patientUser = appointment.patientId?.userId || {};

    return {
        canJoin: true,
        appointmentId: appointment._id.toString(),
        roomId: meeting.roomName || meeting.roomId || `careflow-${appointment._id}`,
        roomName: meeting.roomName || meeting.roomId || `careflow-${appointment._id}`,
        meetingUrl: `/meeting/${appointment._id}`,
        provider: "careflow-webrtc",
        doctorName: formatDoctorName(doctorUser.name || "Doctor"),
        patientName: patientUser.name || "Patient",
        appointmentDate: appointment.appointmentDate,
        startTime: appointment.startTime,
        endTime: appointment.endTime
    };
};

export const autoCompleteExpiredAppointments = async () => {
    try {
        const activeAppointments = await AppointmentModel.find({
            consultationType: "online",
            status: { $in: ["booked", "in_progress"] }
        });

        for (const app of activeAppointments) {
            const access = getConsultationAccess(app);
            if (access.reason === "CONSULTATION_ENDED") {
                console.log(`[CareFlow Auto-Complete] Marking expired appointment ${app._id} as completed.`);
                await AppointmentModel.findOneAndUpdate(
                    { _id: app._id, status: { $ne: "completed" } },
                    {
                        status: "completed",
                        consultationStatus: "completed",
                        completedAt: new Date()
                    }
                );
            }
        }
    } catch (err) {
        console.error("[CareFlow Auto-Complete Worker Error]:", err.message);
    }
};

export const getAppointmentByIdService = getAppointmentService;

export const checkInAppointmentService = async (appointmentId, userId, role) => {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
        throw new AppError(404, "Appointment not found");
    }
    appointment.status = "CHECKED_IN";
    await appointment.save();
    return appointment;
};