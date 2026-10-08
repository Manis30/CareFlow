import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import UserModel from "../src/model/user.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import { getMedicalRecordFileService } from "../src/service/medicalRecord.js";

async function main() {
    console.log("=== RUNNING MEDICAL RECORD PREVIEW & DOWNLOAD SMOKE CHECKS ===");
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB.");

    const pdfRecord = await MedicalRecordModel.findOne({ "file.mimeType": "application/pdf" }).lean();
    const imgRecord = await MedicalRecordModel.findOne({ "file.mimeType": /^image\// }).lean();

    if (!pdfRecord) throw new Error("No PDF record found in DB");
    if (!imgRecord) throw new Error("No Image record found in DB");

    // We can use super_admin or the patient user owning the record
    const ownerUser = await UserModel.findById(pdfRecord.patientId.userId || pdfRecord.patientId).lean() ||
                      await UserModel.findOne({ role: "super_admin" }).lean();

    // ── CHECK 6: PDF PREVIEW & DOWNLOAD ──────────────────────────────────────
    console.log(`\n[Check 6] PDF Record (${pdfRecord._id}): ${pdfRecord.title}`);
    
    // 6a: Preview
    const pdfPreview = await getMedicalRecordFileService(pdfRecord._id, ownerUser, "preview");
    console.log("PDF Preview Result:", {
        mimeType: pdfPreview.mimeType,
        fileName: pdfPreview.fileName,
        fileSize: pdfPreview.fileSize,
        bufferLength: pdfPreview.buffer?.length,
        isPdfHeader: pdfPreview.buffer?.slice(0, 5).toString() === "%PDF-"
    });

    if (pdfPreview.mimeType !== "application/pdf") {
        throw new Error(`Expected application/pdf, got ${pdfPreview.mimeType}`);
    }
    if (!pdfPreview.buffer || pdfPreview.buffer.length === 0) {
        throw new Error("PDF buffer is empty");
    }

    // 6b: Download
    const pdfDownload = await getMedicalRecordFileService(pdfRecord._id, ownerUser, "download");
    console.log("PDF Download Result:", {
        mimeType: pdfDownload.mimeType,
        fileName: pdfDownload.fileName,
        fileSize: pdfDownload.fileSize,
        bufferLength: pdfDownload.buffer?.length
    });
    if (!pdfDownload.fileName.endsWith(".pdf")) {
        throw new Error(`Expected filename to end with .pdf, got ${pdfDownload.fileName}`);
    }

    // ── CHECK 7: IMAGE PREVIEW & DOWNLOAD ────────────────────────────────────
    console.log(`\n[Check 7] Image Record (${imgRecord._id}): ${imgRecord.title}`);

    // 7a: Preview
    const imgPreview = await getMedicalRecordFileService(imgRecord._id, ownerUser, "preview");
    console.log("Image Preview Result:", {
        mimeType: imgPreview.mimeType,
        fileName: imgPreview.fileName,
        fileSize: imgPreview.fileSize,
        bufferLength: imgPreview.buffer?.length
    });
    if (!imgPreview.mimeType.startsWith("image/")) {
        throw new Error(`Expected image/* mime type, got ${imgPreview.mimeType}`);
    }
    if (!imgPreview.buffer || imgPreview.buffer.length === 0) {
        throw new Error("Image buffer is empty");
    }

    // 7b: Download
    const imgDownload = await getMedicalRecordFileService(imgRecord._id, ownerUser, "download");
    console.log("Image Download Result:", {
        mimeType: imgDownload.mimeType,
        fileName: imgDownload.fileName,
        fileSize: imgDownload.fileSize,
        bufferLength: imgDownload.buffer?.length
    });

    console.log("\n=== ALL MEDICAL RECORD FILE CHECKS PASSED ===");
    process.exit(0);
}

main().catch(err => {
    console.error("Medical Record Smoke Check Error:", err);
    process.exit(1);
});
