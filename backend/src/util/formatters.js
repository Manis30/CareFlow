/**
 * Canonical Doctor Name Formatter for CareFlow.
 * 
 * Rules:
 * 1. Database: "S. Priyadharshini" -> Display: "Dr. S. Priyadharshini"
 * 2. Database: "Dr. S. Priyadharshini" -> Display: "Dr. S. Priyadharshini"
 * 3. Never produce: "Dr. Dr. ...", "Dr. Doctor", "Dr. Specialist"
 * 4. Never use fake fallback names.
 * 5. If unavailable, return unavailable state rather than "Doctor".
 */
export const formatDoctorName = (rawName, unavailableFallback = null) => {
    if (!rawName || typeof rawName !== "string") {
        return unavailableFallback;
    }

    const trimmed = rawName.trim();
    if (!trimmed) {
        return unavailableFallback;
    }

    // Aggressively strip multiple leading "Dr.", "Dr ", "Doctor", "Dr. Dr.", "Specialist", case-insensitively
    const stripped = trimmed.replace(/^(dr\.?\s*|doctor\s*|specialist\s*)+/i, "").trim();

    // Check if stripped name is an invalid or fake placeholder
    const lower = stripped.toLowerCase();
    if (!stripped || lower === "unknown" || lower === "doctor" || lower === "specialist" || lower === "n/a") {
        return unavailableFallback;
    }

    // Preserve existing title-casing or format
    const formatted = stripped
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

    return `Dr. ${formatted}`;
};

