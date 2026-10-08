import multer from "multer";
import { resolveMedicalFileType } from "../util/fileTypeResolver.js";

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for medical documents and scans
    },
    fileFilter: (req, file, cb) => {
        const resolution = resolveMedicalFileType(file);
        if (resolution.isValid) {
            cb(null, true);
        } else {
            cb(new Error(resolution.error || "Unsupported file type. Only PDF, DOC, DOCX, TXT documents and JPG, PNG, WEBP images are allowed."));
        }
    }
});

export default upload;