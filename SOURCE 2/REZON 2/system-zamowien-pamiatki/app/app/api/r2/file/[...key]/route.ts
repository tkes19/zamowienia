import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Konfiguracja R2 Client
const r2Client = new S3Client({
  region: 'auto',
  endpoint:
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'rezon-produkty';

export async function GET(request: NextRequest, { params }: { params: { key: string[] } }) {
  try {
    // Dekodowanie każdej części ścieżki osobno, aby właściwie obsłużyć polskie znaki
    const decodedParts = params.key.map(part => decodeURIComponent(part));
    const key = decodedParts.join('/');

    console.log('API: Pobieranie pliku z R2', {
      originalKey: params.key,
      decodedKey: key,
      parts: decodedParts,
    });

    // Pobierz plik bezpośrednio z R2 używając AWS SDK
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    let response;
    try {
      response = await r2Client.send(command);
    } catch (error) {
      console.warn('Direct R2 fetch failed, fallback to case-insensitive search', {
        key,
        error,
      });

      const keyLower = key.toLowerCase();
      const prefix = key.substring(0, key.lastIndexOf('/') + 1);
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
      });
      const listed = await r2Client.send(listCommand);

      const matchedKey = listed.Contents?.find(obj => obj.Key?.toLowerCase() === keyLower)?.Key;

      if (!matchedKey) {
        throw error;
      }

      response = await r2Client.send(
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: matchedKey,
        })
      );
    }

    if (!response.Body) {
      throw new Error('Plik nie został znaleziony w R2');
    }

    // Konwertuj stream na buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const fileData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      fileData.set(chunk, offset);
      offset += chunk.length;
    }

    return new NextResponse(fileData, {
      headers: {
        'Content-Type': response.ContentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': response.ContentLength?.toString() || fileData.length.toString(),
      },
    });
  } catch (error) {
    console.error('Błąd przy pobieraniu pliku z R2:', error);
    console.error('Parametry:', params);
    return NextResponse.json(
      {
        error: 'Nie można pobrać pliku',
        details: error instanceof Error ? error.message : 'Nieznany błąd',
        key: params.key?.join('/') || 'brak klucza',
      },
      { status: 500 }
    );
  }
}
