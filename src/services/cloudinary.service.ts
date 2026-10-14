import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env';

// Configure Cloudinary
if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

export interface UploadSignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export const generateUploadSignature = (folder: string): UploadSignatureResponse => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const paramsToSign = {
    folder,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    config.cloudinary.apiSecret || 'dev_secret'
  );

  return {
    signature,
    timestamp,
    apiKey: config.cloudinary.apiKey,
    cloudName: config.cloudinary.cloudName,
    folder,
  };
};

export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  folder: string
): Promise<{ secure_url: string; public_id: string }> => {
  // If Cloudinary is not configured with real credentials in dev, provide a mock data URI or URL
  if (
    !config.cloudinary.cloudName ||
    !config.cloudinary.apiKey ||
    !config.cloudinary.apiSecret ||
    config.cloudinary.cloudName === 'mock_cloud'
  ) {
    const base64Data = buffer.toString('base64');
    const mockPublicId = `${folder}/mock_${Date.now()}`;
    // Return a valid base64 data URI so images display immediately even without a Cloudinary account
    return {
      secure_url: `data:image/jpeg;base64,${base64Data}`,
      public_id: mockPublicId,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Cloudinary upload returned empty result'));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

export const deleteCloudinaryImage = async (publicId: string): Promise<boolean> => {
  if (!publicId || publicId.startsWith('mock_') || publicId.includes('/mock_')) {
    return true;
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error(`Failed to delete Cloudinary asset [${publicId}]:`, error);
    return false;
  }
};
