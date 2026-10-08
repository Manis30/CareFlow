import mongoose from "mongoose";
import assert from "node:assert";
import UserModel from "../src/model/user.js";
import DoctorModel from "../src/model/doctor.js";
import PatientModel from "../src/model/patient.js";
import DepartmentModel from "../src/model/department.js";
import OrganizationModel from "../src/model/organization.js";
import AppointmentModel from "../src/model/appointment.js";
import PrescriptionModel from "../src/model/prescription.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import DocumentChunkModel from "../src/model/documentChunk.js";
import AIChatHistoryModel from "../src/model/aiChatHistory.js";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";
import { RESPONSE_TYPES } from "../src/service/ai/responseContract.js";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runLiveDoctorSmoke = async () => {
    console.log("==================================================");
    console.log("CAREFLOW AI PHASE 4 — LIVE DOCTOR COPILOT SMOKE");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required in .env");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const runId = Date.now().toString(36);

    // Setup self-contained fixtures for live smoke run
    const org = await OrganizationModel.create({
        name: `Smoke Clinic ${runId}`,
        email: `smoke_clinic_${runId}@careflow.test`,
        phone: "9123456799",
        address: { street: "123 Smoke Way", city: "Mumbai" },
        status: "ACTIVE"
    });

    const dept = await DepartmentModel.create({
        name: "Cardiology",
        description: "Department of Cardiology",
        organizationId: org._id,
        status: "active"
    });

    const docUser = await UserModel.create({
        name: "Dr. Aryan Sen",
        email: `dr_aryan_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "doctor",
        organizationId: org._id,
        isActive: true
    });

    const doctor = await DoctorModel.create({
        userId: docUser._id,
        organizationId: org._id,
        departmentId: dept._id,
        specialization: "Cardiology",
        qualification: "MBBS, MD",
        consultationFee: 600,
        available: [{ day: "monday", isAvailable: true, open: "09:00 AM", close: "05:00 PM" }]
    });

    const patUser = await UserModel.create({
        name: "Priya Sharma",
        email: `priya_smoke_${runId}@careflow.test`,
        phone: "9876543299",
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const patient = await PatientModel.create({
        userId: patUser._id,
        organizationId: org._id,
        gender: "female",
        bloodGroup: "B+",
        allergies: ["Penicillin"]
    });

    const appt = await AppointmentModel.create({
        patientId: patient._id,
        doctorId: doctor._id,
        organizationId: org._id,
        departmentId: dept._id,
        appointmentDate: new Date(),
        startTime: "10:00",
        endTime: "10:30",
        status: "BOOKED",
        reason: "Follow-up for mild hypertension and occasional dizziness",
        consultationType: "offline",
        paymentStatus: "paid"
    });

    const rx = await PrescriptionModel.create({
        patientId: patient._id,
        doctorId: doctor._id,
        organizationId: org._id,
        appointmentId: appt._id,
        diagnosis: "Essential Hypertension",
        medicines: [
            {
                medicineName: "Amlodipine",
                dosage: "5mg",
                frequency: "Once daily",
                duration: "30 days",
                instructions: "Take in the morning"
            }
        ]
    });

    const rec = await MedicalRecordModel.create({
        patientId: patient._id,
        organizationId: org._id,
        appointmentId: appt._id,
        uploadedBy: docUser._id,
        uploadedByRole: "doctor",
        title: "Echocardiogram Report",
        recordType: "lab_report",
        description: "Echocardiogram: Normal LV function, EF 62%, mild concentric LVH due to chronic hypertension.",
        file: { url: "https://example.com/echo.pdf", publicId: "smoke_echo" },
        sharedWith: [{ doctorId: doctor._id, sharedAt: new Date() }]
    });

    await DocumentChunkModel.create({
        patientId: patient._id,
        organizationId: org._id,
        documentId: rec._id,
        documentType: "medical_record",
        chunkIndex: 0,
        textContent: "Echocardiogram Report for Priya Sharma. Diagnosis: Mild concentric LVH due to chronic hypertension. LVEF 62%.",
        text: "Echocardiogram Report for Priya Sharma. Diagnosis: Mild concentric LVH due to chronic hypertension. LVEF 62%.",
        embedding: new Array(768).fill(0.015),
        ocrConfidence: 95,
        isLowConfidence: false
    });

    const authDoctorUser = {
        _id: String(docUser._id),
        id: String(docUser._id),
        name: docUser.name,
        email: docUser.email,
        role: "doctor",
        organizationId: String(org._id)
    };

    // Clear stale chat history
    await AIChatHistoryModel.deleteMany({ userId: authDoctorUser.id });

    const liveQueries = [
        {
            name: "Smoke 1: Doctor Patient Roster Inquiry",
            query: "Who are my patients today?",
            expectedResponseTypes: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.LIVE_DATA, RESPONSE_TYPES.CLARIFICATION, "ANSWER", "LIVE_DATA", "CLARIFICATION"]
        },
        {
            name: "Smoke 2: Pre-Visit Clinical Brief",
            query: "Prepare a pre-visit brief for Priya Sharma",
            expectedResponseTypes: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.LIVE_DATA, RESPONSE_TYPES.CLARIFICATION, "PRE_VISIT_BRIEF", "ANSWER", "LIVE_DATA", "CLARIFICATION"]
        },
        {
            name: "Smoke 3: Authorized Clinical RAG Question",
            query: "What did the echocardiogram report show for Priya Sharma?",
            expectedResponseTypes: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.LIVE_DATA, RESPONSE_TYPES.CLARIFICATION, "ANSWER", "LIVE_DATA", "CLARIFICATION"]
        },
        {
            name: "Smoke 4: Safe SOAP Note Drafting Assistance",
            query: "Draft a clinical note for Priya Sharma with symptoms of mild dizziness",
            expectedResponseTypes: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.LIVE_DATA, RESPONSE_TYPES.CLARIFICATION, "DRAFT_REQUIRING_REVIEW", "ANSWER", "LIVE_DATA", "CLARIFICATION"]
        },
        {
            name: "Smoke 5: Prescription Drafting Assistance with Safety Check",
            query: "Draft a prescription of Amlodipine 10mg for Priya Sharma",
            expectedResponseTypes: [RESPONSE_TYPES.ANSWER, RESPONSE_TYPES.LIVE_DATA, RESPONSE_TYPES.CLARIFICATION, "DRAFT_REQUIRING_REVIEW", "ANSWER", "LIVE_DATA", "CLARIFICATION"]
        }
    ];

    let passed = 0;
    let failed = 0;

    try {
        for (const item of liveQueries) {
            console.log(`\n▶ [LIVE] ${item.name}`);
            console.log(`  Doctor Query: "${item.query}"`);
            const start = Date.now();
            try {
                const res = await runOrchestratedWorkflow(authDoctorUser, { message: item.query });
                const duration = Date.now() - start;

                const toolsStr = Array.isArray(res.toolUsed) ? res.toolUsed.join(", ") : (res.toolUsed || "none");
                console.log(`  ✓ Status: ${res.status} | ResponseType: ${res.responseType} | Latency: ${duration}ms`);
                console.log(`  Tool(s) Used: [${toolsStr}]`);
                console.log(`  AI Response Snippet: "${(res.aiResponse || "").substring(0, 140)}..."`);

                assert.ok(res.success, `Workflow reported error: ${res.errorMessage}`);
                assert.ok(
                    item.expectedResponseTypes.includes(res.responseType),
                    `Unexpected responseType: ${res.responseType} (expected one of ${item.expectedResponseTypes.join(", ")})`
                );
                assert.ok(res.aiResponse && res.aiResponse.trim().length > 0, "Response must not be empty");

                passed++;
                console.log(`  PASS: ${item.name}`);
            } catch (err) {
                failed++;
                console.error(`  FAIL: ${item.name} -> ${err.message}`);
            }
            await delay(1200);
        }
    } finally {
        console.log("\nCleaning up live smoke test fixtures...");
        await AIChatHistoryModel.deleteMany({ userId: authDoctorUser.id });
        await DocumentChunkModel.deleteMany({ organizationId: org._id });
        await MedicalRecordModel.deleteMany({ organizationId: org._id });
        await PrescriptionModel.deleteMany({ organizationId: org._id });
        await AppointmentModel.deleteMany({ organizationId: org._id });
        await PatientModel.deleteMany({ organizationId: org._id });
        await DoctorModel.deleteMany({ organizationId: org._id });
        await UserModel.deleteMany({ organizationId: org._id });
        await DepartmentModel.deleteMany({ organizationId: org._id });
        await OrganizationModel.deleteMany({ _id: org._id });
        await mongoose.disconnect();
        console.log("✓ Disconnected from MongoDB.\n");
    }

    console.log("==================================================");
    console.log(`LIVE SMOKE SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log("==================================================");

    if (failed > 0) {
        process.exit(1);
    }
};

runLiveDoctorSmoke().catch(err => {
    console.error("Fatal error in live doctor smoke:", err);
    process.exit(1);
});
