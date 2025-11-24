import { NextResponse } from 'next/server';
import { testR2Connection } from '@/lib/r2';

export async function GET() {
  try {
    const result = await testR2Connection();

    return NextResponse.json({
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: `Błąd połączenia: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
