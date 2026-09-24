/**
 * Deterministic Emergency & Safety Screener for CareFlow Healthcare Platform.
 * DO NOT RELY ON LLM SOLELY FOR EMERGENCY DETECTION.
 * Rule: LLM cannot downgrade a deterministic emergency result.
 * Policy Decision: Hard-stopping the entire pipeline on any emergency keyword match
 * is an intentional clinical safety trade-off to prioritize patient safety over false-positives.
 */

const EMERGENCY_KEYWORDS = [
    "chest pain",
    "heart attack",
    "shortness of breath",
    "difficulty breathing",
    "can't breathe",
    "cannot breathe",
    "stroke",
    "facial drooping",
    "arm weakness",
    "slurred speech",
    "unconscious",
    "loss of consciousness",
    "passed out",
    "fainted",
    "syncope",
    "severe bleeding",
    "bleeding uncontrollably",
    "hemorrhage",
    "coughing up blood",
    "hemoptysis",
    "suicidal",
    "suicide",
    "overdose",
    "poisoning",
    "anaphylaxis",
    "anaphylactic shock",
    "acute anaphylaxis",
    "severe allergic reaction",
    "swelling of tongue",
    "swelling of throat",
    "cyanosis",
    "bluish lips",
    "severe chest distress",
    "acute respiratory distress",
    "seizure",
    "convulsions",
    "severe trauma",
    "cardiac arrest",
    "pulmonary embolism",
    "severe abdominal distress",
    "acute abdomen",
    "head trauma",
    "uncontrollable bleeding"
];

export const screenEmergencySymptoms = (text) => {
    if (!text || typeof text !== "string") {
        return { isEmergency: false, detectedKeyword: null };
    }

    const lowerText = text.toLowerCase();
    for (const keyword of EMERGENCY_KEYWORDS) {
        if (lowerText.includes(keyword)) {
            return {
                isEmergency: true,
                detectedKeyword: keyword,
                urgency: "emergency",
                escalationMessage: "EMERGENCY ALERT: Your symptoms may indicate a critical medical emergency. Please call local emergency services (108 / 911) or visit the nearest hospital Emergency Room immediately. Do not delay emergency care for an online booking."
            };
        }
    }

    return { isEmergency: false, detectedKeyword: null };
};

