import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { name } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ message: 'Nazwa działu jest wymagana' }, { status: 400 });
    }

    // Sprawdź czy dział istnieje
    const existingDepartment = await prisma.department.findUnique({
      where: { id: params.id },
    });

    if (!existingDepartment) {
      return NextResponse.json({ message: 'Dział nie został znaleziony' }, { status: 404 });
    }

    // Sprawdź czy nazwa nie jest już zajęta przez inny dział
    const duplicateDepartment = await prisma.department.findFirst({
      where: {
        name: name.trim(),
        id: { not: params.id },
      },
    });

    if (duplicateDepartment) {
      return NextResponse.json({ message: 'Dział o tej nazwie już istnieje' }, { status: 400 });
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Sprawdź czy dział istnieje i czy ma przypisanych użytkowników
    const department = await prisma.department.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!department) {
      return NextResponse.json({ message: 'Dział nie został znaleziony' }, { status: 404 });
    }

    if (department._count.users > 0) {
      return NextResponse.json(
        { message: 'Nie można usunąć działu, który ma przypisanych użytkowników' },
        { status: 400 }
      );
    }

    await prisma.department.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Dział został usunięty pomyślnie' });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
