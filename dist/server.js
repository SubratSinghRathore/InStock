"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const startServer = async () => {
    try {
        await (0, db_1.connectDB)();
        const app = (0, app_1.createApp)();
        const server = app.listen(env_1.config.port, () => {
            console.log(`[InStock Backend] Server running on port ${env_1.config.port} in ${env_1.config.nodeEnv} mode`);
            console.log(`[InStock Backend] API base: http://localhost:${env_1.config.port}/api/v1`);
            console.log(`[InStock Backend] Health: http://localhost:${env_1.config.port}/api/v1/health`);
        });
        const gracefulShutdown = () => {
            console.log('[InStock Backend] Shutting down gracefully...');
            server.close(() => {
                console.log('[InStock Backend] HTTP server closed.');
                process.exit(0);
            });
        };
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
    }
    catch (error) {
        console.error('[InStock Backend] Fatal error during startup:', error);
        process.exit(1);
    }
};
startServer();
