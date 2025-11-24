import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !['ADMIN', 'SALES_DEPT'].includes(session.user.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { name } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ message: 'Nazwa działu jest wymagana' }, { status: 400 });
    }

    // Sprawdź czy dział już istnieje
    const existingDepartment = await prisma.department.findUnique({
      where: { name: name.trim() },
    });

    if (existingDepartment) {
      return NextResponse.json({ message: 'Dział o tej nazwie już istnieje' }, { status: 400 });
    }

    const department = await prisma.department.create({
      data: {
        id: crypto.randomUUID(),
        name: name.trim(),
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
