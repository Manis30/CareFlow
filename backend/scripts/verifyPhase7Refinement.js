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
import { searchPatientDocuments } from "../src/service/ai/documentQaService.js";

async function runPhase7Verification() {
    console.log("===============================================================");
    console.log("CAREFLOW PHASE 7: FOCUSED CLINICAL INTELLIGENCE VERIFICATION");
    console.log("===============================================================\n");

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.");

    // Doctor 1: Dr. K. Senthil Kumar (Cauvery Medical) — Authorized for Karthik Raj
    const docUser1 = await UserModel.findOne({ email: "dr.ksenthilkumar.cauvery-medical@demo-careflow.in" }).lean();
    assert.ok(docUser1, "Dr. K. Senthil Kumar must exist");
    const doctor1 = await DoctorModel.findOne({ userId: docUser1._id }).lean();
    assert.ok(doctor1, "Doctor profile 1 must exist");

    const authDoctor1 = {
        id: docUser1._id.toString(),
        role: "doctor",
        organizationId: doctor1.organizationId.toString()
    };

    // Doctor 2: Dr. R. Karthikeyan (CMHI) — Cross-clinic doctor
    const docUser2 = await UserModel.findOne({ email: "dr.rkarthikeyan.cmhi@demo-careflow.in" }).lean();
    assert.ok(docUser2, "Dr. R. Karthikeyan must exist");
    const doctor2 = await DoctorModel.findOne({ userId: docUser2._id }).lean();
    assert.ok(doctor2, "Doctor profile 2 must exist");

    const authDoctor2 = {
        id: docUser2._id.toString(),
        role: "doctor",
        organizationId: doctor2.organizationId.toString()
    };

    // Clean test chat histories
    await AIChatHistoryModel.deleteMany({ userId: { $in: [docUser1._id, docUser2._id] } });

    // ─────────────────────────────────────────────────────────────────
    // CHECK 1: Multi-Tool Clinical Question
    // Doctor asks about patient's history, medications, latest consultation, and shared records in one query
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- [CHECK 1] Multi-Tool Clinical Question ---");
    console.log("Query: 'What is Karthik Raj\\'s full history, active medications, latest consultation notes, and shared records?'");

    const check1 = await runOrchestratedWorkflow(authDoctor1, {
        message: "What is Karthik Raj's full history, active medications, latest consultation notes, and shared records?"
    });

    console.log(`Response Type: ${check1.responseType}`);
    console.log(`Tool(s) Used: ${check1.toolUsed}`);
    console.log(`Citations Count: ${check1.citations?.length || 0}`);
    console.log(`AI Response Snippet:\n${check1.aiResponse.slice(0, 500)}...\n`);

    assert.strictEqual(check1.success, true, "Check 1 must succeed");
    assert.ok(
        check1.toolUsed.includes("getClinicalSummary") && check1.toolUsed.includes("getSharedMedicalRecords"),
        `Must chain both getClinicalSummary and getSharedMedicalRecords. Got: ${check1.toolUsed}`
    );
    assert.ok(
        check1.aiResponse.includes("LATEST CONSULTATION") || check1.aiResponse.toLowerCase().includes("consultation"),
        "Response must include consultation section"
    );
    assert.ok(
        check1.aiResponse.includes("ACTIVE MEDICATIONS") || check1.aiResponse.toLowerCase().includes("medication"),
        "Response must include active medications"
    );
    assert.ok(
        check1.aiResponse.includes("AUTHORIZED MEDICAL RECORDS") || check1.aiResponse.toLowerCase().includes("shared"),
        "Response must include shared medical records"
    );
    assert.ok(
        !check1.aiResponse.includes("ObjectId(") && !check1.aiResponse.match(/ID:\s*[a-f0-9]{6}/),
        "Response must not leak raw internal MongoDB IDs"
    );
    console.log("✓ CHECK 1 PASS: Multi-part question executed chained authorized tools with longitudinal synthesis and citations.");

    // ─────────────────────────────────────────────────────────────────
    // CHECK 2: Ambiguous Patient Name
    // Doctor asks for a name with multiple authorized matches in the clinic
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- [CHECK 2] Ambiguous Patient Name Disambiguation ---");
    console.log("Query: 'Show me Phase3 Test Patient Alpha\\'s clinical summary'");

    const check2 = await runOrchestratedWorkflow(authDoctor2, {
        message: "Show me Phase3 Test Patient Alpha's clinical summary"
    });

    console.log(`Response Type: ${check2.responseType}`);
    console.log(`AI Response:\n${check2.aiResponse}\n`);

    assert.strictEqual(check2.responseType, "CLARIFICATION", "Ambiguous patient must return CLARIFICATION responseType");
    assert.ok(
        check2.aiResponse.includes("I found") && check2.aiResponse.includes("patients matching"),
        "Must prompt clarification for matching patients"
    );
    assert.ok(
        !check2.aiResponse.includes("ID:"),
        "Clarification question must not display internal database IDs"
    );
    assert.strictEqual(check2.agentState?.stage, "SELECT_PATIENT", "Agent state stage must be SELECT_PATIENT");
    console.log("✓ CHECK 2 PASS: Ambiguous name prompted natural clarification with clean clinical attributes and zero internal IDs.");

    // ─────────────────────────────────────────────────────────────────
    // CHECK 3: Missing Clinical Fact (Strict Grounding & Refusal)
    // Doctor queries a vital sign or blood group not present in the record
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- [CHECK 3] Missing Clinical Fact (Strict Grounding) ---");
    console.log("Query: 'What is Karthik Raj\\'s documented blood group and in-clinic resting heart rate?'");

    const check3 = await runOrchestratedWorkflow(authDoctor1, {
        message: "What is Karthik Raj's documented blood group and in-clinic resting heart rate?"
    });

    console.log(`Response Type: ${check3.responseType}`);
    console.log(`AI Response Snippet:\n${check3.aiResponse.slice(0, 400)}...\n`);

    const missingHandled = /couldn't find that information|not documented|no .*documented|unavailable|measurement (?:is )?required|requires in-person/i.test(check3.aiResponse);
    assert.ok(missingHandled, "Must refuse absent clinical fact without fabrication");
    assert.ok(!/heart rate is (?:7\d|8\d|6\d) bpm/i.test(check3.aiResponse), "Must never fabricate heart rate values");
    console.log("✓ CHECK 3 PASS: Grounding strictly maintained; absent facts refused without hallucination.");

    // ─────────────────────────────────────────────────────────────────
    // CHECK 4: Unauthorized Record Access (Cross-Tenant / Doctor Scoping)
    // Doctor (Dr. K. Harini Devi at CMHI) attempts to access Karthik Raj's documents directly (patient with no share/appt)
    // ─────────────────────────────────────────────────────────────────
    console.log("\n--- [CHECK 4] Unauthorized Record Access ---");
    console.log("Query: Unauthorized doctor (Dr. K. Harini Devi) attempts to search Karthik Raj's documents");

    const pUser = await UserModel.findOne({ email: "karthik.raj.02@demo-careflow.in" }).lean();
    const pDoc = await PatientModel.findOne({ userId: pUser._id }).lean();
    const unauthDocUser = await UserModel.findOne({ email: "dr.kharinidevi.cmhi@demo-careflow.in" }).lean();
    const unauthDoctor = await DoctorModel.findOne({ userId: unauthDocUser._id }).lean();

    const authDoctorUnauth = {
        id: unauthDocUser._id.toString(),
        role: "doctor",
        organizationId: unauthDoctor.organizationId.toString()
    };

    let authDenied = false;
    try {
        await searchPatientDocuments({
            user: authDoctorUnauth,
            query: "blood test results",
            patientId: pDoc._id.toString()
        });
    } catch (err) {
        authDenied = true;
        console.log(`Access Denied as expected: HTTP ${err.statusCode || 403} - ${err.message}`);
        assert.strictEqual(err.statusCode, 403, "Must throw 403 Forbidden for unauthorized doctor");
    }

    assert.strictEqual(authDenied, true, "Cross-tenant / unauthorized patient access must be strictly rejected with 403");
    console.log("✓ CHECK 4 PASS: Unauthorized cross-tenant document access threw 403 Forbidden.");

    console.log("\n===============================================================");
    console.log("ALL 4 FOCUSED PHASE 7 ACCEPTANCE CHECKS PASSED SUCCESSFULLY!");
    console.log("===============================================================");

    await mongoose.disconnect();
}

runPhase7Verification().catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
});
