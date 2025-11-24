import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('=== Role Editor API GET Called ===');

    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      console.log('❌ Access denied - not admin');
      return NextResponse.json({ message: 'Forbidden - Admin access required' }, { status: 403 });
    }

    console.log('✅ User authorized, fetching permissions...');

    // Sprawdź czy tabele istnieją
    try {
      await prisma.permission.count();
      console.log('✅ Permission table accessible');
    } catch (error) {
      console.log('❌ Permission table not accessible:', error);
      return NextResponse.json(
        {
          message: 'Permission system not initialized. Please initialize it first.',
          initialized: false,
        },
        { status: 200 }
      );
    }

    // Pobierz wszystkie uprawnienia pogrupowane po kategoriach
    const permissions = await prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    console.log(`📝 Found ${permissions.length} permissions`);

    // Pobierz wszystkie przypisania uprawnień do ról
    const rolePermissions = await prisma.rolePermission.findMany({
      include: {
        permission: true,
      },
    });

    console.log(`🔗 Found ${rolePermissions.length} role-permission mappings`);

    if (rolePermissions.length === 0) {
      console.log(
        '⚠️ No role-permission mappings found! This means roles have no permissions assigned.'
      );
    } else {
      // Policz uprawnienia dla każdej roli
      const roleStats: Record<string, number> = {};
      rolePermissions.forEach(rp => {
        if (!roleStats[rp.role]) roleStats[rp.role] = 0;
        roleStats[rp.role]++;
      });
      console.log('📊 Role permission stats:', roleStats);
    }

    // Pogrupuj uprawnienia po kategoriach
    const permissionsByCategory = permissions.reduce(
      (acc, permission) => {
        if (!acc[permission.category]) {
          acc[permission.category] = [];
        }
        acc[permission.category].push(permission);
        return acc;
      },
      {} as Record<string, typeof permissions>
    );

    // Mapuj uprawnienia na role
    const rolePermissionMap = rolePermissions.reduce(
      (acc, rp) => {
        if (!acc[rp.role]) {
          acc[rp.role] = [];
        }
        acc[rp.role].push(rp.permission);
        return acc;
      },
      {} as Record<string, typeof permissions>
    );

    // Definicje ról
    const roles = [
      {
        code: 'ADMIN',
        name: 'Administrator',
        description: 'Pełny dostęp do systemu',
        color: 'bg-red-100 text-red-800',
      },
      {
        code: 'SALES_DEPT',
        name: 'Kierownik Sprzedaży',
        description: 'Zarządzanie zespołem sprzedażowym',
        color: 'bg-blue-100 text-blue-800',
      },
      {
        code: 'SALES_REP',
        name: 'Przedstawiciel Handlowy',
        description: 'Tworzenie zamówień i obsługa klientów',
        color: 'bg-green-100 text-green-800',
      },
      {
        code: 'WAREHOUSE',
        name: 'Magazynier',
        description: 'Zarządzanie magazynem',
        color: 'bg-orange-100 text-orange-800',
      },
      {
        code: 'NEW_USER',
        name: 'Nowy Użytkownik',
        description: 'Podstawowy dostęp do systemu',
        color: 'bg-gray-100 text-gray-800',
      },
    ];

    // Określ czy system jest w pełni zainicjalizowany
    const adminPermissions = rolePermissionMap['ADMIN'] || [];
    const otherRolesHavePermissions = Object.entries(rolePermissionMap).some(
      ([role, perms]) => role !== 'ADMIN' && perms.length > 0
    );

    const isInitialized =
      permissions.length > 0 && adminPermissions.length > 0 && otherRolesHavePermissions;

    console.log('🔍 Initialization check:', {
      hasPermissions: permissions.length > 0,
      adminHasPermissions: adminPermissions.length > 0,
      otherRolesHavePermissions,
      isInitialized,
    });

    return NextResponse.json({
      roles,
      permissionsByCategory,
      rolePermissions: rolePermissionMap,
      totalPermissions: permissions.length,
      totalCategories: Object.keys(permissionsByCategory).length,
      rolesCount: roles.length,
      initialized: isInitialized,
    });
  } catch (error) {
    console.error('Error fetching role editor data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { role, permissionId, action, reason } = await request.json();

    if (!role || !permissionId || !action) {
      return NextResponse.json(
        { message: 'Role, permissionId and action are required' },
        { status: 400 }
      );
    }

    if (!['GRANT', 'REVOKE'].includes(action)) {
      return NextResponse.json({ message: 'Action must be GRANT or REVOKE' }, { status: 400 });
    }

    // Sprawdź czy uprawnienie istnieje
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      return NextResponse.json({ message: 'Permission not found' }, { status: 404 });
    }

    let result;

    try {
      if (action === 'GRANT') {
        // Sprawdź czy już istnieje
        const existingRolePermission = await prisma.rolePermission.findFirst({
          where: {
            role: role,
            permissionId: permissionId,
          },
          include: {
            permission: true,
          },
        });

        if (!existingRolePermission) {
          result = await prisma.rolePermission.create({
            data: {
              id: crypto.randomUUID(),
              role: role,
              permissionId: permissionId,
              grantedBy: session.user.id,
            },
            include: {
              permission: true,
            },
          });
        } else {
          // Update existing
          result = await prisma.rolePermission.update({
            where: { id: existingRolePermission.id },
            data: {
              grantedBy: session.user.id,
              grantedAt: new Date(),
            },
            include: {
              permission: true,
            },
          });
        }
      } else {
        // Odbierz uprawnienie
        const rolePermissionToDelete = await prisma.rolePermission.findFirst({
          where: {
            role: role,
            permissionId: permissionId,
          },
        });

        if (rolePermissionToDelete) {
          await prisma.rolePermission.delete({
            where: { id: rolePermissionToDelete.id },
          });
        }

        result = { role, permission };
      }
    } catch (dbError: any) {
      console.error('❌ Database error in role-permission operation:', dbError);
      return NextResponse.json(
        {
          message: 'Database operation failed',
          error: dbError?.message || 'Unknown database error',
          code: dbError?.code,
        },
        { status: 500 }
      );
    }

    // Zapisz w audycie
    await prisma.permissionAudit.create({
      data: {
        id: crypto.randomUUID(),
        role: role,
        permissionId: permissionId,
        action: action === 'GRANT' ? 'GRANTED' : 'REVOKED',
        changedBy: session.user.id,
        reason: reason || null,
      },
    });

    return NextResponse.json({
      message: `Permission ${action === 'GRANT' ? 'granted' : 'revoked'} successfully`,
      result,
    });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
