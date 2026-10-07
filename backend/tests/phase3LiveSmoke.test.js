import mongoose from "mongoose";
import assert from "node:assert";
import UserModel from "../src/model/user.js";
import PatientModel from "../src/model/patient.js";
import AIChatHistoryModel from "../src/model/aiChatHistory.js";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";
import { RESPONSE_TYPES } from "../src/service/ai/responseContract.js";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runLivePatientSmoke = async () => {
    console.log("==================================================");
    console.log("CAREFLOW AI PHASE 3 — LIVE GEMINI SMOKE SUITE");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required.");
    }
    if (!process.env.GEMINI_API_KEY) {
        console.warn("[WARNING] GEMINI_API_KEY is not defined. Reporting per instructions.");
        return;
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const patient = await PatientModel.findOne().populate("userId").lean();
    if (!patient) {
        console.warn("No patient found in database to execute live smoke test.");
        await mongoose.disconnect();
        return;
    }

    const patientUser = {
        ...patient.userId,
        id: String(patient.userId._id || patient.userId),
        role: "patient"
    };

    // Clear stale chat history for clean live tests
    await AIChatHistoryModel.deleteMany({ userId: patientUser.id });

    const queries = [
        {
            name: "Smoke 1: Symptom & Doctor Request",
            query: "I have fever and want to see a doctor.",
            expectedResponseType: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.CLARIFICATION, "ANSWER", "CLARIFICATION"]
        },
        {
            name: "Smoke 2: Next Appointment Inquiry",
            query: "What is my next appointment?",
            expectedResponseType: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.LIVE_DATA, "ANSWER"]
        },
        {
            name: "Smoke 3: Last Prescription Inquiry",
            query: "What did my doctor prescribe last time?",
            expectedResponseType: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.LIVE_DATA, "ANSWER"]
        },
        {
            name: "Smoke 4: Medication Timing Inquiry",
            query: "When should I take my medicine?",
            expectedResponseType: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.LIVE_DATA, "ANSWER"]
        },
        {
            name: "Smoke 5: Missed Dose Safety Guard",
            query: "I missed my tablet.",
            expectedResponseType: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.SAFETY_ESCALATION, "ANSWER"],
            expectedSafetyText: "never"
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const item of queries) {
        console.log(`\n▶ [LIVE] ${item.name}`);
        console.log(`  User Message: "${item.query}"`);
        const start = Date.now();
        try {
            const res = await runOrchestratedWorkflow(patientUser, { message: item.query });
            const duration = Date.now() - start;

            console.log(`  ✓ Status: ${res.status} | ResponseType: ${res.responseType} | Latency: ${duration}ms`);
            console.log(`  Tool(s) Used: [${(res.toolUsed || []).join(", ")}]`);
            console.log(`  AI Response Snippet: "${(res.aiResponse || "").substring(0, 120)}..."`);

            assert.ok(res.success, `Workflow reported error: ${res.errorMessage}`);
            assert.ok(
                item.expectedResponseType.includes(res.responseType),
                `Unexpected responseType: ${res.responseType}`
            );
            assert.ok(res.aiResponse && res.aiResponse.trim().length > 0, "Response must not be empty");

            if (item.expectedSafetyText) {
                const lower = res.aiResponse.toLowerCase();
                assert.ok(
                    lower.includes(item.expectedSafetyText),
                    `Missed dose response must contain safe guidance '${item.expectedSafetyText}'`
                );
            }

            passed++;
        } catch (err) {
            console.error(`  ✗ Test failed: ${err.message}`);
            failed++;
        } finally {
            await delay(1200);
        }
    }

    console.log("\n==================================================");
    console.log(`LIVE SMOKE RESULTS: ${passed}/${queries.length} Passed, ${failed} Failed`);
    console.log("==================================================");

    await mongoose.disconnect();
    if (failed > 0) {
        process.exit(1);
    }
};

runLivePatientSmoke().catch((e) => {
    console.error("Live smoke fatal error:", e);
    process.exit(1);
});
