import mongoose from "mongoose";
import MedicationScheduleModel from "../model/medicationSchedule.js";
import DoseLogModel from "../model/doseLog.js";
import PrescriptionModel from "../model/prescription.js";
import PatientModel from "../model/patient.js";
import DoctorModel from "../model/doctor.js";
import { AppError } from "../middleware/errorHandler.js";
import { getPatientByUserId } from "../repository/patient.js";

/**
 * Medication Intelligence & Safety Service (Phase 3)
 * Enforces doctor approval lifecycle, patient isolation, and adherence metrics from DoseLog.
 */

export const proposeScheduleFromPrescription = async (user, prescriptionId) => {
    if (!prescriptionId) throw new AppError(400, "prescriptionId is required");

    const prescription = await PrescriptionModel.findById(prescriptionId).lean();
    if (!prescription) throw new AppError(404, "Prescription not found");

    // Authorization: User must be the patient, the doctor, or clinic admin
    const patient = await PatientModel.findById(prescription.patientId).lean();
    if (!patient) throw new AppError(404, "Associated patient not found");

    const userIdStr = String(user.id || user._id);
    if (user.role === "patient" && String(patient.userId) !== userIdStr) {
        throw new AppError(403, "Not authorized to access this prescription");
    }

    const proposedSchedules = [];
    const now = new Date();

    for (const med of prescription.medicines || []) {
        // Parse frequency or timesPerDay
        let timesPerDay = med.timesPerDay || 1;
        let timesOfDay = med.timesOfDay && med.timesOfDay.length > 0 ? med.timesOfDay : [];
        if (timesOfDay.length === 0) {
            if (timesPerDay === 1) timesOfDay = ["09:00"];
            else if (timesPerDay === 2) timesOfDay = ["09:00", "21:00"];
            else if (timesPerDay === 3) timesOfDay = ["09:00", "14:00", "21:00"];
            else timesOfDay = ["09:00"];
        }

        const startDate = med.startDate ? new Date(med.startDate) : new Date(prescription.createdAt || now);
        let endDate = med.endDate ? new Date(med.endDate) : null;
        if (!endDate && med.duration) {
            const daysMatch = med.duration.match(/(\d+)\s*day/i);
            const weeksMatch = med.duration.match(/(\d+)\s*week/i);
            const monthsMatch = med.duration.match(/(\d+)\s*month/i);
            let daysToAdd = 7; // default 1 week
            if (daysMatch) daysToAdd = parseInt(daysMatch[1]);
            else if (weeksMatch) daysToAdd = parseInt(weeksMatch[1]) * 7;
            else if (monthsMatch) daysToAdd = parseInt(monthsMatch[1]) * 30;
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + daysToAdd);
        }

        const schedule = await MedicationScheduleModel.create({
            patientId: prescription.patientId,
            prescriptionId: prescription._id,
            doctorId: prescription.doctorId,
            organizationId: prescription.organizationId,
            medicineName: med.medicineName,
            dosage: med.dosage,
            frequency: med.frequency || `${timesPerDay} time(s) a day`,
            timesPerDay,
            timesOfDay,
            withFood: med.withFood || "unspecified",
            startDate,
            endDate,
            instructions: med.instructions || "",
            status: "PROPOSED" // Strict Invariant: Always starts as PROPOSED
        });

        proposedSchedules.push(schedule);
    }

    return proposedSchedules;
};

export const getMedicationSchedules = async (user, { patientId = null, status = null } = {}) => {
    const filter = {};

    if (user.role === "patient") {
        const patient = await getPatientByUserId(user.id || user._id);
        if (!patient) throw new AppError(404, "Patient profile not found");
        filter.patientId = patient._id;
    } else if (patientId) {
        filter.patientId = patientId;
    } else {
        throw new AppError(400, "patientId is required for clinical staff queries");
    }

    if (status) {
        filter.status = status;
    }

    return await MedicationScheduleModel.find(filter)
        .populate("doctorId", "specialization userId")
        .sort({ createdAt: -1 })
        .lean();
};

export const doctorApproveMedicationSchedule = async (user, scheduleId, { approved = true, edits = {}, rejectionReason = null } = {}) => {
    if (user.role !== "doctor" && user.role !== "admin") {
        throw new AppError(403, "Only licensed doctors or clinic administrators can approve medication schedules");
    }

    const schedule = await MedicationScheduleModel.findById(scheduleId);
    if (!schedule) throw new AppError(404, "Medication schedule not found");

    if (approved) {
        if (edits.dosage) schedule.dosage = edits.dosage;
        if (edits.timesOfDay) schedule.timesOfDay = edits.timesOfDay;
        if (edits.timesPerDay) schedule.timesPerDay = edits.timesPerDay;
        if (edits.withFood) schedule.withFood = edits.withFood;
        if (edits.instructions) schedule.instructions = edits.instructions;
        if (edits.startDate) schedule.startDate = new Date(edits.startDate);
        if (edits.endDate) schedule.endDate = new Date(edits.endDate);

        schedule.status = "ACTIVE"; // Transitioned by doctor approval
        schedule.approvedBy = user.id || user._id;
        schedule.approvedAt = new Date();
        schedule.rejectionReason = null;
    } else {
        schedule.status = "CANCELLED";
        schedule.rejectionReason = rejectionReason || "Rejected by doctor";
    }

    await schedule.save();
    return schedule;
};

export const recordDoseLog = async (user, { scheduleId, status, scheduledTime, notes = null, snoozedUntil = null }) => {
    if (!scheduleId) throw new AppError(400, "scheduleId is required");
    if (!["TAKEN", "MISSED", "SKIPPED", "SNOOZED"].includes(status)) {
        throw new AppError(400, "Invalid dose log status");
    }

    const schedule = await MedicationScheduleModel.findById(scheduleId);
    if (!schedule) throw new AppError(404, "Medication schedule not found");

    // Invariant: Patient cannot log dose for another patient
    if (user.role === "patient") {
        const patient = await getPatientByUserId(user.id || user._id);
        if (!patient || String(patient._id) !== String(schedule.patientId)) {
            throw new AppError(403, "You can only record medication logs for your own schedule");
        }
    }

    const scheduledDate = scheduledTime ? new Date(scheduledTime) : new Date();

    const log = await DoseLogModel.create({
        patientId: schedule.patientId,
        scheduleId: schedule._id,
        scheduledTime: scheduledDate,
        takenTime: status === "TAKEN" ? new Date() : null,
        status,
        snoozedUntil: status === "SNOOZED" && snoozedUntil ? new Date(snoozedUntil) : null,
        notes,
        recordedBy: user.id || user._id
    });

    return log;
};

export const getTodayMedications = async (user, targetDate = new Date()) => {
    const patient = await getPatientByUserId(user.id || user._id);
    if (!patient) throw new AppError(404, "Patient profile not found");

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Active or doctor approved schedules valid today
    const schedules = await MedicationScheduleModel.find({
        patientId: patient._id,
        status: { $in: ["ACTIVE", "DOCTOR_APPROVED"] },
        startDate: { $lte: endOfDay },
        $or: [
            { endDate: null },
            { endDate: { $gte: startOfDay } }
        ]
    }).lean();

    // Fetch existing dose logs for today
    const logs = await DoseLogModel.find({
        patientId: patient._id,
        scheduledTime: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    const result = [];
    for (const s of schedules) {
        for (const timeStr of s.timesOfDay || ["09:00"]) {
            const [hh, mm] = timeStr.split(":").map(Number);
            const scheduledDoseTime = new Date(startOfDay);
            scheduledDoseTime.setHours(hh || 9, mm || 0, 0, 0);

            // Find matching log within 90 minutes
            const matchingLog = logs.find(l =>
                String(l.scheduleId) === String(s._id) &&
                Math.abs(new Date(l.scheduledTime).getTime() - scheduledDoseTime.getTime()) < 90 * 60 * 1000
            );

            result.push({
                scheduleId: s._id,
                medicineName: s.medicineName,
                dosage: s.dosage,
                scheduledTime: timeStr,
                scheduledDateTime: scheduledDoseTime,
                withFood: s.withFood,
                instructions: s.instructions,
                status: matchingLog ? matchingLog.status : (scheduledDoseTime < new Date() ? "DUE" : "SCHEDULED"),
                logId: matchingLog ? matchingLog._id : null
            });
        }
    }

    result.sort((a, b) => a.scheduledDateTime - b.scheduledDateTime);
    return result;
};

export const calculateAdherence = async (user, targetPatientId = null) => {
    let patientId = targetPatientId;
    if (user.role === "patient") {
        const patient = await getPatientByUserId(user.id || user._id);
        if (!patient) throw new AppError(404, "Patient profile not found");
        patientId = patient._id;
    }

    if (!patientId) throw new AppError(400, "patientId is required");

    // Calculate strictly from DoseLog records (Rule 17)
    const logs = await DoseLogModel.find({ patientId }).lean();
    const totalRecorded = logs.length;
    const takenDoses = logs.filter(l => l.status === "TAKEN").length;
    const missedDoses = logs.filter(l => l.status === "MISSED").length;
    const skippedDoses = logs.filter(l => l.status === "SKIPPED").length;
    const snoozedDoses = logs.filter(l => l.status === "SNOOZED").length;

    const adherencePercentage = totalRecorded > 0
        ? Math.round((takenDoses / totalRecorded) * 100)
        : 100;

    return {
        patientId,
        totalRecorded,
        takenDoses,
        missedDoses,
        skippedDoses,
        snoozedDoses,
        adherencePercentage,
        summary: totalRecorded > 0
            ? `${takenDoses} of ${totalRecorded} scheduled doses taken (${adherencePercentage}% adherence)`
            : "No dose logs recorded yet."
    };
};

export const checkPrescriptionSafety = async (user, { patientId = null, medicines = [] } = {}) => {
    let resolvedPatientId = patientId;
    if (user.role === "patient") {
        const patient = await getPatientByUserId(user.id || user._id);
        if (!patient) throw new AppError(404, "Patient profile not found");
        resolvedPatientId = patient._id;
    }

    if (!resolvedPatientId) throw new AppError(400, "patientId is required for safety verification");

    const patientDoc = await PatientModel.findById(resolvedPatientId).lean();
    if (!patientDoc) throw new AppError(404, "Patient record not found");

    const activeSchedules = await MedicationScheduleModel.find({
        patientId: resolvedPatientId,
        status: { $in: ["ACTIVE", "DOCTOR_APPROVED"] }
    }).lean();

    const issues = [];
    const patientAllergies = Array.isArray(patientDoc.allergies)
        ? patientDoc.allergies.map(a => a.toLowerCase().trim())
        : [];

    for (const med of medicines) {
        const medNameLower = (med.medicineName || "").toLowerCase().trim();

        // 1. Allergy conflict check
        for (const allergy of patientAllergies) {
            if (allergy && medNameLower.includes(allergy)) {
                issues.push({
                    type: "ALLERGY_CONFLICT",
                    severity: "HIGH",
                    medicine: med.medicineName,
                    allergy,
                    message: `Patient has a documented allergy to "${allergy}" matching medicine "${med.medicineName}".`
                });
            }
        }

        // 2. Duplicate active medicine check
        const duplicateActive = activeSchedules.find(s =>
            (s.medicineName || "").toLowerCase().trim() === medNameLower
        );
        if (duplicateActive) {
            issues.push({
                type: "DUPLICATE_MEDICATION",
                severity: "MEDIUM",
                medicine: med.medicineName,
                existingScheduleId: duplicateActive._id,
                message: `Medicine "${med.medicineName}" is already actively prescribed on the patient's schedule.`
            });
        }
    }

    return {
        safe: issues.length === 0,
        issueCount: issues.length,
        issues,
        patientAllergiesFound: patientAllergies.length
    };
};
