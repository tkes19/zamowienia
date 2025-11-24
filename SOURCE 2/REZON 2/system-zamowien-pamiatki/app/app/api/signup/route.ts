import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    message: 'Signup endpoint. Use POST to create a new user.',
    supportedMethods: ['POST'],
  });
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Wszystkie wymagane pola muszą być wypełnione' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: email } });

    if (existingUser) {
      return NextResponse.json(
        { message: 'Użytkownik z tym adresem email już istnieje' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user - domyślnie SALES_REP dla aplikacji przedstawicieli handlowych
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name,
        email,
        password: hashedPassword,
        role: 'SALES_REP',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { message: 'Użytkownik został utworzony pomyślnie', userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ message: 'Wystąpił błąd podczas rejestracji' }, { status: 500 });
  }
}
