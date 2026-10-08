import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import UserModel from "../src/model/user.js";
import DoctorModel from "../src/model/doctor.js";
import PatientModel from "../src/model/patient.js";
import DepartmentModel from "../src/model/department.js";
import AppointmentModel from "../src/model/appointment.js";

async function inspect() {
    await mongoose.connect(process.env.DB_URL);
    const docUser = await UserModel.findOne({ name: /Senthil Kumar/i }).lean();
    console.log("Doctor User:", { id: docUser._id, name: docUser.name, org: docUser.organizationId });
    const doctor = await DoctorModel.findOne({ userId: docUser._id }).lean();
    console.log("Doctor record:", { id: doctor._id, spec: doctor.specialization, org: doctor.organizationId });

    console.log("Total appointments for doctor in DB:", await AppointmentModel.countDocuments({ doctorId: doctor._id }));

    const now = new Date();
    console.log("Now (JS Date):", now.toISOString(), "Local:", now.toString());

    // Local midnight to midnight
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayAppts = await AppointmentModel.find({
        doctorId: doctor._id,
        appointmentDate: { $gte: startOfToday, $lte: endOfToday }
    }).populate({ path: "patientId", populate: { path: "userId" } }).populate("departmentId").lean();

    console.log("Today appts (Local midnight-to-midnight):", todayAppts.length);
    for (const a of todayAppts) {
        console.log("  Local Today Appt:", {
            id: a._id,
            patientName: a.patientId?.userId?.name || a.patientId?.name,
            date: a.appointmentDate?.toISOString(),
            startTime: a.startTime,
            endTime: a.endTime,
            type: a.consultationType,
            status: a.status
        });
    }

    // UTC midnight to midnight
    const utcStart = new Date("2026-10-08T00:00:00.000Z");
    const utcEnd = new Date("2026-10-08T23:59:59.999Z");
    const utcTodayAppts = await AppointmentModel.find({
        doctorId: doctor._id,
        appointmentDate: { $gte: utcStart, $lte: utcEnd }
    }).populate({ path: "patientId", populate: { path: "userId" } }).populate("departmentId").lean();
    console.log("Today appts (UTC midnight-to-midnight):", utcTodayAppts.length);
    for (const a of utcTodayAppts) {
        console.log("  UTC Today Appt:", {
            id: a._id,
            patientName: a.patientId?.userId?.name || a.patientId?.name,
            date: a.appointmentDate?.toISOString(),
            startTime: a.startTime,
            endTime: a.endTime,
            type: a.consultationType,
            status: a.status
        });
    }

    // Call getDoctorTodayAppointmentsService
    const { getDoctorTodayAppointmentsService } = await import("../src/service/appointment.js");
    const serviceToday = await getDoctorTodayAppointmentsService(docUser._id);
    console.log("getDoctorTodayAppointmentsService returned count:", serviceToday.length);
    for (const a of serviceToday) {
        console.log("  Service Appt:", {
            id: a._id,
            patientName: a.patientId?.userId?.name || a.patientId?.name,
            date: a.appointmentDate,
            startTime: a.startTime,
            type: a.consultationType,
            status: a.status
        });
    }

    process.exit(0);
}

inspect().catch(err => {
    console.error(err);
    process.exit(1);
});
