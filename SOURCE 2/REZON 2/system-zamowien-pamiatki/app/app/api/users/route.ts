import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Sprawdź uprawnienia: ADMIN może tworzyć wszystkich, SALES_DEPT tylko SALES_REP
    if (!session || !['ADMIN', 'SALES_DEPT'].includes(session.user.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { name, email, password, role, departmentId } = await request.json();

    // Walidacja wymaganych pól
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { message: 'Imię, email, hasło i rola są wymagane' },
        { status: 400 }
      );
    }

    // Sprawdź czy email jest unikalny
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'Użytkownik z tym adresem email już istnieje' },
        { status: 400 }
      );
    }

    // Sprawdź uprawnienia do tworzenia roli
    if (session.user.role === 'SALES_DEPT') {
      const allowedRoles = ['SALES_REP', 'NEW_USER'];
      if (!allowedRoles.includes(role)) {
        return NextResponse.json(
          { message: 'Brak uprawnień do tworzenia użytkowników o tej roli' },
          { status: 403 }
        );
      }
    }

    // Walidacja hasła (minimum 6 znaków)
    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Hasło musi mieć co najmniej 6 znaków' },
        { status: 400 }
      );
    }

    // Sprawdź czy dział istnieje (jeśli podano)
    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      });

      if (!department) {
        return NextResponse.json({ message: 'Wybrany dział nie istnieje' }, { status: 400 });
      }
    }

    // Hashuj hasło
    const hashedPassword = await bcrypt.hash(password, 10);

    // Utwórz użytkownika
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        departmentId: departmentId || null,
        isActive: true,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
