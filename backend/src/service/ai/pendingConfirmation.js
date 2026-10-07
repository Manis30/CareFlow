import crypto from "crypto";
import { AppError } from "../../middleware/errorHandler.js";
import AIPendingConfirmationModel from "../../model/aiPendingConfirmation.js";
import { normalizeRole } from "./roleNormalizer.js";

/**
 * Server-Side Persistent Pending Confirmation Store (Rule 8).
 * - Confirmation is persisted in MongoDB as the authoritative source of truth.
 * - Single-use atomic consumption prevents race conditions & double-booking.
 * - 15-minute expiration enforced via MongoDB TTL and query validation.
 * - Client cannot modify: patientId, doctorId, organizationId, date, time, consultationType, payment state.
 */
const CONFIRMATION_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Creates a cryptographically secure pending confirmation action persisted in MongoDB.
 */
export const createPendingConfirmation = async ({
    userId,
    role,
    organizationId = null,
    toolName,
    canonicalArgs = {},
    displayPayload = {},
    summary = ""
}) => {
    if (!userId) {
        throw new AppError(400, "userId is required to create a pending confirmation.");
    }
    if (!toolName) {
        throw new AppError(400, "toolName is required to create a pending confirmation.");
    }

    const canonicalRole = normalizeRole(role);
    const confirmationId = `cf-conf-${crypto.randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_MS);

    const actionHash = crypto
        .createHash("sha256")
        .update(`${userId}:${toolName}:${JSON.stringify(canonicalArgs)}:${now.getTime()}`)
        .digest("hex");

    const entryData = {
        confirmationId,
        userId: String(userId),
        role: canonicalRole,
        organizationId: organizationId ? String(organizationId) : null,
        toolName,
        canonicalArgs: Object.freeze({ ...canonicalArgs }),
        displayPayload: { ...displayPayload, confirmationId },
        summary,
        actionHash,
        consumed: false,
        consumedAt: null,
        expiresAt
    };

    try {
        await AIPendingConfirmationModel.create(entryData);
    } catch (err) {
        console.error("[PendingConfirmation Error] Failed to persist confirmation to MongoDB:", err.message);
        throw new AppError(500, "Failed to initialize server-side confirmation. Please retry.");
    }

    return {
        confirmationId,
        expiresAt,
        summary,
        displayPayload: entryData.displayPayload,
        canonicalArgs: entryData.canonicalArgs
    };
};

/**
 * Atomically retrieves and consumes a pending confirmation from MongoDB.
 * Validates existence, authenticated user ownership, expiration, and non-consumed state.
 * Throws 409 if already consumed to prevent double booking.
 * Throws 410 if expired.
 */
export const consumePendingConfirmation = async (confirmationId, userId) => {
    if (!confirmationId) {
        throw new AppError(400, "confirmationId is required to execute confirmation.");
    }

    const now = new Date();

    // First, inspect the document to provide accurate error codes if not actionable
    const existing = await AIPendingConfirmationModel.findOne({ confirmationId });
    if (!existing) {
        throw new AppError(404, "Confirmation action not found or has expired. Please initiate the request again.");
    }

    if (String(existing.userId) !== String(userId)) {
        throw new AppError(403, "You are not authorized to confirm this action.");
    }

    if (now > new Date(existing.expiresAt)) {
        await AIPendingConfirmationModel.deleteOne({ confirmationId }).catch(() => {});
        throw new AppError(410, "This confirmation request has expired (15-minute limit). Please request a new appointment slot.");
    }

    if (existing.consumed) {
        throw new AppError(409, "This action has already been confirmed and completed.");
    }

    // Atomic update to mark as consumed
    const updated = await AIPendingConfirmationModel.findOneAndUpdate(
        { confirmationId, userId, consumed: false },
        { $set: { consumed: true, consumedAt: now } },
        { returnDocument: 'after' }
    );

    if (!updated) {
        throw new AppError(409, "Action has already been processed or confirmed concurrently.");
    }

    return {
        toolName: updated.toolName,
        canonicalArgs: { ...updated.canonicalArgs },
        displayPayload: updated.displayPayload,
        summary: updated.summary,
        actionHash: updated.actionHash
    };
};

/**
 * Peek at a pending confirmation without consuming it.
 */
export const getPendingConfirmation = async (confirmationId) => {
    if (!confirmationId) return null;
    return await AIPendingConfirmationModel.findOne({ confirmationId }).lean();
};
