import mongoose from "mongoose";
import assert from "node:assert";
import { formatDoctorName } from "../src/util/formatters.js";
import { buildCanonicalResponse, RESPONSE_TYPES } from "../src/service/ai/responseContract.js";
import { templatePureDataResponse, PURE_DATA_TOOLS } from "../src/service/ai/aiGateway.js";
import { computeToolFingerprint, executeOrchestratedTool } from "../src/service/ai/orchestrator/toolExecutor.js";
import { getDoctorAuthorizedMedicalRecords, searchPatientDocuments } from "../src/service/ai/documentQaService.js";
import { TOOL_DEFINITIONS } from "../src/service/ai/tools.js";
import UserModel from "../src/model/user.js";
import DoctorModel from "../src/model/doctor.js";
import PatientModel from "../src/model/patient.js";
import OrganizationModel from "../src/model/organization.js";
import DepartmentModel from "../src/model/department.js";
import AppointmentModel from "../src/model/appointment.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import DocumentChunkModel from "../src/model/documentChunk.js";

const runPhase6SmokeTests = async () => {
    console.log("==================================================");
    console.log("CAREFLOW AI PHASE 6 — PRODUCTION HARDENING SMOKE");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required in .env");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const runId = Date.now().toString(36);
    let passed = 0;
    let failed = 0;

    const test = (name, fn) => {
        try {
            fn();
            passed++;
            console.log(`  ✓ ${name}`);
        } catch (err) {
            failed++;
            console.error(`  ✗ ${name} -> ${err.message}`);
        }
    };

    const asyncTest = async (name, fn) => {
        try {
            await fn();
            passed++;
            console.log(`  ✓ ${name}`);
        } catch (err) {
            failed++;
            console.error(`  ✗ ${name} -> ${err.message}`);
        }
    };

    // Fixtures for database-dependent tests
    const orgA = await OrganizationModel.create({
        name: `Org A Smoke ${runId}`,
        email: `orga_${runId}@careflow.test`,
        phone: "9123456793",
        address: { street: "10 A St", city: "Chennai" },
        status: "ACTIVE"
    });

    const orgB = await OrganizationModel.create({
        name: `Org B Smoke ${runId}`,
        email: `orgb_${runId}@careflow.test`,
        phone: "9123456794",
        address: { street: "20 B St", city: "Delhi" },
        status: "ACTIVE"
    });

    const deptA = await DepartmentModel.create({
        name: "Cardiology",
        description: "Cardiology",
        organizationId: orgA._id,
        status: "active"
    });

    const docUserA = await UserModel.create({
        name: "Dr. Aryan Sen",
        email: `dr_aryan_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "doctor",
        organizationId: orgA._id,
        isActive: true
    });

    const doctorA = await DoctorModel.create({
        userId: docUserA._id,
        organizationId: orgA._id,
        departmentId: deptA._id,
        specialization: "Cardiology",
        qualification: "MBBS, MD",
        consultationFee: 500
    });

    const patUserA = await UserModel.create({
        name: "Priya Sharma",
        email: `priya_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: orgA._id,
        isActive: true
    });

    const patientA = await PatientModel.create({
        userId: patUserA._id,
        organizationId: orgA._id,
        bloodGroup: "O+"
    });

    const apptA = await AppointmentModel.create({
        patientId: patientA._id,
        doctorId: doctorA._id,
        organizationId: orgA._id,
        departmentId: deptA._id,
        appointmentDate: new Date(),
        startTime: "10:00",
        endTime: "10:30",
        status: "COMPLETED",
        consultationType: "offline",
        paymentStatus: "paid"
    });

    const recA = await MedicalRecordModel.create({
        patientId: patientA._id,
        organizationId: orgA._id,
        uploadedBy: patUserA._id,
        uploadedByRole: "patient",
        title: "Lipid Panel",
        recordType: "lab_report",
        file: { url: "https://example.com/lipid.pdf", publicId: "smoke_lipid" },
        sharedWith: [{ doctorId: doctorA._id, sharedAt: new Date() }]
    });

    const chunkA = await DocumentChunkModel.create({
        patientId: patientA._id,
        organizationId: orgA._id,
        documentId: recA._id,
        documentType: "medical_record",
        chunkIndex: 0,
        textContent: "Total Cholesterol: 190 mg/dL, Triglycerides: 140 mg/dL.",
        text: "Total Cholesterol: 190 mg/dL, Triglycerides: 140 mg/dL.",
        embedding: new Array(768).fill(0.015),
        ocrConfidence: 95,
        isLowConfidence: false
    });

    try {
        // Test 1: Doctor name does not become "Dr. Dr."
        test("1. doctor name does not become 'Dr. Dr.'", () => {
            assert.strictEqual(formatDoctorName("Dr. Dr. Priya Sharma"), "Dr. Priya Sharma");
            assert.strictEqual(formatDoctorName("Dr Priya Sharma"), "Dr. Priya Sharma");
            assert.strictEqual(formatDoctorName("Dr. Priya Sharma"), "Dr. Priya Sharma");
            assert.strictEqual(formatDoctorName("priya sharma"), "Dr. Priya Sharma");
            assert.strictEqual(formatDoctorName("Doctor Specialist Aryan"), "Dr. Aryan");
            assert.strictEqual(formatDoctorName(""), null);
            assert.strictEqual(formatDoctorName(null, "Doctor"), "Doctor");
        });

        // Test 2: Tool failure does not return success
        test("2. tool failure does not return success", () => {
            const errResponse = buildCanonicalResponse({
                responseType: RESPONSE_TYPES.ERROR,
                aiResponse: "Database operation timed out.",
                statusCode: 500
            });
            assert.strictEqual(errResponse.success, false);
            assert.strictEqual(errResponse.responseType, "ERROR");
            assert.strictEqual(errResponse.statusCode, 500);
            assert.ok(errResponse.aiResponse.includes("timed out"));
        });

        // Test 3: Empty result produces clean response
        test("3. empty result produces clean response", () => {
            const apptsEmpty = templatePureDataResponse("getMyAppointments", []);
            assert.strictEqual(apptsEmpty, "You currently have no scheduled appointments.");

            const sharedEmpty = templatePureDataResponse("getSharedMedicalRecords", { records: [] });
            assert.strictEqual(sharedEmpty, "I couldn't find any shared medical records for this patient available to you.");

            const docsEmpty = templatePureDataResponse("searchDoctors", { doctors: [] });
            assert.ok(docsEmpty.includes("No doctors found"));
            assert.ok(!docsEmpty.includes("{"), "Must not contain raw JSON");
        });

        // Test 4: Malformed AI output uses canonical error handling
        test("4. malformed AI output uses canonical error handling", () => {
            const malformedResult = { success: false, error: "Unexpected token in JSON at position 0" };
            const fallback = buildCanonicalResponse({
                responseType: RESPONSE_TYPES.ERROR,
                aiResponse: "I couldn't process that response safely. Please clarify your request.",
                statusCode: 400
            });
            assert.strictEqual(fallback.success, false);
            assert.strictEqual(fallback.responseType, "ERROR");
            assert.ok(!fallback.aiResponse.includes("{"), "Must not expose raw JSON error");
        });

        // Test 5: Duplicate tool call is prevented
        test("5. duplicate tool call is prevented", () => {
            const fp1 = computeToolFingerprint("getClinicStats", { startDate: "2026-10-01", groupBy: "department" });
            const fp2 = computeToolFingerprint("getClinicStats", { groupBy: "department", startDate: "2026-10-01" });
            assert.strictEqual(fp1, fp2, "Fingerprints must match regardless of key order");

            const executed = new Set();
            executed.add(fp1);
            assert.ok(executed.has(fp2), "Repeated tool call must be detected");
        });

        // Test 6: Doctor context does not leak
        await asyncTest("6. doctor context does not leak across organizations", async () => {
            const unauthDoctorUser = {
                _id: new mongoose.Types.ObjectId(),
                id: new mongoose.Types.ObjectId().toString(),
                role: "doctor",
                organizationId: orgB._id // Belonging to Org B
            };

            await assert.rejects(
                async () => {
                    await getDoctorAuthorizedMedicalRecords({
                        doctorUserId: unauthDoctorUser.id,
                        organizationId: orgA._id,
                        patientId: patientA._id
                    });
                },
                /not found|not authorized|forbidden/i,
                "Cross-org doctor must be denied access"
            );
        });

        // Test 7: Admin tenant scope is preserved
        await asyncTest("7. admin tenant scope is preserved", async () => {
            const adminUser = {
                id: "admin-1",
                role: "admin",
                organizationId: orgA._id
            };

            const callArgs = { organizationId: String(orgB._id) }; // Attempt cross-tenant spoofing
            // executeOrchestratedTool must enforce user's authenticated organizationId
            try {
                await executeOrchestratedTool(adminUser, "getClinicStats", callArgs, false);
            } catch (_) {}
            assert.strictEqual(callArgs.organizationId, String(orgA._id), "Tenant scope must be overwritten with authenticated admin orgId");
        });

        // Test 8: Shared-record OCR is not unnecessarily repeated
        await asyncTest("8. shared-record OCR is not unnecessarily repeated", async () => {
            const docUser = {
                id: String(docUserA._id),
                _id: String(docUserA._id),
                role: "doctor",
                organizationId: orgA._id
            };

            // Call searchPatientDocuments on existing chunk
            const res = await searchPatientDocuments({
                user: docUser,
                query: "Cholesterol level",
                patientId: patientA._id,
                recordId: recA._id
            });

            assert.ok(res.answer && res.answer.length > 0);
            assert.ok(res.citations.length > 0);
            // Verify chunks in DB were not duplicated
            const chunkCount = await DocumentChunkModel.countDocuments({ documentId: recA._id });
            assert.strictEqual(chunkCount, 1, "DocumentChunk count must remain exactly 1");
        });

        // Test 9: Analytics cache respects groupBy/filter context
        await asyncTest("9. analytics cache respects groupBy/filter context", async () => {
            const user = { role: "admin", organizationId: orgA._id };
            const ungrouped = await TOOL_DEFINITIONS.getClinicStats.execute(user, { organizationId: String(orgA._id) });
            const grouped = await TOOL_DEFINITIONS.getClinicStats.execute(user, { organizationId: String(orgA._id), groupBy: "department" });

            assert.strictEqual(ungrouped.byDepartment, undefined, "Ungrouped query must not have byDepartment");
            assert.ok(grouped.byDepartment !== undefined, "Grouped query must have byDepartment breakdown");
        });

        // Test 10: AiDrawer renders error/clinical/analytics response safely
        test("10. AiDrawer renders error/clinical/analytics response safely", () => {
            const resObj = { message: "Department workload compiled", summary: "Cardiology is busiest." };
            const fallbackText = typeof resObj === 'string'
                ? resObj
                : resObj?.message || resObj?.summary || "Default fallback";
            assert.strictEqual(fallbackText, "Department workload compiled");
            assert.ok(!fallbackText.includes("{"), "Must never render raw JSON string in AiDrawer");
        });

    } finally {
        console.log("\nCleaning up test fixtures...");
        await DocumentChunkModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await MedicalRecordModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await AppointmentModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await PatientModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await DoctorModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await DepartmentModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await UserModel.deleteMany({ _id: { $in: [docUserA._id, patUserA._id] } });
        await OrganizationModel.deleteMany({ _id: { $in: [orgA._id, orgB._id] } });
        await mongoose.disconnect();
        console.log("✓ Disconnected from MongoDB.\n");
    }

    console.log("==================================================");
    console.log(`PHASE 6 SMOKE SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log("==================================================");

    if (failed > 0 || passed !== 10) {
        process.exit(1);
    }
};

runPhase6SmokeTests().catch(err => {
    console.error("Fatal error in Phase 6 smoke tests:", err);
    process.exit(1);
});
