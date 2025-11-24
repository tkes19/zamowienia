import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { ProductCategory } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { products } = await request.json();

    if (!Array.isArray(products)) {
      return NextResponse.json({ message: 'Products must be an array' }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const productData of products) {
      try {
        const { identifier, index, description, price, category, productionPath, isActive } =
          productData;

        if (!identifier || !index || price === undefined || !category) {
          console.log(`⚠️  Brakujące dane dla produktu: ${identifier}`);
          skipped++;
          continue;
        }

        // Sprawdź czy produkt już istnieje po identyfikatorze
        const existingProducts = await prisma.product.findMany({
          where: { identifier: identifier },
        });
        const existingProduct = existingProducts[0] || null;

        if (existingProduct) {
          skipped++;
          continue;
        }

        // Utwórz produkt
        await prisma.product.create({
          data: {
            id: crypto.randomUUID(),
            identifier,
            index,
            description: description || null,
            price: parseFloat(price.toString()),
            category: category as ProductCategory,
            productionPath: productionPath || '',
            isActive: isActive !== false, // Domyślnie true
            imageUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        imported++;
      } catch (error) {
        console.error(`❌ Błąd importu produktu ${productData.identifier}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('Error importing products:', error);
    return NextResponse.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
