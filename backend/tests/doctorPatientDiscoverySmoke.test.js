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

async function runDoctorPatientDiscoverySmoke() {
    console.log("==================================================");
    console.log("DOCTOR AI PATIENT RECORD DISCOVERY SMOKE TEST");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required in .env");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const runId = Date.now().toString(36);

    // ── FIXTURES SETUP ──────────────────────────────────────────────
    const org = await OrganizationModel.create({
        name: `CareFlow Hospital ${runId}`,
        email: `hosp_${runId}@careflow.test`,
        phone: "9123450099",
        address: { street: "100 Med Way", city: "Chennai" },
        status: "ACTIVE"
    });

    const deptCardio = await DepartmentModel.create({
        name: "Cardiology",
        description: "Department of Cardiovascular Sciences",
        organizationId: org._id,
        status: "active"
    });

    const docUser = await UserModel.create({
        name: "Dr. Ramesh Iyer",
        email: `dr_ramesh_${runId}@careflow.test`,
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
        consultationFee: 700
    });

    // Patient 1: Rajasekaran (has shared records)
    const patUser1 = await UserModel.create({
        name: "Rajasekaran",
        email: `raja_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const patient1 = await PatientModel.create({
        userId: patUser1._id,
        organizationId: org._id,
        phone: "9876540001",
        gender: "male"
    });

    // Patient 2: Priya Kumar (has appointment)
    const patUser2 = await UserModel.create({
        name: "Priya Kumar",
        email: `priya_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const patient2 = await PatientModel.create({
        userId: patUser2._id,
        organizationId: org._id,
        phone: "9876540002",
        gender: "female"
    });

    // Patient 3: Arun Kumar (has appointment)
    const patUser3 = await UserModel.create({
        name: "Arun Kumar",
        email: `arun_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const patient3 = await PatientModel.create({
        userId: patUser3._id,
        organizationId: org._id,
        phone: "9876540003",
        gender: "male"
    });

    // Create appointments for Priya and Arun with Doctor
    await AppointmentModel.create({
        patientId: patient2._id,
        doctorId: doctor._id,
        departmentId: deptCardio._id,
        organizationId: org._id,
        appointmentDate: new Date(),
        startTime: "10:00",
        endTime: "10:30",
        status: "BOOKED",
        consultationType: "offline",
        paymentMethod: "cash",
        paymentStatus: "pending"
    });

    await AppointmentModel.create({
        patientId: patient3._id,
        doctorId: doctor._id,
        departmentId: deptCardio._id,
        organizationId: org._id,
        appointmentDate: new Date(),
        startTime: "11:00",
        endTime: "11:30",
        status: "BOOKED",
        consultationType: "offline",
        paymentMethod: "cash",
        paymentStatus: "pending"
    });

    // Also create appointment for Rajasekaran
    const apptRaja = await AppointmentModel.create({
        patientId: patient1._id,
        doctorId: doctor._id,
        departmentId: deptCardio._id,
        organizationId: org._id,
        appointmentDate: new Date(),
        startTime: "12:00",
        endTime: "12:30",
        status: "BOOKED",
        consultationType: "offline",
        paymentMethod: "cash",
        paymentStatus: "pending"
    });

    // Create 2 shared medical records for Rajasekaran
    const rec1 = await MedicalRecordModel.create({
        patientId: patient1._id,
        organizationId: org._id,
        uploadedBy: patUser1._id,
        uploadedByRole: "patient",
        title: "Blood Test Report",
        recordType: "lab_report",
        description: "Routine hematology",
        file: {
            url: "https://res.cloudinary.com/careflow/raw/upload/blood_test",
            publicId: "blood_test",
            resourceType: "raw",
            mimeType: "application/pdf",
            fileName: "blood_test.pdf"
        },
        sharedWith: [{ doctorId: doctor._id, sharedAt: new Date() }]
    });

    const rec2 = await MedicalRecordModel.create({
        patientId: patient1._id,
        organizationId: org._id,
        uploadedBy: patUser1._id,
        uploadedByRole: "patient",
        title: "Echocardiogram",
        recordType: "scan",
        description: "Transthoracic echocardiogram",
        file: {
            url: "https://res.cloudinary.com/careflow/raw/upload/echo_report",
            publicId: "echo_report",
            resourceType: "raw",
            mimeType: "application/pdf",
            fileName: "echo_report.pdf"
        },
        sharedWith: [{ doctorId: doctor._id, sharedAt: new Date() }]
    });

    // Add document chunks for grounded search
    await DocumentChunkModel.create({
        patientId: patient1._id,
        organizationId: org._id,
        documentId: rec1._id,
        documentType: "medical_record",
        chunkIndex: 0,
        textContent: "Blood Test Report for Rajasekaran. Fasting Blood Glucose 98 mg/dL (Normal). Total Hemoglobin 14.2 g/dL. No acute abnormalities.",
        text: "Blood Test Report for Rajasekaran. Fasting Blood Glucose 98 mg/dL (Normal). Total Hemoglobin 14.2 g/dL. No acute abnormalities.",
        embedding: new Array(768).fill(0.01),
        ocrConfidence: 98,
        isLowConfidence: false
    });

    await DocumentChunkModel.create({
        patientId: patient1._id,
        organizationId: org._id,
        documentId: rec2._id,
        documentType: "medical_record",
        chunkIndex: 0,
        textContent: "Echocardiogram Report for Rajasekaran. Left ventricular ejection fraction 62%. Normal valvular morphology. No wall motion abnormality.",
        text: "Echocardiogram Report for Rajasekaran. Left ventricular ejection fraction 62%. Normal valvular morphology. No wall motion abnormality.",
        embedding: new Array(768).fill(0.02),
        ocrConfidence: 99,
        isLowConfidence: false
    });

    // Clean any prior chat history
    await AIChatHistoryModel.deleteMany({ userId: docUser._id });

    const authDoctor = {
        id: docUser._id.toString(),
        role: "doctor",
        organizationId: org._id.toString()
    };

    try {
        // ================================================================
        // CHECK 1: "What can you tell me about Patient Records?" → getDoctorAuthorizedPatients
        // ================================================================
        console.log("[CHECK 1] Asking: 'What can you tell me about Patient Records?'");
        const turn1 = await runOrchestratedWorkflow(authDoctor, {
            message: "What can you tell me about Patient Records?"
        });

        assert.strictEqual(turn1.success, true, "Turn 1 must succeed");
        assert.ok(
            turn1.toolUsed?.includes("getDoctorAuthorizedPatients"),
            `Expected toolUsed to contain getDoctorAuthorizedPatients, got: ${turn1.toolUsed}`
        );
        assert.ok(!turn1.aiResponse.includes("unable to understand"), "Must not return 'unable to understand'");
        assert.strictEqual(turn1.agentState?.stage, "SELECT_PATIENT", "Agent state stage must be SELECT_PATIENT");
        assert.ok(Array.isArray(turn1.agentState?.authorizedPatients), "Must persist authorizedPatients in agentState");
        console.log("  ✓ CHECK 1 PASSED: Routes to getDoctorAuthorizedPatients and sets SELECT_PATIENT stage.");

        // ================================================================
        // CHECK 2: Response contains real authorized patient names
        // ================================================================
        console.log("\n[CHECK 2] Verifying patient list in response...");
        assert.ok(turn1.aiResponse.includes("Rajasekaran"), "Must include Rajasekaran");
        assert.ok(turn1.aiResponse.includes("Priya Kumar"), "Must include Priya Kumar");
        assert.ok(turn1.aiResponse.includes("Arun Kumar"), "Must include Arun Kumar");
        assert.ok(!turn1.aiResponse.includes(patient1._id.toString()), "Must NEVER expose MongoDB ObjectIds");
        assert.ok(!turn1.aiResponse.includes(patient2._id.toString()), "Must NEVER expose MongoDB ObjectIds");
        console.log("  ✓ CHECK 2 PASSED: Returns real DB patients without exposing MongoDB IDs.");

        // ================================================================
        // CHECK 3: "Rajasekaran" → resolves real patient
        // ================================================================
        console.log("\n[CHECK 3] Doctor replies: 'Rajasekaran'");
        const turn2 = await runOrchestratedWorkflow(authDoctor, {
            message: "Rajasekaran"
        });

        assert.strictEqual(turn2.success, true);
        assert.strictEqual(turn2.agentState?.stage, "PATIENT_SELECTED");
        assert.strictEqual(String(turn2.agentState?.patientId), String(patient1._id));
        assert.ok(turn2.aiResponse.includes("Rajasekaran"));
        assert.ok(!turn2.aiResponse.includes("patientId"), "Must NEVER ask for patientId");
        console.log("  ✓ CHECK 3 PASSED: Resolves patient Rajasekaran without asking for patientId.");

        // ================================================================
        // CHECK 4: "Show shared medical records" → getSharedMedicalRecords
        // ================================================================
        console.log("\n[CHECK 4] Doctor replies: 'Show shared medical records'");
        const turn3 = await runOrchestratedWorkflow(authDoctor, {
            message: "Show shared medical records"
        });

        assert.strictEqual(turn3.success, true);
        assert.strictEqual(turn3.agentState?.stage, "SELECT_SHARED_RECORD");
        assert.ok(Array.isArray(turn3.agentState?.sharedMedicalRecords), "Must populate sharedMedicalRecords");
        assert.strictEqual(turn3.agentState?.sharedMedicalRecords.length, 2);
        assert.ok(turn3.aiResponse.includes("Blood Test Report"), "Must list Blood Test Report");
        assert.ok(turn3.aiResponse.includes("Echocardiogram"), "Must list Echocardiogram");
        assert.ok(!turn3.aiResponse.includes("appointmentId"), "Must NEVER ask for appointmentId");
        console.log("  ✓ CHECK 4 PASSED: Discovers shared medical records and presents numbered options.");

        // ================================================================
        // CHECK 5: "2" → resolves second shared record (Echocardiogram)
        // ================================================================
        console.log("\n[CHECK 5] Doctor replies: '2'");
        const turn4 = await runOrchestratedWorkflow(authDoctor, {
            message: "2"
        });

        assert.strictEqual(turn4.success, true);
        assert.strictEqual(turn4.agentState?.stage, "RECORD_SELECTED");
        const t4Lower = turn4.aiResponse.toLowerCase();
        assert.ok(
            t4Lower.includes("ejection fraction") || t4Lower.includes("echocardiogram") || t4Lower.includes("valvular") || t4Lower.includes("wall motion"),
            "Grounded response must contain findings from Echocardiogram"
        );
        console.log("  ✓ CHECK 5 PASSED: '2' resolves record #2 (Echocardiogram) with grounded clinical answer.");

        // ================================================================
        // CHECK 6: "all" → retrieves all authorized shared records
        // ================================================================
        console.log("\n[CHECK 6] Doctor replies: 'all'");
        const turn5 = await runOrchestratedWorkflow(authDoctor, {
            message: "all"
        });

        assert.strictEqual(turn5.success, true);
        const t5Lower = turn5.aiResponse.toLowerCase();
        assert.ok(
            t5Lower.includes("blood") || t5Lower.includes("glucose") || t5Lower.includes("hemoglobin") || t5Lower.includes("echocardiogram"),
            "Response for 'all' must summarize authorized shared records"
        );
        console.log("  ✓ CHECK 6 PASSED: 'all' summarizes all authorized shared records.");

        // ================================================================
        // LIVE CONVERSATION VERIFICATION: Complete End-to-End Multi-Turn
        // ================================================================
        console.log("\n==================================================");
        console.log("LIVE MULTI-TURN CONVERSATION VERIFICATION");
        console.log("==================================================");
        await AIChatHistoryModel.deleteMany({ userId: docUser._id });

        console.log("Doctor: 'What can you tell me about Patient Records?'");
        const live1 = await runOrchestratedWorkflow(authDoctor, { message: "What can you tell me about Patient Records?" });
        console.log(`CareFlow AI:\n${live1.aiResponse}\n`);
        assert.ok(live1.aiResponse.includes("Rajasekaran"));

        console.log("Doctor: 'Rajasekaran'");
        const live2 = await runOrchestratedWorkflow(authDoctor, { message: "Rajasekaran" });
        console.log(`CareFlow AI:\n${live2.aiResponse}\n`);
        assert.ok(live2.aiResponse.includes("Rajasekaran"));

        console.log("Doctor: 'Show me his shared medical records'");
        const live3 = await runOrchestratedWorkflow(authDoctor, { message: "Show me his shared medical records" });
        console.log(`CareFlow AI:\n${live3.aiResponse}\n`);
        assert.ok(live3.aiResponse.includes("1. Blood Test Report"));
        assert.ok(live3.aiResponse.includes("2. Echocardiogram"));

        console.log("Doctor: '2'");
        const live4 = await runOrchestratedWorkflow(authDoctor, { message: "2" });
        console.log(`CareFlow AI:\n${live4.aiResponse}\n`);
        assert.ok(live4.aiResponse.toLowerCase().includes("ejection fraction") || live4.aiResponse.toLowerCase().includes("echocardiogram"));

        console.log("==================================================");
        console.log("✓ ALL 6 CHECKS + LIVE CONVERSATION PASSED PERFECTLY");
        console.log("==================================================");

    } finally {
        console.log("\n[Cleanup]: Cleaning test fixtures...");
        await AIChatHistoryModel.deleteMany({ userId: docUser._id });
        await DocumentChunkModel.deleteMany({ organizationId: org._id });
        await MedicalRecordModel.deleteMany({ organizationId: org._id });
        await AppointmentModel.deleteMany({ organizationId: org._id });
        await PatientModel.deleteMany({ _id: { $in: [patient1._id, patient2._id, patient3._id] } });
        await DoctorModel.deleteMany({ _id: doctor._id });
        await DepartmentModel.deleteMany({ _id: deptCardio._id });
        await UserModel.deleteMany({ _id: { $in: [docUser._id, patUser1._id, patUser2._id, patUser3._id] } });
        await OrganizationModel.deleteMany({ _id: org._id });
        await mongoose.disconnect();
    }
}

runDoctorPatientDiscoverySmoke().catch((err) => {
    console.error("FATAL ERROR IN DOCTOR DISCOVERY SMOKE:", err);
    process.exit(1);
});
