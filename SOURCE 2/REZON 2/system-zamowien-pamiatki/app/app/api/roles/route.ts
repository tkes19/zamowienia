import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Pobierz statystyki ról
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        role: true,
      },
    });

    // Pobierz wszystkich użytkowników z rolami
    const usersWithRoles = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
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
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    // Definicje ról z opisami
    const roleDefinitions = {
      ADMIN: {
        name: 'Administrator',
        description: 'Pełny dostęp do systemu, zarządzanie użytkownikami i konfiguracją',
        color: 'bg-red-100 text-red-800',
        permissions: ['Wszystkie uprawnienia'],
      },
      SALES_DEPT: {
        name: 'Kierownik Sprzedaży',
        description: 'Zarządzanie zespołem sprzedażowym, dostęp do raportów',
        color: 'bg-blue-100 text-blue-800',
        permissions: [
          'Zarządzanie przedstawicielami',
          'Dostęp do raportów',
          'Zarządzanie klientami',
        ],
      },
      SALES_REP: {
        name: 'Przedstawiciel Handlowy',
        description: 'Tworzenie zamówień, zarządzanie klientami',
        color: 'bg-green-100 text-green-800',
        permissions: ['Tworzenie zamówień', 'Zarządzanie własnymi klientami'],
      },
      WAREHOUSE: {
        name: 'Magazynier',
        description: 'Zarządzanie stanem magazynu, realizacja zamówień',
        color: 'bg-orange-100 text-orange-800',
        permissions: ['Zarządzanie magazynem', 'Aktualizacja statusów zamówień'],
      },
      NEW_USER: {
        name: 'Nowy Użytkownik',
        description: 'Ograniczony dostęp, oczekuje na przypisanie roli',
        color: 'bg-gray-100 text-gray-800',
        permissions: ['Tylko odczyt'],
      },
    };

    // Przekształć statystyki na obiekt z dodatkowymi informacjami
    const rolesWithStats = Object.entries(roleDefinitions).map(([role, definition]) => {
      const stats = roleStats.find(stat => stat.role === role);
      const usersInRole = usersWithRoles.filter(user => user.role === role);

      return {
        role,
        ...definition,
        userCount: stats?._count.role || 0,
        users: usersInRole,
      };
    });

    return NextResponse.json({
      roles: rolesWithStats,
      totalUsers: usersWithRoles.length,
      allUsers: usersWithRoles,
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
