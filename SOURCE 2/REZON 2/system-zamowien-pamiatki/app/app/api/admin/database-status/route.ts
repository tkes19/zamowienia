import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Funkcja retry dla prepared statement conflicts
async function retryDatabaseOperation<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isPreparedStatementError =
        error?.code === '26000' ||
        error?.message?.includes('prepared statement') ||
        error?.message?.includes('does not exist');

      if (isPreparedStatementError && attempt < maxRetries) {
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for prepared statement error`);
        // Krótkie opóźnienie przed retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Retry exceeded');
}

export async function GET(request: NextRequest) {
  try {
    // Sprawdź połączenie z bazą danych z retry mechanism
    const [userCount, productCount, customerCount] = await retryDatabaseOperation(async () => {
      return await Promise.all([
        prisma.user.count(),
        prisma.product.count(),
        prisma.customer.count(),
      ]);
    });

    // Pobierz ostatnio dodanego użytkownika z retry
    const lastUser = await retryDatabaseOperation(async () => {
      return await prisma.user.findFirst({
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          email: true,
          createdAt: true,
        },
      });
    });

    // Sprawdź źródło bazy danych z zmiennej środowiskowej
    const databaseUrl = process.env.DATABASE_URL || '';
    const isDirectConnection = databaseUrl.includes('db.') && databaseUrl.includes(':5432');

    return NextResponse.json({
      connected: true,
      source: databaseUrl,
      connectionType: isDirectConnection ? 'Direct Connection' : 'Pooler Connection',
      userCount,
      productCount,
      customerCount,
      lastUser,
    });
  } catch (error) {
    console.error('🔴 Błąd sprawdzania statusu bazy:', error);

    return NextResponse.json(
      {
        connected: false,
        source: process.env.DATABASE_URL || '',
        connectionType: 'Unknown',
        userCount: 0,
        productCount: 0,
        customerCount: 0,
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
