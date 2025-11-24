import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadFile, getR2PublicUrl } from '@/lib/r2';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Pobiera obrazek z URL i wgrywa do R2
 * @param imageUrl URL obrazka do pobrania
 * @param identifier Identyfikator produktu
 * @param category Kategoria produktu (małe litery)
 * @returns URL obrazka w R2
 */
async function downloadAndUploadImageToR2(
  imageUrl: string,
  identifier: string,
  category: string
): Promise<string> {
  // 1. Pobierz obrazek
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  // 2. Pobierz buffer i content-type
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  // 3. Wykryj rozszerzenie na podstawie Content-Type
  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  const extension = extensionMap[contentType] || 'jpg';

  // 4. Utwórz klucz R2: produkty/kategoria/IDENTIFIER.ext
  const sanitizedIdentifier = identifier.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  const r2Key = `produkty/${category}/${sanitizedIdentifier}.${extension}`;

  // 5. Wgraj do R2
  const uploadSuccess = await uploadFile(r2Key, imageBuffer, contentType);

  if (!uploadSuccess) {
    throw new Error('Upload to R2 failed');
  }

  // 6. Zwróć publiczny URL
  return getR2PublicUrl(r2Key);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json({ error: 'Identyfikator jest wymagany' }, { status: 400 });
    }

    // 1. Pobierz dane z API Rezon
    const apiResponse = await fetch('https://rezon-api.vercel.app/api/v1/products');
    const apiData = await apiResponse.json();
    const apiProducts = apiData.data?.products || [];

    const apiProduct = apiProducts.find((p: any) => p.name === identifier);

    if (!apiProduct) {
      return NextResponse.json(
        {
          error: 'Produkt nie znaleziony w API Rezon',
        },
        { status: 404 }
      );
    }

    // 2. Mapowanie kategorii - MUSI pasować do enum ProductCategory w schema.prisma
    const categoryMapping: Record<string, string> = {
      'akcesoria podróżne': 'AKCESORIA_PODROZNE',
      'artykuły biurowe': 'DLUGOPISY',
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

    const mappedCategory = categoryMapping[apiProduct.category?.toLowerCase()] || 'MAGNESY';

    // 3. Pobierz i wgraj obrazek do R2
    let mainImageUrl: string | null = null;
    if (apiProduct.imageCover) {
      const originalImageUrl = apiProduct.imageCover.startsWith('http')
        ? apiProduct.imageCover
        : 'https://www.rezon.eu' + apiProduct.imageCover;

      try {
        mainImageUrl = await downloadAndUploadImageToR2(
          originalImageUrl,
          identifier, // Identyfikator produktu
          mappedCategory.toLowerCase()
        );
        console.log(`✅ Obrazek wgrany do R2: ${mainImageUrl}`);
      } catch (error) {
        console.warn('❌ Upload obrazka do R2 się nie powiódł, używam placeholdera:', error);
        mainImageUrl = null; // Fallback do placeholdera po stronie klienta
      }
    }

    let imageUrls: string[] = [];
    if (apiProduct.images && Array.isArray(apiProduct.images)) {
      // Wgraj wszystkie obrazy do R2
      const uploadPromises = apiProduct.images.map(async (img: any, index: number) => {
        if (typeof img === 'string') {
          const originalUrl = img.startsWith('http') ? img : 'https://www.rezon.eu' + img;

          try {
            // Dla dodatkowych obrazów dodaj suffix _2, _3, etc.
            const identifierWithSuffix = index === 0 ? identifier : `${identifier}_${index + 1}`;

            const r2Url = await downloadAndUploadImageToR2(
              originalUrl,
              identifierWithSuffix,
              mappedCategory.toLowerCase()
            );

            console.log(`✅ Dodatkowy obrazek ${index + 1} wgrany do R2: ${r2Url}`);
            return r2Url;
          } catch (error) {
            console.warn(`❌ Upload dodatkowego obrazka ${index + 1} się nie powiódł, pomijam URL:`, error);
            return null; // Pomiń zewnętrzny URL
          }
        }
        return null;
      });

      try {
        imageUrls = (await Promise.all(uploadPromises)).filter((url): url is string => Boolean(url));
      } catch (error) {
        console.warn('❌ Błąd przetwarzania dodatkowych obrazków, pomijam kolekcję:', error);
        // Fallback do pustej listy, aby wymusić placeholdery po stronie klienta
        imageUrls = [];
      }
    }

    // 4. Sprawdź czy produkt istnieje w bazie
    const existingProduct = await prisma.product.findFirst({
      where: { identifier: identifier },
    });

    let product;
    let action;

    if (existingProduct) {
      // AKTUALIZUJ istniejący produkt
      product = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          index: apiProduct.pc_id || apiProduct.name,
          slug: apiProduct.slug || identifier.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          description: apiProduct.description || '',
          price: apiProduct.price || 0,
          imageUrl: mainImageUrl,
          images: imageUrls.length > 0 ? imageUrls : Prisma.JsonNull,
          category: mappedCategory as any,
          productionPath: apiProduct.technology?.toString() || '1', // wartość liczbowa
          dimensions: apiProduct.dimensions || null,
          isActive: apiProduct.active !== false,
          new: apiProduct.new === true,
          updatedAt: new Date(),
        },
      });
      action = 'updated';
    } else {
      // WSTAW nowy produkt
      product = await prisma.product.create({
        data: {
          id: `prod_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
          identifier: identifier,
          index: apiProduct.pc_id || apiProduct.name,
          slug: apiProduct.slug || identifier.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          description: apiProduct.description || '',
          price: apiProduct.price || 0,
          imageUrl: mainImageUrl,
          images: imageUrls.length > 0 ? imageUrls : Prisma.JsonNull,
          category: mappedCategory as any,
          productionPath: apiProduct.technology?.toString() || '1', // wartość liczbowa
          dimensions: apiProduct.dimensions || null,
          isActive: apiProduct.active !== false,
          new: apiProduct.new === true,
          updatedAt: new Date(),
        },
      });
      action = 'created';
    }

    // 5. Aktualizuj/utwórz dane magazynowe
    await prisma.inventory.upsert({
      where: {
        productId_location: {
          productId: product.id,
          location: 'MAIN',
        },
      },
      update: {
        stock: apiProduct.stock || 0,
        stockOptimal: apiProduct.stock_optimal || 0,
        stockOrdered: apiProduct.stock_ordered || 0,
        updatedAt: new Date(),
      },
      create: {
        id: `inv_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        stock: apiProduct.stock || 0,
        stockOptimal: apiProduct.stock_optimal || 0,
        stockOrdered: apiProduct.stock_ordered || 0,
        location: 'MAIN',
      },
    });

    return NextResponse.json({
      success: true,
      action: action,
      product: {
        id: product.id,
        identifier: product.identifier,
        name: apiProduct.name,
        category: mappedCategory,
        price: apiProduct.price,
        hasImages: imageUrls.length > 0,
        technology: apiProduct.technology,
      },
    });
  } catch (error) {
    console.error('❌ Błąd aktualizacji produktu:', error);
    return NextResponse.json(
      {
        error: 'Wystąpił błąd podczas aktualizacji produktu',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint do aktualizacji/dodawania produktu z API Rezon',
    method: 'POST',
    body: '{"identifier": "NAZWA_PRODUKTU"}',
    auth: 'Required (ADMIN)',
  });
}
