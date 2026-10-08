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
import { RESPONSE_TYPES } from "../src/service/ai/responseContract.js";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runLivePhase5Smoke = async () => {
    console.log("==================================================");
    console.log("CAREFLOW AI PHASE 5 — LIVE SMOKE TEST");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required in .env");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const runId = Date.now().toString(36);

    // Setup Fixtures: Org A and Org B
    const orgA = await OrganizationModel.create({
        name: `Smoke Apex Clinic ${runId}`,
        email: `apex_${runId}@careflow.test`,
        phone: "9123456791",
        address: { street: "100 Health Way", city: "Bangalore" },
        status: "ACTIVE"
    });

    const orgB = await OrganizationModel.create({
        name: `Smoke Beacon Clinic ${runId}`,
        email: `beacon_${runId}@careflow.test`,
        phone: "9123456792",
        address: { street: "200 Metro Rd", city: "Delhi" },
        status: "ACTIVE"
    });

    const deptCardio = await DepartmentModel.create({
        name: "Cardiology",
        description: "Department of Cardiology",
        organizationId: orgA._id,
        status: "active"
    });

    const deptNeuro = await DepartmentModel.create({
        name: "Neurology",
        description: "Department of Neurology",
        organizationId: orgA._id,
        status: "active"
    });

    const docUser = await UserModel.create({
        name: "Dr. Kabir Rao",
        email: `dr_kabir_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "doctor",
        organizationId: orgA._id,
        isActive: true
    });

    const doctor = await DoctorModel.create({
        userId: docUser._id,
        organizationId: orgA._id,
        departmentId: deptCardio._id,
        specialization: "Cardiology",
        qualification: "MBBS, MD",
        consultationFee: 700,
        available: [{ day: "monday", isAvailable: true, open: "09:00 AM", close: "05:00 PM" }]
    });

    const patUser = await UserModel.create({
        name: "Meera Patel",
        email: `meera_${runId}@careflow.test`,
        phone: "9876543288",
        password: "HashPassword123!",
        role: "patient",
        organizationId: orgA._id,
        isActive: true
    });

    const patient = await PatientModel.create({
        userId: patUser._id,
        organizationId: orgA._id,
        gender: "female",
        bloodGroup: "O+",
        allergies: ["Sulfa"]
    });

    const adminUser = await UserModel.create({
        name: "Admin Sanjay",
        email: `admin_sanjay_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "admin",
        organizationId: orgA._id,
        isActive: true
    });

    const superAdminUser = await UserModel.create({
        name: "SuperAdmin Vikram",
        email: `super_vikram_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "super_admin",
        isActive: true
    });

    // Create appointments in Org A (Cardiology: 2, Neurology: 1)
    const apptDate = new Date();
    await AppointmentModel.create([
        {
            patientId: patient._id,
            doctorId: doctor._id,
            organizationId: orgA._id,
            departmentId: deptCardio._id,
            appointmentDate: apptDate,
            startTime: "09:30",
            endTime: "10:00",
            status: "COMPLETED",
            consultationType: "offline",
            paymentStatus: "paid"
        },
        {
            patientId: patient._id,
            doctorId: doctor._id,
            organizationId: orgA._id,
            departmentId: deptCardio._id,
            appointmentDate: apptDate,
            startTime: "10:30",
            endTime: "11:00",
            status: "BOOKED",
            consultationType: "offline",
            paymentStatus: "paid"
        },
        {
            patientId: patient._id,
            doctorId: doctor._id,
            organizationId: orgA._id,
            departmentId: deptNeuro._id,
            appointmentDate: apptDate,
            startTime: "11:30",
            endTime: "12:00",
            status: "BOOKED",
            consultationType: "offline",
            paymentStatus: "pending"
        }
    ]);

    const deptB = await DepartmentModel.create({
        name: "General Medicine",
        description: "Department of General Medicine",
        organizationId: orgB._id,
        status: "active"
    });

    // Create 1 appointment in Org B
    await AppointmentModel.create({
        patientId: patient._id,
        doctorId: doctor._id,
        organizationId: orgB._id,
        departmentId: deptB._id,
        appointmentDate: apptDate,
        startTime: "14:00",
        endTime: "14:30",
        status: "COMPLETED",
        consultationType: "offline",
        paymentStatus: "paid"
    });

    // Create 2 Shared Medical Records for Patient Meera Patel in Org A
    const rec1 = await MedicalRecordModel.create({
        patientId: patient._id,
        organizationId: orgA._id,
        uploadedBy: patUser._id,
        uploadedByRole: "patient",
        title: "Blood Chemistry Panel",
        recordType: "lab_report",
        description: "Fasting blood glucose 98 mg/dL, HbA1c 5.4%, total cholesterol 182 mg/dL.",
        file: { url: "https://example.com/blood.pdf", publicId: "smoke_blood" },
        sharedWith: [{ doctorId: doctor._id, sharedAt: new Date() }]
    });

    const rec2 = await MedicalRecordModel.create({
        patientId: patient._id,
        organizationId: orgA._id,
        uploadedBy: patUser._id,
        uploadedByRole: "patient",
        title: "Echocardiogram Report",
        recordType: "lab_report",
        description: "Normal LV cavity size and systolic function. LVEF 64%. No regional wall motion abnormalities.",
        file: { url: "https://example.com/echo.pdf", publicId: "smoke_echo" },
        sharedWith: [{ doctorId: doctor._id, sharedAt: new Date() }]
    });

    await DocumentChunkModel.create([
        {
            patientId: patient._id,
            organizationId: orgA._id,
            documentId: rec1._id,
            documentType: "medical_record",
            chunkIndex: 0,
            textContent: "Blood Chemistry Panel for Meera Patel. Fasting blood glucose: 98 mg/dL. HbA1c: 5.4%. Total cholesterol: 182 mg/dL. HDL: 52 mg/dL.",
            text: "Blood Chemistry Panel for Meera Patel. Fasting blood glucose: 98 mg/dL. HbA1c: 5.4%. Total cholesterol: 182 mg/dL. HDL: 52 mg/dL.",
            embedding: new Array(768).fill(0.012),
            ocrConfidence: 94,
            isLowConfidence: false
        },
        {
            patientId: patient._id,
            organizationId: orgA._id,
            documentId: rec2._id,
            documentType: "medical_record",
            chunkIndex: 0,
            textContent: "Echocardiogram Report for Meera Patel. Normal LV cavity size, LVEF 64%. Trace mitral regurgitation, otherwise unremarkable.",
            text: "Echocardiogram Report for Meera Patel. Normal LV cavity size, LVEF 64%. Trace mitral regurgitation, otherwise unremarkable.",
            embedding: new Array(768).fill(0.024),
            ocrConfidence: 96,
            isLowConfidence: false
        }
    ]);

    const authDoctor = {
        _id: String(docUser._id),
        id: String(docUser._id),
        name: docUser.name,
        email: docUser.email,
        role: "doctor",
        organizationId: String(orgA._id)
    };

    const authAdmin = {
        _id: String(adminUser._id),
        id: String(adminUser._id),
        name: adminUser.name,
        email: adminUser.email,
        role: "admin",
        organizationId: String(orgA._id)
    };

    const authSuperAdmin = {
        _id: String(superAdminUser._id),
        id: String(superAdminUser._id),
        name: superAdminUser.name,
        email: superAdminUser.email,
        role: "super_admin",
        organizationId: null
    };

    // Clean existing chat histories and seed doctor active patient context
    await AIChatHistoryModel.deleteMany({ userId: { $in: [authDoctor.id, authAdmin.id, authSuperAdmin.id] } });
    await AIChatHistoryModel.create({
        userId: authDoctor.id,
        organizationId: orgA._id,
        messages: [
            {
                role: "assistant",
                text: "Opened medical chart for patient Meera Patel.",
                agentState: {
                    patientId: String(patient._id),
                    patientName: "Meera Patel"
                }
            }
        ]
    });

    let passed = 0;
    let failed = 0;

    try {
        // Query 1 (Doctor): "Show me this patient's shared medical records."
        console.log("\n▶ [LIVE SMOKE 1] Doctor: Broad Shared Records Query");
        console.log('  Query: "Show me this patient\'s shared medical records."');
        {
            const res1 = await runOrchestratedWorkflow(authDoctor, { message: "Show me this patient's shared medical records." });
            console.log(`  ✓ Status: ${res1.status} | ResponseType: ${res1.responseType}`);
            console.log(`  Tool Used: ${res1.toolUsed}`);
            console.log(`  AI Response: "${res1.aiResponse.substring(0, 150)}..."`);

            assert.ok(res1.success, `Query 1 failed: ${res1.errorMessage}`);
            assert.ok(
                res1.aiResponse.includes("1.") && res1.aiResponse.includes("2."),
                "Query 1 must list shared records numbered without auto-selecting"
            );
            assert.ok(
                res1.aiResponse.toLowerCase().includes("which one") || res1.aiResponse.toLowerCase().includes("all"),
                "Query 1 must prompt doctor to choose a number or 'all'"
            );
            passed++;
            console.log("  PASS: Live Smoke 1");
        }
        await delay(1000);

        // Query 2 (Doctor): "2"
        console.log("\n▶ [LIVE SMOKE 2] Doctor: Conversational Number Selection ('2')");
        console.log('  Query: "2"');
        {
            const res2 = await runOrchestratedWorkflow(authDoctor, { message: "2" });
            console.log(`  ✓ Status: ${res2.status} | ResponseType: ${res2.responseType}`);
            console.log(`  Tool Used: ${res2.toolUsed}`);
            console.log(`  AI Response: "${(res2.aiResponse || "").substring(0, 150)}..."`);

            assert.ok(res2.success, `Query 2 failed: ${res2.errorMessage}`);
            assert.strictEqual(res2.toolUsed, "searchPatientDocuments");
            assert.ok(
                res2.aiResponse && res2.aiResponse.length > 0,
                "Query 2 must return grounded clinical answer for record 2"
            );
            assert.ok(
                Array.isArray(res2.citations) && res2.citations.length > 0,
                "Query 2 must provide safe citations"
            );
            passed++;
            console.log("  PASS: Live Smoke 2");
        }
        await delay(1000);

        // Query 3 (Doctor): "all"
        console.log("\n▶ [LIVE SMOKE 3] Doctor: Conversational Multi-Record Selection ('all')");
        console.log('  Query: "all"');
        {
            const res3 = await runOrchestratedWorkflow(authDoctor, { message: "all" });
            console.log(`  ✓ Status: ${res3.status} | ResponseType: ${res3.responseType}`);
            console.log(`  Tool Used: ${res3.toolUsed}`);
            console.log(`  AI Response: "${(res3.aiResponse || "").substring(0, 150)}..."`);

            assert.ok(res3.success, `Query 3 failed: ${res3.errorMessage}`);
            assert.strictEqual(res3.toolUsed, "searchPatientDocuments");
            assert.ok(
                res3.aiResponse && res3.aiResponse.length > 0,
                "Query 3 must return synthesized findings across all shared records"
            );
            passed++;
            console.log("  PASS: Live Smoke 3");
        }
        await delay(1000);

        // Query 4 (Admin): "Which department has the most appointments this month?"
        console.log("\n▶ [LIVE SMOKE 4] Admin: Department Volume Analytics");
        console.log('  Query: "Which department has the most appointments this month?"');
        {
            const res4 = await runOrchestratedWorkflow(authAdmin, { message: "Which department has the most appointments this month?" });
            console.log(`  ✓ Status: ${res4.status} | ResponseType: ${res4.responseType}`);
            console.log(`  Tool Used: ${res4.toolUsed}`);
            console.log(`  AI Response: "${(res4.aiResponse || "").substring(0, 150)}..."`);

            assert.ok(res4.success, `Query 4 failed: ${res4.errorMessage}`);
            assert.ok(
                ["getClinicStats", "getHealthcareAnalytics"].includes(res4.toolUsed),
                `Expected analytics tool, received: ${res4.toolUsed}`
            );
            assert.ok(
                res4.aiResponse && (res4.aiResponse.includes("Cardiology") || res4.aiResponse.includes("department")),
                "Query 4 response must reflect department appointment distribution"
            );
            passed++;
            console.log("  PASS: Live Smoke 4");
        }
        await delay(1000);

        // Query 5 (Super Admin): "Which organization has the most appointments this month?"
        console.log("\n▶ [LIVE SMOKE 5] Super Admin: Cross-Organization Volume Analytics");
        console.log('  Query: "Which organization has the most appointments this month?"');
        {
            const res5 = await runOrchestratedWorkflow(authSuperAdmin, { message: "Which organization has the most appointments this month?" });
            console.log(`  ✓ Status: ${res5.status} | ResponseType: ${res5.responseType}`);
            console.log(`  Tool Used: ${res5.toolUsed}`);
            console.log(`  AI Response: "${(res5.aiResponse || "").substring(0, 150)}..."`);

            assert.ok(res5.success, `Query 5 failed: ${res5.errorMessage}`);
            assert.ok(
                ["compareOrganizations", "getHealthcareAnalytics", "getClinicStats", "getPlatformStats"].includes(res5.toolUsed),
                `Expected super admin analytics tool, received: ${res5.toolUsed}`
            );
            assert.ok(
                res5.aiResponse && res5.aiResponse.length > 0,
                "Query 5 response must provide cross-tenant comparison or volume answer"
            );
            passed++;
            console.log("  PASS: Live Smoke 5");
        }

    } catch (err) {
        failed++;
        console.error("Live Smoke Error:", err);
    } finally {
        console.log("\nTearing down Phase 5 Live Smoke test fixtures...");
        await AIChatHistoryModel.deleteMany({ userId: { $in: [authDoctor.id, authAdmin.id, authSuperAdmin.id] } });
        await DocumentChunkModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await MedicalRecordModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await AppointmentModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await PatientModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await DoctorModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await DepartmentModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await UserModel.deleteMany({ _id: { $in: [docUser._id, patUser._id, adminUser._id, superAdminUser._id] } });
        await OrganizationModel.deleteMany({ _id: { $in: [orgA._id, orgB._id] } });
        await mongoose.disconnect();
        console.log("✓ Disconnected from MongoDB.\n");
    }

    console.log("==================================================");
    console.log(`PHASE 5 LIVE SMOKE SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log("==================================================");

    if (failed > 0 || passed !== 5) {
        process.exit(1);
    }
};

runLivePhase5Smoke().catch(err => {
    console.error("Fatal error in live Phase 5 smoke:", err);
    process.exit(1);
});
