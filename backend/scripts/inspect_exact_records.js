import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import MedicalRecordModel from "../src/model/medicalRecord.js";

async function inspectExactRecords() {
    await mongoose.connect(process.env.DB_URL);
    const r1 = await MedicalRecordModel.findById("6ac75838f7a1f5abb35133bd").lean();
    const r2 = await MedicalRecordModel.findById("6ac758a1f7a1f5abb35137cb").lean();
    console.log("Record 1:", JSON.stringify(r1, null, 2));
    console.log("Record 2:", JSON.stringify(r2, null, 2));
    await mongoose.disconnect();
}

inspectExactRecords().catch(console.error);
