import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import {
  isS3Configured,
  getS3Bucket,
  getS3Region,
  uploadLocalFileToS3,
  getS3Client,
} from '@/lib/s3';
import { HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const configured = isS3Configured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      message: 'AWS S3 is not configured in .env',
    });
  }

  try {
    const client = getS3Client();
    const bucket = getS3Bucket();
    const region = getS3Region();

    // Verify bucket connectivity
    await client.send(new HeadBucketCommand({ Bucket: bucket }));

    // List sample keys under this user's prefix
    const listRes = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${userId}/`,
        MaxKeys: 10,
      })
    );

    return NextResponse.json({
      configured: true,
      bucket,
      region,
      userId,
      userPrefix: `${userId}/`,
      userObjectCount: listRes.KeyCount || 0,
      sampleObjects: (listRes.Contents || []).map((o) => ({
        key: o.Key,
        size: o.Size,
        lastModified: o.LastModified,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        configured: true,
        error: error.message,
        bucket: getS3Bucket(),
        region: getS3Region(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/media/s3
 * Trigger a background sync of existing generated media files on disk into S3 grouped by userId.
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!isS3Configured()) {
    return NextResponse.json({ error: 'S3 credentials not configured' }, { status: 400 });
  }

  try {
    await initPostgresTables();

    // Find all calendars owned by this user
    const calRows = await pool.query(
      'SELECT id FROM content_calendars WHERE user_id = $1',
      [userId]
    );

    const calendarIds = calRows.rows.map((r: any) => String(r.id));
    const mediaRoot = path.join(process.cwd(), 'media', 'generated');
    let totalUploaded = 0;
    const syncedFiles: string[] = [];

    for (const calId of calendarIds) {
      const calDir = path.join(mediaRoot, calId);
      if (!fs.existsSync(calDir)) continue;

      const files = fs.readdirSync(calDir);
      for (const file of files) {
        const filePath = path.join(calDir, file);
        if (!fs.statSync(filePath).isFile()) continue;

        try {
          const res = await uploadLocalFileToS3({
            filePath,
            userId,
            calendarId: calId,
            customFileName: file,
          });

          if (res) {
            totalUploaded++;
            syncedFiles.push(res.key);

            // Update matching post in DB if it has this mediaUrl
            const mediaUrl = `/api/media/generated/${calId}/${file}`;
            await pool.query(
              'UPDATE posts SET s3_key = $1, s3_url = $2 WHERE user_id = $3 AND (media_url = $4 OR media_url LIKE $5)',
              [res.key, res.url, userId, mediaUrl, `%${file}%`]
            );
          }
        } catch (err: any) {
          console.error(`[S3 Sync] Error uploading ${file}:`, err.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: totalUploaded,
      syncedFiles,
      bucket: getS3Bucket(),
      region: getS3Region(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

