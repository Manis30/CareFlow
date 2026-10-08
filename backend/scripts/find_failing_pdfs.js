import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import MedicalRecordModel from "../src/model/medicalRecord.js";

async function findFailingPdfs() {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to DB.");

    // Find all records where url or title indicates PDF, or all medical records
    const allRecords = await MedicalRecordModel.find().lean();
    console.log(`Total records in DB: ${allRecords.length}`);

    for (const r of allRecords) {
        const url = r.file?.url || "";
        const mime = r.file?.mimeType || "";
        const title = r.title || "";
        const fileName = r.file?.fileName || "";
        const isPdf = mime.includes("pdf") || url.includes(".pdf") || title.includes("PDF") || fileName.includes(".pdf");

        console.log(`ID: ${r._id} | title: "${title}" | fileName: "${fileName}" | mime: "${mime}" | resourceType: "${r.file?.resourceType}" | url: ${url}`);
        
        if (url) {
            try {
                const res = await fetch(url);
                const buf = Buffer.from(await res.arrayBuffer());
                const isRealPdf = buf.slice(0, 4).toString("ascii") === "%PDF";
                console.log(`  -> Fetch HTTP ${res.status}, Content-Type: ${res.headers.get("content-type")}, size: ${buf.length}, isRealPdf: ${isRealPdf}`);
                if (!isRealPdf && res.status === 200) {
                    console.log(`  -> Non-PDF content (first 100 bytes): ${buf.slice(0, 100).toString("ascii")}`);
                }
            } catch (err) {
                console.log(`  -> Fetch error: ${err.message}`);
            }
        }
    }

    await mongoose.disconnect();
}

findFailingPdfs().catch(console.error);
