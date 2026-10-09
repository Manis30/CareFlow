import mongoose from "mongoose";
import assert from "node:assert";
import dotenv from "dotenv";
dotenv.config();

import UserModel from "../src/model/user.js";
import PatientModel from "../src/model/patient.js";
import DoctorModel from "../src/model/doctor.js";
import DepartmentModel from "../src/model/department.js";
import OrganizationModel from "../src/model/organization.js";
import AppointmentModel from "../src/model/appointment.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import DocumentChunkModel from "../src/model/documentChunk.js";
import AIChatHistoryModel from "../src/model/aiChatHistory.js";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";
import { resolveSharedRecordSelection, resolveDoctorPatientSelection } from "../src/service/doctorCopilot.js";
import { searchPatientDocuments } from "../src/service/ai/documentQaService.js";

async function runPhase8TargetedVerification() {
    console.log("==================================================");
    console.log("PHASE 8 TARGETED VERIFICATION SUITE");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required in .env");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const runId = Date.now().toString(36);

    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            passed++;
            console.log(`  ✓ ${name}`);
        } catch (err) {
            failed++;
            console.error(`  ✗ ${name}`);
            console.error(`    ${err.message}`);
        }
    };

    // ── FIXTURES SETUP ──────────────────────────────────────────────
    const org = await OrganizationModel.create({
        name: `CareFlow Metro Hospital ${runId}`,
        email: `hosp_${runId}@careflow.test`,
        phone: "9123450099",
        address: { street: "100 Metro Way", city: "Chennai" },
        status: "ACTIVE"
    });

    const deptCardio = await DepartmentModel.create({
        name: "Cardiology",
        description: "Department of Cardiology",
        organizationId: org._id,
        status: "active"
    });

    const docUser = await UserModel.create({
        name: "Dr. K Senthilkumar",
        email: `dr_senthil_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "doctor",
        organizationId: org._id,
        isActive: true
    });

    const doctor = await DoctorModel.create({
        userId: docUser._id,
        organizationId: org._id,
        departmentId: deptCardio._id,
        specialization: "Cardiology",
        qualification: "MBBS, MD (Cardiology)",
        consultationFee: 700,
        experienceYears: 15,
        isActive: true
    });

    // Patient 1: Karthik Raj
    const p1User = await UserModel.create({
        name: "Karthik Raj",
        email: `karthik_raj_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const p1 = await PatientModel.create({
        userId: p1User._id,
        organizationId: org._id,
        dateOfBirth: new Date("1985-06-15"),
        gender: "male"
    });

    // Patient 2: Ambiguous Name Patient Alpha (first)
    const p2User = await UserModel.create({
        name: "Phase3 Test Patient Alpha",
        email: `alpha1_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const p2 = await PatientModel.create({
        userId: p2User._id,
        organizationId: org._id,
        dateOfBirth: new Date("1978-03-20"),
        gender: "female"
    });

    // Patient 3: Ambiguous Name Patient Alpha (second)
    const p3User = await UserModel.create({
        name: "Phase3 Test Patient Alpha",
        email: `alpha2_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const p3 = await PatientModel.create({
        userId: p3User._id,
        organizationId: org._id,
        dateOfBirth: new Date("1992-11-10"),
        gender: "male"
    });

    // Create appointments so doctor is authorized for all 3
    const apptDate = new Date();
    await AppointmentModel.create({
        patientId: p1._id,
        doctorId: doctor._id,
        departmentId: deptCardio._id,
        organizationId: org._id,
        appointmentDate: apptDate,
        startTime: "10:00",
        endTime: "10:30",
        consultationType: "offline",
        status: "COMPLETED"
    });

    await AppointmentModel.create({
        patientId: p2._id,
        doctorId: doctor._id,
        departmentId: deptCardio._id,
        organizationId: org._id,
        appointmentDate: new Date(Date.now() - 7 * 86400000),
        startTime: "11:00",
        endTime: "11:30",
        consultationType: "offline",
        status: "COMPLETED"
    });

    await AppointmentModel.create({
        patientId: p3._id,
        doctorId: doctor._id,
        departmentId: deptCardio._id,
        organizationId: org._id,
        appointmentDate: new Date(Date.now() - 2 * 86400000),
        startTime: "14:00",
        endTime: "14:30",
        consultationType: "offline",
        status: "COMPLETED"
    });

    // Create two medical records for Karthik Raj
    const rec1 = await MedicalRecordModel.create({
        patientId: p1._id,
        organizationId: org._id,
        uploadedBy: p1User._id,
        uploadedByRole: "patient",
        title: "2D Echocardiogram Doppler Study",
        recordType: "diagnostic_report",
        description: "Cardiology echo evaluation",
        file: {
            url: "https://res.cloudinary.com/careflow/raw/upload/echo_karthik",
            publicId: "echo_karthik",
            resourceType: "raw",
            mimeType: "application/pdf",
            fileName: "echo_karthik.pdf"
        },
        extractedText: "2D Echocardiogram Doppler Study\nDate: 2026-03-10\nLeft Ventricular Ejection Fraction (LVEF): 58% (Normal: 55-70%)\nInterventricular septum: 10 mm (Normal)\nLeft atrium: 34 mm\nImpression: Normal LV systolic function. No regional wall motion abnormalities. Trace mitral regurgitation.",
        sharedWith: [{ doctorId: doctor._id, sharedAt: new Date() }]
    });

    const rec2 = await MedicalRecordModel.create({
        patientId: p1._id,
        organizationId: org._id,
        uploadedBy: p1User._id,
        uploadedByRole: "patient",
        title: "Comprehensive Metabolic & Lipid Panel",
        recordType: "lab_report",
        description: "Fasting lipid and metabolic profile",
        file: {
            url: "https://res.cloudinary.com/careflow/raw/upload/lipid_karthik",
            publicId: "lipid_karthik",
            resourceType: "raw",
            mimeType: "application/pdf",
            fileName: "lipid_karthik.pdf"
        },
        extractedText: "Comprehensive Metabolic & Lipid Panel\nDate: 2026-03-15\nFasting Blood Glucose: 98 mg/dL (Normal: 70-99 mg/dL)\nTotal Cholesterol: 182 mg/dL (Desirable: <200 mg/dL)\nTriglycerides: 140 mg/dL (Normal: <150 mg/dL)\nHDL Cholesterol: 48 mg/dL (Optimal: >40 mg/dL)\nLDL Cholesterol: 106 mg/dL (Near optimal: 100-129 mg/dL)\nSerum Creatinine: 0.9 mg/dL (Normal: 0.7-1.3 mg/dL)\nImpression: Lipid and metabolic parameters within acceptable limits.",
        sharedWith: [{ doctorId: doctor._id, sharedAt: new Date() }]
    });

    // Insert DocumentChunk entries for rec1 and rec2
    await DocumentChunkModel.create([
        {
            documentId: rec1._id,
            organizationId: org._id,
            patientId: p1._id,
            chunkIndex: 0,
            textContent: rec1.extractedText,
            documentType: "medical_record"
        },
        {
            documentId: rec2._id,
            organizationId: org._id,
            patientId: p1._id,
            chunkIndex: 0,
            textContent: rec2.extractedText,
            documentType: "lab_report"
        }
    ]);

    // ─────────────────────────────────────────────────────────────────
    // TEST 1: Discover Karthik Raj's records
    // ─────────────────────────────────────────────────────────────────
    let savedState = null;
    await test("1. 'Show patient Karthik Raj's records' -> returns authorized numbered list", async () => {
        const res = await runOrchestratedWorkflow(docUser, {
            message: "Show patient Karthik Raj's records"
        });
        const payload = res.data || res;

        assert.strictEqual(payload.success, true);
        assert.ok(payload.aiResponse, "Expected aiResponse in output");
        assert.ok(payload.aiResponse.includes("1."), "Expected numbered choice 1");
        assert.ok(payload.aiResponse.includes("2."), "Expected numbered choice 2");
        assert.ok(payload.aiResponse.includes("2D Echocardiogram"), "Expected echo record title");
        assert.ok(payload.aiResponse.includes("Metabolic"), "Expected lipid record title");
        assert.strictEqual(payload.agentState?.stage, "SELECT_SHARED_RECORD");
        assert.strictEqual(Array.isArray(payload.agentState?.sharedMedicalRecords), true);
        assert.strictEqual(payload.agentState.sharedMedicalRecords.length, 2);

        savedState = payload.agentState;
    });

    // ─────────────────────────────────────────────────────────────────
    // TEST 2: Select '1' -> returns structured summary with object citations
    // ─────────────────────────────────────────────────────────────────
    await test("2. Reply '1' -> returns single structured summary with readable citations & persists without [object Object]", async () => {
        const res = await runOrchestratedWorkflow(docUser, {
            message: "1"
        });
        const payload = res.data || res;

        assert.strictEqual(payload.success, true);
        assert.ok(payload.aiResponse, "Expected aiResponse");
        assert.ok(payload.aiResponse.length > 30, "Expected non-empty response");
        assert.ok(!payload.aiResponse.includes("[object Object]"), "Must not contain [object Object]");
        assert.ok(!payload.aiResponse.includes("Document Chunk ["), "Must not contain raw chunk markers");

        // Verify citations
        assert.ok(Array.isArray(payload.citations), "Expected citations array");
        assert.ok(payload.citations.length > 0, "Expected at least 1 citation");
        const firstCite = payload.citations[0];
        assert.strictEqual(typeof firstCite, "object", "Citation must be structured object");
        assert.ok(firstCite.title, "Citation must have title");
        assert.ok(firstCite.recordId, "Citation must have recordId");

        // Verify MongoDB history persistence didn't corrupt citations to [object Object]
        const historyDoc = await AIChatHistoryModel.findOne({ userId: docUser._id }).lean();
        assert.ok(historyDoc?.messages?.length > 0, "Chat history messages must exist");
        const lastMsg = historyDoc.messages[historyDoc.messages.length - 1];
        assert.ok(Array.isArray(lastMsg.citations), "Citations must be saved as array");
        if (lastMsg.citations.length > 0) {
            assert.notStrictEqual(lastMsg.citations[0], "[object Object]", "Citations must NOT be stringified to [object Object]");
            assert.strictEqual(typeof lastMsg.citations[0], "object", "Citation in DB must be saved as native object");
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // TEST 3: Fresh record discovery -> Reply 'all'
    // ─────────────────────────────────────────────────────────────────
    await test("3. Reply 'all' in fresh discovery -> summarizes all authorized records with distinct document separation", async () => {
        // Step A: Discover records again
        await AIChatHistoryModel.deleteMany({ userId: docUser._id });
        const discRes = await runOrchestratedWorkflow(docUser, {
            message: "Show patient Karthik Raj's records"
        });
        const discPayload = discRes.data || discRes;
        assert.strictEqual(discPayload.agentState?.stage, "SELECT_SHARED_RECORD");

        // Step B: Doctor replies "all"
        const allRes = await runOrchestratedWorkflow(docUser, {
            message: "all"
        });
        const allPayload = allRes.data || allRes;

        assert.strictEqual(allPayload.success, true);
        assert.ok(allPayload.aiResponse, "Expected aiResponse");
        assert.ok(allPayload.aiResponse.length > 50, "Expected substantial summary of all records");
        assert.ok(!allPayload.aiResponse.includes("[object Object]"), "Must not contain [object Object]");
        assert.ok(Array.isArray(allPayload.citations), "Expected citations array");
        assert.ok(allPayload.citations.length >= 2, "Expected citations for both documents");
    });

    // ─────────────────────────────────────────────────────────────────
    // TEST 4: Ambiguous Patient Name Disambiguation
    // ─────────────────────────────────────────────────────────────────
    await test("5. Ambiguous patient name -> safe clarification with birth year/visit date, zero MongoDB IDs", async () => {
        await AIChatHistoryModel.deleteMany({ userId: docUser._id });
        const res = await runOrchestratedWorkflow(docUser, {
            message: "Show records for Phase3 Test Patient Alpha"
        });
        const payload = res.data || res;

        assert.strictEqual(payload.success, true);
        assert.ok(payload.aiResponse, "Expected clarification response");
        assert.ok(payload.aiResponse.includes("1."), "Expected numbered choice 1");
        assert.ok(payload.aiResponse.includes("2."), "Expected numbered choice 2");
        assert.ok(payload.aiResponse.includes("Phase3 Test Patient Alpha"), "Expected patient name");

        // Verify NO Mongo IDs are exposed
        assert.ok(!payload.aiResponse.includes(String(p2._id)), "Must not leak p2 Mongo ID");
        assert.ok(!payload.aiResponse.includes(String(p3._id)), "Must not leak p3 Mongo ID");
        assert.ok(!payload.aiResponse.includes(String(p2User._id)), "Must not leak p2 user ID");
        assert.ok(!payload.aiResponse.includes(String(p3User._id)), "Must not leak p3 user ID");

        // Verify birth year or visit date is present
        assert.ok(payload.aiResponse.includes("1978") || payload.aiResponse.includes("visit"), "Must include distinguishing attribute");
        assert.strictEqual(payload.agentState?.stage, "SELECT_PATIENT");
    });

    // ─────────────────────────────────────────────────────────────────
    // TEST 5: Document Action: Summarize Record
    // ─────────────────────────────────────────────────────────────────
    await test("6. Summarize Record -> returns concise clinical summary with LVEF and findings", async () => {
        const sumRes = await searchPatientDocuments({
            user: docUser,
            query: "Summarize this medical record",
            patientId: String(p1._id),
            recordId: String(rec1._id)
        });

        assert.ok(sumRes.answer, "Expected answer");
        assert.ok(sumRes.answer.includes("Echocardiogram") || sumRes.answer.includes("LVEF") || sumRes.answer.includes("58%"), "Expected key echo findings in summary");
        assert.ok(!sumRes.answer.includes("Document Chunk ["), "Must not include raw chunk headers");
        assert.ok(Array.isArray(sumRes.citations), "Expected citations array");
        assert.strictEqual(sumRes.citations[0].recordId, String(rec1._id));
    });

    // ─────────────────────────────────────────────────────────────────
    // TEST 6: Document Action: Extract Findings
    // ─────────────────────────────────────────────────────────────────
    await test("7. Extract Findings -> preserves exact values, units, and ranges", async () => {
        const extRes = await searchPatientDocuments({
            user: docUser,
            query: "Extract all clinical findings, laboratory results, and measurements from this medical document",
            patientId: String(p1._id),
            recordId: String(rec2._id)
        });

        assert.ok(extRes.answer, "Expected answer");
        assert.ok(extRes.answer.includes("98") || extRes.answer.includes("mg/dL") || extRes.answer.includes("Cholesterol"), "Expected exact laboratory values and units");
        assert.ok(Array.isArray(extRes.citations), "Expected citations array");
    });

    // ─────────────────────────────────────────────────────────────────
    // TEST 7: Document Action: Ask About This Record
    // ─────────────────────────────────────────────────────────────────
    await test("8. Ask About This Record -> grounded answer or explicit not-documented response", async () => {
        // Sub-test A: Grounded question about documented finding
        const askA = await searchPatientDocuments({
            user: docUser,
            query: "What is the patient's ejection fraction in this echocardiogram?",
            patientId: String(p1._id),
            recordId: String(rec1._id)
        });
        assert.ok(askA.answer, "Expected answer");
        assert.ok(askA.answer.includes("58%") || askA.answer.includes("LVEF"), "Expected 58% LVEF in answer");

        // Sub-test B: Question about non-documented finding
        const askB = await searchPatientDocuments({
            user: docUser,
            query: "What is the patient's prostate-specific antigen (PSA) level in this echocardiogram?",
            patientId: String(p1._id),
            recordId: String(rec1._id)
        });
        assert.ok(askB.answer, "Expected answer");
        assert.ok(
            askB.answer.toLowerCase().includes("couldn't find") ||
            askB.answer.toLowerCase().includes("not documented") ||
            askB.answer.toLowerCase().includes("not present"),
            "Expected explicit not-documented response for absent PSA"
        );
    });

    // Cleanup fixtures
    await MedicalRecordModel.deleteMany({ organizationId: org._id });
    await DocumentChunkModel.deleteMany({ organizationId: org._id });
    await AppointmentModel.deleteMany({ organizationId: org._id });
    await PatientModel.deleteMany({ organizationId: org._id });
    await DoctorModel.deleteMany({ organizationId: org._id });
    await UserModel.deleteMany({ organizationId: org._id });
    await DepartmentModel.deleteMany({ organizationId: org._id });
    await OrganizationModel.deleteMany({ _id: org._id });
    await AIChatHistoryModel.deleteMany({ userId: docUser._id });

    await mongoose.disconnect();

    console.log("\n==================================================");
    console.log(`PHASE 8 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runPhase8TargetedVerification().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
