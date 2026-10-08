import mongoose from "mongoose";
import AppointmentModel from "../model/appointment.js";
import PrescriptionModel from "../model/prescription.js";
import MedicalRecordModel from "../model/medicalRecord.js";
import FollowUpTaskModel from "../model/followUpTask.js";
import PaymentModel from "../model/payment.js";
import MedicationScheduleModel from "../model/medicationSchedule.js";
import DoseLogModel from "../model/doseLog.js";
import DoctorModel from "../model/doctor.js";
import { getPatientByUserId } from "../repository/patient.js";
import { AppError } from "../middleware/errorHandler.js";
import { formatDoctorName } from "../util/formatters.js";

/**
 * Patient Intelligence & Proactive Care Service (Phase 3 & Phase 4)
 * Assembles chronological patient care timelines and proactive healthcare alerts.
 */

export const getPatientCareTimeline = async (userOrPatientId, targetPatientId = null) => {
    let patientId = targetPatientId;
    if (userOrPatientId) {
        if (typeof userOrPatientId === "string" || userOrPatientId instanceof mongoose.Types.ObjectId) {
            patientId = userOrPatientId;
        } else if (userOrPatientId.role === "patient") {
            const patient = await getPatientByUserId(userOrPatientId.id || userOrPatientId._id);
            if (!patient) throw new AppError(404, "Patient profile not found");
            patientId = patient._id;
        } else if (userOrPatientId.role === "doctor") {
            const doctorUserId = userOrPatientId.id || userOrPatientId._id;
            const doctor = await DoctorModel.findOne({ userId: doctorUserId }).lean();
            if (!doctor) throw new AppError(404, "Doctor profile not found");
            const orgId = doctor.organizationId?._id || doctor.organizationId || userOrPatientId.organizationId;

            if (!targetPatientId) {
                throw new AppError(400, "patientId is required for doctor timeline lookup");
            }
            patientId = targetPatientId;

            const hasAppt = await AppointmentModel.exists({
                doctorId: doctor._id,
                patientId,
                organizationId: orgId
            });
            const hasShared = await MedicalRecordModel.exists({
                patientId,
                organizationId: orgId,
                "sharedWith.doctorId": doctor._id
            });

            if (!hasAppt && !hasShared) {
                throw new AppError(403, "Doctor is not authorized to access care timeline for this patient");
            }
        } else if (userOrPatientId.userId && userOrPatientId._id) {
            // Already a patient doc
            patientId = userOrPatientId._id;
        }
    }

    if (!patientId) throw new AppError(400, "patientId is required");

    // 1. Retrieve Appointments
    const appointments = await AppointmentModel.find({ patientId })
        .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
        .populate("organizationId", "name")
        .sort({ appointmentDate: -1 })
        .lean();

    // 2. Retrieve Prescriptions
    const prescriptions = await PrescriptionModel.find({ patientId })
        .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
        .sort({ createdAt: -1 })
        .lean();

    // 3. Retrieve Medical Records
    const medicalRecords = await MedicalRecordModel.find({ patientId })
        .sort({ createdAt: -1 })
        .lean();

    const timeline = [];

    // Format Appointments
    for (const appt of appointments) {
        const docName = formatDoctorName(appt.doctorId?.userId?.name, "Specialist") || "Specialist";
        const orgName = appt.organizationId?.name || "CareFlow Clinic";
        timeline.push({
            date: appt.appointmentDate,
            category: "APPOINTMENT",
            title: `Consultation with ${docName}`,
            description: `Status: ${appt.status} | Clinic: ${orgName} | Time: ${appt.startTime || ''} - ${appt.endTime || ''}`,
            reason: appt.reason || appt.reasonForVisit || "General consultation",
            referenceId: appt._id,
            timestamp: new Date(appt.appointmentDate).getTime()
        });
    }

    // Format Prescriptions
    for (const presc of prescriptions) {
        const docName = formatDoctorName(presc.doctorId?.userId?.name, "Doctor") || "Doctor";
        const medNames = (presc.medicines || []).map(m => m.medicineName).join(", ");
        timeline.push({
            date: presc.createdAt,
            category: "PRESCRIPTION",
            title: `Prescription issued by ${docName}`,
            description: `Diagnosis: ${presc.diagnosis} | Medicines: ${medNames || 'None'}`,
            notes: presc.notes || null,
            referenceId: presc._id,
            timestamp: new Date(presc.createdAt).getTime()
        });
    }

    // Format Medical Records
    for (const record of medicalRecords) {
        timeline.push({
            date: record.createdAt,
            category: "MEDICAL_RECORD",
            title: record.title || "Medical Document",
            description: `Type: ${record.recordType} | File: ${record.file?.url ? 'Available' : 'None'}`,
            referenceId: record._id,
            timestamp: new Date(record.createdAt).getTime()
        });
    }

    // Sort chronologically descending (newest first)
    timeline.sort((a, b) => b.timestamp - a.timestamp);

    return {
        patientId,
        totalEvents: timeline.length,
        timeline
    };
};

export const getProactivePatientCareAlerts = async (userOrPatientId) => {
    let patient = null;
    if (userOrPatientId) {
        if (typeof userOrPatientId === "string" || userOrPatientId instanceof mongoose.Types.ObjectId) {
            patient = await (await import("../model/patient.js")).default.findById(userOrPatientId);
        } else if (userOrPatientId.role === "patient") {
            patient = await getPatientByUserId(userOrPatientId.id || userOrPatientId._id);
        } else if (userOrPatientId.userId && userOrPatientId._id) {
            patient = userOrPatientId;
        }
    }
    if (!patient) throw new AppError(404, "Patient profile not found");

    const alerts = [];
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // 1. Upcoming Appointments in Next 48 Hours
    const upcomingAppts = await AppointmentModel.find({
        patientId: patient._id,
        appointmentDate: { $gte: now, $lte: in48Hours },
        status: { $in: ["BOOKED", "booked", "confirmed", "CONFIRMED"] }
    })
    .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
    .populate("organizationId", "name")
    .lean();

    for (const appt of upcomingAppts) {
        const docName = formatDoctorName(appt.doctorId?.userId?.name, "Doctor") || "Doctor";
        alerts.push({
            type: "UPCOMING_APPOINTMENT",
            priority: "HIGH",
            title: `Upcoming Consultation with ${docName}`,
            message: `You have an appointment on ${new Date(appt.appointmentDate).toISOString().split('T')[0]} at ${appt.startTime || ''}.`,
            entityId: appt._id,
            entityType: "appointment"
        });
    }

    // 2. Pending Medications for Today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const activeSchedules = await MedicationScheduleModel.find({
        patientId: patient._id,
        status: { $in: ["ACTIVE", "DOCTOR_APPROVED"] },
        startDate: { $lte: endOfDay },
        $or: [{ endDate: null }, { endDate: { $gte: startOfDay } }]
    }).lean();

    const todayLogs = await DoseLogModel.find({
        patientId: patient._id,
        scheduledTime: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    for (const sched of activeSchedules) {
        for (const timeStr of sched.timesOfDay || ["09:00"]) {
            const [hh, mm] = timeStr.split(":").map(Number);
            const doseTime = new Date();
            doseTime.setHours(hh || 9, mm || 0, 0, 0);

            const hasLog = todayLogs.some(l =>
                String(l.scheduleId) === String(sched._id) &&
                Math.abs(new Date(l.scheduledTime).getTime() - doseTime.getTime()) < 90 * 60 * 1000
            );

            if (!hasLog) {
                const isOverdue = doseTime < now;
                alerts.push({
                    type: isOverdue ? "MEDICATION_OVERDUE" : "MEDICATION_DUE",
                    priority: isOverdue ? "HIGH" : "MEDIUM",
                    title: isOverdue ? `Overdue: ${sched.medicineName}` : `Scheduled: ${sched.medicineName}`,
                    message: `Dose: ${sched.dosage} at ${timeStr}. ${sched.withFood ? `(${sched.withFood.replace('_', ' ')})` : ''}`,
                    entityId: sched._id,
                    entityType: "medicationSchedule"
                });
            }
        }
    }

    // 3. Due Follow-up Tasks
    const followUps = await FollowUpTaskModel.find({
        patientId: patient._id,
        status: "PENDING",
        followUpDate: { $lte: in48Hours }
    })
    .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
    .lean();

    for (const f of followUps) {
        const docName = formatDoctorName(f.doctorId?.userId?.name, "Doctor") || "Doctor";
        alerts.push({
            type: "FOLLOW_UP_DUE",
            priority: "MEDIUM",
            title: `Follow-Up Recommended by ${docName}`,
            message: `Reason: ${f.reason} (Target: ${new Date(f.followUpDate).toISOString().split('T')[0]})`,
            entityId: f._id,
            entityType: "followUpTask"
        });
    }

    // 4. Pending Payments
    const pendingPayments = await PaymentModel.find({
        patientId: patient._id,
        status: "PENDING"
    }).lean();

    if (pendingPayments.length > 0) {
        const totalPending = pendingPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
        alerts.push({
            type: "PENDING_PAYMENT",
            priority: "LOW",
            title: "Pending Clinic Payment",
            message: `You have ${pendingPayments.length} pending bill(s) totaling ₹${totalPending}. Pay at clinic counter.`,
            entityType: "payment"
        });
    }

    return {
        patientId: patient._id,
        alertCount: alerts.length,
        alerts
    };
};

export const createFollowUpTask = async (user, { patientId, appointmentId = null, followUpDate, reason, instructions = null }) => {
    if (user.role !== "doctor" && user.role !== "admin") {
        throw new AppError(403, "Only doctors or clinic staff can schedule follow-up care tasks");
    }

    if (!patientId) throw new AppError(400, "patientId is required");
    if (!followUpDate) throw new AppError(400, "followUpDate is required");
    if (!reason) throw new AppError(400, "reason is required");

    let doctorId = null;
    if (user.role === "doctor") {
        const DoctorModel = (await import("../model/doctor.js")).default;
        const doc = await DoctorModel.findOne({ userId: user.id || user._id }).lean();
        if (!doc) throw new AppError(404, "Doctor profile not found");
        doctorId = doc._id;
    }

    const task = await FollowUpTaskModel.create({
        patientId,
        doctorId,
        organizationId: user.organizationId?._id || user.organizationId,
        appointmentId,
        followUpDate: new Date(followUpDate),
        reason,
        instructions,
        status: "PENDING"
    });

    return task;
};

export const getPatientFollowUpTasks = async (user) => {
    const patient = await getPatientByUserId(user.id || user._id);
    if (!patient) throw new AppError(404, "Patient profile not found");

    return await FollowUpTaskModel.find({ patientId: patient._id })
        .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
        .sort({ followUpDate: 1 })
        .lean();
};
