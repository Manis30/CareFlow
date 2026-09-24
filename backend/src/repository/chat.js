import ChatModel from "../model/chat.js";

export const createChatMessage = async (data) => {
    return await ChatModel.create(data);
};

export const getAppointmentChatMessages = async (appointmentId) => {
    return await ChatModel.find({ appointmentId })
        .populate("senderId", "name email role profileImage")
        .sort({ createdAt: 1 });
};
