import { AppError } from "../middleware/errorHandler.js";
import { getPatientByUserId } from "../repository/patient.js";
import { getDoctorByUserId } from "../repository/doctor.js";
import {
    getTodayMedications,
    recordDoseLog,
    getMedicationSchedules,
    doctorApproveMedicationSchedule,
    calculateAdherence
} from "../service/medication.js";

export const getTodayMedicationsController = async (req, res, next) => {
    try {
        const data = await getTodayMedications(req.user);
        res.status(200).json({
            success: true,
            message: "Today's medications fetched successfully",
            data
        });
    } catch (err) {
        next(err);
    }
};

export const recordDoseLogController = async (req, res, next) => {
    try {
        const { medicationScheduleId, scheduleId, scheduledTime, status, snoozedUntil, note, notes } = req.body;
        const result = await recordDoseLog(req.user, {
            scheduleId: scheduleId || medicationScheduleId,
            scheduledTime,
            status,
            snoozedUntil,
            notes: notes || note
        });
        res.status(201).json({
            success: true,
            message: "Dose log recorded successfully",
            data: result
        });
    } catch (err) {
        next(err);
    }
};

export const getMedicationSchedulesController = async (req, res, next) => {
    try {
        const data = await getMedicationSchedules(req.user, {
            patientId: req.query.patientId,
            status: req.query.status
        });
        res.status(200).json({
            success: true,
            message: "Medication schedules fetched successfully",
            data
        });
    } catch (err) {
        next(err);
    }
};

export const approveMedicationScheduleController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, instructions, rejectionReason } = req.body;

        const result = await doctorApproveMedicationSchedule(req.user, {
            scheduleId: id,
            action,
            instructions,
            rejectionReason
        });

        res.status(200).json({
            success: true,
            message: `Medication schedule ${action.toLowerCase()}d successfully`,
            data: result
        });
    } catch (err) {
        next(err);
    }
};

export const getMedicationAdherenceController = async (req, res, next) => {
    try {
        const data = await calculateAdherence(req.user, req.query.patientId);
        res.status(200).json({
            success: true,
            message: "Medication adherence calculated successfully",
            data
        });
    } catch (err) {
        next(err);
    }
};
