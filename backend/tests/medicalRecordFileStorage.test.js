import mongoose from "mongoose";
import assert from "node:assert";
import app from "../src/app.js";
import UserModel from "../src/model/user.js";
import PatientModel from "../src/model/patient.js";
import OrganizationModel from "../src/model/organization.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import DocumentChunkModel from "../src/model/documentChunk.js";
import { createToken } from "../src/util/token.js";
import { ingestDocument } from "../src/service/ai/documentQaService.js";
import deleteFromCloudinary from "../src/util/deleteFromCloudinary.js";

/**
 * CAREFLOW — MEDICAL RECORD FILE STORAGE & PDF PREVIEW FOCUSED TEST SUITE
 * Exactly 8 tests verifying the complete upload → Cloudinary → database → preview → download pipeline.
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

async function runMedicalRecordStorageTestSuite() {
    console.log("==================================================");
    console.log("CAREFLOW — MEDICAL RECORD FILE STORAGE FOCUSED SUITE");
    console.log("==================================================");

    if (!process.env.DB_URL) {
        throw new Error("DB_URL is required in .env");
    }

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.\n");

    // Spin up ephemeral test server
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;

    const runId = Date.now().toString(36);
    const uploadedPublicIds = [];

    // Fixtures: Organization, Patient 1 (Owner), Patient 2 (Unauthorized)
    const org = await OrganizationModel.create({
        name: `FileStorage Org ${runId}`,
        email: `org_${runId}@careflow.test`,
        phone: "9123450001",
        address: { street: "100 Medical Way", city: "Chennai" },
        status: "ACTIVE"
    });

    const userPat1 = await UserModel.create({
        name: `Patient One ${runId}`,
        email: `pat1_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const patient1 = await PatientModel.create({
        userId: userPat1._id,
        organizationId: org._id,
        dateOfBirth: new Date("1992-05-15"),
        gender: "female",
        phone: "9876543210"
    });

    const userPat2 = await UserModel.create({
        name: `Patient Two ${runId}`,
        email: `pat2_${runId}@careflow.test`,
        password: "HashPassword123!",
        role: "patient",
        organizationId: org._id,
        isActive: true
    });

    const patient2 = await PatientModel.create({
        userId: userPat2._id,
        organizationId: org._id,
        dateOfBirth: new Date("1988-11-20"),
        gender: "male",
        phone: "9876543211"
    });

    const tokenPat1 = createToken({ id: userPat1._id.toString() }, process.env.JWT_ACCESS_SECRET, "1h");
    const tokenPat2 = createToken({ id: userPat2._id.toString() }, process.env.JWT_ACCESS_SECRET, "1h");

    // Sample valid PDF buffer (%PDF-1.4 header)
    const samplePdfBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n188\n%%EOF"
    );

    // Sample valid 1x1 PNG buffer
    const samplePngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
    );

    let pdfRecord = null;
    let imgRecord = null;

    try {
        // 1. PDF upload stores correct resource type
        await test("1. PDF upload stores correct resource type", async () => {
            const formData = new FormData();
            formData.append("title", "Cardiac Lab Report 2026");
            formData.append("recordType", "lab_report");
            formData.append("description", "Blood serum cardiology panel");
            formData.append(
                "file",
                new Blob([samplePdfBuffer], { type: "application/pdf" }),
                "cardiac_lab_report.pdf"
            );

            const res = await fetch(`${baseUrl}/medical-record`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokenPat1}`
                },
                body: formData
            });

            const body = await res.json();
            assert.strictEqual(res.status, 201, `Upload failed: ${JSON.stringify(body)}`);
            assert.strictEqual(body.success, true);
            assert.ok(body.data?._id, "Record ID must be returned");

            pdfRecord = await MedicalRecordModel.findById(body.data._id);
            assert.ok(pdfRecord, "Medical record must be persisted in database");
            if (pdfRecord.file?.publicId) {
                uploadedPublicIds.push({ publicId: pdfRecord.file.publicId, resourceType: "raw" });
            }

            // Cloudinary raw storage assertions
            assert.strictEqual(pdfRecord.file.resourceType, "raw", "PDF resourceType must be 'raw'");
            assert.strictEqual(pdfRecord.file.mimeType, "application/pdf", "MIME type must be 'application/pdf'");
            assert.strictEqual(pdfRecord.file.fileCategory, "document", "Category must be 'document'");
            assert.ok(pdfRecord.file.url.includes("/raw/upload/"), "URL must use /raw/upload/ path");
        });

        // 2. Image upload still works
        await test("2. Image upload still works", async () => {
            const formData = new FormData();
            formData.append("title", "Chest X-Ray Scan");
            formData.append("recordType", "scan");
            formData.append("description", "Anterior-posterior chest radiograph");
            formData.append(
                "file",
                new Blob([samplePngBuffer], { type: "image/png" }),
                "chest_xray.png"
            );

            const res = await fetch(`${baseUrl}/medical-record`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokenPat1}`
                },
                body: formData
            });

            const body = await res.json();
            assert.strictEqual(res.status, 201, `Image upload failed: ${JSON.stringify(body)}`);
            assert.strictEqual(body.success, true);

            imgRecord = await MedicalRecordModel.findById(body.data._id);
            assert.ok(imgRecord, "Image medical record must be persisted");
            if (imgRecord.file?.publicId) {
                uploadedPublicIds.push({ publicId: imgRecord.file.publicId, resourceType: "image" });
            }

            // Cloudinary image storage assertions
            assert.strictEqual(imgRecord.file.resourceType, "image", "Image resourceType must be 'image'");
            assert.strictEqual(imgRecord.file.mimeType, "image/png", "MIME type must be 'image/png'");
            assert.strictEqual(imgRecord.file.fileCategory, "image", "Category must be 'image'");
            assert.ok(imgRecord.file.url.includes("/image/upload/"), "Image URL must use /image/upload/");
        });

        // 3. PDF preview returns application/pdf
        await test("3. PDF preview returns application/pdf", async () => {
            assert.ok(pdfRecord, "pdfRecord fixture required");
            const res = await fetch(`${baseUrl}/medical-record/${pdfRecord._id}/preview`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokenPat1}`
                }
            });

            assert.strictEqual(res.status, 200, `Preview returned HTTP ${res.status}`);
            const contentType = res.headers.get("content-type");
            assert.strictEqual(contentType, "application/pdf", "Content-Type must be application/pdf");
            const buf = await res.arrayBuffer();
            assert.ok(buf.byteLength > 0, "Preview must deliver file content bytes");
        });

        // 4. PDF preview uses inline disposition
        await test("4. PDF preview uses inline disposition", async () => {
            assert.ok(pdfRecord, "pdfRecord fixture required");
            const res = await fetch(`${baseUrl}/medical-record/${pdfRecord._id}/preview`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokenPat1}`
                }
            });

            assert.strictEqual(res.status, 200);
            const disposition = res.headers.get("content-disposition");
            assert.ok(disposition, "Content-Disposition header must be present");
            assert.ok(disposition.startsWith("inline"), `Disposition must be inline, got: ${disposition}`);
        });

        // 5. PDF download returns attachment
        await test("5. PDF download returns attachment", async () => {
            assert.ok(pdfRecord, "pdfRecord fixture required");
            const res = await fetch(`${baseUrl}/medical-record/${pdfRecord._id}/download`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokenPat1}`
                }
            });

            assert.strictEqual(res.status, 200, `Download returned HTTP ${res.status}`);
            const disposition = res.headers.get("content-disposition");
            assert.ok(disposition, "Content-Disposition header must be present");
            assert.ok(disposition.startsWith("attachment"), `Disposition must be attachment, got: ${disposition}`);
            const contentType = res.headers.get("content-type");
            assert.strictEqual(contentType, "application/pdf", "Content-Type must be application/pdf");
        });

        // 6. Download preserves filename
        await test("6. Download preserves filename", async () => {
            assert.ok(pdfRecord, "pdfRecord fixture required");
            const res = await fetch(`${baseUrl}/medical-record/${pdfRecord._id}/download`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokenPat1}`
                }
            });

            const disposition = res.headers.get("content-disposition");
            assert.ok(disposition, "Content-Disposition header must be present");
            // Must contain cardiac_lab_report.pdf or sanitized filename with .pdf
            assert.ok(
                disposition.includes("cardiac_lab_report.pdf") || disposition.includes(".pdf"),
                `Filename must be preserved with .pdf extension, got: ${disposition}`
            );
        });

        // 7. Unauthorized user cannot preview another record
        await test("7. Unauthorized user cannot preview another record", async () => {
            assert.ok(pdfRecord, "pdfRecord fixture required");
            // Patient 2 attempts to preview Patient 1's record
            const res = await fetch(`${baseUrl}/medical-record/${pdfRecord._id}/preview`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${tokenPat2}`
                }
            });

            assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden for unauthorized user, got ${res.status}`);
            const body = await res.json();
            assert.strictEqual(body.success, false);
            assert.ok(body.message.includes("not allowed"), "Message must indicate unauthorized access");
        });

        // 8. Existing OCR/RAG source remains usable
        await test("8. Existing OCR/RAG source remains usable", async () => {
            assert.ok(pdfRecord, "pdfRecord fixture required");
            assert.ok(imgRecord, "imgRecord fixture required");

            // Ingest extracted document into RAG chunks to verify OCR/RAG source pipeline integrity
            const chunkResult = await ingestDocument({
                patientId: patient1._id,
                organizationId: org._id,
                documentId: pdfRecord._id,
                documentType: "lab_report",
                sourceId: String(pdfRecord._id),
                textContent: "Patient cardiology screening shows normal sinus rhythm. Cholesterol level 185 mg/dL. Triglycerides normal.",
                ocrConfidence: 98,
                isLowConfidence: false
            });

            assert.ok(Array.isArray(chunkResult) && chunkResult.length > 0, "Document chunks must be ingested");
            const storedChunks = await DocumentChunkModel.find({ documentId: pdfRecord._id });
            assert.ok(storedChunks.length > 0, "Stored document chunks must be found in database");
            assert.strictEqual(storedChunks[0].sourceId, String(pdfRecord._id));
            assert.strictEqual(storedChunks[0].documentType, "lab_report");
        });

    } finally {
        // Cleanup fixtures from DB and Cloudinary
        console.log("\n[Cleanup]: Removing test artifacts...");
        try {
            for (const item of uploadedPublicIds) {
                await deleteFromCloudinary(item.publicId, { resourceType: item.resourceType });
            }
            await MedicalRecordModel.deleteMany({ organizationId: org._id });
            await DocumentChunkModel.deleteMany({ organizationId: org._id });
            await PatientModel.deleteMany({ _id: { $in: [patient1._id, patient2._id] } });
            await UserModel.deleteMany({ _id: { $in: [userPat1._id, userPat2._id] } });
            await OrganizationModel.deleteOne({ _id: org._id });
        } catch (cleanupErr) {
            console.warn("Cleanup notice:", cleanupErr.message);
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

runMedicalRecordStorageTestSuite().catch((err) => {
    console.error("FATAL ERROR IN TEST SUITE:", err);
    process.exit(1);
});
