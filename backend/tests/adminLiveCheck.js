import mongoose from "mongoose";
import assert from "node:assert";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";
import { geminiProvider } from "../src/service/ai/providers/geminiProvider.js";
import UserModel from "../src/model/user.js";
import DoctorModel from "../src/model/doctor.js";
import PatientModel from "../src/model/patient.js";
import OrganizationModel from "../src/model/organization.js";
import DepartmentModel from "../src/model/department.js";
import AppointmentModel from "../src/model/appointment.js";
import AIChatHistoryModel from "../src/model/aiChatHistory.js";

const runAdminLiveCheck = async () => {
    console.log("==================================================");
    console.log("CAREFLOW AI — ADMIN LIVE QUERY VERIFICATION");
    console.log("==================================================");

    await mongoose.connect(process.env.DB_URL);
    const runId = Date.now().toString(36);

    // Setup fixtures
    const org = await OrganizationModel.create({
        name: `Live Org ${runId}`,
        email: `live_${runId}@careflow.test`,
        phone: "9123456799",
        address: { street: "100 Live St", city: "Bangalore" },
        status: "ACTIVE"
    });

    const deptCardio = await DepartmentModel.create({
        name: "Cardiology",
        description: "Heart and Vascular Care",
        organizationId: org._id,
        status: "active"
    });

    const docUser = await UserModel.create({
        name: "Dr. Sanjay Gupta",
        email: `dr_sanjay_${runId}@careflow.test`,
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
        consultationFee: 750
    });

    const patUser = await UserModel.create({
        name: "Rohan Verma",
        email: `rohan_${runId}@careflow.test`,
        phone: "9876543299",
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const patient = await PatientModel.create({
        userId: patUser._id,
        organizationId: org._id,
        gender: "male",
        bloodGroup: "O+"
    });

    const adminUser = await UserModel.create({
        name: "Admin Pooja",
        email: `admin_pooja_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "admin",
        organizationId: org._id,
        isActive: true
    });

    // Create 2 appointments in Cardiology for this month
    const now = new Date();
    const apptDate = new Date(now.getFullYear(), now.getMonth(), 15, 10, 0); // Mid-current month

    await AppointmentModel.create({
        patientId: patient._id,
        doctorId: doctor._id,
        organizationId: org._id,
        departmentId: deptCardio._id,
        appointmentDate: apptDate,
        startTime: "10:00",
        endTime: "10:30",
        status: "COMPLETED",
        reason: "Cardio Checkup",
        consultationType: "offline",
        paymentStatus: "paid"
    });

    const authAdmin = {
        id: String(adminUser._id),
        _id: String(adminUser._id),
        role: "admin",
        organizationId: org._id
    };

    try {
        console.log("\n▶ Running Admin query: 'Which department has the most appointments this month?'");
        
        // Track Gemini calls
        geminiProvider.resetCooldown();
        let geminiCalls = 0;
        const origGenerate = geminiProvider.generate.bind(geminiProvider);
        geminiProvider.generate = async (...args) => {
            geminiCalls++;
            return await origGenerate(...args);
        };

        const res = await runOrchestratedWorkflow(authAdmin, {
            message: "Which department has the most appointments this month?"
        });

        console.log("\n[Admin Live Query Output]:");
        console.log(`  Success:      ${res.success}`);
        console.log(`  ResponseType: ${res.responseType}`);
        console.log(`  ToolUsed:     ${res.toolUsed}`);
        console.log(`  Gemini Calls: ${geminiCalls}`);
        console.log(`  Full AI Response:\n"${res.aiResponse}"\n`);

        assert.ok(res.success, `Workflow failed: ${res.errorMessage}`);
        assert.ok(res.aiResponse.includes("Cardiology"), "Response must mention Cardiology");

        // Verify date range uses October 1 -> October 31 (calendar month boundaries)
        const normalized = res.aiResponse.replace(/[\u202F\u00A0]/g, ' ').replace(/[\u2013\u2014]/g, '-');
        const hasOct1 = normalized.includes("October 1") || normalized.includes("Oct 1") || normalized.includes("2026-10-01");
        const hasOct31 = normalized.includes("October 31") || normalized.includes("Oct 31") || normalized.includes("2026-10-31");
        const hasNoSep30 = !normalized.includes("September 30") && !normalized.includes("Sep 30") && !normalized.includes("2026-09-30");

        console.log(`  ✓ Date Range Check:`);
        console.log(`    Contains start (October 1 / 2026-10-01): ${hasOct1}`);
        console.log(`    Contains end (October 31 / 2026-10-31):  ${hasOct31}`);
        console.log(`    No incorrect rollback (Sep 30):          ${hasNoSep30}`);

        assert.ok(hasOct1 && hasOct31, "Response must use October 1 → October 31");
        assert.ok(hasNoSep30, "Response must not contain September 30");

        // Verify provider retry limit: Gemini called at most 1 time before fallback
        console.log(`\n  ✓ Provider Cooldown Check:`);
        console.log(`    Gemini calls made during request: ${geminiCalls}`);
        assert.ok(geminiCalls <= 1, `Gemini must only be called at most once during request, got ${geminiCalls}`);

        console.log("\n==================================================");
        console.log("ADMIN LIVE QUERY: VERIFIED AND PASSED");
        console.log("==================================================");
    } finally {
        await AIChatHistoryModel.deleteMany({ userId: authAdmin.id });
        await AppointmentModel.deleteMany({ organizationId: org._id });
        await PatientModel.deleteMany({ organizationId: org._id });
        await DoctorModel.deleteMany({ organizationId: org._id });
        await UserModel.deleteMany({ _id: { $in: [docUser._id, patUser._id, adminUser._id] } });
        await DepartmentModel.deleteMany({ organizationId: org._id });
        await OrganizationModel.deleteMany({ _id: org._id });
        await mongoose.disconnect();
    }
};

runAdminLiveCheck().catch(err => {
    console.error("Admin live check failed:", err);
    process.exit(1);
});
