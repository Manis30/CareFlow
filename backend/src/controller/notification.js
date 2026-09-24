import { getUserNotificationsService, markNotificationReadService } from "../service/notification.js";
import { AppError } from "../middleware/errorHandler.js";

export const getMyNotificationsController = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError(401, "Authentication required");
        }
        const notifications = await getUserNotificationsService(req.user.id);
        return res.status(200).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        next(error);
    }
};

export const markReadController = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError(401, "Authentication required");
        }
        const updated = await markNotificationReadService(req.params.id, req.user.id);
        return res.status(200).json({
            success: true,
            data: updated
        });
    } catch (error) {
        next(error);
    }
};
