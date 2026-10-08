import mongoose from "mongoose";
import assert from "node:assert";
import UserModel from "../src/model/user.js";
import DoctorModel from "../src/model/doctor.js";
import PatientModel from "../src/model/patient.js";
import DepartmentModel from "../src/model/department.js";
import OrganizationModel from "../src/model/organization.js";
import AppointmentModel from "../src/model/appointment.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import DocumentChunkModel from "../src/model/documentChunk.js";
import AIChatHistoryModel from "../src/model/aiChatHistory.js";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runLiveChecks = async () => {
    console.log("==================================================");
    console.log("CAREFLOW AI PHASE 6 — 3 LIVE MANUAL CHECKS");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required in .env");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const runId = Date.now().toString(36);

    // Setup self-contained fixtures
    const org = await OrganizationModel.create({
        name: `Live Org ${runId}`,
        email: `live_${runId}@careflow.test`,
        phone: "9123456795",
        address: { street: "123 Live St", city: "Bangalore" },
        status: "ACTIVE"
    });

    const deptCardio = await DepartmentModel.create({
        name: "Cardiology",
        description: "Department of Cardiology",
        organizationId: org._id,
        status: "active"
    });

    const deptDerma = await DepartmentModel.create({
        name: "Dermatology",
        description: "Department of Dermatology",
        organizationId: org._id,
        status: "active"
    });

    const docUser = await UserModel.create({
        name: "Dr. Vikram Seth",
        email: `dr_vikram_${runId}@careflow.test`,
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
        qualification: "MBBS, MD",
        consultationFee: 750,
        available: [{ day: "monday", isAvailable: true, open: "09:00 AM", close: "05:00 PM" }]
    });

    const patUser = await UserModel.create({
        name: "Aarav Sharma",
        email: `aarav_${runId}@careflow.test`,
        phone: "9876543277",
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const patient = await PatientModel.create({
        userId: patUser._id,
        organizationId: org._id,
        gender: "male",
        bloodGroup: "A+"
    });

    const adminUser = await UserModel.create({
        name: "Admin Meenakshi",
        email: `admin_meena_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "admin",
        organizationId: org._id,
        isActive: true
    });

    // Upcoming appointment for Aarav with Dr. Vikram in Cardiology
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appt = await AppointmentModel.create({
        patientId: patient._id,
        doctorId: doctor._id,
        organizationId: org._id,
        departmentId: deptCardio._id,
        appointmentDate: tomorrow,
        startTime: "11:00",
        endTime: "11:30",
        status: "BOOKED",
        reason: "Cardiac evaluation",
        consultationType: "offline",
        paymentStatus: "paid"
    });

    // Shared medical record for Aarav
    const rec = await MedicalRecordModel.create({
        patientId: patient._id,
        organizationId: org._id,
        uploadedBy: patUser._id,
        uploadedByRole: "patient",
        title: "Echocardiogram Baseline",
        recordType: "lab_report",
        description: "Normal LV systolic function, EF 62%.",
        file: { url: "https://example.com/echo.pdf", publicId: "smoke_echo" },
        sharedWith: [{ doctorId: doctor._id, sharedAt: new Date() }]
    });

    await DocumentChunkModel.create({
        patientId: patient._id,
        organizationId: org._id,
        documentId: rec._id,
        documentType: "medical_record",
        chunkIndex: 0,
        textContent: "Echocardiogram Baseline Report for Aarav Sharma. LVEF 62%, normal LV dimensions.",
        text: "Echocardiogram Baseline Report for Aarav Sharma. LVEF 62%, normal LV dimensions.",
        embedding: new Array(768).fill(0.015),
        ocrConfidence: 95,
        isLowConfidence: false
    });

    const authPatient = {
        _id: String(patUser._id),
        id: String(patUser._id),
        name: patUser.name,
        email: patUser.email,
        role: "patient",
        organizationId: String(org._id)
    };

    const authDoctor = {
        _id: String(docUser._id),
        id: String(docUser._id),
        name: docUser.name,
        email: docUser.email,
        role: "doctor",
        organizationId: String(org._id)
    };

    const authAdmin = {
        _id: String(adminUser._id),
        id: String(adminUser._id),
        name: adminUser.name,
        email: adminUser.email,
        role: "admin",
        organizationId: String(org._id)
    };

    await AIChatHistoryModel.deleteMany({ userId: { $in: [authPatient.id, authDoctor.id, authAdmin.id] } });

    let passed = 0;

    try {
        // Live Check 1 (Patient): "What are my upcoming appointments?"
        console.log("\n▶ [CHECK 1 - Patient]: 'What are my upcoming appointments?'");
        {
            const res1 = await runOrchestratedWorkflow(authPatient, { message: "What are my upcoming appointments?" });
            console.log(`  ✓ ResponseType: ${res1.responseType} | ToolUsed: ${res1.toolUsed}`);
            console.log(`  AI Response: "${res1.aiResponse.substring(0, 150)}..."`);

            assert.ok(res1.success, `Patient check failed: ${res1.errorMessage}`);
            assert.ok(
                res1.aiResponse.includes("appointment") || res1.aiResponse.includes("11:00") || res1.aiResponse.includes("Vikram"),
                "Response must reflect patient's upcoming appointment"
            );
            assert.ok(!res1.aiResponse.includes("Dr. Dr."), "Must never include Dr. Dr.");
            assert.ok(!res1.aiResponse.includes("{"), "Must never include raw JSON");
            passed++;
            console.log("  PASS: Check 1 (Patient)");
        }
        await delay(1000);

        // Live Check 2 (Doctor): "Show me my next patient's shared medical records."
        console.log("\n▶ [CHECK 2 - Doctor]: 'Show me my next patient's shared medical records.'");
        {
            const res2 = await runOrchestratedWorkflow(authDoctor, { message: "Show me my next patient's shared medical records." });
            console.log(`  ✓ ResponseType: ${res2.responseType} | ToolUsed: ${res2.toolUsed}`);
            console.log(`  AI Response: "${res2.aiResponse.substring(0, 150)}..."`);

            assert.ok(res2.success, `Doctor check failed: ${res2.errorMessage}`);
            assert.ok(
                res2.aiResponse.includes("Echocardiogram") || res2.aiResponse.includes("shared medical record"),
                "Response must list the next patient's shared medical records"
            );
            assert.ok(!res2.aiResponse.includes("Dr. Dr."), "Must never include Dr. Dr.");
            assert.ok(!res2.aiResponse.includes("{"), "Must never include raw JSON");
            passed++;
            console.log("  PASS: Check 2 (Doctor)");
        }
        await delay(1000);

        // Live Check 3 (Admin): "Which department has the most appointments this month?"
        console.log("\n▶ [CHECK 3 - Admin]: 'Which department has the most appointments this month?'");
        {
            const res3 = await runOrchestratedWorkflow(authAdmin, { message: "Which department has the most appointments this month?" });
            console.log(`  ✓ ResponseType: ${res3.responseType} | ToolUsed: ${res3.toolUsed}`);
            console.log(`  AI Response: "${res3.aiResponse.substring(0, 150)}..."`);

            assert.ok(res3.success, `Admin check failed: ${res3.errorMessage}`);
            assert.ok(
                res3.aiResponse.includes("Cardiology") || res3.aiResponse.includes("department"),
                "Response must provide department volume metrics"
            );
            assert.ok(!res3.aiResponse.includes("{"), "Must never include raw JSON");
            passed++;
            console.log("  PASS: Check 3 (Admin)");
        }

    } finally {
        console.log("\nTearing down test fixtures...");
        await AIChatHistoryModel.deleteMany({ userId: { $in: [authPatient.id, authDoctor.id, authAdmin.id] } });
        await DocumentChunkModel.deleteMany({ organizationId: org._id });
        await MedicalRecordModel.deleteMany({ organizationId: org._id });
        await AppointmentModel.deleteMany({ organizationId: org._id });
        await PatientModel.deleteMany({ organizationId: org._id });
        await DoctorModel.deleteMany({ organizationId: org._id });
        await UserModel.deleteMany({ _id: { $in: [docUser._id, patUser._id, adminUser._id] } });
        await DepartmentModel.deleteMany({ organizationId: org._id });
        await OrganizationModel.deleteMany({ _id: org._id });
        await mongoose.disconnect();
        console.log("✓ Disconnected from MongoDB.\n");
    }

    console.log("==================================================");
    console.log(`LIVE CHECKS SUMMARY: ${passed}/3 PASSED`);
    console.log("==================================================");

    if (passed !== 3) {
        process.exit(1);
    }
};

runLiveChecks().catch(err => {
    console.error("Fatal error in live checks:", err);
    process.exit(1);
});
