import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import User from "../src/model/user.js";
import Doctor from "../src/model/doctor.js";
import Appointment from "../src/model/appointment.js";

async function inspectAll() {
    await mongoose.connect(process.env.DB_URL);
    const doctors = await Doctor.find().populate("userId", "name email").lean();

    for (const d of doctors) {
        const appts = await Appointment.find({ doctorId: d._id }).lean();
        const onlineCount = appts.filter(a => (a.consultationType || "").toLowerCase() === "online").length;
        const offlineCount = appts.filter(a => (a.consultationType || "").toLowerCase() === "offline").length;
        const cancelledCount = appts.filter(a => (a.status || "").toLowerCase() === "cancelled").length;

        if (onlineCount > 0 && offlineCount > 0) {
            console.log(`Doctor: ${d.userId?.name} (${d.userId?.email}) | Total: ${appts.length} | Online: ${onlineCount} | Offline: ${offlineCount} | Cancelled: ${cancelledCount}`);
        }
    }
    await mongoose.disconnect();
}
inspectAll().catch(console.error);
