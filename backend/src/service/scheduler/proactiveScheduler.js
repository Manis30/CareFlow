import cron from "node-cron";
import mongoose from "mongoose";
import ScheduleLockModel from "../../model/scheduleLock.js";
import NotificationModel from "../../model/notification.js";
import MedicationScheduleModel from "../../model/medicationSchedule.js";
import AppointmentModel from "../../model/appointment.js";
import FollowUpTaskModel from "../../model/followUpTask.js";
import PatientModel from "../../model/patient.js";
import UserModel from "../../model/user.js";
import {
    sendAppointmentReminderEmail,
    sendMedicationReminderEmail,
    sendFollowUpReminderEmail
} from "../email.js";

/**
 * MongoDB-Backed Distributed Lock Helper (Rule 14)
 * Guarantees duplicate-free execution across multiple server instances or clusters.
 */
export const acquireLock = async (lockKey, durationMs = 60000) => {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + durationMs);

    try {
        const lock = await ScheduleLockModel.findOneAndUpdate(
            {
                lockKey,
                $or: [
                    { lockedUntil: { $lte: now } },
                    { lockedUntil: { $exists: false } }
                ]
            },
            {
                $set: {
                    lockedUntil,
                    lockedBy: `process_${process.pid}_${Date.now()}`
                }
            },
            { upsert: true, new: true }
        );
        return Boolean(lock);
    } catch (err) {
        // E11000 duplicate key error means another node currently holds the lock
        return false;
    }
};

export const releaseLock = async (lockKey) => {
    try {
        await ScheduleLockModel.deleteOne({ lockKey });
    } catch (e) {
        // Safe ignore
    }
};

/**
 * 1. Process Due Medication Reminders
 */
export const processMedicationReminders = async () => {
    const locked = await acquireLock("medication_reminders_lock", 45000);
    if (!locked) return { locked: false, processedCount: 0 };

    let processedCount = 0;
    try {
        const now = new Date();
        const startWindow = new Date(now.getTime() - 20 * 60 * 1000);
        const endWindow = new Date(now.getTime() + 20 * 60 * 1000);

        // Find active schedules
        const activeSchedules = await MedicationScheduleModel.find({
            status: { $in: ["ACTIVE", "DOCTOR_APPROVED"] },
            startDate: { $lte: now },
            $or: [{ endDate: null }, { endDate: { $gte: now } }]
        }).populate({ path: "patientId", populate: { path: "userId", select: "name email" } });

        for (const sched of activeSchedules) {
            const patientUser = sched.patientId?.userId;
            if (!patientUser) continue;

            for (const timeStr of sched.timesOfDay || ["09:00"]) {
                const [hh, mm] = timeStr.split(":").map(Number);
                const doseTime = new Date();
                doseTime.setHours(hh || 9, mm || 0, 0, 0);

                if (doseTime >= startWindow && doseTime <= endWindow) {
                    // Deduplication check: check if notification already created for this specific dose
                    const existing = await NotificationModel.findOne({
                        userId: patientUser._id,
                        type: "MEDICATION_REMINDER",
                        relatedEntityId: sched._id,
                        scheduledFor: {
                            $gte: new Date(doseTime.getTime() - 30 * 60 * 1000),
                            $lte: new Date(doseTime.getTime() + 30 * 60 * 1000)
                        }
                    });

                    if (!existing) {
                        const notif = await NotificationModel.create({
                            userId: patientUser._id,
                            organizationId: sched.organizationId,
                            type: "MEDICATION_REMINDER",
                            title: `Medication Due: ${sched.medicineName}`,
                            message: `Time to take ${sched.dosage} of ${sched.medicineName} (${sched.withFood || 'as directed'}).`,
                            relatedEntityType: "medicationSchedule",
                            relatedEntityId: sched._id,
                            scheduledFor: doseTime,
                            sentAt: new Date(),
                            status: "SENT"
                        });

                        if (patientUser.email) {
                            await sendMedicationReminderEmail(patientUser.email, {
                                medicineName: sched.medicineName,
                                dosage: sched.dosage,
                                instructions: sched.instructions,
                                withFood: sched.withFood,
                                scheduledTime: timeStr
                            });
                        }

                        processedCount++;
                    }
                }
            }
        }
    } finally {
        await releaseLock("medication_reminders_lock");
    }

    return { locked: true, processedCount };
};

/**
 * 2. Process Appointment Reminders (24-Hour & 2-Hour)
 */
export const processAppointmentReminders = async () => {
    const locked = await acquireLock("appointment_reminders_lock", 45000);
    if (!locked) return { locked: false, processedCount: 0 };

    let processedCount = 0;
    try {
        const now = new Date();
        const in24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        const in24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        const in2hStart = new Date(now.getTime() + 1 * 60 * 60 * 1000);
        const in2hEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

        // Fetch booked appointments in either 24h or 2h window
        const appointments = await AppointmentModel.find({
            status: { $in: ["BOOKED", "booked", "CONFIRMED", "confirmed"] },
            $or: [
                { appointmentDate: { $gte: in24hStart, $lte: in24hEnd } },
                { appointmentDate: { $gte: in2hStart, $lte: in2hEnd } }
            ]
        })
        .populate({ path: "patientId", populate: { path: "userId", select: "name email" } })
        .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
        .populate("organizationId", "name");

        for (const appt of appointments) {
            const patientUser = appt.patientId?.userId;
            if (!patientUser) continue;

            const is24h = appt.appointmentDate >= in24hStart && appt.appointmentDate <= in24hEnd;
            const reminderTypeLabel = is24h ? "24_HOUR" : "2_HOUR";

            const existing = await NotificationModel.findOne({
                userId: patientUser._id,
                type: "APPOINTMENT_REMINDER",
                relatedEntityId: appt._id,
                "metaData.reminderWindow": reminderTypeLabel
            });

            if (!existing) {
                const docName = appt.doctorId?.userId?.name ? `Dr. ${appt.doctorId.userId.name}` : "Doctor";
                const clinicName = appt.organizationId?.name || "CareFlow Clinic";
                const timeText = is24h ? "tomorrow" : "in about 2 hours";

                await NotificationModel.create({
                    userId: patientUser._id,
                    organizationId: appt.organizationId?._id || appt.organizationId,
                    type: "APPOINTMENT_REMINDER",
                    title: `Appointment Reminder (${timeText})`,
                    message: `You have an appointment with ${docName} at ${appt.startTime || ''} at ${clinicName}.`,
                    relatedEntityType: "appointment",
                    relatedEntityId: appt._id,
                    scheduledFor: appt.appointmentDate,
                    sentAt: new Date(),
                    status: "SENT",
                    metaData: { reminderWindow: reminderTypeLabel }
                });

                if (patientUser.email) {
                    await sendAppointmentReminderEmail(patientUser.email, {
                        doctorName: docName,
                        clinicName,
                        date: new Date(appt.appointmentDate).toISOString().split('T')[0],
                        time: appt.startTime,
                        type: appt.consultationType || "Offline",
                        timeframe: timeText
                    });
                }

                processedCount++;
            }
        }
    } finally {
        await releaseLock("appointment_reminders_lock");
    }

    return { locked: true, processedCount };
};

/**
 * 3. Process Follow-Up Reminders
 */
export const processFollowUpReminders = async () => {
    const locked = await acquireLock("followup_reminders_lock", 45000);
    if (!locked) return { locked: false, processedCount: 0 };

    let processedCount = 0;
    try {
        const now = new Date();
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const dueFollowUps = await FollowUpTaskModel.find({
            status: "PENDING",
            followUpDate: { $lte: endOfDay },
            remindedAt: null
        })
        .populate({ path: "patientId", populate: { path: "userId", select: "name email" } })
        .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

        for (const f of dueFollowUps) {
            const patientUser = f.patientId?.userId;
            if (!patientUser) continue;

            const existing = await NotificationModel.findOne({
                userId: patientUser._id,
                type: "FOLLOW_UP_REMINDER",
                relatedEntityId: f._id
            });

            if (!existing) {
                const docName = f.doctorId?.userId?.name ? `Dr. ${f.doctorId.userId.name}` : "Doctor";

                await NotificationModel.create({
                    userId: patientUser._id,
                    organizationId: f.organizationId,
                    type: "FOLLOW_UP_REMINDER",
                    title: `Follow-Up Consultation Due`,
                    message: `Recommended follow-up visit with ${docName}. Reason: ${f.reason}`,
                    relatedEntityType: "followUpTask",
                    relatedEntityId: f._id,
                    scheduledFor: f.followUpDate,
                    sentAt: new Date(),
                    status: "SENT"
                });

                f.remindedAt = new Date();
                await f.save();

                if (patientUser.email) {
                    await sendFollowUpReminderEmail(patientUser.email, {
                        doctorName: docName,
                        followUpDate: new Date(f.followUpDate).toISOString().split('T')[0],
                        reason: f.reason,
                        instructions: f.instructions
                    });
                }

                processedCount++;
            }
        }
    } finally {
        await releaseLock("followup_reminders_lock");
    }

    return { locked: true, processedCount };
};

/**
 * Executes a single proactive scheduler cycle across all reminder domains.
 */
export const runSchedulerCycle = async () => {
    const medResult = await processMedicationReminders();
    const apptResult = await processAppointmentReminders();
    const followUpResult = await processFollowUpReminders();

    return {
        timestamp: new Date(),
        medicationReminders: medResult,
        appointmentReminders: apptResult,
        followUpReminders: followUpResult,
        totalNotificationsDispatched: (medResult.processedCount || 0) + (apptResult.processedCount || 0) + (followUpResult.processedCount || 0)
    };
};

/**
 * Starts recurring node-cron scheduler (runs every 15 minutes).
 */
export const startProactiveScheduler = () => {
    console.log("[PROACTIVE SCHEDULER] Initialized node-cron proactive care background service.");
    return cron.schedule("*/15 * * * *", async () => {
        try {
            await runSchedulerCycle();
        } catch (err) {
            console.error("[PROACTIVE SCHEDULER ERROR]:", err.message);
        }
    });
};
