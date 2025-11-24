import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !['ADMIN', 'SALES_DEPT'].includes(session.user.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const requestBody = await request.json();
    const { name, email, role, departmentId, isActive } = requestBody;

    console.log('[API] PUT /api/users/[id] - Request body:', requestBody);
    console.log('[API] User session:', session.user.email, 'role:', session.user.role);
    console.log('[API] Target user ID:', params.id);

    // Sprawdź czy użytkownik istnieje
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ message: 'Użytkownik nie został znaleziony' }, { status: 404 });
    }

    // Sprawdź uprawnienia SALES_DEPT do edycji SALES_REP i NEW_USER
    if (session.user.role === 'SALES_DEPT') {
      const allowedRoles = ['SALES_REP', 'NEW_USER'];
      if (!allowedRoles.includes(existingUser.role) || !allowedRoles.includes(role)) {
        return NextResponse.json(
          { message: 'Brak uprawnień do edycji tego użytkownika' },
          { status: 403 }
        );
      }
    }

    // Sprawdź czy email jest unikalny (jeśli zmieniony)
    if (email && email !== existingUser.email) {
      const duplicateUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (duplicateUser) {
        return NextResponse.json(
          { message: 'Użytkownik z tym adresem email już istnieje' },
          { status: 400 }
        );
      }
    }

    // Sprawdź czy dział istnieje (jeśli podano)
    if (departmentId && departmentId !== null) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      });

      if (!department) {
        return NextResponse.json({ message: 'Wybrany dział nie istnieje' }, { status: 400 });
      }
    }

    // Przygotuj dane do aktualizacji
    const updateData: any = {};

    if (name && typeof name === 'string') {
      updateData.name = name.trim();
    }

    if (
      email &&
      typeof email === 'string' &&
      email.toLowerCase() !== existingUser.email.toLowerCase()
    ) {
      updateData.email = email.toLowerCase();
    }

    if (role && typeof role === 'string') {
      updateData.role = role;
    }

    if (departmentId !== undefined) {
      updateData.departmentId = departmentId || null;
    }

    if (isActive !== undefined && typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    updateData.updatedAt = new Date();

    console.log('[API] Update data prepared:', JSON.stringify(updateData, null, 2));
    console.log('[API] Update data keys:', Object.keys(updateData));
    console.log('[API] Update data values:', Object.values(updateData));

    // Spróbuj najpierw stworzyć enum jeśli nie istnieje
    try {
      await prisma.$executeRaw`
        DO $$ BEGIN
          CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT', 'NEW_USER');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;
      console.log('[API] UserRole enum created or already exists');
    } catch (enumError: any) {
      console.log('[API] Failed to create UserRole enum:', enumError?.message || 'Unknown error');
    }
    console.log('[API] Existing user before update:', {
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      departmentId: existingUser.departmentId,
      isActive: existingUser.isActive,
    });

    // Aktualizuj użytkownika
    let user;
    try {
      user = await prisma.user.update({
        where: { id: params.id },
        data: updateData,
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
    } catch (prismaError: any) {
      console.error('[API] Prisma update error:', prismaError);
      return NextResponse.json(
        { message: 'Database update error', details: prismaError?.message || 'Unknown error' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ message: 'User update returned null' }, { status: 500 });
    }

    console.log('[API] User updated successfully:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      isActive: user.isActive,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    // Tylko ADMIN może usuwać użytkowników
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Sprawdź czy użytkownik istnieje
    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      return NextResponse.json({ message: 'Użytkownik nie został znaleziony' }, { status: 404 });
    }

    // Nie pozwalaj usunąć samego siebie
    if (params.id === session.user.id) {
      return NextResponse.json({ message: 'Nie można usunąć własnego konta' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Użytkownik został usunięty pomyślnie' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
