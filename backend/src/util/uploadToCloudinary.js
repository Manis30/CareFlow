import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";
import { sanitizeFileName } from "./fileTypeResolver.js";

/**
 * Uploads a file buffer to Cloudinary using appropriate resource_type.
 * Documents (PDF, DOC, DOCX, TXT) must use resource_type: "raw".
 * Images (JPG, PNG, WEBP) use resource_type: "image".
 */
const uploadToCloudinary = (fileBuffer, folder, options = {}) => {
    return new Promise((resolve, reject) => {
        const resourceType = options.resourceType || "auto";
        const uploadOptions = {
            folder,
            resource_type: resourceType,
            ...options
        };

        // For raw documents (PDF, DOC, DOCX, TXT), use access_mode: "public" so the backend
        // can securely stream the raw file bytes without Cloudinary's default 401 restriction.
        // We do not append the extension to public_id because Cloudinary blocks .pdf in raw URL delivery by default.
        if (resourceType === "raw") {
            uploadOptions.access_mode = "public";
            if (!uploadOptions.public_id && options.fileName) {
                const cleanName = sanitizeFileName(options.fileName);
                const nameWithoutExt = cleanName.replace(/\.[^/.]+$/, "");
                const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                uploadOptions.public_id = `${nameWithoutExt}-${uniqueSuffix}`;
            }
        }

        const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) {
                return reject(error);
            }
            resolve({
                url: result.secure_url,
                publicId: result.public_id,
                resourceType: result.resource_type,
                format: result.format,
                bytes: result.bytes
            });
        });

        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
};

export default uploadToCloudinary;