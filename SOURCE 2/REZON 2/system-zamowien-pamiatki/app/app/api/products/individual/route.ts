import { NextRequest, NextResponse } from 'next/server';
import AWS from 'aws-sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import 'dotenv/config';

export const dynamic = 'force-dynamic';

// Cache dla produktów R2 (TTL 10 minut)
const individualProductCache = new Map<string, { data: any[]; timestamp: number }>();
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

// Funkcja normalizacji nazwy (identyczna jak w PROJEKTY MIEJSCOWOŚCI)
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

// Funkcja wyciągnięcia identyfikatora z nazwy pliku
const extractIdentifierFromFile = (fileName: string, objectName: string): string => {
  const normalizedObject = normalizeName(objectName);
  const baseName = fileName.replace(/\.[^.]+$/i, '');
  const baseNameLower = baseName.toLowerCase();
  const expectedPrefix = `${normalizedObject}_`;

  if (!baseNameLower.startsWith(expectedPrefix)) {
    console.warn(`Prefix "${expectedPrefix}" nie pasuje do "${baseName}"`);
    // Fallback: zwróć całą nazwę bez rozszerzenia
    return baseName;
  }

  return baseName.slice(expectedPrefix.length);
};

// Funkcja konwersji identyfikatora pliku do formatu bazy (skopiowana z location-order.tsx)
const convertFileToDatabase = (fileIdentifier: string): string => {
  return fileIdentifier
    .replace(/_/g, ' ')
    .toUpperCase()
    .replace(/KOLO/g, 'KOŁO')
    .replace(/KREG/g, 'KRĄG')
    .replace(/TRZMA/g, 'TRZYMA');
};

// Funkcja znajdowania pasującego produktu (skopiowana z location-order.tsx)
const findMatchingProduct = (fileIdentifier: string, products: any[]): any => {
  const targetDatabaseFormat = convertFileToDatabase(fileIdentifier);

  let exactMatch = products.find(
    product => product.identifier?.toUpperCase() === targetDatabaseFormat
  );

  if (exactMatch) return exactMatch;

  exactMatch = products.find(
    product => product.index?.toUpperCase().replace(/[-\s]/g, ' ') === targetDatabaseFormat
  );

  if (exactMatch) return exactMatch;

  const fileWords = fileIdentifier
    .toLowerCase()
    .replace(/_/g, ' ')
    .split(' ')
    .filter(w => w.length > 2);

  if (fileWords.length === 0) return undefined;

  let bestMatch: any = undefined;
  let bestScore = 0;

  for (const product of products) {
    if (!product.identifier && !product.index) continue;

    const productText = `${product.identifier || ''} ${product.index || ''}`.toLowerCase();
    let score = 0;

    for (const word of fileWords) {
      if (productText.includes(word)) {
        score += 1;
      }
    }

    if (score === fileWords.length && score > bestScore) {
      bestScore = score;
      bestMatch = product;
    } else if (score > bestScore && score >= Math.ceil(fileWords.length * 0.6)) {
      bestScore = score;
      bestMatch = product;
    }
  }

  return bestMatch;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder');
    const object = searchParams.get('object');
    const refresh = searchParams.get('refresh') === 'true';

    console.log('🔍 API /products/individual called with params:', { folder, object, refresh });

    // Sprawdź sesję użytkownika
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Sprawdź czy R2 jest skonfigurowany
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

    // CASE 1: Brak parametrów - zwróć foldery użytkownika
    if (!folder) {
      console.log('📚 No folder - returning user assigned folders...');

      try {
        const userFolders = await prisma.$queryRaw`
          SELECT "folderName"
          FROM "UserFolderAccess"
          WHERE "userId" = ${userId} AND "isActive" = true
          ORDER BY "folderName"
        `;

        console.log(
          `✅ User folders loaded: ${Array.isArray(userFolders) ? userFolders.length : 0} items`
        );
        return NextResponse.json({
          success: true,
          folders: userFolders,
          source: 'database',
        });
      } catch (dbError) {
        console.error('Database error for user folders:', dbError);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to load user folders',
            details: dbError instanceof Error ? dbError.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    // CASE 2: Tylko folder - zwróć obiekty (podfoldery) w folderze
    if (folder && !object) {
      console.log(`🔍 Loading objects for folder: ${folder}`);

      // Sprawdź uprawnienia użytkownika do folderu
      try {
        const hasAccess = await prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM "UserFolderAccess"
          WHERE "userId" = ${userId} AND "folderName" = ${folder} AND "isActive" = true
        `;

        if (!Array.isArray(hasAccess) || !hasAccess[0] || hasAccess[0].count === 0) {
          return NextResponse.json(
            { success: false, error: 'Access denied to folder' },
            { status: 403 }
          );
        }

        // Skanuj podfoldery w R2
        const objectsParams = {
          Bucket: bucketName,
          Prefix: `KLIENCI INDYWIDUALNI/${folder}/`,
          Delimiter: '/',
        };

        const objectsData = await s3.listObjectsV2(objectsParams).promise();
        const objects: string[] = [];

        if (objectsData.CommonPrefixes) {
          objectsData.CommonPrefixes.forEach(prefixObj => {
            if (prefixObj.Prefix) {
              const objectName = prefixObj.Prefix.replace(
                `KLIENCI INDYWIDUALNI/${folder}/`,
                ''
              ).replace('/', '');

              if (objectName) {
                objects.push(objectName);
              }
            }
          });
        }

        console.log(`✅ Found ${objects.length} objects in folder ${folder}`);

        return NextResponse.json({
          success: true,
          folder,
          objects: objects.sort(),
          source: 'r2',
        });
      } catch (error) {
        console.error('Error loading objects:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to load objects',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    // CASE 3: Folder + object - zwróć produkty dla obiektu
    if (folder && object) {
      console.log(`🔍 Loading products for folder: ${folder}, object: ${object}`);

      // Sprawdź uprawnienia użytkownika do folderu
      try {
        const hasAccess = await prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM "UserFolderAccess"
          WHERE "userId" = ${userId} AND "folderName" = ${folder} AND "isActive" = true
        `;

        if (!Array.isArray(hasAccess) || !hasAccess[0] || hasAccess[0].count === 0) {
          return NextResponse.json(
            { success: false, error: 'Access denied to folder' },
            { status: 403 }
          );
        }

        // Sprawdź cache
        const cacheKey = `individual_${folder}_${object}`;
        const cached = individualProductCache.get(cacheKey);

        if (!refresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
          console.log(
            `📦 Returning cached products for ${folder}/${object}: ${cached.data.length} products`
          );
          return NextResponse.json({
            success: true,
            folder,
            object,
            products: cached.data,
            count: cached.data.length,
            source: 'cache',
            cachedAt: new Date(cached.timestamp).toISOString(),
          });
        }

        // Pobierz produkty z bazy danych do dopasowywania
        const databaseProducts = await prisma.product.findMany({
          where: { isActive: true },
          orderBy: { identifier: 'asc' },
        });

        // Skanuj pliki produktów w R2
        const productsParams = {
          Bucket: bucketName,
          Prefix: `KLIENCI INDYWIDUALNI/${folder}/${object}/`,
          MaxKeys: 10000,
        };

        const productsData = await s3.listObjectsV2(productsParams).promise();
        const products: Array<{
          id: string;
          identifier: string;
          name: string;
          imageUrl: string;
          category: string;
          price: number;
          isActive: boolean;
          databaseProduct?: any;
        }> = [];

        if (productsData.Contents) {
          productsData.Contents.forEach(obj => {
            if (!obj.Key) return;

            const fileName = obj.Key.split('/').pop();
            if (fileName && /\.jpe?g$/i.test(fileName)) {
              try {
                const identifier = extractIdentifierFromFile(fileName, object);
                const matchingDbProduct = findMatchingProduct(identifier, databaseProducts);

                const baseDisplayName = convertFileToDatabase(identifier);

                const originalNameLower = fileName.replace(/\.[^.]+$/i, '').toLowerCase();
                if (identifier.toLowerCase() === originalNameLower) {
                  // Nie dodawaj jeśli nie udało się odciąć prefiksu
                  return;
                }

                products.push({
                  id: `individual_${folder}_${object}_${identifier}`,
                  identifier,
                  name: matchingDbProduct
                    ? `${baseDisplayName} (${matchingDbProduct.index || matchingDbProduct.identifier})`
                    : baseDisplayName,
                  imageUrl: `/api/r2/file/KLIENCI%20INDYWIDUALNI/${encodeURIComponent(folder)}/${encodeURIComponent(object)}/${encodeURIComponent(fileName)}`,
                  category: matchingDbProduct?.category || 'PAMIĄTKI',
                  price: matchingDbProduct?.price || 15.99,
                  isActive: true,
                  databaseProduct: matchingDbProduct,
                });
              } catch (parseError) {
                console.warn(`Failed to parse file ${fileName}:`, parseError);
              }
            }
          });
        }

        // Sortuj produkty alfabetycznie
        products.sort((a, b) => a.name.localeCompare(b.name));

        // Zapisz do cache
        individualProductCache.set(cacheKey, { data: products, timestamp: Date.now() });

        console.log(`✅ Loaded ${products.length} products for ${folder}/${object} from R2`);

        return NextResponse.json({
          success: true,
          folder,
          object,
          products,
          count: products.length,
          source: 'r2',
          scannedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error loading individual products:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to load individual products',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
  } catch (error) {
    console.error('Error in individual products API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
