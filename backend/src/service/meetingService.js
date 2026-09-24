import crypto from 'crypto';

/**
 * Creates a secure, unguessable Jitsi Meet room for an online appointment.
 */
export const getIceServers = () => {
    const iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ];

    if (process.env.TURN_URL) {
        iceServers.push({
            urls: process.env.TURN_URL,
            username: process.env.TURN_USERNAME || "",
            credential: process.env.TURN_CREDENTIAL || ""
        });
    }

    return iceServers;
};

export const createMeetingSession = (appointmentId = '') => {
    const randomToken = crypto.randomBytes(8).toString('hex');
    const cleanApptId = String(appointmentId).replace(/[^a-zA-Z0-9]/g, '');
    const roomName = `careflow-${cleanApptId || 'session'}-${randomToken}`;

    return {
        provider: "careflow-webrtc",
        roomId: roomName,
        roomName,
        meetingUrl: `/meeting/${appointmentId}`,
        status: "scheduled",
        iceServers: getIceServers()
    };
};

export const createJitsiMeeting = createMeetingSession;

export default {
    createMeetingSession,
    createJitsiMeeting,
    getIceServers
};
