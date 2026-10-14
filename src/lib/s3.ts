import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

let cachedClient: S3Client | null = null;

/** Check whether required AWS S3 credentials are present in environment */
export function isS3Configured(): boolean {
  return !!(
    (process.env.AWS_ACCESS_KEY_ID || '').trim() &&
    (process.env.AWS_SECRET_ACCESS_KEY || '').trim() &&
    (process.env.S3_BUCKET_NAME || '').trim()
  );
}

export function getS3Bucket(): string {
  return (process.env.S3_BUCKET_NAME || 'social-app-files').trim();
}

export function getS3Region(): string {
  return (process.env.AWS_REGION || 'ap-south-1').trim();
}

/** Get or initialize singleton S3 client */
export function getS3Client(): S3Client {
  if (!cachedClient) {
    const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
    const region = getS3Region();

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS S3 credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are not configured');
    }

    cachedClient = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return cachedClient;
}

/**
 * Standard S3 object key layout grouped by userId:
 * `<userId>/<calendarId>/<fileName>`
 * or for standalone uploads: `<userId>/uploads/<fileName>`
 */
export function buildUserS3Key(
  userId: string,
  calendarId: string | null | undefined,
  fileName: string
): string {
  const cleanUser = String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanName = path.basename(fileName);
  if (calendarId) {
    const cleanCal = String(calendarId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${cleanUser}/${cleanCal}/${cleanName}`;
  }
  return `${cleanUser}/uploads/${cleanName}`;
}

export function getS3PublicUrl(key: string): string {
  const bucket = getS3Bucket();
  const region = getS3Region();
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/** Determine standard MIME Content-Type by file extension */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Upload a Buffer or Uint8Array directly to S3
 */
export async function uploadBufferToS3(params: {
  buffer: Buffer | Uint8Array;
  key: string;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<{ key: string; url: string; bucket: string }> {
  const client = getS3Client();
  const bucket = getS3Bucket();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    Body: params.buffer,
    ContentType: params.contentType || 'image/png',
    Metadata: params.metadata,
  });

  await client.send(command);
  const url = getS3PublicUrl(params.key);

  return {
    key: params.key,
    url,
    bucket,
  };
}

/**
 * Upload a local file to S3 grouped by userId
 */
export async function uploadLocalFileToS3(params: {
  filePath: string;
  userId: string;
  calendarId?: string | null;
  customFileName?: string;
  metadata?: Record<string, string>;
}): Promise<{
  key: string;
  url: string;
  bucket: string;
  fileName: string;
  bytes: number;
} | null> {
  if (!isS3Configured()) {
    console.warn('[S3] S3 credentials not configured, skipping S3 upload for:', params.filePath);
    return null;
  }

  if (!fs.existsSync(params.filePath)) {
    console.warn('[S3] Local file does not exist:', params.filePath);
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(params.filePath);
    const fileName = params.customFileName || path.basename(params.filePath);
    const key = buildUserS3Key(params.userId, params.calendarId, fileName);
    const contentType = getMimeType(params.filePath);

    const uploadRes = await uploadBufferToS3({
      buffer: fileBuffer,
      key,
      contentType,
      metadata: {
        userId: params.userId,
        calendarId: params.calendarId || '',
        ...params.metadata,
      },
    });

    return {
      ...uploadRes,
      fileName,
      bytes: fileBuffer.length,
    };
  } catch (error: any) {
    console.error(`[S3] Upload error for file ${params.filePath}:`, error.message);
    throw error;
  }
}

/**
 * Generate a secure presigned GET URL for an S3 object
 * (Useful because buckets with Block Public Access reject direct anonymous GETs)
 */
export async function getPresignedS3Url(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const client = getS3Client();
  const bucket = getS3Bucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Download an object from S3 as Buffer (ideal for fallback streaming or proxying)
 */
export async function downloadS3ObjectToBuffer(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isS3Configured()) return null;

  try {
    const client = getS3Client();
    const bucket = getS3Bucket();

    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!response.Body) return null;

    // Convert stream to Buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const contentType = response.ContentType || 'image/png';

    return { buffer, contentType };
  } catch (error: any) {
    console.error(`[S3] Download error for key ${key}:`, error.message);
    return null;
  }
}

/**
 * Check if an object exists in S3
 */
export async function checkS3ObjectExists(key: string): Promise<boolean> {
  if (!isS3Configured()) return false;
  try {
    const client = getS3Client();
    const bucket = getS3Bucket();
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

