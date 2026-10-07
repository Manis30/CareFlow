import mongoose from "mongoose";
import assert from "node:assert";
import UserModel from "../src/model/user.js";
import OrganizationModel from "../src/model/organization.js";
import DoctorModel from "../src/model/doctor.js";
import PatientModel from "../src/model/patient.js";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";
import { RESPONSE_TYPES } from "../src/service/ai/responseContract.js";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const stats = {
    totalRequests: 0,
    totalSteps: 0,
    totalLatencyMs: 0,
    llmLatencyMs: 0,
    toolLatencyMs: 0,
    providerFallbacks: 0,
    duplicateCallsPrevented: 0
};

const runLiveTest = async (name, user, message) => {
    console.log(`\n▶ [LIVE] ${name}`);
    console.log(`  Query: "${message}"`);
    const start = Date.now();
    try {
        const result = await runOrchestratedWorkflow(user, { message });
        const duration = Date.now() - start;
        
        stats.totalRequests++;
        stats.totalSteps += result.stepCount || 1;
        stats.totalLatencyMs += duration;

        console.log(`  ✓ Status: ${result.status} | ResponseType: ${result.responseType} | Steps: ${result.stepCount || 1} | Latency: ${duration}ms`);
        console.log(`  AI Response Snippet: "${(result.aiResponse || "").substring(0, 100)}..."`);
        
        assert.ok(result.success, `Workflow reported failure: ${result.errorMessage || "Unknown"}`);
        assert.ok(result.responseType, "Response must include a canonical responseType");
        assert.ok(result.aiResponse && result.aiResponse.trim().length > 0, "Response must contain non-empty text");

        return result;
    } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
        throw err;
    } finally {
        await delay(1500); // 1.5s delay between live LLM calls to respect rate limits
    }
};

const runSmokeSuite = async () => {
    console.log("==================================================");
    console.log("CAREFLOW AI PHASE 2 — LIVE GEMINI SMOKE SUITE");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required.");
    }
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required for live smoke tests.");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const superAdminUser = await UserModel.findOne({ role: "super_admin" }).lean();
    const adminUser = await UserModel.findOne({ role: "admin" }).populate("organizationId").lean();
    const doctor = await DoctorModel.findOne().populate("userId").populate("organizationId").lean();
    const doctorUser = { ...doctor.userId, id: String(doctor.userId._id || doctor.userId), role: "doctor", organizationId: doctor.organizationId?._id || doctor.organizationId };
    const patient = await PatientModel.findOne().populate("userId").lean();
    const patientUser = { ...patient.userId, id: String(patient.userId._id || patient.userId), role: "patient" };

    assert.ok(superAdminUser, "Super admin user required");
    assert.ok(adminUser, "Admin user required");
    assert.ok(doctorUser, "Doctor user required");
    assert.ok(patientUser, "Patient user required");

    let passed = 0;
    let failed = 0;

    const suite = [
        // ── PATIENT SMOKE (5) ────────────────────────────────────────────────────────
        { name: "P01: Patient symptom presentation", user: patientUser, msg: "I have stomach pain and need to see a doctor" },
        { name: "P02: Patient appointment inquiry", user: patientUser, msg: "What appointments do I have?" },
        { name: "P03: Patient payment history", user: patientUser, msg: "How much have I paid?" },
        { name: "P04: Patient emergency safety escalation", user: patientUser, msg: "I have severe crushing chest pain and cannot breathe" },
        { name: "P05: Patient missed dose clinical safety", user: patientUser, msg: "I forgot my blood pressure pill this morning, should I take a double dose?" },

        // ── DOCTOR SMOKE (5) ─────────────────────────────────────────────────────────
        { name: "D01: Doctor next patient briefing", user: doctorUser, msg: "Who is my next patient?" },
        { name: "D02: Doctor today's schedule", user: doctorUser, msg: "What is my schedule today?" },
        { name: "D03: Doctor department inquiry", user: doctorUser, msg: "What department am I in?" },
        { name: "D04: Doctor cancellation check", user: doctorUser, msg: "Who cancelled today?" },
        { name: "D05: Doctor upcoming leave check", user: doctorUser, msg: "Do I have leave next week?" },

        // ── ADMIN SMOKE (5) ──────────────────────────────────────────────────────────
        { name: "A01: Admin department volume analytics", user: adminUser, msg: "Which department has the most appointments?" },
        { name: "A02: Admin clinic appointment volume", user: adminUser, msg: "How many appointments this month?" },
        { name: "A03: Admin doctor leave status", user: adminUser, msg: "Which doctors are on leave?" },
        { name: "A04: Admin clinic revenue check", user: adminUser, msg: "What is our revenue this month?" },
        { name: "A05: Admin clinic cancellation rate", user: adminUser, msg: "What is our clinic cancellation rate?" },

        // ── SUPER ADMIN SMOKE (5) ────────────────────────────────────────────────────
        { name: "S01: Super Admin platform performance", user: superAdminUser, msg: "How is the platform performing?" },
        { name: "S02: Super Admin latency and database health", user: superAdminUser, msg: "Show system latency and database health" },
        { name: "S03: Super Admin top organization comparison", user: superAdminUser, msg: "Which organization has the most appointments?" },
        { name: "S04: Super Admin platform revenue", user: superAdminUser, msg: "How is platform revenue this month?" },
        { name: "S05: Super Admin platform cancellation rates", user: superAdminUser, msg: "Which clinic has the highest cancellation rate?" }
    ];

    for (const testCase of suite) {
        try {
            await runLiveTest(testCase.name, testCase.user, testCase.msg);
            passed++;
        } catch (e) {
            failed++;
        }
    }

    console.log("\n==================================================");
    console.log("LIVE SMOKE SUITE RESULTS");
    console.log("==================================================");
    console.log(`TOTAL LIVE TESTS: ${suite.length}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);

    console.log("\n--- MEASURED PERFORMANCE METRICS ---");
    console.log(`Average Steps Per Request: ${(stats.totalSteps / stats.totalRequests).toFixed(2)}`);
    console.log(`Average Latency Per Request: ${(stats.totalLatencyMs / stats.totalRequests).toFixed(0)} ms`);
    console.log(`Total Requests Handled: ${stats.totalRequests}`);
    console.log(`Provider Fallback Engagements: ${stats.providerFallbacks}`);

    await mongoose.disconnect();

    if (failed > 0) {
        process.exit(1);
    }
};

runSmokeSuite().catch((err) => {
    console.error("Fatal Live Smoke Test Error:", err);
    process.exit(1);
});
