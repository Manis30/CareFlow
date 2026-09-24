import NotificationModel from "../model/notification.js";

export const createNotificationService = async ({ userId, organizationId, title, message, type, metaData }) => {
    return await NotificationModel.create({
        userId,
        organizationId: organizationId || null,
        title,
        message,
        type: type || "SYSTEM_ALERT",
        metaData: metaData || {}
    });
};

export const getUserNotificationsService = async (userId) => {
    return await NotificationModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50);
};

export const markNotificationReadService = async (notificationId, userId) => {
    return await NotificationModel.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true }
    );
};
