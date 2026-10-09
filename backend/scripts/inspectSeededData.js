import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function inspectData() {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to DB.");

    const db = mongoose.connection.db;

    const doctors = await db.collection("users").find({ role: "doctor" }).toArray();
    console.log("\n--- DOCTORS ---");
    for (const d of doctors) {
        console.log(`- Doctor: ${d.name} (${d.email}) ID: ${d._id}`);
        const docProfile = await db.collection("doctors").findOne({ userId: d._id });
        if (docProfile) {
            console.log(`  Profile ID: ${docProfile._id}, Dept: ${docProfile.departmentId}, Org: ${docProfile.organizationId}`);
            const apptCount = await db.collection("appointments").countDocuments({ doctorId: docProfile._id });
            console.log(`  Total appointments assigned: ${apptCount}`);
        }
    }

    const patients = await db.collection("users").find({ role: "patient" }).toArray();
    console.log("\n--- PATIENTS ---");
    for (const p of patients.slice(0, 5)) {
        console.log(`- Patient: ${p.name} (${p.email}) UserID: ${p._id}`);
        const pDoc = await db.collection("patients").findOne({ userId: p._id });
        if (pDoc) {
            console.log(`  Patient Profile ID: ${pDoc._id}`);
            const recCount = await db.collection("medicalrecords").countDocuments({ patientId: pDoc._id });
            console.log(`  Medical records count: ${recCount}`);
        }
    }

    console.log("\n--- MEDICAL RECORDS (PDF) ---");
    const pdfRecords = await db.collection("medicalrecords").find({ "file.url": { $regex: "pdf", $options: "i" } }).toArray();
    for (const r of pdfRecords) {
        console.log(`- Record ID: ${r._id}, Title: "${r.title}", Patient: ${r.patientId}, File: ${r.file?.fileName || r.file?.url}`);
        console.log(`  Shared with:`, r.sharedWith);
    }

    await mongoose.disconnect();
}

inspectData().catch(console.error);
