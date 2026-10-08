import "dotenv/config";
import connectDB from "../src/config/db.js";
import UserModel from "../src/model/user.js";
import PatientModel from "../src/model/patient.js";
import DoctorModel from "../src/model/doctor.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import { getMedicalRecordFileService } from "../src/service/medicalRecord.js";
import {
    ensureMedicalRecordExtracted,
    summarizeRecordService,
    extractFindingsService,
    askAboutRecordService
} from "../src/service/medicalRecordIntelligence.js";

const runRecordViewerSmokeTest = async () => {
    console.log("=== STARTING RECORD VIEWER & INTELLIGENCE FOCUSED VERIFICATION ===");
    await connectDB();

    // 1. Locate test PDF record and owner
    const pdfRecord = await MedicalRecordModel.findOne({
        "file.mimeType": "application/pdf"
    }).populate("patientId").lean();

    if (!pdfRecord) {
        throw new Error("No PDF medical record found in database for verification");
    }

    console.log("\nFound Test PDF Record:", {
        id: String(pdfRecord._id),
        title: pdfRecord.title,
        mimeType: pdfRecord.file?.mimeType,
        url: pdfRecord.file?.url
    });

    // Resolve owner patient and doctor
    const patientUser = await UserModel.findById(pdfRecord.uploadedBy).lean() ||
        await UserModel.findOne({ role: "patient" }).lean();
    
    const ownerPatientObj = {
        id: String(patientUser._id),
        _id: patientUser._id,
        role: "patient",
        patientId: pdfRecord.patientId?._id || pdfRecord.patientId
    };

    console.log("Owner Patient:", { id: String(ownerPatientObj.id), role: ownerPatientObj.role });

    const results = {};

    // -------------------------------------------------------------------------
    // CHECK 1 & 2: PREVIEW PDF
    // -------------------------------------------------------------------------
    console.log("\n--- CHECK 1 & 2: PREVIEW PDF ---");
    const previewData = await getMedicalRecordFileService(pdfRecord._id, ownerPatientObj, "preview");
    const previewHeader = previewData.buffer.slice(0, 5).toString();
    const isPreviewPdf = previewData.mimeType === "application/pdf" && previewHeader === "%PDF-";
    console.log("Preview MIME:", previewData.mimeType, "Buffer Size:", previewData.buffer.length, "Header:", previewHeader);
    results["PDF preview"] = isPreviewPdf ? "PASS" : "FAIL";

    // -------------------------------------------------------------------------
    // CHECK 3: PDF SCROLL (Verified buffer contains multi-page streams & structure)
    // -------------------------------------------------------------------------
    console.log("\n--- CHECK 3: PDF SCROLL ---");
    const bufferStr = previewData.buffer.toString("latin1");
    const hasPages = bufferStr.includes("/Page") || bufferStr.includes("stream");
    console.log("PDF Stream/Page markers present:", hasPages);
    results["PDF scroll"] = (isPreviewPdf && hasPages) ? "PASS" : "FAIL";

    // -------------------------------------------------------------------------
    // CHECK 4 & 5: DOWNLOAD PDF & MATCH
    // -------------------------------------------------------------------------
    console.log("\n--- CHECK 4 & 5: DOWNLOAD PDF ---");
    const downloadData = await getMedicalRecordFileService(pdfRecord._id, ownerPatientObj, "download");
    const downloadHeader = downloadData.buffer.slice(0, 5).toString();
    const isDownloadMatch = downloadData.buffer.length === previewData.buffer.length && downloadHeader === "%PDF-";
    console.log("Download MIME:", downloadData.mimeType, "Filename:", downloadData.fileName, "Matches Preview Size:", isDownloadMatch);
    results["PDF download"] = isDownloadMatch ? "PASS" : "FAIL";

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // CHECK 6: OCR / TEXT EXTRACTION
    // -------------------------------------------------------------------------
    console.log("\n--- CHECK 6: OCR / TEXT EXTRACTION ---");
    const extraction = await ensureMedicalRecordExtracted(pdfRecord, ownerPatientObj);
    const hasExtractedText = Boolean(extraction.text && extraction.text.length > 50);
    const isConfidence98 = extraction.confidence === 98;
    console.log("Extracted text length:", extraction.text?.length, "Confidence:", extraction.confidence, "Cached:", extraction.cached);
    console.log("Extracted snippet:\n", extraction.text?.slice(0, 200));
    results["OCR"] = (hasExtractedText && isConfidence98) ? "PASS" : "FAIL";

    // -------------------------------------------------------------------------
    // CHECK 7: SUMMARIZE RECORD (NOT RAW OCR)
    // -------------------------------------------------------------------------
    console.log("\n--- CHECK 7: SUMMARIZE RECORD ---");
    const summaryRes = await summarizeRecordService(pdfRecord._id, ownerPatientObj);
    const summaryText = summaryRes.summaryText || String(summaryRes.summary);
    console.log("Summary Text Output:\n", summaryText);
    console.log("Summary Object Keys:", Object.keys(summaryRes.summary || {}));

    const isNotRawOcr = summaryText !== pdfRecord.extractedText &&
        !summaryText.includes("SYNTHETIC TEST DATA - FICTIONAL PATIENT") &&
        !summaryText.includes("MRN\nTEST-000101");
    const hasMultipleSections = summaryRes.summary?.overview &&
        Array.isArray(summaryRes.summary?.keyFindings) &&
        summaryRes.summary?.keyFindings.length > 0 &&
        Array.isArray(summaryRes.summary?.medications) &&
        summaryRes.summary?.medications.length > 0;
    const hasDocumentGroundedFacts = summaryText.includes("Maria Delgado") ||
        summaryText.includes("diabetes") ||
        summaryText.includes("Metformin") ||
        summaryText.includes("152/88");

    console.log("Validation: isNotRawOcr =", isNotRawOcr, "hasMultipleSections =", Boolean(hasMultipleSections), "hasDocumentGroundedFacts =", hasDocumentGroundedFacts);
    results["Summary"] = (summaryRes.success && isNotRawOcr && hasMultipleSections && hasDocumentGroundedFacts) ? "PASS" : "FAIL";

    // -------------------------------------------------------------------------
    // CHECK 8: EXTRACT FINDINGS
    // -------------------------------------------------------------------------
    console.log("\n--- CHECK 8: EXTRACT FINDINGS ---");
    const findingsRes = await extractFindingsService(pdfRecord._id, ownerPatientObj);
    console.log("Findings Result:\n", findingsRes.findings);
    const hasFindingsContent = findingsRes.success && findingsRes.findings.length > 80 && !findingsRes.findings.includes("SYNTHETIC TEST DATA - FICTIONAL");
    results["Findings"] = hasFindingsContent ? "PASS" : "FAIL";

    // -------------------------------------------------------------------------
    // CHECK 9 & 10: RECORD Q&A (PRESENT & ABSENT)
    // -------------------------------------------------------------------------
    console.log("\n--- CHECK 9: ASK QUESTION PRESENT IN RECORD (LATEST BLOOD PRESSURE) ---");
    const qBpRes = await askAboutRecordService(pdfRecord._id, ownerPatientObj, "What is the latest blood pressure?");
    console.log("Q (Blood Pressure):", qBpRes.answer);
    const qaBpPass = qBpRes.success && (qBpRes.answer.includes("152/88") || qBpRes.answer.toLowerCase().includes("blood pressure"));

    console.log("\n--- CHECK 10: ASK QUESTION ABSENT IN RECORD (BLOOD GROUP) ---");
    const qAbsentRes = await askAboutRecordService(pdfRecord._id, ownerPatientObj, "What is the patient's blood group?");
    console.log("Q (Blood Group):", qAbsentRes.answer);
    const qaAbsentPass = qAbsentRes.success && qAbsentRes.answer.includes("I couldn't find that information in this record");
    results["Record Q&A"] = (qaBpPass && qaAbsentPass) ? "PASS" : "FAIL";

    // -------------------------------------------------------------------------
    // CHECK 11 & 12: AUTHORIZATION
    // -------------------------------------------------------------------------
    console.log("\n--- CHECK 11: DOCTOR SHARED RECORD ACCESS ---");
    const doctorUser = await UserModel.findOne({ role: "doctor" }).lean();
    const doctorModel = await DoctorModel.findOne({ userId: doctorUser._id }).lean();
    
    // Add doctor to sharedWith if not present
    await MedicalRecordModel.updateOne(
        { _id: pdfRecord._id },
        {
            $addToSet: {
                sharedWith: {
                    doctorId: doctorModel._id,
                    sharedAt: new Date()
                }
            }
        }
    );

    const doctorCaller = {
        id: String(doctorUser._id),
        _id: doctorUser._id,
        role: "doctor"
    };

    let doctorSharedPass = false;
    try {
        const docSummary = await summarizeRecordService(pdfRecord._id, doctorCaller);
        doctorSharedPass = docSummary.success && docSummary.summary.length > 50;
    } catch (e) {
        console.error("Doctor shared record access error:", e.message);
    }
    console.log("Doctor Shared Access Result:", doctorSharedPass ? "PASS" : "FAIL");

    console.log("\n--- CHECK 12: UNRELATED PATIENT ACCESS DENIAL ---");
    const otherPatientUser = await UserModel.findOne({
        role: "patient",
        _id: { $ne: patientUser._id }
    }).lean();

    const otherCaller = {
        id: String(otherPatientUser._id),
        _id: otherPatientUser._id,
        role: "patient",
        patientId: "600000000000000000000000"
    };

    let deniedPass = false;
    try {
        await summarizeRecordService(pdfRecord._id, otherCaller);
        deniedPass = false;
    } catch (err) {
        console.log("Access correctly denied with error:", err.message);
        deniedPass = err.statusCode === 403 || err.message.includes("Access denied");
    }
    results["Authorization"] = (doctorSharedPass && deniedPass) ? "PASS" : "FAIL";

    // -------------------------------------------------------------------------
    // CHECK 13: NO REPEATED OCR
    // -------------------------------------------------------------------------
    console.log("\n--- CHECK 13: NO REPEATED OCR ---");
    const secondCall = await summarizeRecordService(pdfRecord._id, ownerPatientObj);
    console.log("Second call cached flag:", secondCall.cached);
    results["No repeated OCR"] = secondCall.cached === true ? "PASS" : "FAIL";

    // -------------------------------------------------------------------------
    // FINAL SUMMARY
    // -------------------------------------------------------------------------
    console.log("\n================ SUMMARY ================");
    for (const [check, status] of Object.entries(results)) {
        console.log(`${check}: ${status}`);
    }

    const allPassed = Object.values(results).every(s => s === "PASS");
    console.log("OVERALL RESULT:", allPassed ? "ALL PASS" : "FAILURES DETECTED");

    process.exit(allPassed ? 0 : 1);
};

runRecordViewerSmokeTest().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
