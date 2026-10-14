import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/instock',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'instock_super_secret_access_token_key_dev',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'instock_super_secret_refresh_token_key_dev',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
