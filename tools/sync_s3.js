const { Pool } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.S3_BUCKET_NAME || 'social-app-files';

async function migrateAndSync() {
  try {
    console.log('Running column migrations on posts table...');
    await pool.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS s3_key TEXT;');
    await pool.query('ALTER TABLE posts ADD COLUMN IF NOT EXISTS s3_url TEXT;');
    console.log('Migrations completed successfully.');

    const mediaRoot = path.join(process.cwd(), 'media', 'generated');
    if (!fs.existsSync(mediaRoot)) {
      console.log('No media/generated folder found.');
      return;
    }

    const cals = fs.readdirSync(mediaRoot);
    console.log('Found calendar directories:', cals);
    let uploadedCount = 0;

    for (const calId of cals) {
      const calDir = path.join(mediaRoot, calId);
      if (!fs.statSync(calDir).isDirectory()) continue;

      const ownerRes = await pool.query('SELECT user_id FROM content_calendars WHERE id = $1', [calId]);
      const userId = ownerRes.rows[0]?.user_id || 'usr_b461db165c65102ec785';

      const files = fs.readdirSync(calDir);
      for (const file of files) {
        const filePath = path.join(calDir, file);
        if (!fs.statSync(filePath).isFile()) continue;

        const key = `${userId}/${calId}/${file}`;
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(file).toLowerCase();
        const contentType =
          ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream';

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buf,
            ContentType: contentType,
          })
        );

        const s3Url = `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
        const mediaUrl = `/api/media/generated/${calId}/${file}`;

        await pool.query(
          'UPDATE posts SET s3_key = $1, s3_url = $2 WHERE calendar_id = $3 AND (media_url = $4 OR media_url LIKE $5)',
          [key, s3Url, calId, mediaUrl, `%${file}%`]
        );
        uploadedCount++;
        console.log(`[Synced to S3] ${key}`);
      }
    }
    console.log(`Successfully synced ${uploadedCount} existing media files to S3 bucket '${bucket}' grouped by userId!`);
  } catch (e) {
    console.error('Error during migrate and sync:', e);
  } finally {
    await pool.end();
  }
}

migrateAndSync();

