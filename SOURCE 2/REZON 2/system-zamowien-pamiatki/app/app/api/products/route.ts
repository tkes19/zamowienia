import { NextRequest, NextResponse } from 'next/server';
import AWS from 'aws-sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import 'dotenv/config';

export const dynamic = 'force-dynamic';

// Cache dla produktów R2 (TTL 10 minut)
const productCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minut

// Konfiguracja Cloudflare R2
const s3 = new AWS.S3({
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  s3ForcePathStyle: true,
  region: 'auto',
});

const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

// Funkcja normalizacji nazwy (identyczna jak w KLIENCI INDYWIDUALNI)
const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/ /g, '_')
    .replace(/ą/g, 'ą')
    .replace(/ć/g, 'ć')
    .replace(/ę/g, 'ę')
    .replace(/ł/g, 'ł')
    .replace(/ń/g, 'ń')
    .replace(/ó/g, 'ó')
    .replace(/ś/g, 'ś')
    .replace(/ź/g, 'ź')
    .replace(/ż/g, 'ż');
};

// Funkcja wyciągnięcia identyfikatora z nazwy pliku (identyczna jak w KI)
const extractIdentifierFromFile = (fileName: string, locationName: string): string => {
  const normalizedLocation = normalizeName(locationName);
  const baseName = fileName.replace(/\.[^.]+$/i, '');
  const baseNameLower = baseName.toLowerCase();
  const expectedPrefix = normalizedLocation + '_';

  if (!baseNameLower.startsWith(expectedPrefix)) {
    console.warn(
      `Prefix "${expectedPrefix}" nie pasuje do "${baseName}" dla miejscowości "${locationName}"`
    );
    // Fallback: zwróć całą nazwę bez rozszerzenia
    return baseName;
  }

  return baseName.slice(expectedPrefix.length);
};

// Funkcja parsowania nazwy pliku na czytelną nazwę produktu
const parseProductName = (identifier: string): string => {
  return identifier
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const refresh = searchParams.get('refresh') === 'true';

    console.log('🔍 API /products called with params:', { location, refresh });

    // CASE 1: Bez parametru location - zwróć produkty z bazy danych (katalog produktów)
    if (!location || location.trim() === '') {
      console.log('📚 No location - returning database products for catalog...');

      try {
        const databaseProducts = await prisma.product.findMany({
          where: {
            isActive: true,
          },
          orderBy: {
            identifier: 'asc',
          },
        });

        console.log(`✅ Database products loaded: ${databaseProducts.length} items`);
        return NextResponse.json(databaseProducts);
      } catch (dbError) {
        console.error('Database error, using fallback products:', dbError);

        // Fallback produkty jeśli baza nie działa
        const fallbackProducts = [
          {
            id: 'fallback-product-1',
            identifier: 'KIELISZEK_METAL',
            index: 'DK43-013A',
            slug: 'kieliszek-metal',
            description: 'Metalowy kieliszek pamiątkowy',
            price: 15.99,
            imageUrl: null,
            images: null,
            category: 'PAMIĄTKI',
            productionPath: null,
            dimensions: '5cm x 8cm',
            isActive: true,
            new: false,
          },
          {
            id: 'fallback-product-2',
            identifier: 'NIEZBĘDNIK',
            index: 'DK43-033D',
            slug: 'niezbednik',
            description: 'Niezbędnik turystyczny',
            price: 12.5,
            imageUrl: null,
            images: null,
            category: 'PAMIĄTKI',
            productionPath: null,
            dimensions: '8cm x 6cm',
            isActive: true,
            new: false,
          },
        ];

        return NextResponse.json(fallbackProducts);
      }
    }

    // If we have a location parameter, proceed with R2 logic
    // CASE 2: Z parametrem location - zwróć produkty z R2 dla lokalizacji
    console.log(`🔍 Pobieranie produktów z R2 dla lokalizacji: ${location}`);
    console.log('🔍 R2 Config Check:', {
      endpoint: !!process.env.CLOUDFLARE_R2_ENDPOINT,
      accessKeyId: !!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: !!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      bucketName: !!process.env.CLOUDFLARE_R2_BUCKET_NAME,
    });

    // Sprawdzenie czy R2 jest skonfigurowany
    if (!bucketName || !process.env.CLOUDFLARE_R2_ENDPOINT) {
      console.error('🔴 R2 not configured - missing environment variables');
      return NextResponse.json(
        {
          success: false,
          error: 'R2 storage not configured',
          details: 'Missing CLOUDFLARE_R2_BUCKET_NAME or CLOUDFLARE_R2_ENDPOINT',
        },
        { status: 500 }
      );
    }

    // Sprawdź cache (jeśli nie force refresh)
    const cacheKey = `products_${location}`;
    const cached = productCache.get(cacheKey);

    if (!refresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📦 Zwracam produkty z cache dla ${location}: ${cached.data.length} produktów`);
      return NextResponse.json({
        success: true,
        location,
        products: cached.data,
        count: cached.data.length,
        source: 'cache',
        cachedAt: new Date(cached.timestamp).toISOString(),
      });
    }

    // Skanuj R2 bucket
    console.log(`🔍 Skanowanie R2 dla lokalizacji: ${location}`);

    const filesParams = {
      Bucket: bucketName,
      Prefix: `PROJEKTY MIEJSCOWOŚCI/${location}/`,
      MaxKeys: 10000,
    };

    const filesData = await s3.listObjectsV2(filesParams).promise();
    const products: Array<{
      id: string;
      identifier: string;
      name: string;
      imageUrl: string;
      category: string;
      price: number;
      isActive: boolean;
    }> = [];

    if (filesData.Contents) {
      filesData.Contents.forEach(obj => {
        if (!obj.Key) return;

        const fileName = obj.Key.split('/').pop();
        if (fileName && /\.jpe?g$/i.test(fileName)) {
          // Wyciągnij identyfikator produktu z nazwy pliku (identyczna logika jak w KI)
          const identifier = extractIdentifierFromFile(fileName, location);

          // Sprawdź czy identyfikator został poprawnie wyciągnięty
          const originalNameLower = fileName.replace(/\.[^.]+$/i, '').toLowerCase();
          if (
            identifier &&
            identifier.length > 0 &&
            identifier.toLowerCase() !== originalNameLower
          ) {
            const productName = parseProductName(identifier);

            products.push({
              id: `r2_${location.toLowerCase()}_${identifier}`,
              identifier,
              name: productName,
              imageUrl: `/api/r2/file/PROJEKTY%20MIEJSCOWO%C5%9ACI/${encodeURIComponent(location)}/${encodeURIComponent(fileName)}`,
              category: 'PAMIĄTKI',
              price: 15.99, // Domyślna cena
              isActive: true,
            });
          }
        }
      });
    }

    // Sortuj produkty alfabetycznie
    products.sort((a, b) => a.name.localeCompare(b.name));

    // Zapisz do cache
    productCache.set(cacheKey, { data: products, timestamp: Date.now() });

    console.log(`✅ Załadowano ${products.length} produktów dla ${location} z R2`);

    return NextResponse.json({
      success: true,
      location,
      products,
      count: products.length,
      source: 'r2',
      scannedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching products from R2:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
