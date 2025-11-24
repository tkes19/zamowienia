import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Pobierz z API
    const response = await fetch('https://rezon-api.vercel.app/api/v1/products');
    const apiData = await response.json();
    const apiProducts = apiData.data?.products || [];

    // Pobierz z bazy
    const dbProducts = await prisma.product.findMany({
      select: { identifier: true },
    });
    const dbNames = new Set(dbProducts.map(p => p.identifier));

    // Znajdź brakujące
    const missing = apiProducts
      .filter((p: any) => p.name && !dbNames.has(p.name))
      .map((p: any) => ({
        pc_id: p.pc_id,
        name: p.name,
        price: p.price,
        category: p.category,
      }));

    return NextResponse.json({
      total_api: apiProducts.length,
      total_db: dbProducts.length,
      missing_count: missing.length,
      missing_products: missing,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd' }, { status: 500 });
  }
}
