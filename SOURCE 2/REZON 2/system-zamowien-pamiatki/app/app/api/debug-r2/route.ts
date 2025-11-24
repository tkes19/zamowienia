import { NextResponse } from 'next/server';
import AWS from 'aws-sdk';

export const dynamic = 'force-dynamic';

const s3 = new AWS.S3({
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  s3ForcePathStyle: true,
  region: 'auto',
});

const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

export async function GET() {
  try {
    const locationName = 'Ustronie Morskie';

    const filesParams = {
      Bucket: bucketName!,
      Prefix: `PROJEKTY MIEJSCOWOŚCI/${locationName}/`,
      MaxKeys: 50, // Tylko pierwszych 50 plików dla testu
    };

    console.log(`🔍 Debug: Skanowanie pierwszych 50 plików w folderze: ${locationName}`);
    const filesData = await s3.listObjectsV2(filesParams).promise();

    const files: string[] = [];
    const jpgFiles: string[] = [];
    const prefixes: Set<string> = new Set();

    if (filesData.Contents) {
      filesData.Contents.forEach(obj => {
        if (!obj.Key) return;

        const fileName = obj.Key.split('/').pop();
        if (fileName) {
          files.push(fileName);

          if (fileName.endsWith('.jpg')) {
            jpgFiles.push(fileName);

            // Sprawdź różne możliwe prefiksy
            const lowerFileName = fileName.toLowerCase();
            if (lowerFileName.includes('_')) {
              const prefix = lowerFileName.split('_')[0];
              prefixes.add(prefix);
            }
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      locationName,
      totalFiles: files.length,
      jpgFiles: jpgFiles.length,
      firstTenFiles: files.slice(0, 10),
      firstTenJpgFiles: jpgFiles.slice(0, 10),
      detectedPrefixes: Array.from(prefixes).sort(),
      isTruncated: filesData.IsTruncated || false,
    });
  } catch (error) {
    console.error('Debug R2 error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
