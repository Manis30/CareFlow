import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import User from "../src/model/user.js";
import Doctor from "../src/model/doctor.js";
import Appointment from "../src/model/appointment.js";

async function inspect() {
    await mongoose.connect(process.env.DB_URL);
    const emails = [
        "dr.ksenthilkumar.cauvery-medical@demo-careflow.in",
        "dr.gmohanraj.salem-varam@demo-careflow.in",
        "dr.rkarthikeyan.cmhi@demo-careflow.in"
    ];

    const todayDateStr = "2026-10-09";
    const startOfDay = new Date("2026-10-09T00:00:00.000Z");
    const endOfDay = new Date("2026-10-09T23:59:59.999Z");

    for (const email of emails) {
        const u = await User.findOne({ email }).lean();
        if (!u) continue;
        const d = await Doctor.findOne({ userId: u._id }).lean();
        if (!d) continue;

        const allAppts = await Appointment.find({ doctorId: d._id }).lean();
        const todayAppts = allAppts.filter(a => {
            const dt = a.appointmentDate?.toISOString().split("T")[0];
            return dt === todayDateStr;
        });

        const nonCancelledToday = todayAppts.filter(a => {
            const st = (a.status || "").toLowerCase();
            return st !== "cancelled";
        });

        const onlineToday = nonCancelledToday.filter(a => (a.consultationType || "").toLowerCase() === "online");
        const inClinicToday = nonCancelledToday.filter(a => (a.consultationType || "").toLowerCase() === "offline");

        console.log("==========================================");
        console.log(`Doctor: ${u.name} (${email})`);
        console.log(`Total appointments in DB: ${allAppts.length}`);
        console.log(`Appointments on ${todayDateStr}: ${todayAppts.length}`);
        console.log(`Non-cancelled today: ${nonCancelledToday.length}`);
        console.log(`Online non-cancelled today: ${onlineToday.length}`);
        console.log(`In-Clinic non-cancelled today: ${inClinicToday.length}`);
        console.log("Today's Appts Breakdown:", todayAppts.map(a => ({
            id: a._id.toString(),
            status: a.status,
            type: a.consultationType,
            time: `${a.startTime}-${a.endTime}`
        })));
    }

    await mongoose.disconnect();
}

inspect().catch(console.error);
