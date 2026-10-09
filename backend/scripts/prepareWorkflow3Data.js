import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Doctor from "../src/model/doctor.js";
import Appointment from "../src/model/appointment.js";
import User from "../src/model/user.js";

async function prepare() {
    await mongoose.connect(process.env.DB_URL);
    const docUser = await User.findOne({ email: "dr.rkarthikeyan.cmhi@demo-careflow.in" });
    const doc = await Doctor.findOne({ userId: docUser._id });

    const start = new Date("2026-10-09T00:00:00.000Z");
    const end = new Date("2026-10-09T23:59:59.999Z");

    const todayAppts = await Appointment.find({
        doctorId: doc._id,
        appointmentDate: { $gte: start, $lte: end }
    });

    console.log(`Current appointments on 2026-10-09: ${todayAppts.length}`);

    // Ensure we have 1 online appointment today
    const booked = todayAppts.filter(a => a.status !== "CANCELLED" && a.status !== "cancelled");
    if (booked.length >= 2) {
        await Appointment.findByIdAndUpdate(booked[0]._id, { consultationType: "online" });
        console.log(`Updated appointment ${booked[0]._id} to consultationType='online'`);
    }

    // Ensure we have 1 cancelled appointment on 2026-10-09 to test exclusion
    let todayCancelled = todayAppts.find(a => a.status === "CANCELLED" || a.status === "cancelled");
    if (!todayCancelled) {
        const anyCancelled = await Appointment.findOne({ doctorId: doc._id, status: { $in: ["CANCELLED", "cancelled"] } });
        if (anyCancelled) {
            await Appointment.findByIdAndUpdate(anyCancelled._id, { appointmentDate: new Date("2026-10-09T14:30:00.000Z") });
            console.log(`Moved cancelled appointment ${anyCancelled._id} to today's date (2026-10-09)`);
        }
    }

    // Inspect final state for today
    const finalToday = await Appointment.find({
        doctorId: doc._id,
        appointmentDate: { $gte: start, $lte: end }
    }).lean();

    const nonCancelled = finalToday.filter(a => a.status !== "CANCELLED" && a.status !== "cancelled");
    const online = nonCancelled.filter(a => a.consultationType === "online");
    const offline = nonCancelled.filter(a => a.consultationType === "offline");
    const cancelled = finalToday.filter(a => a.status === "CANCELLED" || a.status === "cancelled");

    console.log("==========================================");
    console.log("DOCTOR R. KARTHIKEYAN DATABASE STATE ON TODAY (2026-10-09):");
    console.log(`Total appointments in DB for today: ${finalToday.length}`);
    console.log(`Active (non-cancelled) today count: ${nonCancelled.length}`);
    console.log(`  - Online video: ${online.length}`);
    console.log(`  - In-Clinic: ${offline.length}`);
    console.log(`Cancelled appointments today: ${cancelled.length}`);
    console.log("==========================================");

    await mongoose.disconnect();
}

prepare().catch(console.error);
