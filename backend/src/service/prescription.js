import { AppError } from "../middleware/errorHandler.js";
import { getDoctorByUserId } from "../repository/doctor.js";
import { getPatientByUserId } from "../repository/patient.js";
import { getAppointmentById } from "../repository/appointment.js";
import {
    createPrescription,
    getPrescriptionById,
    getPrescriptionByAppointmentId,
    getPrescriptionsByPatientId,
    getPrescriptionsByDoctorId,
    updatePrescriptionById
} from "../repository/prescription.js";

export const createPrescriptionService = async (appointmentId, doctorUserId, bodyData) => {
    const doctor = await getDoctorByUserId(doctorUserId);
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }

    const appointment = await getAppointmentById(appointmentId);
    if (!appointment) {
        throw new AppError(404, "Appointment not found");
    }

    const appointmentDoctorId = appointment.doctorId._id
        ? appointment.doctorId._id.toString()
        : appointment.doctorId.toString();

    if (appointmentDoctorId !== doctor._id.toString()) {
        throw new AppError(403, "Doctor is not assigned to this appointment");
    }

    if (appointment.status !== "completed") {
        throw new AppError(400, "Only completed appointments can have a prescription");
    }

    const existingPrescription = await getPrescriptionByAppointmentId(appointmentId);
    if (existingPrescription) {
        throw new AppError(409, "Prescription already exists for this appointment");
    }

    if (!bodyData.diagnosis) {
        throw new AppError(400, "Diagnosis is required");
    }

    const patientId = appointment.patientId._id
        ? appointment.patientId._id
        : appointment.patientId;

    const organizationId = appointment.organizationId._id
        ? appointment.organizationId._id
        : appointment.organizationId;

    const prescriptionData = {
        organizationId,
        appointmentId,
        doctorId: doctor._id,
        patientId,
        diagnosis: bodyData.diagnosis,
        medicines: bodyData.medicines || [],
        notes: bodyData.notes || null
    };

    return await createPrescription(prescriptionData);
};

export const getMyPrescriptionsService = async (userId, userRole) => {
    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        if (!patient) {
            throw new AppError(404, "Patient profile not found");
        }
        return await getPrescriptionsByPatientId(patient._id);
    } else if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) {
            throw new AppError(404, "Doctor profile not found");
        }
        return await getPrescriptionsByDoctorId(doctor._id);
    }
    throw new AppError(403, "Invalid role for accessing prescriptions");
};

export const getPrescriptionByIdService = async (id, userId, userRole) => {
    const prescription = await getPrescriptionById(id);
    if (!prescription) {
        throw new AppError(404, "Prescription not found");
    }

    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        const presPatientId = prescription.patientId._id
            ? prescription.patientId._id.toString()
            : prescription.patientId.toString();

        if (!patient || presPatientId !== patient._id.toString()) {
            throw new AppError(403, "You are not allowed to access this prescription");
        }
        return prescription;
    }

    if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        const presDoctorId = prescription.doctorId._id
            ? prescription.doctorId._id.toString()
            : prescription.doctorId.toString();

        if (!doctor || presDoctorId !== doctor._id.toString()) {
            throw new AppError(403, "You are not allowed to access this prescription");
        }
        return prescription;
    }

    throw new AppError(403, "You are not allowed to access this prescription");
};

export const getPrescriptionByAppointmentService = async (appointmentId, userId, userRole) => {
    const appointment = await getAppointmentById(appointmentId);
    if (!appointment) {
        throw new AppError(404, "Appointment not found");
    }

    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        const appPatientId = appointment.patientId._id
            ? appointment.patientId._id.toString()
            : appointment.patientId.toString();

        if (!patient || appPatientId !== patient._id.toString()) {
            throw new AppError(403, "You are not allowed to access prescriptions for this appointment");
        }
    } else if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        const appDoctorId = appointment.doctorId._id
            ? appointment.doctorId._id.toString()
            : appointment.doctorId.toString();

        if (!doctor || appDoctorId !== doctor._id.toString()) {
            throw new AppError(403, "Doctor is not assigned to this appointment");
        }
    }

    const prescription = await getPrescriptionByAppointmentId(appointmentId);
    if (!prescription) {
        throw new AppError(404, "Prescription not found");
    }

    return prescription;
};

export const updatePrescriptionService = async (id, doctorUserId, bodyData) => {
    const doctor = await getDoctorByUserId(doctorUserId);
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }

    const prescription = await getPrescriptionById(id);
    if (!prescription) {
        throw new AppError(404, "Prescription not found");
    }

    const presDoctorId = prescription.doctorId._id
        ? prescription.doctorId._id.toString()
        : prescription.doctorId.toString();

    if (presDoctorId !== doctor._id.toString()) {
        throw new AppError(403, "Only the doctor who created this prescription can update it");
    }

    const updateData = {
        diagnosis: bodyData.diagnosis || prescription.diagnosis,
        medicines: bodyData.medicines || prescription.medicines,
        notes: bodyData.notes !== undefined ? bodyData.notes : prescription.notes
    };

    return await updatePrescriptionById(id, updateData);
};
