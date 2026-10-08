import dotenv from "dotenv";
dotenv.config();
import cloudinary from "../src/config/cloudinary.js";

async function testFetchAndSign() {
    const publicId = "careflow/medical-records/u9r2elzcwnrngtxloqtc";
    
    // 1. Signed URL as image
    const signedImageUrl = cloudinary.url(publicId, {
        resource_type: "image",
        format: "pdf",
        sign_url: true,
        type: "upload"
    });
    console.log("Signed image URL:", signedImageUrl);
    try {
        const res1 = await fetch(signedImageUrl);
        console.log("Signed image URL fetch status:", res1.status, res1.headers.get("content-type"), res1.headers.get("content-length"));
        const b1 = Buffer.from(await res1.arrayBuffer());
        console.log("Signed image bytes length:", b1.length, "Magic:", b1.slice(0, 10).toString("ascii"));
    } catch (e) {
        console.log("Signed image fetch error:", e.message);
    }

    // 2. Fetch using Cloudinary authenticated download or archive or private download
    // Let's check cloudinary.utils.private_download_url or download_archive_url
    try {
        const downloadUrl = cloudinary.utils.private_download_url(publicId, "pdf", {
            resource_type: "image",
            type: "upload"
        });
        console.log("Private download url:", downloadUrl);
        const res2 = await fetch(downloadUrl);
        console.log("Private download status:", res2.status, res2.headers.get("content-type"));
        const b2 = Buffer.from(await res2.arrayBuffer());
        console.log("Private download bytes:", b2.length, "Magic:", b2.slice(0, 10).toString("ascii"));
    } catch (e) {
        console.log("Private download error:", e.message);
    }

    // 3. Can we convert it to raw or re-upload it to raw?
    // How can we get the file data from Cloudinary?
    // Can we download via Admin API or cloudinary.api?
    // Let's check cloudinary api methods
}

testFetchAndSign().catch(console.error);
