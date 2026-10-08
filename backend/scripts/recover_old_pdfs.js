import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import MedicalRecordModel from "../src/model/medicalRecord.js";
import cloudinary from "../src/config/cloudinary.js";
import uploadToCloudinary from "../src/util/uploadToCloudinary.js";
import deleteFromCloudinary from "../src/util/deleteFromCloudinary.js";

async function recoverExistingOldPdfs() {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB.");

    const oldRecordIds = [
        "6ac75838f7a1f5abb35133bd",
        "6ac758a1f7a1f5abb35137cb"
    ];

    for (const id of oldRecordIds) {
        console.log(`\nProcessing Record ID: ${id}`);
        const record = await MedicalRecordModel.findById(id);
        if (!record) {
            console.log(`  Record ${id} not found.`);
            continue;
        }

        console.log(`  Current record: title="${record.title}", resourceType="${record.file?.resourceType}", publicId="${record.file?.publicId}", url="${record.file?.url}"`);

        const oldPublicId = record.file?.publicId;
        const oldResourceType = record.file?.resourceType || "image";

        // 1. Download original PDF bytes from Cloudinary via signed private download
        const dlUrl = cloudinary.utils.private_download_url(oldPublicId, "pdf", {
            resource_type: oldResourceType,
            type: "upload"
        });

        const dlRes = await fetch(dlUrl);
        if (!dlRes.ok) {
            console.error(`  Failed to download original asset: HTTP ${dlRes.status}`);
            continue;
        }

        const buffer = Buffer.from(await dlRes.arrayBuffer());
        console.log(`  Retrieved original bytes: ${buffer.length} bytes`);

        if (buffer.slice(0, 4).toString("ascii") !== "%PDF") {
            console.error(`  Asset is NOT a valid PDF!`);
            continue;
        }

        // 2. Re-upload as resource_type: "raw"
        const safeBaseName = (record.title || "medical_record").toLowerCase().replace(/[^a-z0-9]/g, "_");
        const fileName = `${safeBaseName}.pdf`;

        const uploadResult = await uploadToCloudinary(buffer, "careflow/medical-records", {
            resourceType: "raw",
            fileName
        });

        console.log(`  Uploaded as raw to Cloudinary:`, {
            publicId: uploadResult.publicId,
            url: uploadResult.url,
            resourceType: uploadResult.resourceType,
            bytes: uploadResult.bytes
        });

        // 3. Update MedicalRecord in MongoDB
        record.file = {
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            resourceType: "raw",
            mimeType: "application/pdf",
            fileName: fileName,
            fileExtension: "pdf",
            fileCategory: "document",
            fileSize: buffer.length
        };

        await record.save();
        console.log(`  ✓ Updated MedicalRecord in MongoDB successfully.`);

        // 4. Clean up old image asset from Cloudinary
        if (oldPublicId) {
            try {
                await deleteFromCloudinary(oldPublicId, { resourceType: oldResourceType });
                console.log(`  ✓ Deleted old image asset from Cloudinary (${oldPublicId}).`);
            } catch (delErr) {
                console.warn(`  Warning deleting old asset:`, delErr.message);
            }
        }
    }

    await mongoose.disconnect();
    console.log("\nRecovery complete.");
}

recoverExistingOldPdfs().catch(console.error);
