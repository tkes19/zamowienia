import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ permissions: [] });
    }

    // Pobierz uprawnienia dla roli użytkownika
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: session.user.role,
      },
      include: {
        permission: {
          select: {
            code: true,
          },
        },
      },
    });

    // Wyciągnij kody uprawnień
    const permissions = rolePermissions.map(rp => rp.permission.code);

    return NextResponse.json({
      permissions,
      role: session.user.role,
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return NextResponse.json({ permissions: [] });
  }
}
