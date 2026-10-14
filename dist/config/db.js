"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const connectDB = async (uri) => {
    const connectionUri = uri || env_1.config.mongoUri;
    try {
        const conn = await mongoose_1.default.connect(connectionUri);
        console.log(`[MongoDB] Connected to database: ${conn.connection.name}`);
        return conn;
    }
    catch (error) {
        console.error('[MongoDB] Connection error:', error);
        throw error;
    }
};
exports.connectDB = connectDB;
const disconnectDB = async () => {
    try {
        await mongoose_1.default.disconnect();
        console.log('[MongoDB] Disconnected successfully');
    }
    catch (error) {
        console.error('[MongoDB] Disconnect error:', error);
    }
};
exports.disconnectDB = disconnectDB;
