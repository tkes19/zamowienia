import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const role = searchParams.get('role');
    const action = searchParams.get('action');

    const skip = (page - 1) * limit;

    // Filtry
    const where: any = {};
    if (role) where.role = role;
    if (action) where.action = action;

    // Pobierz logi audytu
    const auditLogs = await prisma.permissionAudit.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      skip,
      take: limit,
    });

    // Pobierz ID użytkowników i uprawnień do pobrania dodatkowych danych
    const userIds = [...new Set(auditLogs.map(log => log.changedBy))];
    const permissionIds = [...new Set(auditLogs.map(log => log.permissionId))];

    // Pobierz dane użytkowników
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    // Pobierz dane uprawnień
    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true, code: true, name: true, category: true },
    });

    // Mapuj dane
    const userMap = users.reduce(
      (acc, user) => {
        acc[user.id] = user;
        return acc;
      },
      {} as Record<string, (typeof users)[0]>
    );

    const permissionMap = permissions.reduce(
      (acc, permission) => {
        acc[permission.id] = permission;
        return acc;
      },
      {} as Record<string, (typeof permissions)[0]>
    );

    // Wzbogać logi o dane użytkowników i uprawnień
    const enrichedLogs = auditLogs.map(log => ({
      ...log,
      user: userMap[log.changedBy] || null,
      permission: permissionMap[log.permissionId] || null,
    }));

    // Policz total dla paginacji
    const total = await prisma.permissionAudit.count({ where });

    return NextResponse.json({
      logs: enrichedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
