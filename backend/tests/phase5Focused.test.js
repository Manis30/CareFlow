import mongoose from "mongoose";
import assert from "node:assert";
import UserModel from "../src/model/user.js";
import OrganizationModel from "../src/model/organization.js";
import DoctorModel from "../src/model/doctor.js";
import PatientModel from "../src/model/patient.js";
import DepartmentModel from "../src/model/department.js";
import AppointmentModel from "../src/model/appointment.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import DocumentChunkModel from "../src/model/documentChunk.js";
import PaymentModel from "../src/model/payment.js";

import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";
import { executeOrchestratedTool } from "../src/service/ai/orchestrator/toolExecutor.js";
import {
    getDoctorAuthorizedMedicalRecords,
    searchPatientDocuments,
    ingestDocument
} from "../src/service/ai/documentQaService.js";
import {
    getDoctorSharedMedicalRecords,
    resolveSharedRecordSelection
} from "../src/service/doctorCopilot.js";
import {
    parseDatePeriod,
    compareOrganizationsAnalytics
} from "../src/service/ai/analyticsService.js";
import { planWorkflowStep } from "../src/service/ai/orchestrator/workflowPlanner.js";

/**
 * CAREFLOW AI — PHASE 5 TARGETED TEST SUITE
 * AUTONOMOUS OPERATIONS + SHARED MEDICAL RECORD INTELLIGENCE
 * 
 * Target: ~20 focused tests covering:
 * - Shared Records: SHARED-01 to SHARED-10
 * - Admin Operations: ADMIN-01 to ADMIN-06
 * - Super Admin Platform Intelligence: SUPER-01 to SUPER-05
 */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

const test = async (name, fn) => {
    totalTests++;
    try {
        await fn();
        passedTests++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        failedTests++;
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
    }
};

async function runPhase5FocusedSuite() {
    console.log("==================================================");
    console.log("CAREFLOW AI — PHASE 5 TARGETED TEST SUITE");
    console.log("==================================================");

    await mongoose.connect(process.env.DB_URL);
    const runId = Date.now();

    // ── FIXTURES SETUP ──────────────────────────────────────────────
    // Organization A (Chennai)
    const orgA = await OrganizationModel.create({
        name: `CareFlow Chennai Clinic ${runId}`,
        email: `chennai_${runId}@careflow.test`,
        phone: "9123456780",
        address: { street: "100 GST Road", city: "Chennai" },
        status: "ACTIVE"
    });

    // Organization B (Coimbatore)
    const orgB = await OrganizationModel.create({
        name: `CareFlow Coimbatore Clinic ${runId}`,
        email: `coimbatore_${runId}@careflow.test`,
        phone: "9123456781",
        address: { street: "200 Avinashi Road", city: "Coimbatore" },
        status: "ACTIVE"
    });

    // Departments
    const deptCardio = await DepartmentModel.create({
        name: "Cardiology",
        description: "Cardiology & Vascular Medicine",
        organizationId: orgA._id,
        status: "active"
    });

    const deptDerma = await DepartmentModel.create({
        name: "Dermatology",
        description: "Skin Care & Dermatology",
        organizationId: orgA._id,
        status: "active"
    });

    const deptOrgB = await DepartmentModel.create({
        name: "General Medicine",
        description: "General Internal Medicine",
        organizationId: orgB._id,
        status: "active"
    });

    // Doctor 1 (Org A - Attending Doctor for Patient 1)
    const docUser1 = await UserModel.create({
        name: "Dr. Ananya Roy",
        email: `ananya_${runId}@careflow.test`,
        password: "Password123!",
        role: "doctor",
        organizationId: orgA._id,
        isActive: true
    });

    const doctor1 = await DoctorModel.create({
        userId: docUser1._id,
        organizationId: orgA._id,
        departmentId: deptCardio._id,
        specialization: "Cardiology",
        qualification: "MBBS, MD",
        consultationFee: 600,
        available: [{ day: "monday", isAvailable: true, open: "09:00 AM", close: "05:00 PM" }]
    });

    // Doctor 2 (Org A - Dermatology)
    const docUser2 = await UserModel.create({
        name: "Dr. Karthik Raman",
        email: `karthik_${runId}@careflow.test`,
        password: "Password123!",
        role: "doctor",
        organizationId: orgA._id,
        isActive: true
    });

    const doctor2 = await DoctorModel.create({
        userId: docUser2._id,
        organizationId: orgA._id,
        departmentId: deptDerma._id,
        specialization: "Dermatology",
        qualification: "MBBS, MD",
        consultationFee: 500,
        available: [{ day: "tuesday", isAvailable: true, open: "10:00 AM", close: "04:00 PM" }]
    });

    // Doctor 3 (Org B - Coimbatore)
    const docUser3 = await UserModel.create({
        name: "Dr. Suresh V",
        email: `suresh_${runId}@careflow.test`,
        password: "Password123!",
        role: "doctor",
        organizationId: orgB._id,
        isActive: true
    });

    const doctor3 = await DoctorModel.create({
        userId: docUser3._id,
        organizationId: orgB._id,
        departmentId: deptOrgB._id,
        specialization: "General Medicine",
        qualification: "MBBS",
        consultationFee: 400
    });

    // Org Admin User (Org A)
    const adminUserA = await UserModel.create({
        name: "Admin Chennai",
        email: `admin_chennai_${runId}@careflow.test`,
        password: "Password123!",
        role: "admin",
        organizationId: orgA._id,
        isActive: true
    });

    // Super Admin User
    const superAdminUser = await UserModel.create({
        name: "Super Admin Platform",
        email: `super_${runId}@careflow.test`,
        password: "Password123!",
        role: "super_admin",
        isActive: true
    });

    // Patient 1 (Org A)
    const patUser1 = await UserModel.create({
        name: "Ramesh Sharma",
        email: `ramesh_${runId}@careflow.test`,
        password: "Password123!",
        role: "patient",
        organizationId: orgA._id,
        isActive: true
    });

    const patient1 = await PatientModel.create({
        userId: patUser1._id,
        organizationId: orgA._id,
        gender: "male",
        dateOfBirth: new Date("1985-05-15"),
        bloodGroup: "O+",
        allergies: ["Penicillin"]
    });

    // Patient 2 (Org B)
    const patUser2 = await UserModel.create({
        name: "Meera Nair",
        email: `meera_${runId}@careflow.test`,
        password: "Password123!",
        role: "patient",
        organizationId: orgB._id,
        isActive: true
    });

    const patient2 = await PatientModel.create({
        userId: patUser2._id,
        organizationId: orgB._id,
        gender: "female",
        dateOfBirth: new Date("1992-08-20"),
        bloodGroup: "A+",
        allergies: []
    });

    // Appointments for Org A
    const appt1 = await AppointmentModel.create({
        patientId: patient1._id,
        doctorId: doctor1._id,
        departmentId: deptCardio._id,
        organizationId: orgA._id,
        appointmentDate: new Date("2026-09-12"),
        startTime: "10:00 AM",
        endTime: "10:30 AM",
        consultationType: "offline",
        status: "COMPLETED",
        reason: "Cardiac health checkup",
        reasonForVisit: "Cardiac health checkup"
    });

    const appt2 = await AppointmentModel.create({
        patientId: patient1._id,
        doctorId: doctor1._id,
        departmentId: deptCardio._id,
        organizationId: orgA._id,
        appointmentDate: new Date("2026-09-15"),
        startTime: "11:00 AM",
        endTime: "11:30 AM",
        consultationType: "offline",
        status: "COMPLETED",
        reason: "Follow-up ECG check",
        reasonForVisit: "Follow-up ECG check"
    });

    const appt3 = await AppointmentModel.create({
        patientId: patient1._id,
        doctorId: doctor2._id,
        departmentId: deptDerma._id,
        organizationId: orgA._id,
        appointmentDate: new Date("2026-09-18"),
        startTime: "02:00 PM",
        endTime: "02:30 PM",
        consultationType: "offline",
        status: "CANCELLED",
        reason: "Skin allergy consultation",
        reasonForVisit: "Skin allergy consultation"
    });

    // Appointment for Org B
    const apptOrgB = await AppointmentModel.create({
        patientId: patient2._id,
        doctorId: doctor3._id,
        departmentId: deptOrgB._id,
        organizationId: orgB._id,
        appointmentDate: new Date("2026-09-16"),
        startTime: "09:30 AM",
        endTime: "10:00 AM",
        consultationType: "offline",
        status: "COMPLETED",
        reason: "Routine checkup",
        reasonForVisit: "Routine checkup"
    });

    // Payments for Org A
    const payment1 = await PaymentModel.create({
        appointmentId: appt1._id,
        patientId: patient1._id,
        organizationId: orgA._id,
        amount: 600,
        currency: "INR",
        status: "PAID",
        paymentMethod: "card"
    });

    const payment2 = await PaymentModel.create({
        appointmentId: appt2._id,
        patientId: patient1._id,
        organizationId: orgA._id,
        amount: 600,
        currency: "INR",
        status: "PAID",
        paymentMethod: "cash"
    });

    const paymentPending = await PaymentModel.create({
        appointmentId: appt3._id,
        patientId: patient1._id,
        organizationId: orgA._id,
        amount: 500,
        currency: "INR",
        status: "PAYMENT_PENDING",
        paymentMethod: "cash"
    });

    // Payment for Org B
    const paymentOrgB = await PaymentModel.create({
        appointmentId: apptOrgB._id,
        patientId: patient2._id,
        organizationId: orgB._id,
        amount: 400,
        currency: "INR",
        status: "PAID",
        paymentMethod: "cash"
    });

    // Medical Records for Patient 1 shared with Doctor 1
    const recBlood = await MedicalRecordModel.create({
        patientId: patient1._id,
        organizationId: orgA._id,
        uploadedBy: docUser1._id,
        uploadedByRole: "doctor",
        file: { url: "https://example.com/blood.pdf", publicId: "blood_pub" },
        title: "Blood Test Report",
        recordType: "lab_report",
        description: "Fasting lipid profile and complete blood count",
        date: new Date("2026-09-10"),
        sharedWith: [{ doctorId: doctor1._id, sharedAt: new Date() }]
    });

    const recMri = await MedicalRecordModel.create({
        patientId: patient1._id,
        organizationId: orgA._id,
        uploadedBy: docUser1._id,
        uploadedByRole: "doctor",
        file: { url: "https://example.com/mri.pdf", publicId: "mri_pub" },
        title: "MRI Knee Report",
        recordType: "radiology",
        description: "Right knee joint scan showing mild joint effusion",
        date: new Date("2026-09-14"),
        sharedWith: [{ doctorId: doctor1._id, sharedAt: new Date() }]
    });

    const recDischarge = await MedicalRecordModel.create({
        patientId: patient1._id,
        organizationId: orgA._id,
        uploadedBy: docUser1._id,
        uploadedByRole: "doctor",
        file: { url: "https://example.com/discharge.pdf", publicId: "discharge_pub" },
        title: "Discharge Summary",
        recordType: "discharge_summary",
        description: "Post-observation discharge summary. Stable cardiac parameters.",
        date: new Date("2026-09-16"),
        sharedWith: [{ doctorId: doctor1._id, sharedAt: new Date() }]
    });

    // Unshared Record (Belongs to Patient 1, NOT shared with Doctor 2)
    const recUnshared = await MedicalRecordModel.create({
        patientId: patient1._id,
        organizationId: orgA._id,
        uploadedBy: docUser1._id,
        uploadedByRole: "doctor",
        file: { url: "https://example.com/oncology.pdf", publicId: "onco_pub" },
        title: "Confidential Oncology Panel",
        recordType: "lab_report",
        description: "Confidential genetic oncology results",
        date: new Date("2026-09-18"),
        sharedWith: [] // NOT shared with doctor 2
    });

    // Document chunks for recBlood
    await DocumentChunkModel.create({
        patientId: patient1._id,
        organizationId: orgA._id,
        documentId: recBlood._id,
        sourceId: String(recBlood._id),
        chunkIndex: 0,
        text: "Lipid Profile: Total Cholesterol 220 mg/dL, HDL 45 mg/dL, LDL 140 mg/dL, Triglycerides 175 mg/dL. Fasting blood sugar 98 mg/dL.",
        textContent: "Lipid Profile: Total Cholesterol 220 mg/dL, HDL 45 mg/dL, LDL 140 mg/dL, Triglycerides 175 mg/dL. Fasting blood sugar 98 mg/dL.",
        ocrConfidence: 95,
        isLowConfidence: false
    });

    // Document chunks for recMri
    await DocumentChunkModel.create({
        patientId: patient1._id,
        organizationId: orgA._id,
        documentId: recMri._id,
        sourceId: String(recMri._id),
        chunkIndex: 0,
        text: "Magnetic resonance imaging of right knee demonstrates mild suprapatellar joint effusion without ligament tear or meniscal injury.",
        textContent: "Magnetic resonance imaging of right knee demonstrates mild suprapatellar joint effusion without ligament tear or meniscal injury.",
        ocrConfidence: 92,
        isLowConfidence: false
    });

    // Scanned low-confidence chunk for test SHARED-08
    const recScannedLowConf = await MedicalRecordModel.create({
        patientId: patient1._id,
        organizationId: orgA._id,
        uploadedBy: docUser1._id,
        uploadedByRole: "doctor",
        file: { url: "https://example.com/scanned.pdf", publicId: "scanned_pub" },
        title: "Scanned Prescription Note",
        recordType: "prescription",
        description: "Handwritten prescription note",
        date: new Date("2026-09-15"),
        sharedWith: [{ doctorId: doctor1._id, sharedAt: new Date() }]
    });

    await DocumentChunkModel.create({
        patientId: patient1._id,
        organizationId: orgA._id,
        documentId: recScannedLowConf._id,
        sourceId: String(recScannedLowConf._id),
        chunkIndex: 0,
        text: "Tab Atorvastatin 10mg once daily at bedtime for hyperlipidemia.",
        textContent: "Tab Atorvastatin 10mg once daily at bedtime for hyperlipidemia.",
        ocrConfidence: 35, // Low confidence (<50%)
        isLowConfidence: true
    });

    try {
        console.log("\n--- PART A: SHARED MEDICAL RECORD INTELLIGENCE (SHARED-01 to SHARED-10) ---");

        // SHARED-01: broad query lists authorized records
        await test("SHARED-01: broad query lists authorized records without auto-selecting", async () => {
            const res = await getDoctorSharedMedicalRecords(docUser1, {
                patientId: String(patient1._id)
            });

            assert.strictEqual(res.success, true);
            assert.ok(Array.isArray(res.records));
            assert.ok(res.records.length >= 3);
            assert.ok(res.response.includes("I found"));
            assert.ok(res.response.includes("Which one would you like me to review?"));
            assert.ok(res.response.includes("You can choose a number or say 'all'."));
            assert.strictEqual(res.agentState.stage, "SELECT_SHARED_RECORD");
            assert.ok(Array.isArray(res.agentState.sharedMedicalRecords));
            assert.strictEqual(String(res.agentState.patientId), String(patient1._id));
        });

        // SHARED-02: numeric selection resolves correct record
        await test("SHARED-02: numeric selection resolves correct record against agentState", async () => {
            const listRes = await getDoctorSharedMedicalRecords(docUser1, {
                patientId: String(patient1._id)
            });

            const selRes = await resolveSharedRecordSelection(docUser1, {
                selection: "2",
                agentState: listRes.agentState
            });

            assert.strictEqual(selRes.handled, true);
            assert.strictEqual(selRes.isAll, false);
            assert.ok(selRes.selectedRecord);
            assert.strictEqual(String(selRes.selectedRecord.id), String(listRes.records[1].id));
            assert.strictEqual(selRes.agentState.stage, "RECORD_SELECTED");
            assert.strictEqual(selRes.agentState.selectedRecordId, listRes.records[1].id);
        });

        // SHARED-03: ordinal selection resolves correct record
        await test("SHARED-03: ordinal selection resolves correct record", async () => {
            const listRes = await getDoctorSharedMedicalRecords(docUser1, {
                patientId: String(patient1._id)
            });

            const selRes = await resolveSharedRecordSelection(docUser1, {
                selection: "the first one",
                agentState: listRes.agentState
            });

            assert.strictEqual(selRes.handled, true);
            assert.strictEqual(selRes.isAll, false);
            assert.strictEqual(String(selRes.selectedRecord.id), String(listRes.records[0].id));
        });

        // SHARED-04: "all" resolves all authorized records
        await test("SHARED-04: 'all' resolves all authorized records", async () => {
            const listRes = await getDoctorSharedMedicalRecords(docUser1, {
                patientId: String(patient1._id)
            });

            const selRes = await resolveSharedRecordSelection(docUser1, {
                selection: "all",
                agentState: listRes.agentState
            });

            assert.strictEqual(selRes.handled, true);
            assert.strictEqual(selRes.isAll, true);
            assert.strictEqual(selRes.agentState.stage, "RECORD_SELECTED");
            assert.strictEqual(selRes.agentState.selectedRecordId, "all");
            assert.ok(Array.isArray(selRes.citations));
        });

        // SHARED-05: selected record restricts RAG
        await test("SHARED-05: selected record restricts RAG strictly to that record", async () => {
            // Select MRI knee report only (recordId: recMri._id)
            const searchMriOnly = await searchPatientDocuments({
                user: docUser1,
                query: "What are the cholesterol and triglyceride levels?",
                patientId: String(patient1._id),
                recordId: String(recMri._id) // Restricted to MRI only!
            });

            // Since only MRI is queried, cholesterol is absent from this record!
            assert.ok(
                searchMriOnly.answer.includes("couldn't find that information") ||
                searchMriOnly.answer.includes("not documented"),
                `Expected not found message, got: ${searchMriOnly.answer}`
            );
        });

        // SHARED-06: unauthorized record is denied
        await test("SHARED-06: unauthorized record access is denied", async () => {
            // Doctor 2 has NO appointment and NO shared record with Patient 1
            let threwOrDenied = false;
            try {
                const res = await searchPatientDocuments({
                    user: docUser2,
                    query: "Show patient medical records",
                    patientId: String(patient1._id),
                    recordId: String(recUnshared._id)
                });
                if (res.chunks.length === 0 && res.citations.length === 0) {
                    threwOrDenied = true;
                }
            } catch (err) {
                if (err.statusCode === 403 || err.message.includes("not authorized")) {
                    threwOrDenied = true;
                }
            }

            assert.strictEqual(threwOrDenied, true, "Doctor 2 must not be able to retrieve unauthorized records");
        });

        // SHARED-07: OCR path is used for scanned document
        await test("SHARED-07: OCR path retrieves text from document chunks", async () => {
            const searchResult = await searchPatientDocuments({
                user: docUser1,
                query: "joint effusion in right knee",
                patientId: String(patient1._id),
                recordId: String(recMri._id)
            });

            assert.ok(searchResult.chunks.length > 0, "Should match OCR/text chunk");
            assert.ok(searchResult.chunks[0].textContent.includes("effusion"));
            assert.strictEqual(searchResult.responseType, "GROUNDED_RECORD");
        });

        // SHARED-08: low OCR confidence is surfaced
        await test("SHARED-08: low OCR confidence surfaces low-confidence warning", async () => {
            const searchResult = await searchPatientDocuments({
                user: docUser1,
                query: "Atorvastatin dosage and medication",
                patientId: String(patient1._id),
                recordId: String(recScannedLowConf._id)
            });

            assert.strictEqual(searchResult.hasLowConfidenceWarning, true);
            assert.ok(searchResult.answer.includes("low image clarity") || searchResult.answer.includes("OCR confidence"));
        });

        // SHARED-09: no fabricated clinical information
        await test("SHARED-09: absent clinical finding produces explicit safe unknown", async () => {
            const searchResult = await searchPatientDocuments({
                user: docUser1,
                query: "What is the genetic BRCA1 gene mutation result?",
                patientId: String(patient1._id),
                recordId: String(recBlood._id)
            });

            assert.ok(
                searchResult.answer.includes("couldn't find that information") ||
                searchResult.answer.includes("not documented"),
                `Expected safe unknown, got: ${searchResult.answer}`
            );
            assert.ok(!searchResult.answer.toLowerCase().includes("positive"));
            assert.ok(!searchResult.answer.toLowerCase().includes("negative"));
        });

        // SHARED-10: safe citation metadata
        await test("SHARED-10: citations expose only safe metadata and zero secrets/storage paths", async () => {
            const searchResult = await searchPatientDocuments({
                user: docUser1,
                query: "cholesterol HDL LDL",
                patientId: String(patient1._id),
                recordId: String(recBlood._id)
            });

            assert.ok(searchResult.citations.length > 0);
            for (const citation of searchResult.citations) {
                assert.ok(citation.recordId, "Must have recordId");
                assert.ok(citation.title, "Must have title");
                assert.strictEqual(citation.fileUrl, undefined, "Must NOT expose fileUrl");
                assert.strictEqual(citation.cloudinaryUrl, undefined, "Must NOT expose cloudinaryUrl");
                assert.strictEqual(citation.storagePath, undefined, "Must NOT expose internal storagePath");
            }
        });

        console.log("\n--- PART B: ADMIN OPERATIONS COPILOT (ADMIN-01 to ADMIN-06) ---");

        // ADMIN-01: appointment statistics use real service
        await test("ADMIN-01: appointment statistics use real service and actual DB counts", async () => {
            const stats = await executeOrchestratedTool(adminUserA, "getClinicStats", {});
            const result = stats.result || stats;

            assert.strictEqual(result.totalAppointments, 3);
            assert.strictEqual(result.completedAppointments, 2);
            assert.strictEqual(result.cancelledAppointments, 1);
            assert.strictEqual(result.completionRate, "66.7%");
            assert.strictEqual(result.cancellationRate, "33.3%");
        });

        // ADMIN-02: doctor workload uses real service
        await test("ADMIN-02: doctor workload query aggregates real appointment distribution", async () => {
            const stats = await executeOrchestratedTool(adminUserA, "getClinicStats", {
                groupBy: "doctor"
            });
            const result = stats.result || stats;

            assert.ok(result.byDoctor, "Should contain byDoctor aggregation");
            const doc1Count = result.byDoctor["Dr. Ananya Roy"] || result.byDoctor["Ananya Roy"] || 0;
            assert.strictEqual(doc1Count, 2, "Doctor 1 has exactly 2 appointments");
        });

        // ADMIN-03: department statistics use real service
        await test("ADMIN-03: department statistics use real service", async () => {
            const stats = await executeOrchestratedTool(adminUserA, "getClinicStats", {
                groupBy: "department"
            });
            const result = stats.result || stats;

            assert.ok(result.byDepartment, "Should contain byDepartment breakdown");
            assert.strictEqual(result.byDepartment["Cardiology"], 2);
            assert.strictEqual(result.byDepartment["Dermatology"], 1);
        });

        // ADMIN-04: revenue query uses real service
        await test("ADMIN-04: revenue query aggregates actual payments from database", async () => {
            const payStats = await executeOrchestratedTool(adminUserA, "getPaymentStats", {});
            const result = payStats.result || payStats;

            assert.strictEqual(result.totalCollected, 1200, "Two paid payments of 600 each = 1200");
            assert.strictEqual(result.pendingAmount, 500, "One pending payment of 500");
            assert.strictEqual(result.paidCount, 2);
            assert.strictEqual(result.pendingCount, 1);
        });

        // ADMIN-05: natural date filter works
        await test("ADMIN-05: natural date filter calculates deterministic ranges", () => {
            const thisMonth = parseDatePeriod("this_month");
            assert.ok(thisMonth.start instanceof Date);
            assert.ok(thisMonth.end instanceof Date);
            assert.ok(thisMonth.start < thisMonth.end);
            assert.strictEqual(thisMonth.start.getDate(), 1);

            const lastMonth = parseDatePeriod("last_month");
            assert.ok(lastMonth.start instanceof Date);
            assert.ok(lastMonth.end instanceof Date);
            assert.ok(lastMonth.start < lastMonth.end);

            const today = parseDatePeriod("today");
            assert.strictEqual(today.start.getDate(), new Date().getDate());
        });

        // ADMIN-06: multi-tool analytics query works
        await test("ADMIN-06: multi-tool query plans department volume followed by doctor workload", async () => {
            const prompt = "Which department has the most appointments and which doctor handles the most appointments there?";
            
            // Step 1: No previous observations
            const step1 = await planWorkflowStep(prompt, adminUserA, []);
            assert.strictEqual(step1.action, "EXECUTE_TOOL");
            assert.strictEqual(step1.toolName, "getClinicStats");
            assert.strictEqual(step1.toolArgs.groupBy, "department");

            // Step 2: Department stats already executed in trace
            const mockTrace = [
                {
                    toolName: "getClinicStats",
                    args: { groupBy: "department" },
                    result: { byDepartment: { "Cardiology": 2, "Dermatology": 1 } }
                }
            ];

            const step2 = await planWorkflowStep(prompt, adminUserA, mockTrace);
            assert.strictEqual(step2.action, "EXECUTE_TOOL");
            assert.strictEqual(step2.toolName, "getClinicStats");
            assert.strictEqual(step2.toolArgs.groupBy, "doctor");
        });

        console.log("\n--- PART C: SUPER ADMIN PLATFORM INTELLIGENCE (SUPER-01 to SUPER-05) ---");

        // SUPER-01: organization statistics use real service
        await test("SUPER-01: organization statistics retrieve real platform metrics", async () => {
            const platformStats = await executeOrchestratedTool(superAdminUser, "getPlatformStats", {});
            const result = platformStats.result || platformStats;

            assert.ok(result.totalOrganizations >= 2, "Should count registered organizations");
            assert.ok(result.totalAppointments >= 4, "Should count platform-wide appointments");
            assert.ok(result.totalDoctors >= 3, "Should count platform doctors");
        });

        // SUPER-02: organization comparison uses real data
        await test("SUPER-02: organization comparison compares clinics using real database metrics", async () => {
            const comp = await compareOrganizationsAnalytics(superAdminUser, {
                orgA: orgA._id,
                orgB: orgB._id
            });

            assert.strictEqual(comp.organizations.length, 2);
            const clinicA = comp.organizations.find(o => o.name.includes("Chennai"));
            const clinicB = comp.organizations.find(o => o.name.includes("Coimbatore"));

            assert.ok(clinicA && clinicB);
            assert.strictEqual(clinicA.appointments, 3);
            assert.strictEqual(clinicA.completedAppointments, 2);
            assert.strictEqual(clinicA.completionRate, "66.7%");
            assert.strictEqual(clinicA.revenue, 1200);

            assert.strictEqual(clinicB.appointments, 1);
            assert.strictEqual(clinicB.completedAppointments, 1);
            assert.strictEqual(clinicB.completionRate, "100%");
            assert.strictEqual(clinicB.revenue, 400);

            assert.ok(comp.summary.includes(clinicA.name));
            assert.ok(comp.summary.includes(clinicB.name));
        });

        // SUPER-03: platform revenue uses real service
        await test("SUPER-03: platform revenue aggregates cross-tenant payments ledger", async () => {
            const globalPaymentStats = await executeOrchestratedTool(superAdminUser, "getPaymentStats", {});
            const result = globalPaymentStats.result || globalPaymentStats;

            assert.ok(result.totalCollected >= 1600, "Chennai 1200 + Coimbatore 400 = 1600");
            assert.ok(result.totalPaymentsCount >= 4);
        });

        // SUPER-04: platform appointment statistics use real service
        await test("SUPER-04: platform appointment breakdown by clinic reflects real appointments", async () => {
            const clinicBreakdown = await executeOrchestratedTool(superAdminUser, "getClinicStats", {
                clinicWise: true
            });
            const result = clinicBreakdown.result || clinicBreakdown;

            assert.ok(result.byClinic, "Should include byClinic breakdown");
            const chennaiData = result.byClinic[orgA.name];
            const coimbatoreData = result.byClinic[orgB.name];

            assert.ok(chennaiData, "Should contain Chennai clinic");
            assert.ok(coimbatoreData, "Should contain Coimbatore clinic");
            assert.strictEqual(chennaiData.total, 3);
            assert.strictEqual(coimbatoreData.total, 1);
        });

        // SUPER-05: organization isolation/permission behavior is correct
        await test("SUPER-05: organization isolation is strictly enforced against non-superadmin", async () => {
            // Admin of Org A tries to access comparison analytics (Super Admin only)
            const unauthorizedComp = await compareOrganizationsAnalytics(adminUserA, {
                orgA: orgA._id,
                orgB: orgB._id
            });

            assert.strictEqual(unauthorizedComp.scope, "Access Denied");
            assert.strictEqual(unauthorizedComp.organizations.length, 0);

            // Admin of Org A querying clinic stats cannot view Org B appointments
            const adminStats = await executeOrchestratedTool(adminUserA, "getClinicStats", {
                organizationId: String(orgB._id) // Forged organizationId
            });
            const res = adminStats.result || adminStats;

            // Strict tenant isolation forces organizationId to admin's own Org A
            assert.strictEqual(res.totalAppointments, 3, "Admin A must only see Org A count (3), never Org B (1)");
        });

    } finally {
        // Cleanup all created fixtures
        await AppointmentModel.deleteMany({ _id: { $in: [appt1._id, appt2._id, appt3._id, apptOrgB._id] } });
        await PaymentModel.deleteMany({ _id: { $in: [payment1._id, payment2._id, paymentPending._id, paymentOrgB._id] } });
        await MedicalRecordModel.deleteMany({ _id: { $in: [recBlood._id, recMri._id, recDischarge._id, recUnshared._id, recScannedLowConf._id] } });
        await DocumentChunkModel.deleteMany({ patientId: { $in: [patient1._id, patient2._id] } });
        await PatientModel.deleteMany({ _id: { $in: [patient1._id, patient2._id] } });
        await DoctorModel.deleteMany({ _id: { $in: [doctor1._id, doctor2._id, doctor3._id] } });
        await DepartmentModel.deleteMany({ _id: { $in: [deptCardio._id, deptDerma._id, deptOrgB._id] } });
        await OrganizationModel.deleteMany({ _id: { $in: [orgA._id, orgB._id] } });
        await UserModel.deleteMany({ _id: { $in: [docUser1._id, docUser2._id, docUser3._id, adminUserA._id, superAdminUser._id, patUser1._id, patUser2._id] } });

        await mongoose.disconnect();
    }

    console.log("==================================================");
    console.log(`PHASE 5 TESTS SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
    console.log("==================================================");

    if (failedTests > 0) {
        process.exit(1);
    }
}

runPhase5FocusedSuite().catch(err => {
    console.error("Fatal test error:", err);
    process.exit(1);
});
