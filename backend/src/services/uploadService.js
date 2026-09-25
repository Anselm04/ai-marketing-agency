import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

const hasStorageCredentials = Boolean(
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY,
);

const s3Client = hasStorageCredentials ? new S3Client({
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
}) : null;

const BUCKET = process.env.S3_BUCKET || process.env.S3_BUCKET_NAME || 'ai-marketing-uploads';
const PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '') || null;

export function isS3Configured() {
  return !!s3Client && hasStorageCredentials;
}

async function putObject(key, body, contentType) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function uploadToS3(key, body, contentType) {
  await putObject(key, body, contentType);
  return getUploadUrl(key);
}

export async function uploadPrivateToS3(key, body, contentType) {
  await putObject(key, body, contentType);
  return { key };
}

export async function getSignedDownloadUrl(key, expiresIn = 3600) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

export function getUploadUrl(key) {
  if (!isS3Configured()) return null;
  if (PUBLIC_BASE_URL) return `${PUBLIC_BASE_URL}/${key}`;
  if (process.env.S3_ENDPOINT) return null;
  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}
