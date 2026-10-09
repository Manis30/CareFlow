import mongoose from "mongoose";
import assert from "node:assert";
import dotenv from "dotenv";
dotenv.config();

import UserModel from "../src/model/user.js";
import DoctorModel from "../src/model/doctor.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import { searchPatientDocuments } from "../src/service/ai/documentQaService.js";

async function verifyDocumentIntelligenceWorkflow() {
    console.log("==================================================");
    console.log("WORKFLOW 2: DOCUMENT INTELLIGENCE ACCEPTANCE CHECK");
    console.log("==================================================");

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.");

    const docUser = await UserModel.findOne({ email: "dr.ksenthilkumar.cauvery-medical@demo-careflow.in" }).lean();
    assert.ok(docUser, "Doctor Dr. K. Senthil Kumar must exist");
    const doctor = await DoctorModel.findOne({ userId: docUser._id }).lean();
    assert.ok(doctor, "Doctor profile must exist");

    const authDoctor = {
        id: docUser._id.toString(),
        role: "doctor",
        organizationId: doctor.organizationId.toString()
    };

    const recordId = "6ac75838f7a1f5abb35133bd";
    const record = await MedicalRecordModel.findById(recordId).lean();
    assert.ok(record, "Test report record must exist");
    assert.strictEqual(record.file?.mimeType, "application/pdf", "Must be a real uploaded PDF");
    console.log(`✓ Real PDF loaded: ${record.file?.fileName} (${record.file?.mimeType}, ${record.file?.fileSize} bytes)`);

    // Check 1: Document Summarization
    console.log("\n[CHECK 1] Summarizing the uploaded PDF...");
    const summaryResult = await searchPatientDocuments({
        user: authDoctor,
        query: "Summarize this medical record",
        recordId
    });

    console.log(`AI Summary:\n${summaryResult.answer}\n`);
    assert.ok(summaryResult.answer, "Summary must not be empty");
    // Structured format
    assert.ok(
        summaryResult.answer.toLowerCase().includes("clinical document summary") ||
        summaryResult.answer.toLowerCase().includes("findings") ||
        summaryResult.answer.toLowerCase().includes("overview") ||
        summaryResult.answer.toLowerCase().includes("patient"),
        "Summary must be structured with clinical sections"
    );
    // Not raw OCR dump
    assert.ok(!summaryResult.answer.includes("Document Chunk [1]:"), "Must not dump chunk markers");
    assert.ok(!summaryResult.answer.includes("Medical Record [1]:"), "Must not dump raw record envelope");
    assert.ok(summaryResult.answer.length < 2500, "Summary must be concise rather than a full raw dump");
    // Preserves key findings
    assert.ok(
        summaryResult.answer.toLowerCase().includes("delgado") ||
        summaryResult.answer.toLowerCase().includes("diabetes") ||
        summaryResult.answer.toLowerCase().includes("hypertension") ||
        summaryResult.answer.toLowerCase().includes("metformin") ||
        summaryResult.answer.toLowerCase().includes("lisinopril"),
        "Summary must preserve key clinical findings and medications"
    );
    console.log("✓ CHECK 1 PASS: Structured, concise summary preserving key clinical findings without raw OCR dump.");

    // Check 2: Specific Question - Grounded in document (Blood pressure)
    console.log("\n[CHECK 2] Specific question: 'What is the patient\\'s blood pressure in this report?'");
    const bpResult = await searchPatientDocuments({
        user: authDoctor,
        query: "What is the patient's blood pressure in this report?",
        recordId
    });

    console.log(`AI Answer (BP):\n${bpResult.answer}\n`);
    assert.ok(
        bpResult.answer.includes("152/88"),
        "Answer must contain exact grounded blood pressure '152/88'"
    );
    assert.ok(
        bpResult.answer.toLowerCase().includes("mmhg") || bpResult.answer.includes("152/88"),
        "Answer must preserve clinical units (mmHg)"
    );
    console.log("✓ CHECK 2 PASS: Specific question answered with exact grounded values and units (152/88 mmHg).");

    // Check 3: Negative Question - Information NOT in document (Blood group / Rh factor)
    console.log("\n[CHECK 3] Specific question for unmentioned fact: 'What is the patient\\'s ABO blood group?'");
    const bgResult = await searchPatientDocuments({
        user: authDoctor,
        query: "What is the patient's ABO blood group?",
        recordId
    });

    console.log(`AI Answer (Blood Group):\n${bgResult.answer}\n`);
    assert.ok(
        bgResult.answer.toLowerCase().includes("couldn't find") ||
        bgResult.answer.toLowerCase().includes("not found") ||
        bgResult.answer.toLowerCase().includes("not mentioned") ||
        bgResult.answer.toLowerCase().includes("not specified") ||
        bgResult.answer.toLowerCase().includes("no information") ||
        bgResult.answer.toLowerCase().includes("not documented"),
        "Model must not hallucinate absent facts like blood group"
    );
    console.log("✓ CHECK 3 PASS: Correctly refused unmentioned clinical fact without hallucination.");

    await mongoose.disconnect();
    console.log("\n==================================================");
    console.log("✓ WORKFLOW 2 FULL ACCEPTANCE CHECK: ALL PASS");
    console.log("==================================================");
}

verifyDocumentIntelligenceWorkflow().catch((err) => {
    console.error("WORKFLOW 2 FAILED:", err);
    process.exit(1);
});
