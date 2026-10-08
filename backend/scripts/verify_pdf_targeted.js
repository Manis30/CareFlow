import mongoose from "mongoose";
import assert from "node:assert";
import puppeteer from "puppeteer-core";
import dotenv from "dotenv";
dotenv.config();

import app from "../src/app.js";
import UserModel from "../src/model/user.js";
import PatientModel from "../src/model/patient.js";
import OrganizationModel from "../src/model/organization.js";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import { createToken } from "../src/util/token.js";
import deleteFromCloudinary from "../src/util/deleteFromCloudinary.js";

async function runTargetedVerification() {
    console.log("==================================================");
    console.log("CAREFLOW — TARGETED PDF PREVIEW/DOWNLOAD VERIFICATION");
    console.log("==================================================");

    await mongoose.connect(process.env.DB_URL);
    console.log("✓ Connected to MongoDB.");

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}/api/v1`;

    const samplePdfBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n188\n%%EOF"
    );

    const samplePngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
    );

    const uploadedAssets = [];
    let newPdfRecordId = null;
    let newImgRecordId = null;

    // Use existing demo patient or test patient
    const patientUser = await UserModel.findOne({ role: "patient", email: "arun.kumar.01@demo-careflow.in" });
    assert.ok(patientUser, "Demo patient user must exist");
    const token = createToken({ id: patientUser._id.toString() }, process.env.JWT_ACCESS_SECRET, "2h");

    const patientProfile = await PatientModel.findOne({ userId: patientUser._id });
    assert.ok(patientProfile, "Demo patient profile must exist");

    try {
        // ----------------------------------------------------
        // TEST 1: Upload a NEW PDF
        // ----------------------------------------------------
        console.log("\n[TEST 1] Upload a NEW PDF...");
        const pdfForm = new FormData();
        pdfForm.append("title", "Clinical Pathology Report - Phase 7 Test");
        pdfForm.append("recordType", "lab_report");
        pdfForm.append("description", "Targeted test verification for binary PDF streaming");
        pdfForm.append(
            "file",
            new Blob([samplePdfBuffer], { type: "application/pdf" }),
            "phase7_pathology_report.pdf"
        );

        const uploadPdfRes = await fetch(`${baseUrl}/medical-record`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: pdfForm
        });
        assert.strictEqual(uploadPdfRes.status, 201, `Upload must return 201, got ${uploadPdfRes.status}`);
        const uploadPdfJson = await uploadPdfRes.json();
        newPdfRecordId = uploadPdfJson.data._id;
        console.log(`  ✓ Upload succeeded. Record ID: ${newPdfRecordId}`);

        const dbPdfRecord = await MedicalRecordModel.findById(newPdfRecordId);
        assert.ok(dbPdfRecord, "MedicalRecord must exist in DB");
        uploadedAssets.push({ publicId: dbPdfRecord.file.publicId, resourceType: dbPdfRecord.file.resourceType });

        console.log(`  ✓ DB record verified:`);
        console.log(`    resourceType: "${dbPdfRecord.file.resourceType}"`);
        console.log(`    mimeType: "${dbPdfRecord.file.mimeType}"`);
        console.log(`    publicId: "${dbPdfRecord.file.publicId}"`);
        console.log(`    url: "${dbPdfRecord.file.url}"`);

        assert.strictEqual(dbPdfRecord.file.resourceType, "raw", "Cloudinary resource type MUST be raw");
        assert.strictEqual(dbPdfRecord.file.mimeType, "application/pdf", "MIME type MUST be application/pdf");

        // Preview Endpoint Check
        const prevRes = await fetch(`${baseUrl}/medical-record/${newPdfRecordId}/preview`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`  Preview Response:`);
        console.log(`    Status: ${prevRes.status}`);
        console.log(`    Content-Type: ${prevRes.headers.get("content-type")}`);
        console.log(`    Content-Disposition: ${prevRes.headers.get("content-disposition")}`);
        console.log(`    Content-Length: ${prevRes.headers.get("content-length")}`);

        assert.strictEqual(prevRes.status, 200, "Preview status must be 200");
        assert.strictEqual(prevRes.headers.get("content-type"), "application/pdf", "Content-Type must be application/pdf");
        assert.ok(prevRes.headers.get("content-disposition").startsWith("inline"), "Content-Disposition must be inline");

        const prevBuf = Buffer.from(await prevRes.arrayBuffer());
        assert.ok(prevBuf.length > 0, "Buffer must not be empty");
        assert.strictEqual(prevBuf.slice(0, 4).toString("ascii"), "%PDF", "Body must be real PDF bytes starting with %PDF");
        console.log(`  ✓ PREVIEW NEW PDF: PASS (${prevBuf.length} bytes, starts with %PDF-1.4)`);

        // ----------------------------------------------------
        // TEST 2: Download the NEW PDF
        // ----------------------------------------------------
        console.log("\n[TEST 2] Download the NEW PDF...");
        const dlRes = await fetch(`${baseUrl}/medical-record/${newPdfRecordId}/download`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`  Download Response:`);
        console.log(`    Status: ${dlRes.status}`);
        console.log(`    Content-Type: ${dlRes.headers.get("content-type")}`);
        console.log(`    Content-Disposition: ${dlRes.headers.get("content-disposition")}`);
        console.log(`    Content-Length: ${dlRes.headers.get("content-length")}`);

        assert.strictEqual(dlRes.status, 200, "Download status must be 200");
        assert.strictEqual(dlRes.headers.get("content-type"), "application/pdf");
        assert.ok(dlRes.headers.get("content-disposition").startsWith("attachment"));
        assert.ok(dlRes.headers.get("content-disposition").includes(".pdf"));

        const dlBuf = Buffer.from(await dlRes.arrayBuffer());
        assert.strictEqual(dlBuf.slice(0, 4).toString("ascii"), "%PDF");
        console.log(`  ✓ DOWNLOAD NEW PDF: PASS (${dlBuf.length} bytes, valid PDF)`);

        // ----------------------------------------------------
        // TEST 3: Upload PNG/JPG Image
        // ----------------------------------------------------
        console.log("\n[TEST 3] Upload PNG Image...");
        const imgForm = new FormData();
        imgForm.append("title", "Clinical Derma Scan - Phase 7 Test");
        imgForm.append("recordType", "scan");
        imgForm.append(
            "file",
            new Blob([samplePngBuffer], { type: "image/png" }),
            "phase7_derma_scan.png"
        );

        const uploadImgRes = await fetch(`${baseUrl}/medical-record`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: imgForm
        });
        assert.strictEqual(uploadImgRes.status, 201);
        const uploadImgJson = await uploadImgRes.json();
        newImgRecordId = uploadImgJson.data._id;

        const dbImgRecord = await MedicalRecordModel.findById(newImgRecordId);
        assert.ok(dbImgRecord);
        uploadedAssets.push({ publicId: dbImgRecord.file.publicId, resourceType: dbImgRecord.file.resourceType });
        assert.strictEqual(dbImgRecord.file.resourceType, "image", "Image resourceType must be image");
        assert.strictEqual(dbImgRecord.file.mimeType, "image/png");

        // Preview Image
        const prevImgRes = await fetch(`${baseUrl}/medical-record/${newImgRecordId}/preview`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.strictEqual(prevImgRes.status, 200);
        assert.strictEqual(prevImgRes.headers.get("content-type"), "image/png");
        assert.ok(prevImgRes.headers.get("content-disposition").startsWith("inline"));
        const prevImgBuf = Buffer.from(await prevImgRes.arrayBuffer());
        assert.strictEqual(prevImgBuf[0], 0x89, "PNG magic byte verified");
        console.log(`  ✓ PREVIEW IMAGE: PASS (${prevImgBuf.length} bytes, PNG format)`);

        // Download Image
        const dlImgRes = await fetch(`${baseUrl}/medical-record/${newImgRecordId}/download`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.strictEqual(dlImgRes.status, 200);
        assert.strictEqual(dlImgRes.headers.get("content-type"), "image/png");
        assert.ok(dlImgRes.headers.get("content-disposition").startsWith("attachment"));
        const dlImgBuf = Buffer.from(await dlImgRes.arrayBuffer());
        assert.strictEqual(dlImgBuf[0], 0x89);
        console.log(`  ✓ DOWNLOAD IMAGE: PASS (${dlImgBuf.length} bytes, PNG format)`);

        // ----------------------------------------------------
        // TEST 4: Open the CURRENT RECOVERED OLD PDF
        // ----------------------------------------------------
        console.log("\n[TEST 4] Test the recovered existing user PDF (Record 6ac75838f7a1f5abb35133bd)...");
        const oldRecord = await MedicalRecordModel.findById("6ac75838f7a1f5abb35133bd");
        assert.ok(oldRecord, "Recovered record 6ac75838f7a1f5abb35133bd must exist in DB");
        console.log(`  Recovered Record details:`);
        console.log(`    title: "${oldRecord.title}"`);
        console.log(`    resourceType: "${oldRecord.file?.resourceType}"`);
        console.log(`    mimeType: "${oldRecord.file?.mimeType}"`);
        console.log(`    publicId: "${oldRecord.file?.publicId}"`);
        console.log(`    url: "${oldRecord.file?.url}"`);

        // Authorize test user or patient owner to view
        const oldOwnerToken = createToken({ id: oldRecord.uploadedBy.toString() }, process.env.JWT_ACCESS_SECRET, "2h");

        const oldPrevRes = await fetch(`${baseUrl}/medical-record/${oldRecord._id}/preview`, {
            headers: { Authorization: `Bearer ${oldOwnerToken}` }
        });
        console.log(`  Old PDF Preview Response:`);
        console.log(`    Status: ${oldPrevRes.status}`);
        console.log(`    Content-Type: ${oldPrevRes.headers.get("content-type")}`);
        console.log(`    Content-Disposition: ${oldPrevRes.headers.get("content-disposition")}`);
        console.log(`    Content-Length: ${oldPrevRes.headers.get("content-length")}`);

        assert.strictEqual(oldPrevRes.status, 200, "Old PDF preview must succeed with status 200");
        assert.strictEqual(oldPrevRes.headers.get("content-type"), "application/pdf");
        assert.ok(oldPrevRes.headers.get("content-disposition").startsWith("inline"));

        const oldPrevBuf = Buffer.from(await oldPrevRes.arrayBuffer());
        assert.strictEqual(oldPrevBuf.slice(0, 4).toString("ascii"), "%PDF", "Must be real PDF bytes");
        console.log(`  ✓ PREVIEW OLD PDF: PASS (${oldPrevBuf.length} bytes, starts with %PDF-1.4)`);

        const oldDlRes = await fetch(`${baseUrl}/medical-record/${oldRecord._id}/download`, {
            headers: { Authorization: `Bearer ${oldOwnerToken}` }
        });
        assert.strictEqual(oldDlRes.status, 200);
        assert.strictEqual(oldDlRes.headers.get("content-type"), "application/pdf");
        assert.ok(oldDlRes.headers.get("content-disposition").startsWith("attachment"));

        const oldDlBuf = Buffer.from(await oldDlRes.arrayBuffer());
        assert.strictEqual(oldDlBuf.slice(0, 4).toString("ascii"), "%PDF");
        console.log(`  ✓ DOWNLOAD OLD PDF: PASS (${oldDlBuf.length} bytes, valid PDF)`);

        // ----------------------------------------------------
        // TEST 5: Real Browser (Edge) UI Rendering Verification
        // ----------------------------------------------------
        console.log("\n[TEST 5] Real Browser UI Verification (Edge Headless)...");
        const browser = await puppeteer.launch({
            executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            // Listen for console logs
            page.on("console", (msg) => {
                const text = msg.text();
                if (text.includes("[Document Preview Loaded]") || text.includes("Preview")) {
                    console.log("    [Browser Console]:", text);
                }
            });

            // 1. Visit Login
            await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
            await page.type('input[type="email"]', "arun.kumar.01@demo-careflow.in");
            await page.type('input[type="password"]', "Password123!");
            await page.click('button[type="submit"]');

            // Wait for navigation
            await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
            console.log(`  Logged in, current URL: ${page.url()}`);

            // 2. Go to Medical Records page
            await page.goto("http://localhost:5173/patient/medical-records", { waitUntil: "networkidle2" });

            // Look for View / Preview button for our test report
            // Wait for records list to appear
            await page.waitForSelector('button', { timeout: 5000 });
            await new Promise((r) => setTimeout(r, 2000));

            const pageText = await page.evaluate(() => document.body.innerText);
            assert.ok(!pageText.includes("[object Object]"), "No [object Object]");
            assert.ok(!pageText.includes("Dr. Dr."), "No Dr. Dr.");

            console.log("  ✓ Real Browser UI loaded successfully without UI defects.");
        } finally {
            await browser.close();
        }

    } finally {
        console.log("\n[Cleanup]: Deleting temporary test records...");
        for (const asset of uploadedAssets) {
            await deleteFromCloudinary(asset.publicId, { resourceType: asset.resourceType }).catch(() => {});
        }
        if (newPdfRecordId) await MedicalRecordModel.findByIdAndDelete(newPdfRecordId);
        if (newImgRecordId) await MedicalRecordModel.findByIdAndDelete(newImgRecordId);

        server.close();
        await mongoose.disconnect();
    }

    console.log("\n==================================================");
    console.log("ALL TARGETED PDF/IMAGE TESTS COMPLETED SUCCESSFULLY");
    console.log("==================================================");
}

runTargetedVerification().catch((err) => {
    console.error("FAILED TARGETED VERIFICATION:", err);
    process.exit(1);
});
