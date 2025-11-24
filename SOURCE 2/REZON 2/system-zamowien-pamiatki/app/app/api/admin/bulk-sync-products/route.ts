import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadFile, getR2PublicUrl } from '@/lib/r2';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Retry funkcja dla operacji bazodanowych z problemami prepared statements
 */
async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isPreparedStatementError =
        error?.message?.includes('prepared statement') &&
        error?.message?.includes('does not exist');

      if (isPreparedStatementError && attempt < maxRetries) {
        console.warn(`🔄 Retry attempt ${attempt}/${maxRetries} for prepared statement error`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Max retries reached');
}

/**
 * Oblicza hash zawartości produktu do detekcji zmian
 */
function calculateProductHash(apiProduct: any): string {
  const contentString = JSON.stringify({
    name: apiProduct.name || '',
    price: apiProduct.price || 0,
    description: apiProduct.description || '',
    category: apiProduct.category || '',
    pc_id: apiProduct.pc_id || '',
    technology: apiProduct.technology || 0,
    stock: apiProduct.stock || 0,
    stock_optimal: apiProduct.stock_optimal || 0,
    active: apiProduct.active === true,
  });

  return crypto.createHash('md5').update(contentString).digest('hex');
}

/**
 * Pobiera obrazek z URL i wgrywa do R2
 */
async function downloadAndUploadImageToR2(
  imageUrl: string,
  identifier: string,
  category: string
): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  const extension = extensionMap[contentType] || 'jpg';
  const sanitizedIdentifier = identifier.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  const r2Key = `produkty/${category}/${sanitizedIdentifier}.${extension}`;

  const uploadSuccess = await uploadFile(r2Key, imageBuffer, contentType);

  if (!uploadSuccess) {
    throw new Error('Upload to R2 failed');
  }

  return getR2PublicUrl(r2Key);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      batchSize = 10, // Wielkość partii
      onlyChanged = true, // Tylko zmienione produkty
      includeImages = true, // Czy wgrywać obrazy
    } = await request.json();

    // 1. Pobierz dane z API
    const apiResponse = await fetch('https://rezon-api.vercel.app/api/v1/products');
    const apiData = await apiResponse.json();
    const apiProducts = apiData.data?.products?.filter((p: any) => p.name && p.pc_id) || [];

    // 2. Pobierz istniejące produkty z bazy
    const dbProducts = await prisma.product.findMany({
      select: {
        identifier: true,
        updatedAt: true,
      },
    });

    const dbProductsMap = new Map(dbProducts.map(p => [p.identifier, p]));

    // 3. Filtrowanie produktów do synchronizacji
    let productsToSync: any[] = [];

    for (const apiProduct of apiProducts) {
      const identifier = apiProduct.name;
      const newHash = calculateProductHash(apiProduct);
      const dbProduct = dbProductsMap.get(identifier);

      if (!dbProduct) {
        // Nowy produkt
        productsToSync.push({ apiProduct, action: 'create', hash: newHash });
      } else if (!onlyChanged) {
        // Tryb "sync all" - aktualizuj wszystkie produkty
        productsToSync.push({ apiProduct, action: 'update', hash: newHash });
      }
    }

    // 4. Przetwarzanie wsadowe
    const results = {
      total: productsToSync.length,
      processed: 0,
      created: 0,
      updated: 0,
      errors: [] as any[],
    };

    // Mapowanie kategorii - MUSI pasować do enum ProductCategory w schema.prisma
    const categoryMapping: Record<string, string> = {
      'akcesoria podróżne': 'AKCESORIA_PODROZNE',
      'artykuły biurowe': 'DLUGOPISY', // mapujemy na istniejącą kategorię
      breloki: 'BRELOKI',
      'gadżety domowe': 'OZDOBY_DOMOWE',
      'kubki i szklanki': 'CERAMIKA_I_SZKLO',
      magnesy: 'MAGNESY',
      odzież: 'TEKSTYLIA',
      parasole: 'AKCESORIA_PODROZNE',
      'prezenty świąteczne': 'UPOMINKI_BIZNESOWE',
      'torby i plecaki': 'TEKSTYLIA',
      bransoletki: 'BRANSOLETKI',
      'ceramika i szkło': 'CERAMIKA_I_SZKLO', // ✅ POPRAWIONE
      'czapki i nakrycia głowy': 'CZAPKI_I_NAKRYCIA_GLOWY', // ✅ POPRAWIONE
      'do auta': 'AKCESORIA_PODROZNE',
      dziecięce: 'DLA_DZIECI', // ✅ POPRAWIONE
      długopisy: 'DLUGOPISY',
      otwieracze: 'OTWIERACZE',
      'ozdoby domowe': 'OZDOBY_DOMOWE',
      tekstylia: 'TEKSTYLIA',
      'upominki biznesowe': 'UPOMINKI_BIZNESOWE',
      'zapalniczki i popielniczki': 'ZAPALNICZKI_I_POPIELNICZKI', // ✅ POPRAWIONE
      zestawy: 'ZESTAWY',
    };

    // Przetwarzaj w partiach
    for (let i = 0; i < productsToSync.length; i += batchSize) {
      const batch = productsToSync.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ({ apiProduct, action, hash }) => {
          try {
            const identifier = apiProduct.name;
            const mappedCategory =
              categoryMapping[apiProduct.category?.toLowerCase()] || 'MAGNESY';

            let mainImageUrl: string | null = null;
            let imageUrls: string[] = [];

            if (includeImages) {
              if (apiProduct.imageCover) {
                const originalImageUrl = apiProduct.imageCover.startsWith('http')
                  ? apiProduct.imageCover
                  : 'https://www.rezon.eu' + apiProduct.imageCover;

                try {
                  mainImageUrl = await downloadAndUploadImageToR2(
                    originalImageUrl,
                    identifier,
                    mappedCategory.toLowerCase()
                  );
                } catch (error) {
                  console.warn(`Image upload failed for ${identifier}, using placeholder:`, error);
                  mainImageUrl = null;
                }
              }

              if (Array.isArray(apiProduct.images)) {
                const galleryUploadPromises = apiProduct.images.map(async (img: any, index: number) => {
                  if (typeof img !== 'string') {
                    return null;
                  }

                  const originalUrl = img.startsWith('http') ? img : 'https://www.rezon.eu' + img;
                  const identifierWithSuffix = index === 0 ? identifier : `${identifier}_${index + 1}`;

                  try {
                    const r2Url = await downloadAndUploadImageToR2(
                      originalUrl,
                      identifierWithSuffix,
                      mappedCategory.toLowerCase()
                    );
                    return r2Url;
                  } catch (error) {
                    console.warn(
                      `Gallery upload failed for ${identifierWithSuffix}, skipping external URL:`,
                      error
                    );
                    return null;
                  }
                });

                try {
                  imageUrls = (await Promise.all(galleryUploadPromises)).filter(
                    (url): url is string => Boolean(url)
                  );
                } catch (error) {
                  console.warn(`Gallery processing failed for ${identifier}, clearing list:`, error);
                  imageUrls = [];
                }
              }
            }

            const existingProduct = await retryDatabaseOperation(() =>
              prisma.product.findFirst({
                where: { identifier },
              })
            );

            if (existingProduct) {
              await retryDatabaseOperation(() =>
                prisma.product.update({
                  where: { id: existingProduct.id },
                  data: {
                    index: apiProduct.pc_id || apiProduct.name,
                    slug: apiProduct.slug || identifier.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                    description: apiProduct.description || '',
                    price: apiProduct.price || 0,
                    imageUrl: mainImageUrl,
                    images: imageUrls.length > 0 ? imageUrls : Prisma.JsonNull,
                    category: mappedCategory as any,
                    productionPath: apiProduct.technology?.toString() || '1',
                    dimensions: apiProduct.dimensions || null,
                    isActive: apiProduct.active !== false,
                    new: apiProduct.new === true,
                    updatedAt: new Date(),
                  },
                })
              );
            } else {
              await retryDatabaseOperation(() =>
                prisma.product.create({
                  data: {
                    id: `prod_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
                    identifier,
                    index: apiProduct.pc_id || apiProduct.name,
                    slug: apiProduct.slug || identifier.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                    description: apiProduct.description || '',
                    price: apiProduct.price || 0,
                    imageUrl: mainImageUrl,
                    images: imageUrls.length > 0 ? imageUrls : Prisma.JsonNull,
                    category: mappedCategory as any,
                    productionPath: apiProduct.technology?.toString() || '1',
                    dimensions: apiProduct.dimensions || null,
                    isActive: apiProduct.active !== false,
                    new: apiProduct.new === true,
                    updatedAt: new Date(),
                  },
                })
              );
            }

            results.processed++;
            if (action === 'create') results.created++;
            if (action === 'update') results.updated++;
          } catch (error) {
            results.errors.push({
              product: apiProduct.name,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Synchronizacja zakończona. Przetworzono: ${results.processed}/${results.total}`,
    });
  } catch (error) {
    console.error('Bulk sync error:', error);
    return NextResponse.json(
      {
        error: 'Wystąpił błąd podczas masowej synchronizacji',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint do masowej synchronizacji produktów z API Rezon',
    method: 'POST',
    parameters: {
      batchSize: 'number (default: 10) - Wielkość partii',
      onlyChanged: 'boolean (default: true) - Tylko zmienione produkty',
      includeImages: 'boolean (default: true) - Czy wgrywać obrazy',
    },
  });
}
