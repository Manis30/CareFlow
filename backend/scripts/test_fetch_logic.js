import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import MedicalRecordModel from "../src/model/medicalRecord.js";
import cloudinary from "../src/config/cloudinary.js";

async function testFetchFunction(record) {
    const storedUrl = record.file?.url || "";
    const publicId = record.file?.publicId;
    let resourceType = record.file?.resourceType || "image";
    let mimeType = record.file?.mimeType;
    let extension = record.file?.fileExtension;

    if (!mimeType) {
        if (storedUrl.toLowerCase().includes(".pdf") || record.title?.toLowerCase().includes("pdf")) {
            mimeType = "application/pdf";
            extension = "pdf";
        } else if (storedUrl.toLowerCase().includes(".png")) {
            mimeType = "image/png";
            extension = "png";
        }
    }

    console.log(`\nTesting Record ${record._id} ("${record.title}"):`);
    console.log(`  Stored URL: ${storedUrl}`);
    console.log(`  publicId: ${publicId}, resourceType: ${resourceType}, mimeType: ${mimeType}`);

    let buffer = null;

    // Strategy 1: Cloudinary signed private download url if publicId is present
    if (publicId) {
        const candidateTypes = [resourceType, resourceType === "image" ? "raw" : "image"];
        for (const rType of candidateTypes) {
            try {
                const format = (rType === "image" && (mimeType === "application/pdf" || extension === "pdf"))
                    ? "pdf"
                    : (rType === "image" ? (extension || "") : "");
                
                const signedUrl = cloudinary.utils.private_download_url(publicId, format, {
                    resource_type: rType,
                    type: "upload"
                });

                const res = await fetch(signedUrl);
                if (res.ok) {
                    const candidateBuf = Buffer.from(await res.arrayBuffer());
                    if (candidateBuf.length > 0) {
                        const prefix = candidateBuf.subarray(0, 15).toString("ascii").toLowerCase();
                        if (!prefix.includes("<!doc") && !prefix.includes("<html")) {
                            buffer = candidateBuf;
                            console.log(`  ✓ Strategy 1 Succeeded via private_download_url (${rType}): ${buffer.length} bytes`);
                            break;
                        }
                    }
                }
            } catch (err) {
                console.log(`  Strategy 1 attempt (${rType}) error:`, err.message);
            }
        }
    }

    // Strategy 2: Direct fetch fallback
    if (!buffer && storedUrl) {
        try {
            const res = await fetch(storedUrl);
            if (res.ok) {
                const candidateBuf = Buffer.from(await res.arrayBuffer());
                if (candidateBuf.length > 0) {
                    const prefix = candidateBuf.subarray(0, 15).toString("ascii").toLowerCase();
                    if (!prefix.includes("<!doc") && !prefix.includes("<html")) {
                        buffer = candidateBuf;
                        console.log(`  ✓ Strategy 2 Succeeded via direct fetch: ${buffer.length} bytes`);
                    }
                }
            }
        } catch (err) {
            console.log(`  Strategy 2 error:`, err.message);
        }
    }

    if (!buffer) {
        console.error(`  ✗ FAILED to retrieve buffer`);
        return null;
    }

    const isPdf = buffer.subarray(0, 4).toString("ascii") === "%PDF";
    console.log(`  Result: ${buffer.length} bytes | Starts with %PDF: ${isPdf}`);
    return buffer;
}

async function run() {
    await mongoose.connect(process.env.DB_URL);
    // Test with the 2 user records
    const r1 = await MedicalRecordModel.findById("6ac75838f7a1f5abb35133bd").lean();
    const r2 = await MedicalRecordModel.findById("6ac758a1f7a1f5abb35137cb").lean();
    await testFetchFunction(r1);
    await testFetchFunction(r2);

    // Also test with a raw record
    const rRaw = await MedicalRecordModel.findOne({ "file.resourceType": "raw" }).lean();
    if (rRaw) await testFetchFunction(rRaw);

    // Also test with an image record
    const rImg = await MedicalRecordModel.findOne({ "file.resourceType": "image", "file.mimeType": "image/png" }).lean();
    if (rImg) await testFetchFunction(rImg);

    await mongoose.disconnect();
}

run().catch(console.error);
