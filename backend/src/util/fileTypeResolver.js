import path from "node:path";

/**
 * Detects MIME type and format from binary magic bytes (signatures).
 * Prevents trusting spoofed file extensions.
 */
export const detectMagicBytes = (buffer) => {
    if (!buffer || buffer.length < 4) return null;

    // 1. PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
    if (buffer.length >= 5 &&
        buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2D) {
        return { mimeType: "application/pdf", extension: "pdf", category: "document" };
    }

    // 2. PNG: \x89PNG\r\n\x1a\n
    if (buffer.length >= 8 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
        return { mimeType: "image/png", extension: "png", category: "image" };
    }

    // 3. JPEG: 0xFF 0xD8 0xFF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { mimeType: "image/jpeg", extension: "jpg", category: "image" };
    }

    // 4. WEBP: RIFF....WEBP
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return { mimeType: "image/webp", extension: "webp", category: "image" };
    }

    // 5. DOCX (ZIP format container): PK\x03\x04
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
        return {
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            extension: "docx",
            category: "document"
        };
    }

    // 6. DOC (OLE Compound Binary format): 0xD0 0xCF 0x11 0xE0
    if (buffer.length >= 8 &&
        buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
        return { mimeType: "application/msword", extension: "doc", category: "document" };
    }

    return null;
};

/**
 * Sanitizes original filenames for safe storage and downloads.
 * Strips directory traversal characters, null bytes, and unsafe characters.
 */
export const sanitizeFileName = (originalName = "", fallbackExt = "pdf") => {
    if (!originalName || typeof originalName !== "string") {
        return `medical_document_${Date.now()}.${fallbackExt}`;
    }

    // Remove path separators and traversal
    const base = path.basename(originalName).trim();
    // Replace spaces and special characters with underscores
    const sanitized = base.replace(/[^\w\.\-\(\)]/g, "_").replace(/_{2,}/g, "_");
    
    if (!sanitized || sanitized === ".") {
        return `medical_document_${Date.now()}.${fallbackExt}`;
    }
    return sanitized;
};

/**
 * Central Medical File Type Resolver.
 * Resolves structured metadata from Multer file, record, or buffer.
 *
 * Requirements:
 * - PDF, DOC, DOCX, TXT -> category: "document", cloudinaryResourceType: "raw"
 * - JPG, JPEG, PNG, WEBP -> category: "image", cloudinaryResourceType: "image"
 */
export const resolveMedicalFileType = (file) => {
    if (!file) {
        return {
            isValid: false,
            error: "No file provided for inspection"
        };
    }

    const rawMime = (file.mimetype || file.mimeType || "").toLowerCase().trim();
    const rawName = (file.originalname || file.fileName || file.name || "").toLowerCase().trim();
    const extFromName = rawName.includes(".") ? rawName.split(".").pop() : "";

    // Check magic bytes if buffer is available
    const detectedMagic = file.buffer ? detectMagicBytes(file.buffer) : null;

    // 1. PDF Documents
    if (
        (detectedMagic && detectedMagic.mimeType === "application/pdf") ||
        rawMime === "application/pdf" ||
        extFromName === "pdf"
    ) {
        // If buffer was provided, verify it didn't fail magic byte check
        if (file.buffer && detectedMagic && detectedMagic.mimeType !== "application/pdf") {
            return {
                isValid: false,
                error: "File signature mismatch: File content is not a valid PDF document."
            };
        }

        return {
            isValid: true,
            category: "document",
            mimeType: "application/pdf",
            extension: "pdf",
            cloudinaryResourceType: "raw",
            previewSupported: true
        };
    }

    // 2. Images (PNG, JPG/JPEG, WEBP)
    if (
        (detectedMagic && detectedMagic.category === "image") ||
        rawMime.startsWith("image/") ||
        ["png", "jpg", "jpeg", "webp"].includes(extFromName)
    ) {
        const mime = detectedMagic?.mimeType || (
            extFromName === "png" ? "image/png" :
            extFromName === "webp" ? "image/webp" :
            "image/jpeg"
        );
        const ext = detectedMagic?.extension || (extFromName === "jpeg" ? "jpg" : extFromName || "jpg");

        return {
            isValid: true,
            category: "image",
            mimeType: mime,
            extension: ext,
            cloudinaryResourceType: "image",
            previewSupported: true
        };
    }

    // 3. Word Documents (DOCX)
    if (
        rawMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        extFromName === "docx" ||
        (detectedMagic && detectedMagic.extension === "docx")
    ) {
        return {
            isValid: true,
            category: "document",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            extension: "docx",
            cloudinaryResourceType: "raw",
            previewSupported: false
        };
    }

    // 4. Word Documents (DOC)
    if (
        rawMime === "application/msword" ||
        extFromName === "doc" ||
        (detectedMagic && detectedMagic.extension === "doc")
    ) {
        return {
            isValid: true,
            category: "document",
            mimeType: "application/msword",
            extension: "doc",
            cloudinaryResourceType: "raw",
            previewSupported: false
        };
    }

    // 5. Plain Text Documents (TXT)
    if (
        rawMime === "text/plain" ||
        extFromName === "txt"
    ) {
        return {
            isValid: true,
            category: "document",
            mimeType: "text/plain",
            extension: "txt",
            cloudinaryResourceType: "raw",
            previewSupported: true
        };
    }

    return {
        isValid: false,
        error: "Unsupported medical document format. Allowed types: PDF, DOC, DOCX, TXT documents and JPG, PNG, WEBP images."
    };
};
