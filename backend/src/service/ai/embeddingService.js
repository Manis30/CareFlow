import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

/**
 * CareFlow Canonical Embedding Configuration.
 * 
 * Strict Rules:
 * - Model: gemini-embedding-2
 * - Dimension: 768
 * - Similarity: cosine
 * - No user-chosen or LLM-chosen models/dimensions.
 * - Always pre-validate Array.isArray(embedding) && embedding.length === 768.
 * - No mock vectors, no Math.sin, no hardcoded values.
 */
export const EMBEDDING_CONFIG = Object.freeze({
    model: "gemini-embedding-2",
    outputDimensionality: 768,
    similarity: "cosine"
});

let aiInstance = null;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
    try {
        aiInstance = new GoogleGenAI({ apiKey });
    } catch (err) {
        console.error("Failed to initialize GoogleGenAI for embeddingService:", err.message);
    }
}

/**
 * Generate 768-dimensional real embedding using gemini-embedding-2.
 */
export const generateEmbeddingVector = async (text) => {
    if (!text || typeof text !== "string" || !text.trim()) {
        throw new Error("Text content is required to generate embedding");
    }

    if (!aiInstance || !process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured for embedding generation");
    }

    const response = await aiInstance.models.embedContent({
        model: EMBEDDING_CONFIG.model,
        contents: text,
        config: {
            outputDimensionality: EMBEDDING_CONFIG.outputDimensionality
        }
    });

    const values = response?.embeddings?.[0]?.values || response?.embedding?.values;

    if (!Array.isArray(values) || values.length !== EMBEDDING_CONFIG.outputDimensionality) {
        throw new Error(`Embedding generation returned invalid vector dimensions: expected ${EMBEDDING_CONFIG.outputDimensionality}, got ${values ? values.length : 'none'}`);
    }

    return values;
};
