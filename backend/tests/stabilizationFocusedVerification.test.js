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
import {
    getDoctorTodayAppointmentsService,
    getDoctorUpcomingAppointmentsService,
    getMyAppointmentsService
} from "../src/service/appointment.js";

async function runStabilizationVerification() {
    console.log("==================================================");
    console.log("CAREFLOW AI — STABILIZATION FOCUSED VERIFICATION");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required in .env");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const runId = Date.now().toString(36);

    const org = await OrganizationModel.create({
        name: `CareFlow Hospital ${runId}`,
        email: `hosp_${runId}@careflow.test`,
        phone: "9123450099",
        address: { street: "100 Med Way", city: "Chennai" },
        status: "ACTIVE"
    });

    const dept = await DepartmentModel.create({
        name: "General Medicine",
        description: "General medicine department",
        organizationId: org._id,
        status: "active"
    });

    const docUser = await UserModel.create({
        name: "Dr. Ananya Sen",
        email: `dr_ananya_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "doctor",
        organizationId: org._id,
        isActive: true
    });

    const doctor = await DoctorModel.create({
        userId: docUser._id,
        organizationId: org._id,
        departmentId: dept._id,
        specialization: "General Medicine",
        qualification: "MBBS, MD",
        consultationFee: 600
    });

    // Patient: Aarav Sharma
    const patUser = await UserModel.create({
        name: "Aarav Sharma",
        email: `aarav_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const patient = await PatientModel.create({
        userId: patUser._id,
        organizationId: org._id,
        phone: "9876541111",
        gender: "male"
    });

    // 1 Active Appointment Today (offline)
    const today = new Date();
    await AppointmentModel.create({
        patientId: patient._id,
        doctorId: doctor._id,
        departmentId: dept._id,
        organizationId: org._id,
        appointmentDate: today,
        startTime: "10:00",
        endTime: "10:30",
        status: "BOOKED",
        consultationType: "offline",
        paymentMethod: "cash",
        paymentStatus: "pending"
    });

    // 1 Cancelled Appointment Today (must NOT be counted in active today's appointments)
    await AppointmentModel.create({
        patientId: patient._id,
        doctorId: doctor._id,
        departmentId: dept._id,
        organizationId: org._id,
        appointmentDate: today,
        startTime: "11:00",
        endTime: "11:30",
        status: "CANCELLED",
        consultationType: "offline",
        paymentMethod: "cash",
        paymentStatus: "pending"
    });

    // 1 Online Appointment Upcoming
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    await AppointmentModel.create({
        patientId: patient._id,
        doctorId: doctor._id,
        departmentId: dept._id,
        organizationId: org._id,
        appointmentDate: futureDate,
        startTime: "14:00",
        endTime: "14:30",
        status: "BOOKED",
        consultationType: "online",
        paymentMethod: "cash",
        paymentStatus: "pending"
    });

    // Shared Medical Record for Aarav Sharma
    const rec = await MedicalRecordModel.create({
        patientId: patient._id,
        organizationId: org._id,
        uploadedBy: patUser._id,
        uploadedByRole: "patient",
        title: "Lipid Profile",
        recordType: "lab_report",
        description: "Fasting lipid panel",
        file: {
            url: "https://res.cloudinary.com/careflow/raw/upload/lipid_report",
            publicId: "lipid_report",
            resourceType: "raw",
            mimeType: "application/pdf",
            fileName: "lipid_report.pdf"
        },
        sharedWith: [{ doctorId: doctor._id, sharedAt: new Date() }]
    });

    await DocumentChunkModel.create({
        patientId: patient._id,
        organizationId: org._id,
        documentId: rec._id,
        documentType: "medical_record",
        chunkIndex: 0,
        textContent: "Lipid Profile for Aarav Sharma. Total Cholesterol 185 mg/dL. Triglycerides 140 mg/dL. HDL 48 mg/dL. LDL 109 mg/dL. Borderline LDL.",
        text: "Lipid Profile for Aarav Sharma. Total Cholesterol 185 mg/dL. Triglycerides 140 mg/dL. HDL 48 mg/dL. LDL 109 mg/dL. Borderline LDL.",
        embedding: new Array(768).fill(0.01),
        ocrConfidence: 98,
        isLowConfidence: false
    });

    const authDoctor = {
        id: docUser._id.toString(),
        role: "doctor",
        organizationId: org._id.toString()
    };

    try {
        // ================================================================
        // CHECK A: Doctor Appointment Inflated Count Fix
        // ================================================================
        console.log("[CHECK A] Doctor Today Appointments Count (Cancelled Must Be Excluded)...");
        const todayAppointments = await getDoctorTodayAppointmentsService(docUser._id.toString());
        assert.strictEqual(todayAppointments.length, 1, "Today's count must be exactly 1 (excluding cancelled appointment)");
        assert.strictEqual(todayAppointments[0].status.toUpperCase(), "BOOKED");
        console.log("  ✓ CHECK A PASSED: Today's active appointments count is 1 (cancelled appointment excluded).");

        // ================================================================
        // CHECK B: Channel Filtering (Online vs Offline)
        // ================================================================
        console.log("\n[CHECK B] Doctor Appointment Channel Filtering...");
        const offlineAppts = await getDoctorTodayAppointmentsService(docUser._id.toString(), { consultationType: "offline" });
        assert.strictEqual(offlineAppts.length, 1, "Must find 1 offline appointment today");

        const onlineTodayAppts = await getDoctorTodayAppointmentsService(docUser._id.toString(), { consultationType: "online" });
        assert.strictEqual(onlineTodayAppts.length, 0, "Must find 0 online appointments today");

        const upcomingOnline = await getDoctorUpcomingAppointmentsService(docUser._id.toString(), { consultationType: "online" });
        assert.strictEqual(upcomingOnline.length, 1, "Must find 1 upcoming online appointment");
        assert.strictEqual(upcomingOnline[0].consultationType, "online");
        console.log("  ✓ CHECK B PASSED: Channel filters (online vs offline) resolve accurately.");

        // ================================================================
        // CHECK C: getMyAppointmentsService with doctor role
        // ================================================================
        console.log("\n[CHECK C] getMyAppointmentsService for Doctor Role...");
        const doctorMyAppts = await getMyAppointmentsService(docUser._id.toString(), "doctor");
        assert.ok(Array.isArray(doctorMyAppts), "Must return array of appointments");
        assert.strictEqual(doctorMyAppts.length, 3, "Doctor has 3 total appointments in ledger");
        console.log("  ✓ CHECK C PASSED: getMyAppointmentsService handles doctor role without 404 patient error.");

        // ================================================================
        // CHECK D: Doctor AI Natural-Language Query with Patient Name: "Show patient Aarav Sharma's records"
        // ================================================================
        console.log("\n[CHECK D] Doctor AI query: 'Show patient Aarav Sharma\\'s records'...");
        await AIChatHistoryModel.deleteMany({ userId: docUser._id });

        const nameQueryRes = await runOrchestratedWorkflow(authDoctor, {
            message: "Show patient Aarav Sharma's records"
        });

        assert.strictEqual(nameQueryRes.success, true, "Workflow must succeed");
        assert.strictEqual(nameQueryRes.agentState?.stage, "SELECT_SHARED_RECORD", "Stage must be SELECT_SHARED_RECORD");
        assert.ok(nameQueryRes.aiResponse.includes("Lipid Profile"), "Must list Lipid Profile");
        assert.ok(nameQueryRes.aiResponse.includes("Which one would you like me to review?"), "Must ask which record to review");
        assert.strictEqual(String(nameQueryRes.agentState?.patientId), String(patient._id), "Must bind patientId to Aarav Sharma");
        console.log("  ✓ CHECK D PASSED: Natural language question with patient name resolves Aarav Sharma, lists shared records, and prompts for selection.");

        // ================================================================
        // CHECK E: Summarize full record via conversational selection: "1"
        // ================================================================
        console.log("\n[CHECK E] Doctor selects '1' to review Lipid Profile...");
        const selectRecordRes = await runOrchestratedWorkflow(authDoctor, {
            message: "1"
        });

        assert.strictEqual(selectRecordRes.success, true);
        assert.strictEqual(selectRecordRes.agentState?.stage, "RECORD_SELECTED");
        const eLower = selectRecordRes.aiResponse.toLowerCase();
        assert.ok(
            eLower.includes("cholesterol") || eLower.includes("triglycerides") || eLower.includes("lipid") || eLower.includes("ldl"),
            "Summary must contain documented clinical findings"
        );
        assert.ok(
            !eLower.includes("document chunk [1]:"),
            "Summary must never dump raw chunk headers or raw OCR text"
        );
        console.log("  ✓ CHECK E PASSED: Record 1 summarized with grounded clinical findings without raw OCR text dump.");

        console.log("\n==================================================");
        console.log("✓ ALL 5 STABILIZATION VERIFICATION CHECKS PASSED");
        console.log("==================================================");

    } finally {
        console.log("\n[Cleanup]: Cleaning test fixtures...");
        await AIChatHistoryModel.deleteMany({ userId: docUser._id });
        await DocumentChunkModel.deleteMany({ organizationId: org._id });
        await MedicalRecordModel.deleteMany({ organizationId: org._id });
        await AppointmentModel.deleteMany({ organizationId: org._id });
        await PatientModel.deleteMany({ _id: patient._id });
        await DoctorModel.deleteMany({ _id: doctor._id });
        await DepartmentModel.deleteMany({ _id: dept._id });
        await UserModel.deleteMany({ _id: { $in: [docUser._id, patUser._id] } });
        await OrganizationModel.deleteMany({ _id: org._id });
        await mongoose.disconnect();
    }
}

runStabilizationVerification().catch((err) => {
    console.error("FATAL ERROR IN STABILIZATION VERIFICATION:", err);
    process.exit(1);
});
