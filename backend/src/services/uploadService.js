import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
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
const PRIVATE_BUCKET = process.env.S3_PRIVATE_BUCKET || BUCKET;
const PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '') || null;

function selectBucket(privateBucket = false) {
  return privateBucket ? PRIVATE_BUCKET : BUCKET;
}

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
  if (!isS3Configured()) throw new Error('S3 not configured');
  await s3Client.send(new PutObjectCommand({
    Bucket: PRIVATE_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return { key };
}

export async function deleteStoredObject(key, { privateBucket = false } = {}) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return { deleted: false, key: null, privateBucket: Boolean(privateBucket) };
  if (!isS3Configured()) {
    const error = new Error('S3-compatible storage is unavailable, so the stored object was not deleted.');
    error.code = 'object_storage_unavailable';
    error.statusCode = 503;
    error.status = 503;
    throw error;
  }
  await s3Client.send(new DeleteObjectCommand({
    Bucket: selectBucket(privateBucket),
    Key: normalizedKey,
  }));
  return { deleted: true, key: normalizedKey, privateBucket: Boolean(privateBucket) };
}

export async function getSignedDownloadUrl(key, expiresIn = 3600) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

export async function getPrivateSignedDownloadUrl(key, expiresIn = 3600) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key }), { expiresIn });
}

export async function createMultipartUpload(key, contentType = 'application/octet-stream', options = {}) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  const privateBucket = options.privateBucket === true;
  const result = await s3Client.send(new CreateMultipartUploadCommand({
    Bucket: selectBucket(privateBucket),
    Key: key,
    ContentType: contentType,
  }));
  if (!result.UploadId) throw new Error('Storage provider did not return a multipart upload ID');
  return { uploadId: result.UploadId, key, privateBucket };
}

export async function getMultipartPartUploadUrl({ key, uploadId, partNumber, expiresIn = 3600, privateBucket = false }) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  const normalizedPart = Number(partNumber);
  if (!Number.isInteger(normalizedPart) || normalizedPart < 1 || normalizedPart > 10000) {
    throw new Error('Multipart part number must be between 1 and 10000');
  }
  return getSignedUrl(s3Client, new UploadPartCommand({
    Bucket: selectBucket(privateBucket),
    Key: key,
    UploadId: uploadId,
    PartNumber: normalizedPart,
  }), { expiresIn });
}

export async function completeMultipartUpload({ key, uploadId, parts, privateBucket = false }) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  const result = await s3Client.send(new CompleteMultipartUploadCommand({
    Bucket: selectBucket(privateBucket),
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  }));
  return {
    key,
    url: privateBucket ? null : getUploadUrl(key),
    etag: result.ETag || null,
    location: privateBucket ? null : result.Location || null,
    privateBucket,
  };
}

export async function abortMultipartUpload({ key, uploadId, privateBucket = false }) {
  if (!isS3Configured()) throw new Error('S3 not configured');
  await s3Client.send(new AbortMultipartUploadCommand({
    Bucket: selectBucket(privateBucket),
    Key: key,
    UploadId: uploadId,
  }));
  return { aborted: true, key, privateBucket };
}

export function getUploadUrl(key) {
  if (!isS3Configured()) return null;
  if (PUBLIC_BASE_URL) return `${PUBLIC_BASE_URL}/${key}`;
  if (process.env.S3_ENDPOINT) return null;
  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}