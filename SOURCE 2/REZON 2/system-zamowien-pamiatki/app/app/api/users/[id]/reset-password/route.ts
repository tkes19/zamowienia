import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    // Tylko ADMIN może resetować hasła
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ message: 'Hasło jest wymagane' }, { status: 400 });
    }

    // Walidacja hasła (minimum 6 znaków)
    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Hasło musi mieć co najmniej 6 znaków' },
        { status: 400 }
      );
    }

    // Sprawdź czy użytkownik istnieje
    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      return NextResponse.json({ message: 'Użytkownik nie został znaleziony' }, { status: 404 });
    }

    // Hashuj nowe hasło
    const hashedPassword = await bcrypt.hash(password, 10);

    // Aktualizuj hasło
    await prisma.user.update({
      where: { id: params.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'Hasło zostało zmienione pomyślnie' });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
