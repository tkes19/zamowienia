import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET - Pobierz ustawienia użytkownika
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        name: true,
        email: true,
        role: true,
        defaultStartPage: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      role: user.role,
      defaultStartPage: user.defaultStartPage || 'CATALOG',
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Zapisz ustawienia użytkownika
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { defaultStartPage } = await request.json();

    // Walidacja
    if (!['CATALOG', 'ORDERS'].includes(defaultStartPage)) {
      return NextResponse.json(
        {
          error: 'Invalid defaultStartPage value',
        },
        { status: 400 }
      );
    }

    // Aktualizuj ustawienia użytkownika w bazie danych
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { defaultStartPage },
      select: { defaultStartPage: true },
    });

    return NextResponse.json({
      message: 'Settings updated successfully',
      defaultStartPage: updatedUser.defaultStartPage,
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
