import dotenv from "dotenv";
dotenv.config();
import cloudinary from "../src/config/cloudinary.js";

async function testAllDownloadPatterns() {
    const testCases = [
        // 1. Old PDF stored as image
        {
            name: "Old PDF as image",
            publicId: "careflow/medical-records/u9r2elzcwnrngtxloqtc",
            format: "pdf",
            resourceType: "image"
        },
        // 2. New PDF stored as raw (without .pdf in publicId)
        {
            name: "New PDF as raw (no ext)",
            publicId: "careflow/medical-records/annual_health_report-1791453032298-7uuwk",
            format: "",
            resourceType: "raw"
        },
        // 3. New PDF stored as raw (with .pdf in publicId)
        {
            name: "New PDF as raw (with .pdf)",
            publicId: "careflow/medical-records/cardiac_lab_report-1791452451087-js7xr.pdf",
            format: "",
            resourceType: "raw"
        },
        // 4. PNG image
        {
            name: "PNG image",
            publicId: "careflow/medical-records/qpi2zfezt1irau5elpdm",
            format: "png",
            resourceType: "image"
        }
    ];

    for (const tc of testCases) {
        console.log(`\n=== Testing: ${tc.name} ===`);
        const dlUrl = cloudinary.utils.private_download_url(tc.publicId, tc.format, {
            resource_type: tc.resourceType,
            type: "upload"
        });
        console.log("Generated private URL:", dlUrl);
        try {
            const res = await fetch(dlUrl);
            console.log(`Status: ${res.status}`);
            console.log(`Content-Type: ${res.headers.get("content-type")}`);
            console.log(`Content-Length: ${res.headers.get("content-length")}`);
            const buf = Buffer.from(await res.arrayBuffer());
            console.log(`Byte length: ${buf.length}`);
            console.log(`First 10 bytes:`, buf.slice(0, 10));
        } catch (e) {
            console.log(`Fetch error:`, e.message);
        }
    }
}

testAllDownloadPatterns().catch(console.error);
