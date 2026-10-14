import mongoose from 'mongoose';
import { config } from './env';

export const connectDB = async (uri?: string): Promise<typeof mongoose> => {
  const connectionUri = uri || config.mongoUri;
  try {
    const conn = await mongoose.connect(connectionUri);
    console.log(`[MongoDB] Connected to database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error('[MongoDB] Disconnect error:', error);
  }
};
