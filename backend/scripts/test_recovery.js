import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import MedicalRecordModel from "../src/model/medicalRecord.js";
import cloudinary from "../src/config/cloudinary.js";
import uploadToCloudinary from "../src/util/uploadToCloudinary.js";

async function testRecovery() {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to DB.");

    const r1 = await MedicalRecordModel.findById("6ac75838f7a1f5abb35133bd");
    if (!r1) {
        console.log("Record 1 not found!");
        return;
    }

    console.log("Found Record 1:", r1.title, r1.file);

    // 1. Download original bytes using signed private download url
    const dlUrl = cloudinary.utils.private_download_url(r1.file.publicId, "pdf", {
        resource_type: "image",
        type: "upload"
    });
    console.log("Private download url:", dlUrl);
    const res = await fetch(dlUrl);
    console.log("Fetch status:", res.status, "content-type:", res.headers.get("content-type"));
    const buffer = Buffer.from(await res.arrayBuffer());
    console.log("Buffer length:", buffer.length, "Magic:", buffer.slice(0, 10).toString("ascii"));

    if (buffer.slice(0, 4).toString("ascii") !== "%PDF") {
        throw new Error("Fetched bytes are not a PDF!");
    }

    // 2. Upload to Cloudinary as raw
    const uploadResult = await uploadToCloudinary(buffer, "careflow/medical-records", {
        resourceType: "raw",
        fileName: "test_report.pdf"
    });
    console.log("Uploaded as raw successfully:", uploadResult);

    // 3. Test direct and signed fetch of new raw asset
    const rawCheck = await fetch(uploadResult.url);
    console.log("Raw direct fetch status:", rawCheck.status, "content-type:", rawCheck.headers.get("content-type"), "size:", (await rawCheck.arrayBuffer()).byteLength);

    const rawSignedUrl = cloudinary.utils.private_download_url(uploadResult.publicId, "", {
        resource_type: "raw",
        type: "upload"
    });
    const rawSignedCheck = await fetch(rawSignedUrl);
    console.log("Raw signed fetch status:", rawSignedCheck.status, "content-type:", rawSignedCheck.headers.get("content-type"), "size:", (await rawSignedCheck.arrayBuffer()).byteLength);

    await mongoose.disconnect();
}

testRecovery().catch(console.error);
