import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import MedicalRecordModel from "../src/model/medicalRecord.js";
import cloudinary from "../src/config/cloudinary.js";

async function inspectMedicalRecords() {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to DB.");

    const records = await MedicalRecordModel.find().sort({ createdAt: -1 }).limit(10).lean();
    console.log(`Found ${records.length} recent medical records:\n`);

    for (const r of records) {
        console.log("=========================================");
        console.log(`ID: ${r._id}`);
        console.log(`Title: ${r.title}`);
        console.log(`RecordType: ${r.recordType}`);
        console.log(`File:`, JSON.stringify(r.file, null, 2));

        const url = r.file?.url;
        const publicId = r.file?.publicId;
        const resourceType = r.file?.resourceType;

        if (url) {
            try {
                const res = await fetch(url);
                console.log(`Direct Fetch URL (${url}):`);
                console.log(`  Status: ${res.status}`);
                console.log(`  Content-Type: ${res.headers.get("content-type")}`);
                console.log(`  Content-Length: ${res.headers.get("content-length")}`);
                const buf = Buffer.from(await res.arrayBuffer());
                console.log(`  Byte Length: ${buf.length}`);
                console.log(`  Magic Bytes: ${buf.slice(0, 10).toString("ascii")}`);
                console.log(`  Starts with %PDF: ${buf.slice(0, 4).toString("ascii") === "%PDF"}`);
                if (buf.slice(0, 10).toString("ascii").includes("<html") || buf.slice(0, 10).toString("ascii").includes("<!DOC")) {
                    console.log(`  First 200 chars: ${buf.slice(0, 200).toString("ascii")}`);
                }
            } catch (err) {
                console.error(`  Fetch failed: ${err.message}`);
            }
        }

        if (publicId) {
            console.log(`Cloudinary Admin API Check for public_id: "${publicId}":`);
            try {
                // Check raw
                const rawInfo = await cloudinary.api.resource(publicId, { resource_type: "raw" }).catch(e => ({ error: e.message }));
                console.log(`  Raw resource check:`, rawInfo.error ? `Error: ${rawInfo.error}` : `Found! format: ${rawInfo.format}, bytes: ${rawInfo.bytes}, secure_url: ${rawInfo.secure_url}`);
            } catch (e) {
                console.log(`  Raw check exception:`, e.message);
            }

            try {
                // Check image
                const imgInfo = await cloudinary.api.resource(publicId, { resource_type: "image" }).catch(e => ({ error: e.message }));
                console.log(`  Image resource check:`, imgInfo.error ? `Error: ${imgInfo.error}` : `Found! format: ${imgInfo.format}, bytes: ${imgInfo.bytes}, secure_url: ${imgInfo.secure_url}`);
            } catch (e) {
                console.log(`  Image check exception:`, e.message);
            }
        }
    }

    await mongoose.disconnect();
}

inspectMedicalRecords().catch(console.error);
