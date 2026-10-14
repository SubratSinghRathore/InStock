"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCloudinaryImage = exports.uploadBufferToCloudinary = exports.generateUploadSignature = void 0;
const cloudinary_1 = require("cloudinary");
const env_1 = require("../config/env");
// Configure Cloudinary
if (env_1.config.cloudinary.cloudName && env_1.config.cloudinary.apiKey && env_1.config.cloudinary.apiSecret) {
    cloudinary_1.v2.config({
        cloud_name: env_1.config.cloudinary.cloudName,
        api_key: env_1.config.cloudinary.apiKey,
        api_secret: env_1.config.cloudinary.apiSecret,
        secure: true,
    });
}
const generateUploadSignature = (folder) => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
        folder,
        timestamp,
    };
    const signature = cloudinary_1.v2.utils.api_sign_request(paramsToSign, env_1.config.cloudinary.apiSecret || 'dev_secret');
    return {
        signature,
        timestamp,
        apiKey: env_1.config.cloudinary.apiKey,
        cloudName: env_1.config.cloudinary.cloudName,
        folder,
    };
};
exports.generateUploadSignature = generateUploadSignature;
const uploadBufferToCloudinary = async (buffer, folder) => {
    // If Cloudinary is not configured with real credentials in dev, provide a mock data URI or URL
    if (!env_1.config.cloudinary.cloudName ||
        !env_1.config.cloudinary.apiKey ||
        !env_1.config.cloudinary.apiSecret ||
        env_1.config.cloudinary.cloudName === 'mock_cloud') {
        const base64Data = buffer.toString('base64');
        const mockPublicId = `${folder}/mock_${Date.now()}`;
        // Return a valid base64 data URI so images display immediately even without a Cloudinary account
        return {
            secure_url: `data:image/jpeg;base64,${base64Data}`,
            public_id: mockPublicId,
        };
    }
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            resource_type: 'image',
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        }, (error, result) => {
            if (error || !result) {
                return reject(error || new Error('Cloudinary upload returned empty result'));
            }
            resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
            });
        });
        uploadStream.end(buffer);
    });
};
exports.uploadBufferToCloudinary = uploadBufferToCloudinary;
const deleteCloudinaryImage = async (publicId) => {
    if (!publicId || publicId.startsWith('mock_') || publicId.includes('/mock_')) {
        return true;
    }
    try {
        const result = await cloudinary_1.v2.uploader.destroy(publicId);
        return result.result === 'ok';
    }
    catch (error) {
        console.error(`Failed to delete Cloudinary asset [${publicId}]:`, error);
        return false;
    }
};
exports.deleteCloudinaryImage = deleteCloudinaryImage;
