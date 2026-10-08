import dotenv from "dotenv";
dotenv.config();
import mongoose from "dotenv";
import cloudinary from "../src/config/cloudinary.js";

async function verifyBothOldPdfs() {
    const assets = [
        { id: "careflow/medical-records/u9r2elzcwnrngtxloqtc", format: "pdf", rType: "image" },
        { id: "careflow/medical-records/i8vyvrcyykgpdgxaucjd", format: "pdf", rType: "image" }
    ];

    for (const a of assets) {
        const dlUrl = cloudinary.utils.private_download_url(a.id, a.format, {
            resource_type: a.rType,
            type: "upload"
        });
        console.log(`Testing asset ${a.id}:`);
        console.log(`URL: ${dlUrl}`);
        const res = await fetch(dlUrl);
        console.log(`Status: ${res.status}`);
        console.log(`Content-Type: ${res.headers.get("content-type")}`);
        const buf = Buffer.from(await res.arrayBuffer());
        console.log(`Size: ${buf.length}`);
        console.log(`Magic: ${buf.slice(0, 10).toString("ascii")}`);
        console.log(`Is Real PDF: ${buf.slice(0, 4).toString("ascii") === "%PDF"}\n`);
    }
}

verifyBothOldPdfs().catch(console.error);
