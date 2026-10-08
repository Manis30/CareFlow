import dotenv from "dotenv";
dotenv.config();
import cloudinary from "../src/config/cloudinary.js";

async function checkCloudinaryAssets() {
    const ids = [
        "careflow/medical-records/u9r2elzcwnrngtxloqtc",
        "careflow/medical-records/i8vyvrcyykgpdgxaucjd",
        "careflow/medical-records/u9r2elzcwnrngtxloqtc.pdf",
        "careflow/medical-records/i8vyvrcyykgpdgxaucjd.pdf",
        "u9r2elzcwnrngtxloqtc",
        "i8vyvrcyykgpdgxaucjd"
    ];

    for (const id of ids) {
        console.log(`\n--- Checking ID: ${id} ---`);
        for (const rType of ["image", "raw"]) {
            try {
                const res = await cloudinary.api.resource(id, { resource_type: rType });
                console.log(`[${rType}] FOUND:`, {
                    public_id: res.public_id,
                    format: res.format,
                    resource_type: res.resource_type,
                    type: res.type, // upload / authenticated / private?
                    access_mode: res.access_mode,
                    bytes: res.bytes,
                    url: res.url,
                    secure_url: res.secure_url
                });
            } catch (err) {
                console.log(`[${rType}] NOT FOUND / ERROR: ${err.message}`);
            }
        }
    }
}

checkCloudinaryAssets().catch(console.error);
