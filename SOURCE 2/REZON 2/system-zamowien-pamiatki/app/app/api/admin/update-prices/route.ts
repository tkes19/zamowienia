import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Sprawdź autoryzację - tylko admin może aktualizować ceny
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized - brak sesji' }, { status: 401 });
    }

    // Sprawdź czy użytkownik ma uprawnienia administratora
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - brak uprawnień administratora' },
        { status: 403 }
      );
    }

    console.log('🔍 Sprawdzanie produktów z ceną 0...');

    // Sprawdź ile produktów ma cenę 0
    const productsWithZeroPrice = await prisma.product.findMany({
      where: {
        price: 0,
      },
      select: {
        id: true,
        identifier: true,
        index: true,
        description: true,
        price: true,
        category: true,
      },
    });

    console.log(`📊 Znaleziono ${productsWithZeroPrice.length} produktów z ceną 0`);

    if (productsWithZeroPrice.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Wszystkie produkty mają już ustawione ceny!',
        updated: 0,
        products: [],
      });
    }

    console.log('💰 Rozpoczynam aktualizację cen do 99 PLN...');

    // Aktualizuj wszystkie produkty z ceną 0 na 99
    const updateResult = await prisma.product.updateMany({
      where: {
        price: 0,
      },
      data: {
        price: 99,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Zaktualizowano ${updateResult.count} produktów!`);

    // Weryfikuj zmiany
    const verificationCount = await prisma.product.count({
      where: {
        price: 0,
      },
    });

    // Pokaż statystyki cenowe po aktualizacji
    const priceStats = await prisma.product.groupBy({
      by: ['price'],
      _count: {
        price: true,
      },
      orderBy: {
        price: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Zaktualizowano ${updateResult.count} produktów z ceny 0 na 99 PLN`,
      updated: updateResult.count,
      remainingZeroPrices: verificationCount,
      products: productsWithZeroPrice.map(p => ({
        identifier: p.identifier,
        index: p.index,
        description: p.description,
        category: p.category,
      })),
      priceStats: priceStats.map(stat => ({
        price: stat.price,
        count: stat._count.price,
      })),
    });
  } catch (error) {
    console.error('❌ Błąd podczas aktualizacji cen:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Błąd podczas aktualizacji cen produktów',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
