import http from 'http';
import app from './app.js';
import dbconnection from './config/db.js';
import initSocket from './config/socket.js';
import dotenv from 'dotenv';
import { autoCompleteExpiredAppointments } from './service/appointment.js';
import { startProactiveScheduler } from './service/scheduler/proactiveScheduler.js';
dotenv.config();

const startServer = async () => {
    try {
        await dbconnection();
        const server = http.createServer(app);
        initSocket(server);
        const port = process.env.PORT || 3000;
        server.listen(port, () => {
            console.log(`Server is running in ${port}`);
        });

        // Run auto-complete check immediately and then every 60 seconds
        autoCompleteExpiredAppointments();
        setInterval(() => {
            autoCompleteExpiredAppointments();
        }, 60000);

        // Start Phase 3 Proactive Scheduler (cron + MongoDB distributed lock)
        startProactiveScheduler();
    } catch (error) {
        console.log(`Server startup failed: ${error.message}`);
        process.exit(1);
    }
};
startServer();