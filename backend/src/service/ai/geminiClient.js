import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

/**
 * Centralized Gemini Client Wrapper for CareFlow.
 * Rule: Access GEMINI_API_KEY ONLY from process.env on the backend.
 * Rule: Core functionality must not break if Gemini is offline/unavailable.
 */
let aiInstance = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
    try {
        aiInstance = new GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI client:", e.message);
    }
} else {
    console.warn("WARNING: GEMINI_API_KEY is not set in backend environment.");
}

export const getGeminiModelName = () => {
    return process.env.GEMINI_MODEL || "gemini-3.6-flash";
};

const callGroqFallback = async ({ systemInstruction, prompt, responseSchema }) => {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return null;
    try {
        let enhancedSystemInstruction = systemInstruction || "You are a professional healthcare assistant for CareFlow.";
        if (responseSchema) {
            let schemaFields = "intent, toolName, toolArgs, missingRequiredFields, confidence";
            if (responseSchema.properties) {
                schemaFields = Object.keys(responseSchema.properties).join(", ");
            }
            enhancedSystemInstruction += `\n\nCRITICAL JSON SCHEMA REQUIREMENT: You MUST respond ONLY with a valid JSON object. It MUST strictly contain the following fields: ${schemaFields}. Do not output any markdown code blocks or additional text.`;
        }

        const body = {
            model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
            messages: [
                { role: "system", content: enhancedSystemInstruction },
                { role: "user", content: prompt }
            ]
        };
        if (responseSchema) {
            body.response_format = { type: "json_object" };
        }
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            console.warn(`[Groq Fallback Warning]: HTTP ${res.status}`);
            return null;
        }
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (responseSchema && text) {
            return JSON.parse(text);
        }
        return { response: text };
    } catch (err) {
        console.warn("[Groq Fallback Warning]:", err.message);
        return null;
    }
};

export const generateStructuredContent = async ({ systemInstruction, prompt, responseSchema, timeoutMs = 10000 }) => {
    let lastError = null;

    if (aiInstance && process.env.GEMINI_API_KEY) {
        const primaryModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";
        const candidateModels = [primaryModel, "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"].filter((v, i, a) => a.indexOf(v) === i);

        for (const model of candidateModels) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const config = {
                        systemInstruction: systemInstruction || "You are a professional healthcare assistant for CareFlow.",
                        responseMimeType: responseSchema ? "application/json" : "text/plain"
                    };

                    if (responseSchema) {
                        config.responseSchema = responseSchema;
                    }

                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs)
                    );

                    const response = await Promise.race([
                        aiInstance.models.generateContent({
                            model,
                            contents: prompt,
                            config
                        }),
                        timeoutPromise
                    ]);

                    const text = response.text;
                    if (responseSchema && text) {
                        return JSON.parse(text);
                    }

                    return { response: text };
                } catch (error) {
                    lastError = error;
                    const isTransient = error.message?.includes("503") || error.message?.includes("429") || error.message?.includes("demand");
                    if (isTransient && attempt === 0) {
                        await new Promise(r => setTimeout(r, 600));
                        continue;
                    }
                    console.warn(`[Gemini Candidate Model ${model} Failed]:`, error.message);
                    break;
                }
            }
        }
        console.warn("[Gemini Gateway Error]: Primary model failed or timed out. Trying Groq fallback...");
    }

    // Fallback to Groq API if configured
    const groqResult = await callGroqFallback({ systemInstruction, prompt, responseSchema });
    if (groqResult) {
        return groqResult;
    }

    throw new Error(`AI processing failed: ${lastError?.message || 'Gemini and Groq services unreachable'}`);
};
