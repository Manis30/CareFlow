import dotenv from "dotenv";
dotenv.config();
import cloudinary from "../src/config/cloudinary.js";

async function testRawWithPrivateDownload() {
    const rawPublicId = "careflow/medical-records/cardiac_lab_report-1791452451087-js7xr.pdf";
    console.log("Checking raw resource:", rawPublicId);

    try {
        const res = await cloudinary.api.resource(rawPublicId, { resource_type: "raw" });
        console.log("Raw found:", res.public_id, res.bytes, res.secure_url);
    } catch (e) {
        console.log("Raw not found with .pdf:", e.message);
    }

    try {
        const res2 = await cloudinary.api.resource("careflow/medical-records/cardiac_lab_report-1791452451087-js7xr", { resource_type: "raw" });
        console.log("Raw found without .pdf:", res2.public_id, res2.bytes, res2.secure_url);
    } catch (e) {
        console.log("Raw not found without .pdf:", e.message);
    }

    // Try private download URL for raw
    try {
        const dl = cloudinary.utils.private_download_url(rawPublicId, "", {
            resource_type: "raw",
            type: "upload"
        });
        console.log("Private download for raw:", dl);
        const f = await fetch(dl);
        console.log("Status:", f.status, f.headers.get("content-type"));
        const b = Buffer.from(await f.arrayBuffer());
        console.log("Bytes:", b.length);
    } catch (e) {
        console.log("Error:", e.message);
    }
}

testRawWithPrivateDownload().catch(console.error);
