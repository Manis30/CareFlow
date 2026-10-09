import mongoose from "mongoose";
import assert from "node:assert";
import dotenv from "dotenv";
dotenv.config();

import UserModel from "../src/model/user.js";
import DoctorModel from "../src/model/doctor.js";
import PatientModel from "../src/model/patient.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import AIChatHistoryModel from "../src/model/aiChatHistory.js";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";

async function verifyDoctorAiWorkflow() {
    console.log("==================================================");
    console.log("WORKFLOW 1: DOCTOR AI ACCEPTANCE VERIFICATION");
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

    // Clean any prior conversation history for fresh test
    await AIChatHistoryModel.deleteMany({ userId: docUser._id });

    // Step 1: Ask for a patient's records by name
    console.log("\n[STEP 1] Doctor asks: 'Show patient Karthik Raj\\'s records'");
    const step1 = await runOrchestratedWorkflow(authDoctor, {
        message: "Show patient Karthik Raj's records"
    });

    console.log(`AI Response (Step 1):\n${step1.aiResponse}\n`);
    assert.strictEqual(step1.success, true, "Step 1 must succeed");
    assert.strictEqual(step1.agentState?.stage, "SELECT_SHARED_RECORD", "Stage must be SELECT_SHARED_RECORD");
    assert.ok(step1.aiResponse.includes("Test report"), "Response must list 'Test report'");
    assert.ok(step1.aiResponse.toLowerCase().includes("which one would you like me to review"), "Must ask which record to review");
    console.log("✓ STEP 1 PASS: Resolved Karthik Raj by name, discovered shared records, and prompted which to review.");

    // Step 2: Choose a numbered record ("1")
    console.log("\n[STEP 2] Doctor selects: '1'");
    const step2 = await runOrchestratedWorkflow(authDoctor, {
        message: "1"
    });

    console.log(`AI Response (Step 2):\n${step2.aiResponse}\n`);
    assert.strictEqual(step2.success, true, "Step 2 must succeed");
    assert.strictEqual(step2.agentState?.stage, "RECORD_SELECTED", "Stage must be RECORD_SELECTED");
    assert.ok(
        step2.aiResponse.toLowerCase().includes("maria delgado") ||
        step2.aiResponse.toLowerCase().includes("diabetes") ||
        step2.aiResponse.toLowerCase().includes("hypertension") ||
        step2.aiResponse.toLowerCase().includes("findings"),
        "Must summarize record #1 with documented findings"
    );
    assert.ok(!step2.aiResponse.includes("Document Chunk [1]:"), "Must never dump raw chunk headers or OCR text");
    console.log("✓ STEP 2 PASS: Numbered record 1 chosen and structured summary generated without raw OCR dump.");

    // Step 3: Ask a specific question about it ("What is the latest blood pressure?")
    console.log("\n[STEP 3] Doctor asks question: 'What is the patient\\'s blood pressure in this report?'");
    const step3 = await runOrchestratedWorkflow(authDoctor, {
        message: "What is the patient's blood pressure in this report?"
    });

    console.log(`AI Response (Step 3):\n${step3.aiResponse}\n`);
    assert.strictEqual(step3.success, true, "Step 3 must succeed");
    assert.ok(step3.aiResponse.includes("152/88"), "Response must cite exact grounded BP 152/88 mmHg");
    assert.ok(step3.citations?.length > 0 || step3.agentState?.selectedRecordId, "Evidence must link to source record");
    console.log("✓ STEP 3 PASS: Question answered with grounded clinical evidence (152/88 mmHg).");

    // Step 4: Request a summary of all authorized records ("all")
    console.log("\n[STEP 4] Doctor asks: 'all'");
    const step4 = await runOrchestratedWorkflow(authDoctor, {
        message: "all"
    });

    console.log(`AI Response (Step 4):\n${step4.aiResponse}\n`);
    assert.strictEqual(step4.success, true, "Step 4 must succeed");
    assert.ok(
        step4.aiResponse.toLowerCase().includes("test report") ||
        step4.aiResponse.toLowerCase().includes("delgado") ||
        step4.aiResponse.toLowerCase().includes("summary") ||
        step4.aiResponse.toLowerCase().includes("findings"),
        "Must summarize authorized records"
    );
    console.log("✓ STEP 4 PASS: Summary of all authorized records generated successfully.");

    await AIChatHistoryModel.deleteMany({ userId: docUser._id });
    await mongoose.disconnect();
    console.log("\n==================================================");
    console.log("✓ WORKFLOW 1 FULL ACCEPTANCE CHECK: ALL PASS");
    console.log("==================================================");
}

verifyDoctorAiWorkflow().catch((err) => {
    console.error("WORKFLOW 1 FAILED:", err);
    process.exit(1);
});
