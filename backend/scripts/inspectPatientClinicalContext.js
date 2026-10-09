import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import User from "../src/model/user.js";
import Doctor from "../src/model/doctor.js";
import Patient from "../src/model/patient.js";
import Appointment from "../src/model/appointment.js";
import MedicalRecord from "../src/model/medicalRecord.js";
import Prescription from "../src/model/prescription.js";

async function main() {
    await mongoose.connect(process.env.DB_URL);

    // Dr. R. Karthikeyan
    const docUser = await User.findOne({ email: "dr.rkarthikeyan.cmhi@demo-careflow.in" });
    const doctor = await Doctor.findOne({ userId: docUser._id });

    console.log("Doctor found:", docUser.name, doctor._id);

    // Find patients with appointments for this doctor
    const appts = await Appointment.find({ doctorId: doctor._id })
        .populate({ path: "patientId", populate: { path: "userId" } })
        .sort({ appointmentDate: -1 })
        .lean();

    console.log(`Total appts for doctor: ${appts.length}`);

    const patientMap = new Map();
    for (const a of appts) {
        if (!a.patientId?._id) continue;
        const pId = String(a.patientId._id);
        if (!patientMap.has(pId)) {
            patientMap.set(pId, {
                patientId: pId,
                name: a.patientId.userId?.name,
                email: a.patientId.userId?.email,
                appts: []
            });
        }
        patientMap.get(pId).appts.push(a);
    }

    console.log(`Distinct patients for Dr. Karthikeyan: ${patientMap.size}`);
    for (const [pId, pData] of Array.from(patientMap.entries()).slice(0, 5)) {
        const prescriptions = await Prescription.find({ patientId: pId }).lean();
        const records = await MedicalRecord.find({
            patientId: pId,
            $or: [
                { "sharedWith.doctorId": doctor._id },
                { organizationId: doctor.organizationId }
            ]
        }).lean();
        console.log(`\nPatient: ${pData.name} (${pData.email})`);
        console.log(`- Appointments: ${pData.appts.length}`);
        console.log(`- Prescriptions: ${prescriptions.length}`);
        if (prescriptions.length > 0) {
            console.log(`  Latest Rx Diagnosis: ${prescriptions[0].diagnosis}`);
            console.log(`  Meds:`, prescriptions[0].medicines?.map(m => `${m.medicineName} (${m.dosage})`));
        }
        console.log(`- Medical records: ${records.length}`);
        if (records.length > 0) {
            console.log(`  Record titles:`, records.map(r => r.title));
        }
    }

    await mongoose.disconnect();
}

main().catch(console.error);
