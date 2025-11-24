import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

// Interface dla metadanych pliku
export interface R2FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
}

// Kategorie produktów i ich ścieżki w R2
export const R2_PATHS = {
  MIEJSCOWOSCI: 'projekty-miejscowosci',
  KLIENCI_INDYWIDUALNI: 'klienci-indywidualni',
  IMIENNE: 'imienne',
  HASLA: 'hasla',
  OKOLICZNOSCIOWE: 'okolicznosciowe',
} as const;

/**
 * Sprawdza czy plik istnieje w R2
 */
export async function checkFileExists(key: string): Promise<boolean> {
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Generuje publiczny URL dla pliku w R2
 * Zakłada konfigurację Custom Domain lub Public Access
 */
export function getR2PublicUrl(key: string): string {
  const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;

  if (publicDomain) {
    return `https://${publicDomain}/${key}`;
  }

  // Fallback do signed URL (tymczasowe rozwiązanie)
  return `/api/r2/file/${encodeURIComponent(key)}`;
}

/**
 * Generuje signed URL dla prywatnego dostępu do pliku
 */
export async function getSignedFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Pobiera listę plików z określonego prefixu (folderu)
 */
export async function listFiles(prefix: string): Promise<R2FileMetadata[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 1000,
    });

    const response = await r2Client.send(command);

    if (!response.Contents) {
      return [];
    }

    return response.Contents.map(item => ({
      key: item.Key || '',
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
      url: getR2PublicUrl(item.Key || ''),
    }));
  } catch (error) {
    console.error('Błąd podczas listowania plików:', error);
    return [];
  }
}

/**
 * Upload pliku do R2
 */
export async function uploadFile(
  key: string,
  file: Buffer,
  contentType?: string
): Promise<boolean> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType || 'image/jpeg',
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error('Błąd podczas uploadu pliku:', error);
    return false;
  }
}

/**
 * Pobiera pliki produktów dla określonej miejscowości
 */
export async function getProductFiles(miejscowosc: string): Promise<R2FileMetadata[]> {
  const prefix = `${R2_PATHS.MIEJSCOWOSCI}/${miejscowosc.toLowerCase()}_`;
  return await listFiles(prefix);
}

/**
 * Pobiera URL pliku produktu na podstawie miejscowości i identyfikatora
 */
export function getProductImageUrl(miejscowosc: string, identyfikator: string): string {
  const key = `${R2_PATHS.MIEJSCOWOSCI}/${miejscowosc.toLowerCase()}_${identyfikator}.jpg`;
  return getR2PublicUrl(key);
}

/**
 * Sprawdza połączenie z R2
 */
export async function testR2Connection(): Promise<{ success: boolean; message: string }> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 1,
    });

    await r2Client.send(command);

    return {
      success: true,
      message: 'Połączenie z R2 działa poprawnie',
    };
  } catch (error) {
    return {
      success: false,
      message: `Błąd połączenia z R2: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
    };
  }
}
