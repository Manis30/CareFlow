import { verifyToken } from "../util/token.js";

const parseCookieString = (cookieString) => {
    if (!cookieString) return {};
    return cookieString.split(";").reduce((res, item) => {
        const [key, val] = item.trim().split("=");
        if (key && val) {
            res[key] = decodeURIComponent(val);
        }
        return res;
    }, {});
};

export const socketAuth = (socket, next) => {
    try {
        let token =
            socket.handshake.auth?.token ||
            socket.handshake.auth?.accessToken;

        if (!token && socket.handshake.headers.cookie) {
            const cookies = parseCookieString(socket.handshake.headers.cookie);
            token = cookies.accessToken;
        }

        if (!token) {
            return next(new Error("Authentication required"));
        }

        const decoded = verifyToken(token, process.env.JWT_ACCESS_SECRET);
        socket.user = {
            id: decoded.id,
            role: decoded.role,
            organizationId: decoded.organizationId
        };
        next();
    } catch (error) {
        return next(new Error("Invalid or expired access token"));
    }
};

export default socketAuth;
