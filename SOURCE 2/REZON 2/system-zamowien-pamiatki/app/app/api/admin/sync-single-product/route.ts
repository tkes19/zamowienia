import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadFile, getR2PublicUrl } from '@/lib/r2';
import { Prisma } from '@prisma/client';

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

    if (!session?.user?.role || !['ADMIN', 'SALES_MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Pobieranie danych z API Rezon...');

    // Pobierz dane z zewnętrznego API
    const response = await fetch('https://rezon-api.vercel.app/api/v1/products');
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const apiResponse = await response.json();
    const externalProducts = apiResponse.data?.products || [];
    console.log(`📦 Pobrano ${externalProducts.length} produktów z API`);

    if (!externalProducts || externalProducts.length === 0) {
      return NextResponse.json({ error: 'Brak produktów w zewnętrznym API' }, { status: 400 });
    }

    // Pobierz istniejące produkty z bazy
    const existingProducts = await prisma.product.findMany({
      select: { identifier: true, index: true },
    });

    const existingIdentifiers = new Set(existingProducts.map(p => p.identifier));
    const existingIndexes = new Set(existingProducts.map(p => p.index));

    console.log(`📋 W bazie jest już ${existingProducts.length} produktów`);

    // Znajdź pierwszy produkt, którego nie ma w bazie
    const newProduct = externalProducts.find(
      (p: any) => p.pc_id && !existingIdentifiers.has(p.pc_id) && !existingIndexes.has(p.pc_id)
    );

    if (!newProduct) {
      return NextResponse.json({
        message: 'Wszystkie produkty z API są już w bazie danych',
        existingCount: existingProducts.length,
        apiCount: externalProducts.length,
      });
    }

    console.log(`✨ Znaleziono nowy produkt: ${newProduct.pc_id} - ${newProduct.name}`);

    // Mapowanie kategorii
    const categoryMapping: Record<string, string> = {
      'akcesoria podróżne': 'AKCESORIA_PODROZNE',
      'artykuły biurowe': 'ARTYKULY_BIUROWE',
      breloki: 'BRELOKI',
      'gadżety domowe': 'GADZETY_DOMOWE',
      'kubki i szklanki': 'KUBKI',
      magnesy: 'MAGNESY',
      odzież: 'ODZIEZ',
      parasole: 'PARASOLE',
      'prezenty świąteczne': 'PREZENTY_SWIATECZNE',
    };

    const mappedCategory = categoryMapping[newProduct.category?.toLowerCase()] || 'INNE';

    // Pobierz i wgraj obrazek do R2
    let mainImageUrl: string | null = null;
    if (newProduct.imageCover) {
      const originalImageUrl = newProduct.imageCover.startsWith('http')
        ? newProduct.imageCover
        : 'https://www.rezon.eu' + newProduct.imageCover;

      try {
        mainImageUrl = await downloadAndUploadImageToR2(
          originalImageUrl,
          newProduct.name, // Używamy name jako identifier
          mappedCategory.toLowerCase()
        );
      } catch (error) {
        console.warn('❌ Upload obrazka do R2 się nie powiódł, używam placeholdera:', error);
        mainImageUrl = null; // Fallback do placeholdera po stronie klienta
      }
    }

    // Przygotuj array obrazów
    let imageUrls: string[] = [];
{{ ... }}
      const uploadPromises = newProduct.images.map(async (img: any, index: number) => {
        if (typeof img !== 'string') {
          return null;
        }

        const originalUrl = img.startsWith('http') ? img : 'https://www.rezon.eu' + img;
        const identifierWithSuffix = index === 0 ? newProduct.name : `${newProduct.name}_${index + 1}`;

        try {
          const r2Url = await downloadAndUploadImageToR2(
            originalUrl,
            identifierWithSuffix,
            mappedCategory.toLowerCase()
          );
          return r2Url;
        } catch (error) {
          console.warn(`❌ Upload dodatkowego obrazka ${index + 1} się nie powiódł:`, error);
          return null;
        }
      });

      try {
        imageUrls = (await Promise.all(uploadPromises)).filter(Boolean) as string[];
      } catch (error) {
        console.warn('❌ Błąd przetwarzania dodatkowych obrazków:', error);
        imageUrls = [];
      }
    }

    // Utwórz produkt w bazie
    const createdProduct = await prisma.product.create({
      data: {
        id: `prod_${newProduct.pc_id}_${Date.now()}`,
        identifier: newProduct.pc_id,
        index: newProduct.pc_id,
        slug: newProduct.slug || newProduct.pc_id?.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        description: newProduct.description || newProduct.name || '',
        price: newProduct.price || 0,
        imageUrl: mainImageUrl,
        images: imageUrls.length > 0 ? imageUrls : Prisma.JsonNull,
        category: mappedCategory as any,
        productionPath: `TECHNOLOGY_${newProduct.technology || 1}`,
        isActive: newProduct.active !== false,
        new: newProduct.new === true,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Utworzono produkt: ${createdProduct.id}`);

    // Utwórz dane magazynowe jeśli są dostępne
    let inventoryCreated = null;
    if (newProduct.stock !== undefined || newProduct.stock_optimal !== undefined) {
      inventoryCreated = await prisma.inventory.create({
        data: {
          id: `inv_${newProduct.pc_id}_${Date.now()}`,
          productId: createdProduct.id,
          stock: newProduct.stock || 0,
          stockOptimal: newProduct.stock_optimal || 0,
          stockOrdered: newProduct.stock_ordered || 0,
          location: 'MAIN',
        },
      });

      console.log(`📦 Utworzono dane magazynowe: ${inventoryCreated.id}`);
    }

    return NextResponse.json({
      success: true,
      message: `Pomyślnie dodano produkt: ${newProduct.name}`,
      product: {
        id: createdProduct.id,
        identifier: createdProduct.identifier,
        name: newProduct.name,
        category: mappedCategory,
        price: newProduct.price,
        hasImages: imageUrls.length > 0,
        hasInventory: !!inventoryCreated,
      },
    });
  } catch (error) {
    console.error('❌ Błąd synchronizacji produktu:', error);
    return NextResponse.json(
      {
        error: 'Wystąpił błąd podczas dodawania produktu',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint do automatycznego dodania jednego nowego produktu z API Rezon',
    method: 'POST',
    auth: 'Required (ADMIN/SALES_MANAGER)',
  });
}
