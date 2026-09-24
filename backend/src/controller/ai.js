import { processAIRequestService } from "../service/ai/aiGateway.js";
import { AppError } from "../middleware/errorHandler.js";

export const processAIRequestController = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError(401, "Authentication required to access CareFlow AI Gateway. Please log in.");
        }

        const result = await processAIRequestService(req.user, req.body);
        if (result && result.success === false) {
            const statusCode = result.statusCode || (result.error === "UNAUTHORIZED_ROLE" ? 403 : 400);
            return res.status(statusCode).json({
                success: false,
                message: result.aiResponse || result.error || "AI request failed",
                data: result
            });
        }
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const getAIChatHistoryController = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError(401, "Authentication required to access CareFlow AI Gateway. Please log in.");
        }
        const { getAIChatHistoryService } = await import("../service/ai/aiGateway.js");
        const userId = req.user.id || req.user._id;
        const orgId = req.user.organizationId?._id || req.user.organizationId || null;
        const history = await getAIChatHistoryService(userId, orgId);
        return res.status(200).json({
            success: true,
            data: history
        });
    } catch (err) {
        next(err);
    }
};

export const clearAIChatHistoryController = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError(401, "Authentication required to access CareFlow AI Gateway. Please log in.");
        }
        const AIChatHistoryModel = (await import("../model/aiChatHistory.js")).default;
        const userId = req.user.id || req.user._id;
        const orgId = req.user.organizationId?._id || req.user.organizationId || null;
        await AIChatHistoryModel.deleteOne({ userId, organizationId: orgId });
        return res.status(200).json({
            success: true,
            message: "Chat history cleared successfully"
        });
    } catch (err) {
        next(err);
    }
};
