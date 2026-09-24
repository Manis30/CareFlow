import { getOnlineMeetingService } from "../service/appointment.js";

export const registerVideoSocketHandlers = (io, socket) => {
    socket.on("join_video_room", async (data, ackCallback) => {
        try {
            const { appointmentId } = data || {};
            console.log(`[CareFlow WebRTC] Join request from user ${socket.user?.id} (${socket.user?.role}) for appt: ${appointmentId} (Socket: ${socket.id})`);

            if (!appointmentId) {
                const errPayload = { success: false, message: "Appointment ID is required" };
                if (typeof ackCallback === "function") ackCallback(errPayload);
                return socket.emit("video_error", errPayload);
            }

            if (!socket.user) {
                const errPayload = { success: false, message: "Authentication required" };
                if (typeof ackCallback === "function") ackCallback(errPayload);
                return socket.emit("video_error", errPayload);
            }

            // Verify access authorization
            const access = await getOnlineMeetingService(appointmentId, socket.user);
            if (!access.canJoin) {
                const errPayload = { success: false, message: access.reason || "Meeting is not available yet" };
                if (typeof ackCallback === "function") ackCallback(errPayload);
                return socket.emit("video_error", errPayload);
            }

            const roomName = `video_room:${appointmentId}`;
            socket.join(roomName);

            socket.currentVideoRoom = roomName;
            socket.appointmentId = appointmentId;

            // Fetch active peers in room
            const roomSockets = await io.in(roomName).fetchSockets();
            const peerList = roomSockets
                .filter((s) => s.id !== socket.id)
                .map((s) => ({
                    socketId: s.id,
                    user: s.user
                }));

            console.log(`[CareFlow WebRTC] User ${socket.user.id} joined room ${roomName}. Active peers count: ${peerList.length}`);

            const responsePayload = {
                success: true,
                appointmentId,
                roomId: access.roomId,
                peers: peerList,
                user: socket.user
            };

            if (typeof ackCallback === "function") {
                ackCallback(responsePayload);
            }

            socket.emit("video_room_joined", responsePayload);

            // Notify other participants in the room that a new peer arrived
            socket.to(roomName).emit("peer_joined", {
                socketId: socket.id,
                user: socket.user
            });
        } catch (err) {
            console.error(`[CareFlow WebRTC Error] Join room failed:`, err.message);
            const errPayload = { success: false, message: err.message || "Failed to join video room" };
            if (typeof ackCallback === "function") ackCallback(errPayload);
            socket.emit("video_error", errPayload);
        }
    });

    socket.on("webrtc_offer", (data) => {
        const { targetSocketId, offer } = data || {};
        console.log(`[CareFlow WebRTC] Relay SDP Offer from ${socket.id} -> ${targetSocketId}`);
        if (targetSocketId && offer) {
            io.to(targetSocketId).emit("webrtc_offer", {
                callerSocketId: socket.id,
                callerUser: socket.user,
                offer
            });
        }
    });

    socket.on("webrtc_answer", (data) => {
        const { targetSocketId, answer } = data || {};
        console.log(`[CareFlow WebRTC] Relay SDP Answer from ${socket.id} -> ${targetSocketId}`);
        if (targetSocketId && answer) {
            io.to(targetSocketId).emit("webrtc_answer", {
                responderSocketId: socket.id,
                responderUser: socket.user,
                answer
            });
        }
    });

    socket.on("webrtc_ice_candidate", (data) => {
        const { targetSocketId, candidate } = data || {};
        if (targetSocketId && candidate) {
            io.to(targetSocketId).emit("webrtc_ice_candidate", {
                senderSocketId: socket.id,
                candidate
            });
        }
    });

    socket.on("participant_media_state_changed", (data) => {
        const appointmentId = data?.appointmentId || socket.appointmentId;
        if (appointmentId) {
            const roomName = `video_room:${appointmentId}`;
            console.log(`[CareFlow WebRTC] Media state changed for user ${socket.user?.id} in room ${roomName}:`, data);
            socket.to(roomName).emit("participant_media_state_changed", {
                ...data,
                senderSocketId: socket.id,
                user: socket.user
            });
        }
    });

    socket.on("leave_video_room", (data) => {
        const appointmentId = data?.appointmentId || socket.appointmentId;
        if (appointmentId) {
            const roomName = `video_room:${appointmentId}`;
            console.log(`[CareFlow WebRTC] User ${socket.user?.id} leaving room ${roomName}`);
            socket.to(roomName).emit("peer_left", { socketId: socket.id, user: socket.user });
            socket.leave(roomName);
            delete socket.currentVideoRoom;
            delete socket.appointmentId;
        }
    });

    socket.on("disconnect", () => {
        if (socket.currentVideoRoom) {
            console.log(`[CareFlow WebRTC] Socket ${socket.id} disconnected from ${socket.currentVideoRoom}`);
            socket.to(socket.currentVideoRoom).emit("peer_left", { socketId: socket.id, user: socket.user });
        }
    });
};

export default registerVideoSocketHandlers;
