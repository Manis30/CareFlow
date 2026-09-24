/**
 * Grounding Guardrail Service for CareFlow AI.
 * 
 * Validates that named entities, dates, and numbers present in LLM-synthesized output
 * are grounded in the retrieved tool context string / object passed to the model.
 */

const COMMON_STOPWORDS = new Set([
    "the", "this", "that", "there", "these", "those", "patient", "doctor", "medical",
    "note", "record", "report", "result", "summary", "based", "according", "you", "your",
    "have", "been", "with", "from", "for", "and", "are", "was", "were", "has", "had",
    "can", "may", "must", "should", "will", "would", "about", "above", "after", "again",
    "against", "all", "am", "an", "any", "at", "be", "because", "before", "being",
    "below", "between", "both", "but", "by", "could", "did", "do", "does", "doing",
    "down", "during", "each", "few", "further", "get", "got", "he", "her", "here",
    "hers", "herself", "him", "himself", "his", "how", "if", "in", "into", "is",
    "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor",
    "not", "now", "of", "off", "on", "once", "only", "or", "other", "our", "ours",
    "ourselves", "out", "over", "own", "same", "she", "so", "some", "such", "than",
    "that", "their", "theirs", "them", "themselves", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why",
    "will", "with", "you", "your", "yours", "yourself", "yourselves"
]);

// Paraphrase & Medical Term Mapping (e.g. bid -> twice daily, qd -> once daily, medical mechanisms, analytics metrics)
const PARAPHRASE_WHITELIST = new Set([
    "twice", "daily", "once", "day", "times", "taking", "take", "prescribed", "given",
    "medication", "medications", "drug", "drugs", "treatment", "dose", "dosage", "tablet", "tablets", "capsule",
    "capsules", "mg", "ml", "g", "mcg", "today", "yesterday", "tomorrow", "first",
    "second", "third", "fourth", "fifth", "infection", "bacterial", "viral", "condition", "conditions",
    "history", "summary", "notes", "status", "scheduled", "booked", "active", "completed",
    "blood", "pressure", "manage", "management", "managing", "lower", "lowering", "treat", "treating",
    "control", "controlling", "reduce", "reducing", "purpose", "vessels", "arterial", "vascular",
    "hypertension", "antihypertensive", "glucose", "sugar", "insulin", "inhibitor", "blocker",
    "channel", "calcium", "ace", "heart", "rate", "health", "care", "clinical", "help",
    "helps", "used", "action", "normal", "essential", "primary", "secondary", "body", "fluid",
    "high", "low", "assistant", "patient", "doctor", "relax", "relaxing", "widen", "widening",
    "workload", "liver", "produced", "producing", "response", "natural", "level", "levels",
    "consult", "questions", "further", "record", "records", "explanation", "diagnoses",
    "diagnosis", "morning", "bedtime", "meals", "meal", "food", "water", "evening", "night",
    "beta", "alpha", "diuretic", "statin", "vasodilator", "systemic", "symptom", "symptoms",
    "retention", "mechanism", "efficacy", "regimen", "therapy", "adherence", "renal", "kidney",
    "hepatic", "artery", "cardiovascular", "metabolic", "organ", "organs", "cell", "cells",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "also", "additionally", "furthermore", "overall", "specifically", "namely", "directions", "instructions", "usage", "information", "details", "overview",
    "documents", "document", "statistics", "personnel", "financial", "metrics", "metric", "platform", "appointment", "appointments",
    "department", "departments", "revenue", "volume", "clinic", "clinics", "system", "trends", "patients", "doctors", "consultation",
    "consultations", "intake", "assessment", "plan", "review", "context", "brief", "performance", "breakdown", "totals", "total",
    "count", "average", "utilization", "operational", "visit", "visits", "registered", "registration", "registrations", "growth",
    "distribution", "share", "organization", "organizations", "network", "capacity", "schedule"
]);

export const checkGroundingGuardrail = (generatedText, contextData) => {
    if (!generatedText || typeof generatedText !== "string") {
        return { isGrounded: true, ungroundedItems: [], fallbackText: "" };
    }

    const contextStr = (typeof contextData === "string" ? contextData : JSON.stringify(contextData)).toLowerCase();

    // 1. Build token & number set from contextData
    const contextTokens = new Set(contextStr.toLowerCase().match(/[a-z0-9'-]+/g) || []);
    const contextNumbers = new Set(contextStr.match(/\b\d+(?:\.\d+)?\b/g) || []);

    const ungroundedItems = [];

    // 2. Check Numbers in generatedText
    const genNumbers = generatedText.match(/\b\d+(?:\.\d+)?\b/g) || [];
    for (const num of genNumbers) {
        // Skip common low single digits 1-5 if context has numbers or words
        if (["1", "2", "3", "4", "5"].includes(num)) continue;

        if (!contextNumbers.has(num) && !contextStr.includes(num)) {
            ungroundedItems.push(`Number '${num}'`);
        }
    }

    // 3. Check ISO/Explicit Dates in generatedText
    const genDates = generatedText.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
    for (const dateStr of genDates) {
        if (!contextStr.includes(dateStr.toLowerCase())) {
            ungroundedItems.push(`Date '${dateStr}'`);
        }
    }

    // 4. Check Capitalized Proper Nouns / Specific Entities (excluding sentence starters, headings & stop words)
    const words = generatedText.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
        const rawWord = words[i].replace(/[^a-zA-Z0-9'-]/g, '');
        if (!rawWord || rawWord.length < 3) continue;

        const isCapitalized = /^[A-Z][a-z0-9'-]+$/.test(rawWord);
        const lowerWord = rawWord.toLowerCase();

        // Check if word is capitalized and not sentence-start, bullet-point start, or markdown heading
        const prevWord = i > 0 ? words[i - 1] : "";
        const isSentenceStart = i === 0 || /[.!?:\n]$/.test(prevWord) || /^[-*#•\d]/.test(prevWord) || /^[-*#•]/.test(words[i]);
        if (isCapitalized && !isSentenceStart) {
            if (!COMMON_STOPWORDS.has(lowerWord) && !PARAPHRASE_WHITELIST.has(lowerWord)) {
                if (!contextTokens.has(lowerWord) && !contextStr.includes(lowerWord)) {
                    ungroundedItems.push(`Named Entity '${rawWord}'`);
                }
            }
        }
    }

    const isGrounded = ungroundedItems.length === 0;

    if (!isGrounded) {
        console.warn(`[Grounding Guardrail Warning] Potential hallucination detected in generated answer: ${ungroundedItems.join(", ")}. Falling back to raw context.`);
    }

    return {
        isGrounded,
        ungroundedItems,
        fallbackText: typeof contextData === "string" ? contextData : JSON.stringify(contextData, null, 2)
    };
};
