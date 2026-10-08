import zlib from "zlib";
import { createWorker } from "tesseract.js";

/**
 * Decode ASCII85 string to Buffer.
 */
export const decodeAscii85 = (str) => {
    if (!str || typeof str !== "string") return Buffer.alloc(0);
    const cleaned = str.replace(/<~|~>|\s/g, "");
    const out = [];

    for (let i = 0; i < cleaned.length; ) {
        if (cleaned[i] === "z") {
            out.push(0, 0, 0, 0);
            i++;
            continue;
        }
        let count = 0;
        let value = 0;
        for (let j = 0; j < 5; j++) {
            if (i < cleaned.length) {
                value = value * 85 + (cleaned.charCodeAt(i) - 33);
                count++;
                i++;
            } else {
                value = value * 85 + 84;
            }
        }
        for (let k = 0; k < count - 1; k++) {
            out.push((value >>> (24 - 8 * k)) & 0xff);
        }
    }

    return Buffer.from(out);
};

/**
 * Deterministic text extraction from PDF buffer via content streams (Flate + ASCII85).
 */
export const extractTextFromPdfBuffer = (buffer) => {
    if (!buffer || !Buffer.isBuffer(buffer)) return "";
    let p = 0;
    const lines = [];

    while ((p = buffer.indexOf(Buffer.from("stream"), p)) !== -1) {
        let sStart = p + 6;
        while (sStart < buffer.length && (buffer[sStart] === 0x0a || buffer[sStart] === 0x0d || buffer[sStart] === 0x20)) {
            sStart++;
        }
        const sEnd = buffer.indexOf(Buffer.from("endstream"), sStart);
        if (sEnd === -1) break;

        let streamChunk = buffer.subarray(sStart, sEnd);
        while (streamChunk.length > 0 && (streamChunk[streamChunk.length - 1] === 0x0a || streamChunk[streamChunk.length - 1] === 0x0d || streamChunk[streamChunk.length - 1] === 0x20)) {
            streamChunk = streamChunk.subarray(0, streamChunk.length - 1);
        }

        const strChunk = streamChunk.toString("latin1");
        let decomp = null;
        try {
            decomp = zlib.inflateSync(streamChunk);
        } catch {
            try {
                const a85 = decodeAscii85(strChunk);
                decomp = zlib.inflateSync(a85);
            } catch {
                // not a compressed Flate stream
            }
        }

        if (decomp) {
            const streamText = decomp.toString("latin1");

            // 1. Tj operators: (text) Tj
            const tjRegex = /\(([\s\S]*?)\)\s*Tj/g;
            let m;
            while ((m = tjRegex.exec(streamText)) !== null) {
                const unescaped = m[1].replace(/\\([()\\])/g, "$1");
                if (unescaped.trim()) lines.push(unescaped.trim());
            }

            // 2. TJ operators: [ (text1) -10 (text2) ] TJ
            const tjArrRegex = /\[([\s\S]*?)\]\s*TJ/g;
            while ((m = tjArrRegex.exec(streamText)) !== null) {
                const inner = m[1];
                const parts = [];
                const innerRegex = /\(([\s\S]*?)\)/g;
                let im;
                while ((im = innerRegex.exec(inner)) !== null) {
                    parts.push(im[1].replace(/\\([()\\])/g, "$1"));
                }
                const combined = parts.join("").trim();
                if (combined) lines.push(combined);
            }

            // 3. Hex strings: <48656c6c6f> Tj
            const hexTjRegex = /<([0-9a-fA-F]+)>\s*Tj/g;
            while ((m = hexTjRegex.exec(streamText)) !== null) {
                const hexStr = m[1];
                const textFromHex = Buffer.from(hexStr, "hex").toString("latin1").trim();
                if (textFromHex) lines.push(textFromHex);
            }
        }

        p = sEnd + 9;
    }

    return lines.join("\n");
};

/**
 * Optical character recognition (OCR) using Tesseract.js for image buffers.
 */
export const extractTextFromImageBuffer = async (imageBuffer) => {
    let worker = null;
    try {
        worker = await createWorker("eng");
        const ret = await worker.recognize(imageBuffer).catch((recErr) => {
            console.warn("[Tesseract Recognize Error Handled]:", recErr.message);
            return { data: { text: "", confidence: 0 } };
        });
        await worker.terminate();

        const confidence = ret.data?.confidence || 0;
        const text = ret.data?.text || "";

        return {
            text: text.trim(),
            confidence: Math.round(confidence),
            isLowConfidence: confidence < 50,
            method: "tesseract_ocr"
        };
    } catch (err) {
        if (worker) {
            try { await worker.terminate(); } catch {}
        }
        console.error("[Tesseract OCR Error]:", err.message);
        return {
            text: "",
            confidence: 0,
            isLowConfidence: true,
            method: "tesseract_ocr_failed"
        };
    }
};

/**
 * Unified Document Extractor: Supports PDF, PNG, JPG, WEBP, and TXT.
 * Preserves high confidence for digital text PDFs and runs OCR for images.
 */
export const extractTextFromDocumentBuffer = async ({ buffer, mimeType = "", fileName = "" }) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        return { text: "", confidence: 0, isLowConfidence: true, method: "empty_buffer" };
    }

    const isPdf = mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf") || buffer.slice(0, 5).toString() === "%PDF-";
    const isImage = mimeType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(fileName);
    const isText = mimeType.includes("text") || fileName.toLowerCase().endsWith(".txt");

    if (isPdf) {
        // Step 1: Fast local stream extraction
        const streamText = extractTextFromPdfBuffer(buffer);
        if (streamText && streamText.trim().length >= 40) {
            return {
                text: streamText.trim(),
                confidence: 98,
                isLowConfidence: false,
                method: "pdf_stream"
            };
        }

        // Step 2: If stream extraction yields minimal text (scanned PDF), try Tesseract or multimodal
        return {
            text: streamText.trim(),
            confidence: streamText.trim().length > 0 ? 80 : 0,
            isLowConfidence: streamText.trim().length === 0,
            method: "pdf_scanned"
        };
    }

    if (isImage) {
        return await extractTextFromImageBuffer(buffer);
    }

    if (isText) {
        const txt = buffer.toString("utf8").trim();
        return {
            text: txt,
            confidence: 100,
            isLowConfidence: false,
            method: "plain_text"
        };
    }

    // Default fallback
    const rawTxt = buffer.toString("utf8").replace(/[^\x20-\x7E\n\r\t]/g, "").trim();
    return {
        text: rawTxt,
        confidence: rawTxt.length > 50 ? 70 : 0,
        isLowConfidence: rawTxt.length < 50,
        method: "generic_buffer"
    };
};
