import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function run() {
    await mongoose.connect(process.env.DB_URL);
    const db = mongoose.connection.db;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppts = await db.collection("appointments").find({ appointmentDate: { $gte: today, $lt: tomorrow } }).toArray();
    console.log("All appointments today across all doctors:", todayAppts.length);
    for (const a of todayAppts) {
        const doc = await db.collection("doctors").findOne({ _id: a.doctorId });
        const docUser = await db.collection("users").findOne({ _id: doc?.userId });
        console.log(`Doctor: ${docUser?.name} (${docUser?.email}) DoctorID: ${a.doctorId}`);
        console.log(`  ApptID: ${a._id}, Status: ${a.status}, Type: ${a.consultationType}, Time: ${a.startTime}`);
    }
    await mongoose.disconnect();
}
run().catch(console.error);
