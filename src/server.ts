import { createApp } from './app';
import { connectDB } from './config/db';
import { config } from './config/env';

const startServer = async () => {
  try {
    await connectDB();
    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`[InStock Backend] Server running on port ${config.port} in ${config.nodeEnv} mode`);
      console.log(`[InStock Backend] API base: http://localhost:${config.port}/api/v1`);
      console.log(`[InStock Backend] Health: http://localhost:${config.port}/api/v1/health`);
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
  } catch (error) {
    console.error('[InStock Backend] Fatal error during startup:', error);
    process.exit(1);
  }
};

startServer();
