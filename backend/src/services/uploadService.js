import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = process.env.S3_ENDPOINT ? new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
}) : null;

const BUCKET = process.env.S3_BUCKET || 'ai-marketing-uploads';

export function isS3Configured() {
  return !!s3Client && !!process.env.AWS_ACCESS_KEY_ID;
}

export async function uploadToS3(key, body, contentType) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

export async function getSignedDownloadUrl(key, expiresIn = 3600) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

export function getUploadUrl(key) {
  if (!isS3Configured()) return null;
  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}
