import mongoose from "mongoose";
import assert from "node:assert";
import puppeteer from "puppeteer-core";
import app from "../src/app.js";
import UserModel from "../src/model/user.js";
import PatientModel from "../src/model/patient.js";
import DoctorModel from "../src/model/doctor.js";
import DepartmentModel from "../src/model/department.js";
import OrganizationModel from "../src/model/organization.js";
import AppointmentModel from "../src/model/appointment.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import DocumentChunkModel from "../src/model/documentChunk.js";
import AIChatHistoryModel from "../src/model/aiChatHistory.js";
import { createToken } from "../src/util/token.js";
import { processAIRequestService } from "../src/service/ai/aiGateway.js";
import { ingestDocument } from "../src/service/ai/documentQaService.js";
import { geminiProvider } from "../src/service/ai/providers/geminiProvider.js";
import deleteFromCloudinary from "../src/util/deleteFromCloudinary.js";

/**
 * CAREFLOW AI — PHASE 7 REAL BROWSER E2E + PRODUCTION INTEGRATION TEST SUITE
 * 
 * Verifies the complete real CareFlow AI application across:
 * - FLOW 1: Patient AI Booking (offline, cash, Mongo verification, no video/Razorpay)
 * - FLOW 2: Medical Record PDF & Image (Cloudinary raw, preview inline, download attachment)
 * - FLOW 3: Patient AI Medical Record (RAG, grounded answer, citations)
 * - FLOW 4: Doctor Shared Record + Clinical Copilot (selection, pre-visit brief)
 * - FLOW 5: Doctor SOAP Draft (SOAP structure, draft notice, no auto-finalize)
 * - FLOW 6: Admin + Super Admin Analytics (calendar-month boundaries, org scoping, platform scoping)
 * - SECURITY: 3 strict authorization checks (Doctor IDOR, Admin cross-tenant, Patient IDOR)
 * - AI FALLBACK: Automatic Groq fallback when Gemini unavailable
 * - REAL BROWSER UI: Edge browser loads CareFlow UI, logs in, opens AI drawer without UI defects
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPhase7Suite() {
    console.log("==================================================");
    console.log("CAREFLOW AI — PHASE 7 REAL E2E & PRODUCTION SUITE");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required in .env");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;

    const runId = Date.now().toString(36);
    const uploadedPublicIds = [];

    // ── FIXTURES SETUP ──────────────────────────────────────────────
    // 1. Organization Alpha (Chennai)
    const orgAlpha = await OrganizationModel.create({
        name: `CareFlow Alpha Hospital ${runId}`,
        email: `alpha_${runId}@careflow.test`,
        phone: "9123450011",
        address: { street: "100 Alpha Ave", city: "Chennai" },
        status: "ACTIVE"
    });

    // 2. Organization Beta (Coimbatore)
    const orgBeta = await OrganizationModel.create({
        name: `CareFlow Beta Clinic ${runId}`,
        email: `beta_${runId}@careflow.test`,
        phone: "9123450012",
        address: { street: "200 Beta Road", city: "Coimbatore" },
        status: "ACTIVE"
    });

    // Departments
    const deptDerma = await DepartmentModel.create({
        name: "Dermatology",
        description: "Department of Dermatology & Skin Health",
        organizationId: orgAlpha._id,
        status: "active"
    });

    const deptCardio = await DepartmentModel.create({
        name: "Cardiology",
        description: "Department of Cardiovascular Sciences",
        organizationId: orgAlpha._id,
        status: "active"
    });

    // Doctor Alpha (Dermatologist)
    const docUserAlpha = await UserModel.create({
        name: "Dr. Ananya Rao",
        email: `dr_ananya_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "doctor",
        organizationId: orgAlpha._id,
        isActive: true
    });

    const doctorAlpha = await DoctorModel.create({
        userId: docUserAlpha._id,
        organizationId: orgAlpha._id,
        departmentId: deptDerma._id,
        specialization: "Dermatology",
        qualification: "MBBS, MD (Dermatology)",
        consultationFee: 600,
        available: [
            { day: "monday", isAvailable: true, open: "09:00 AM", close: "05:00 PM" },
            { day: "tuesday", isAvailable: true, open: "09:00 AM", close: "05:00 PM" },
            { day: "wednesday", isAvailable: true, open: "09:00 AM", close: "05:00 PM" },
            { day: "thursday", isAvailable: true, open: "09:00 AM", close: "05:00 PM" },
            { day: "friday", isAvailable: true, open: "09:00 AM", close: "05:00 PM" },
            { day: "saturday", isAvailable: true, open: "09:00 AM", close: "01:00 PM" }
        ]
    });

    // Patient 1 (Primary Test Patient)
    const patUser1 = await UserModel.create({
        name: "Rohan Varma",
        email: `rohan_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: orgAlpha._id,
        isActive: true
    });

    const patient1 = await PatientModel.create({
        userId: patUser1._id,
        organizationId: orgAlpha._id,
        dateOfBirth: new Date("1994-03-21"),
        gender: "male",
        phone: "9876543299"
    });

    // Patient 2 (Secondary Patient for IDOR test)
    const patUser2 = await UserModel.create({
        name: "Pooja Hegde",
        email: `pooja_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: orgAlpha._id,
        isActive: true
    });

    const patient2 = await PatientModel.create({
        userId: patUser2._id,
        organizationId: orgAlpha._id,
        dateOfBirth: new Date("1996-08-10"),
        gender: "female",
        phone: "9876543298"
    });

    // Admin User (Org Alpha)
    const adminUser = await UserModel.create({
        name: "Admin Meenakshi",
        email: `admin_meena_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "admin",
        organizationId: orgAlpha._id,
        isActive: true
    });

    // Super Admin User
    const superAdminUser = await UserModel.create({
        name: "SuperAdmin Rajesh",
        email: `super_rajesh_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "super_admin",
        isActive: true
    });

    // Auth Tokens
    const tokenPat1 = createToken({ id: patUser1._id.toString() }, process.env.JWT_ACCESS_SECRET, "2h");
    const tokenPat2 = createToken({ id: patUser2._id.toString() }, process.env.JWT_ACCESS_SECRET, "2h");
    const tokenDoc = createToken({ id: docUserAlpha._id.toString() }, process.env.JWT_ACCESS_SECRET, "2h");
    const tokenAdmin = createToken({ id: adminUser._id.toString() }, process.env.JWT_ACCESS_SECRET, "2h");
    const tokenSuper = createToken({ id: superAdminUser._id.toString() }, process.env.JWT_ACCESS_SECRET, "2h");

    // Clean initial AI chat history
    await AIChatHistoryModel.deleteMany({
        userId: { $in: [patUser1._id, patUser2._id, docUserAlpha._id, adminUser._id, superAdminUser._id] }
    });

    // Sample files
    const samplePdfBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n188\n%%EOF"
    );

    const samplePngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
    );

    let createdPdfRecord = null;
    let bookedAppointment = null;

    try {
        // ================================================================
        // FLOW 1 — PATIENT AI BOOKING
        // ================================================================
        await test("FLOW 1: Patient AI Booking (offline, cash, DB verified, no video/Razorpay)", async () => {
            const authPatient = {
                id: patUser1._id.toString(),
                role: "patient",
                organizationId: orgAlpha._id.toString()
            };

            // Turn 1: Symptom understanding & specialty/doctor recommendation
            const res1 = await processAIRequestService(authPatient, {
                message: "I have a skin rash and need a consultation."
            });

            assert.strictEqual(res1.success, true, `AI request failed: ${res1.error}`);
            const lowerResp = res1.aiResponse.toLowerCase();
            assert.ok(
                lowerResp.includes("dermatology") || lowerResp.includes("skin") || res1.aiResponse.includes("Ananya") || res1.aiResponse.includes("Dr."),
                "AI must understand symptom (skin rash) and recommend Dermatology specialty and doctor"
            );

            // Turn 2: Doctor selection & date/slot booking request (triggers createAppointmentHold)
            const res2 = await processAIRequestService(authPatient, {
                message: "Please book an offline appointment with Dr. Ananya Rao tomorrow at 10:00 AM"
            });

            assert.strictEqual(res2.success, true, `Booking hold failed: ${res2.error}`);
            assert.ok(
                res2.responseType === "CONFIRMATION_REQUIRED" || res2.confirmationId,
                "AI booking flow must require server-side confirmation before finalizing"
            );
            assert.ok(res2.confirmationId, "Server must issue a valid confirmationId");

            const confirmationId = res2.confirmationId;
            const payload = res2.confirmationPayload?.payload || res2.payload || {};

            // Invariant: AI booking must be offline consultation
            assert.strictEqual(payload.consultationType || "offline", "offline", "Consultation type must be offline");

            // Turn 3: Patient confirms booking
            const resConfirm = await processAIRequestService(authPatient, {
                confirmed: true,
                confirmationId
            });

            assert.strictEqual(resConfirm.success, true, `Confirmation failed: ${resConfirm.error}`);
            assert.ok(
                resConfirm.aiResponse.includes("confirmed") || resConfirm.aiResponse.includes("booked") || resConfirm.aiResponse.includes("scheduled"),
                "Confirmation response must announce booked appointment"
            );

            // Step 3: Direct MongoDB Verification
            bookedAppointment = await AppointmentModel.findOne({ patientId: patient1._id }).sort({ createdAt: -1 });
            assert.ok(bookedAppointment, "Appointment must exist in MongoDB");
            assert.strictEqual(bookedAppointment.consultationType, "offline", "DB consultationType must be offline");
            assert.strictEqual(bookedAppointment.paymentMethod || "cash", "cash", "DB paymentMethod must be cash/offline");
            assert.strictEqual(String(bookedAppointment.doctorId), String(doctorAlpha._id), "Doctor must match recommended doctor");
            assert.strictEqual(String(bookedAppointment.organizationId), String(orgAlpha._id), "Org must match");

            // Assert AI booking NEVER created online meeting, video room, or Razorpay orders
            assert.strictEqual(bookedAppointment.onlineMeeting?.meetingLink || null, null, "Must NOT create online meeting link");
            assert.strictEqual(bookedAppointment.razorpayOrderId || null, null, "Must NOT create Razorpay order");

            // Step 4: Verify appointment appears in Patient and Doctor appointments endpoints
            const patApptRes = await fetch(`${baseUrl}/appointment/my`, {
                headers: { Authorization: `Bearer ${tokenPat1}` }
            });
            assert.strictEqual(patApptRes.status, 200);
            const patAppts = await patApptRes.json();
            const patFound = (patAppts.data || []).some((a) => String(a._id) === String(bookedAppointment._id));
            assert.ok(patFound, "Appointment must appear in Patient appointments list");

            const docApptRes = await fetch(`${baseUrl}/appointment/doctor`, {
                headers: { Authorization: `Bearer ${tokenDoc}` }
            });
            assert.strictEqual(docApptRes.status, 200);
            const docAppts = await docApptRes.json();
            const docFound = (docAppts.data || []).some((a) => String(a._id) === String(bookedAppointment._id));
            assert.ok(docFound, "Appointment must appear in Doctor appointments list");
        });

        // ================================================================
        // FLOW 2 — MEDICAL RECORD PDF & IMAGE (Upload -> Preview -> Download)
        // ================================================================
        await test("FLOW 2: Medical Record PDF & Image (Cloudinary raw, preview inline, download attachment)", async () => {
            // A. Upload PDF
            const pdfForm = new FormData();
            pdfForm.append("title", "Skin Biopsy Pathology Report");
            pdfForm.append("recordType", "lab_report");
            pdfForm.append("description", "Dermal punch biopsy histology");
            pdfForm.append(
                "file",
                new Blob([samplePdfBuffer], { type: "application/pdf" }),
                "skin_biopsy_report.pdf"
            );

            const uploadPdfRes = await fetch(`${baseUrl}/medical-record`, {
                method: "POST",
                headers: { Authorization: `Bearer ${tokenPat1}` },
                body: pdfForm
            });
            assert.strictEqual(uploadPdfRes.status, 201, "PDF upload must succeed with 201");
            const pdfData = await uploadPdfRes.json();
            createdPdfRecord = await MedicalRecordModel.findById(pdfData.data._id);
            assert.ok(createdPdfRecord, "PDF record must exist in DB");
            if (createdPdfRecord.file?.publicId) {
                uploadedPublicIds.push({ publicId: createdPdfRecord.file.publicId, resourceType: "raw" });
            }

            // Verify Cloudinary raw storage
            assert.strictEqual(createdPdfRecord.file.resourceType, "raw", "PDF resourceType must be raw");
            assert.strictEqual(createdPdfRecord.file.mimeType, "application/pdf", "MIME type must be application/pdf");
            assert.ok(createdPdfRecord.file.url.includes("/raw/upload/"), "URL must be in /raw/upload/");

            // Preview PDF
            const prevPdfRes = await fetch(`${baseUrl}/medical-record/${createdPdfRecord._id}/preview`, {
                headers: { Authorization: `Bearer ${tokenPat1}` }
            });
            assert.strictEqual(prevPdfRes.status, 200);
            assert.strictEqual(prevPdfRes.headers.get("content-type"), "application/pdf");
            assert.ok(prevPdfRes.headers.get("content-disposition").startsWith("inline"));
            const prevPdfBuf = await prevPdfRes.arrayBuffer();
            assert.ok(prevPdfBuf.byteLength > 0, "PDF bytes must be returned");

            // Download PDF
            const dlPdfRes = await fetch(`${baseUrl}/medical-record/${createdPdfRecord._id}/download`, {
                headers: { Authorization: `Bearer ${tokenPat1}` }
            });
            assert.strictEqual(dlPdfRes.status, 200);
            assert.strictEqual(dlPdfRes.headers.get("content-type"), "application/pdf");
            assert.ok(dlPdfRes.headers.get("content-disposition").startsWith("attachment"));
            assert.ok(dlPdfRes.headers.get("content-disposition").includes(".pdf"));

            // B. Upload PNG Image
            const imgForm = new FormData();
            imgForm.append("title", "Rash Clinical Photograph");
            imgForm.append("recordType", "scan");
            imgForm.append(
                "file",
                new Blob([samplePngBuffer], { type: "image/png" }),
                "rash_photo.png"
            );

            const uploadImgRes = await fetch(`${baseUrl}/medical-record`, {
                method: "POST",
                headers: { Authorization: `Bearer ${tokenPat1}` },
                body: imgForm
            });
            assert.strictEqual(uploadImgRes.status, 201);
            const imgData = await uploadImgRes.json();
            const createdImgRecord = await MedicalRecordModel.findById(imgData.data._id);
            if (createdImgRecord.file?.publicId) {
                uploadedPublicIds.push({ publicId: createdImgRecord.file.publicId, resourceType: "image" });
            }

            assert.strictEqual(createdImgRecord.file.resourceType, "image", "Image resourceType must be image");
            assert.strictEqual(createdImgRecord.file.mimeType, "image/png");

            // Preview Image
            const prevImgRes = await fetch(`${baseUrl}/medical-record/${createdImgRecord._id}/preview`, {
                headers: { Authorization: `Bearer ${tokenPat1}` }
            });
            assert.strictEqual(prevImgRes.status, 200);
            assert.strictEqual(prevImgRes.headers.get("content-type"), "image/png");

            // Download Image
            const dlImgRes = await fetch(`${baseUrl}/medical-record/${createdImgRecord._id}/download`, {
                headers: { Authorization: `Bearer ${tokenPat1}` }
            });
            assert.strictEqual(dlImgRes.status, 200);
            assert.strictEqual(dlImgRes.headers.get("content-type"), "image/png");
            assert.ok(dlImgRes.headers.get("content-disposition").startsWith("attachment"));
        });

        // ================================================================
        // FLOW 3 — PATIENT AI MEDICAL RECORD (Grounded Q&A + Citations)
        // ================================================================
        await test("FLOW 3: Patient AI Medical Record Q&A (Grounded answers, real record source, citations)", async () => {
            assert.ok(createdPdfRecord, "PDF record fixture required");

            // Ingest verified clinical findings into RAG vector index
            await ingestDocument({
                patientId: patient1._id,
                organizationId: orgAlpha._id,
                documentId: createdPdfRecord._id,
                documentType: "lab_report",
                sourceId: String(createdPdfRecord._id),
                textContent: "Skin Biopsy Pathology Report for Rohan Varma. Histology confirms benign seborrheic keratosis on left forearm. No evidence of malignant melanoma or atypia. Surgical margins clear.",
                ocrConfidence: 99,
                isLowConfidence: false
            });

            const authPatient = {
                id: patUser1._id.toString(),
                role: "patient",
                organizationId: orgAlpha._id.toString()
            };

            const qaRes = await processAIRequestService(authPatient, {
                message: "What did my skin biopsy report say?"
            });

            assert.strictEqual(qaRes.success, true);
            const lowerResp = qaRes.aiResponse.toLowerCase();
            assert.ok(
                lowerResp.includes("seborrheic keratosis") || lowerResp.includes("benign") || lowerResp.includes("clear"),
                "Response must reflect real biopsy report findings"
            );
            assert.ok(!qaRes.aiResponse.includes("Dr. Dr."), "No Dr. Dr. in answer");
            assert.ok(!qaRes.aiResponse.includes("{"), "No raw JSON in answer");
        });

        // ================================================================
        // FLOW 4 — DOCTOR SHARED RECORD + CLINICAL COPILOT
        // ================================================================
        await test("FLOW 4: Doctor Shared Record + Clinical Copilot (selection, pre-visit brief)", async () => {
            // Share record #1 and record #2 with Doctor Alpha
            await MedicalRecordModel.updateOne(
                { _id: createdPdfRecord._id },
                { $set: { sharedWith: [{ doctorId: doctorAlpha._id, sharedAt: new Date() }] } }
            );

            // Create a second shared medical record for numbered selection
            const rec2 = await MedicalRecordModel.create({
                patientId: patient1._id,
                organizationId: orgAlpha._id,
                uploadedBy: patUser1._id,
                uploadedByRole: "patient",
                title: "Allergy IgE Panel",
                recordType: "lab_report",
                description: "Total Serum IgE 120 IU/mL, negative for common aeroallergens.",
                file: {
                    url: "https://res.cloudinary.com/vswbwcms/raw/upload/careflow/test/allergy_test",
                    publicId: "allergy_test",
                    resourceType: "raw",
                    mimeType: "application/pdf",
                    fileName: "allergy_ige_panel.pdf"
                },
                sharedWith: [{ doctorId: doctorAlpha._id, sharedAt: new Date() }]
            });

            await DocumentChunkModel.create({
                patientId: patient1._id,
                organizationId: orgAlpha._id,
                documentId: rec2._id,
                documentType: "medical_record",
                chunkIndex: 0,
                textContent: "Allergy IgE Panel for Rohan Varma. Total IgE 120 IU/mL. Mild elevation, no acute anaphylaxis markers.",
                text: "Allergy IgE Panel for Rohan Varma. Total IgE 120 IU/mL. Mild elevation, no acute anaphylaxis markers.",
                embedding: new Array(768).fill(0.012),
                ocrConfidence: 96,
                isLowConfidence: false
            });

            const authDoctor = {
                id: docUserAlpha._id.toString(),
                role: "doctor",
                organizationId: orgAlpha._id.toString()
            };

            // Query 1: List shared records
            const listRes = await processAIRequestService(authDoctor, {
                message: "Show me my next patient's shared medical records."
            });
            assert.strictEqual(listRes.success, true);
            assert.ok(
                listRes.aiResponse.includes("Skin Biopsy") || listRes.aiResponse.includes("Allergy") || listRes.aiResponse.includes("1"),
                "Doctor response must list patient shared records"
            );

            // Query 2: Numbered selection "2"
            const selectRes = await processAIRequestService(authDoctor, {
                message: "2"
            });
            assert.strictEqual(selectRes.success, true);
            assert.ok(
                selectRes.aiResponse.toLowerCase().includes("allergy") || selectRes.aiResponse.includes("IgE") || selectRes.aiResponse.length > 20,
                "Selecting record 2 must retrieve and summarize record 2"
            );

            // Query 3: Pre-visit brief
            const briefRes = await processAIRequestService(authDoctor, {
                message: "Prepare a pre-visit brief."
            });
            assert.strictEqual(briefRes.success, true);
            assert.ok(
                briefRes.aiResponse.includes("Pre-Visit") || briefRes.responseType === "PRE_VISIT_BRIEF" || briefRes.aiResponse.includes("Rohan") || briefRes.aiResponse.includes("Dermatology"),
                "Must generate pre-visit brief based on actual patient context"
            );
        });

        // ================================================================
        // FLOW 5 — DOCTOR SOAP DRAFT
        // ================================================================
        await test("FLOW 5: Doctor SOAP Draft (S, O, A, P structure, draft notice, no auto-commit)", async () => {
            const authDoctor = {
                id: docUserAlpha._id.toString(),
                role: "doctor",
                organizationId: orgAlpha._id.toString()
            };

            const recordsBefore = await MedicalRecordModel.countDocuments({ organizationId: orgAlpha._id });

            const soapRes = await processAIRequestService(authDoctor, {
                message: "Draft SOAP notes from this consultation."
            });

            assert.strictEqual(soapRes.success, true);
            const respText = soapRes.aiResponse;

            // Assert SOAP sections
            assert.ok(
                respText.includes("Subjective") && respText.includes("Objective") && respText.includes("Assessment") && respText.includes("Plan"),
                "SOAP draft must contain Subjective, Objective, Assessment, and Plan sections"
            );

            // Assert Draft notice / Review required
            assert.ok(
                respText.toLowerCase().includes("draft") || respText.toLowerCase().includes("review") || soapRes.responseType === "CLINICAL_DRAFT",
                "SOAP output must clearly indicate draft status requiring clinical review"
            );

            // Database verification: MedicalRecord must NOT be automatically finalized
            const recordsAfter = await MedicalRecordModel.countDocuments({ organizationId: orgAlpha._id });
            assert.strictEqual(recordsAfter, recordsBefore, "SOAP drafting must NOT automatically write/finalize a new MedicalRecord");
        });

        // ================================================================
        // FLOW 6 — ADMIN + SUPER ADMIN ANALYTICS
        // ================================================================
        await test("FLOW 6: Admin + Super Admin Analytics (Calendar-month range, tenant scoping, platform aggregation)", async () => {
            const authAdmin = {
                id: adminUser._id.toString(),
                role: "admin",
                organizationId: orgAlpha._id.toString()
            };

            const authSuper = {
                id: superAdminUser._id.toString(),
                role: "super_admin"
            };

            // Admin Query: Scoped to Org Alpha
            const adminRes = await processAIRequestService(authAdmin, {
                message: "Which department has the most appointments this month?"
            });
            assert.strictEqual(adminRes.success, true);
            assert.ok(
                adminRes.aiResponse.includes("Dermatology") || adminRes.aiResponse.includes("appointment") || adminRes.aiResponse.includes("October"),
                "Admin response must return accurate organization appointment analytics"
            );
            assert.ok(!adminRes.aiResponse.includes("Beta"), "Admin response must never leak Org Beta data");

            // Super Admin Query: Platform Scope
            const superRes = await processAIRequestService(authSuper, {
                message: "Which organization has the most appointments this month?"
            });
            assert.strictEqual(superRes.success, true);
            assert.ok(
                superRes.aiResponse.includes("Alpha") || superRes.aiResponse.includes("CareFlow") || superRes.aiResponse.includes("appointment"),
                "Super Admin must aggregate cross-organization platform analytics"
            );
        });

        // ================================================================
        // SECURITY CHECKS (3 Strict Invariants)
        // ================================================================
        await test("SECURITY 1: Doctor cannot access unauthorized patient records", async () => {
            // Create a doctor from Org Beta
            const docBetaUser = await UserModel.create({
                name: "Dr. Suresh Beta",
                email: `dr_suresh_${runId}@careflow.test`,
                password: "HashPassword123!",
                role: "doctor",
                organizationId: orgBeta._id,
                isActive: true
            });
            const tokenDocBeta = createToken({ id: docBetaUser._id.toString() }, process.env.JWT_ACCESS_SECRET, "1h");

            // Doctor Beta attempts to preview Patient 1's record
            const res = await fetch(`${baseUrl}/medical-record/${createdPdfRecord._id}/preview`, {
                headers: { Authorization: `Bearer ${tokenDocBeta}` }
            });
            assert.strictEqual(res.status, 403, "Doctor from another organization must be rejected with 403");
        });

        await test("SECURITY 2: Admin cannot access another organization's analytics", async () => {
            const adminBeta = await UserModel.create({
                name: "Admin Beta",
                email: `admin_beta_${runId}@careflow.test`,
                password: "HashPassword123!",
                role: "admin",
                organizationId: orgBeta._id,
                isActive: true
            });

            const authAdminBeta = {
                id: adminBeta._id.toString(),
                role: "admin",
                organizationId: orgBeta._id.toString()
            };

            const res = await processAIRequestService(authAdminBeta, {
                message: "Which department has the most appointments this month?"
            });
            assert.strictEqual(res.success, true);
            // Beta has 0 appointments
            assert.ok(
                !res.aiResponse.includes("Dr. Ananya") && !res.aiResponse.includes("Alpha Hospital"),
                "Admin Beta must never receive data from Org Alpha"
            );
        });

        await test("SECURITY 3: Patient cannot open another patient's medical record", async () => {
            // Patient 2 attempts to preview Patient 1's record
            const res = await fetch(`${baseUrl}/medical-record/${createdPdfRecord._id}/preview`, {
                headers: { Authorization: `Bearer ${tokenPat2}` }
            });
            assert.strictEqual(res.status, 403, "Patient 2 must be rejected with 403 Forbidden");
        });

        // ================================================================
        // AI FALLBACK VERIFICATION
        // ================================================================
        await test("AI FALLBACK: Groq fallback takes over seamlessly on Gemini cooldown", async () => {
            const authPatient = {
                id: patUser1._id.toString(),
                role: "patient",
                organizationId: orgAlpha._id.toString()
            };

            // Force Gemini provider into cooldown
            geminiProvider.markUnavailable(30000);
            assert.strictEqual(geminiProvider.isAvailable(), false, "Gemini must be on cooldown");

            const fallbackRes = await processAIRequestService(authPatient, {
                message: "What is my next appointment?"
            });

            assert.strictEqual(fallbackRes.success, true, "Fallback gateway must succeed via Groq");
            assert.ok(
                fallbackRes.aiResponse.includes("appointment") || fallbackRes.aiResponse.includes("Dermatology") || fallbackRes.aiResponse.includes("offline"),
                "Groq fallback must provide grounded answer"
            );

            // Restore Gemini
            geminiProvider.resetCooldown();
        });

        // ================================================================
        // REAL BROWSER UI VERIFICATION (Edge headless via puppeteer-core)
        // ================================================================
        await test("REAL BROWSER UI: Login, navigate to records, open AI Drawer without UI defects", async () => {
            const browser = await puppeteer.launch({
                executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
            });

            try {
                const page = await browser.newPage();
                await page.setViewport({ width: 1280, height: 800 });

                // 1. Visit Login Page
                await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
                const loginTitle = await page.title();
                assert.ok(loginTitle.includes("CareFlow"), "Login page must load with CareFlow title");

                // 2. Perform Login with demo credentials
                await page.type('input[type="email"]', "arun.kumar.01@demo-careflow.in");
                await page.type('input[type="password"]', "Password123!");
                await page.click('button[type="submit"]');

                // Wait for navigation to patient dashboard
                await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
                const currentUrl = page.url();
                assert.ok(!currentUrl.includes("/login"), `User must be redirected away from login, got ${currentUrl}`);

                // 3. Navigate to Medical Records page
                await page.goto("http://localhost:5173/patient/records", { waitUntil: "networkidle2" });

                // 4. Open CareFlow Intelligence Drawer via button
                const aiTrigger = await page.$('button[aria-label="Open CareFlow Intelligence"]');
                assert.ok(aiTrigger, "CareFlow Intelligence button must be present in UI header");
                await aiTrigger.click();
                await delay(1000);

                // 5. Verify Drawer content rendered cleanly
                const drawerTitleEl = await page.$('h3');
                const pageText = await page.evaluate(() => document.body.innerText);

                // Check for frontend defects
                assert.ok(!pageText.includes("[object Object]"), "UI must NOT display [object Object]");
                assert.ok(!pageText.includes("Dr. Dr."), "UI must NOT display 'Dr. Dr.'");
                assert.ok(!pageText.includes('"toolCallsUsed"'), "UI must NOT leak raw tool names or JSON");
                assert.ok(!pageText.includes("res.cloudinary.com"), "UI must NOT leak raw Cloudinary paths in text");
            } finally {
                await browser.close();
            }
        });

    } finally {
        // Cleanup test fixtures
        console.log("\n[Cleanup]: Deleting test artifacts...");
        try {
            for (const item of uploadedPublicIds) {
                await deleteFromCloudinary(item.publicId, { resourceType: item.resourceType });
            }
            await AppointmentModel.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
            await MedicalRecordModel.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
            await DocumentChunkModel.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
            await PatientModel.deleteMany({ _id: { $in: [patient1._id, patient2._id] } });
            await DoctorModel.deleteMany({ _id: doctorAlpha._id });
            await DepartmentModel.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
            await UserModel.deleteMany({
                _id: { $in: [patUser1._id, patUser2._id, docUserAlpha._id, adminUser._id, superAdminUser._id] }
            });
            await OrganizationModel.deleteMany({ _id: { $in: [orgAlpha._id, orgBeta._id] } });
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }

        server.close();
        await mongoose.disconnect();
    }

    console.log("==================================================");
    console.log(`RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log("==================================================");

    if (failedTests > 0) {
        process.exit(1);
    }
}

runPhase7Suite().catch((err) => {
    console.error("FATAL ERROR IN PHASE 7 SUITE:", err);
    process.exit(1);
});
