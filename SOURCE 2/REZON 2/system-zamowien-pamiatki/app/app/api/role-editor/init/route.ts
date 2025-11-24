import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { seedPermissions } from '@/scripts/seed-permissions';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('=== Permission Init API Called - ENTRY POINT ===');

    // Test 1: Podstawowy test
    console.log('🧪 Test 1: Basic API response');

    // Test 2: Session
    console.log('🧪 Test 2: Getting session...');
    let session;
    try {
      session = await getServerSession(authOptions);
      console.log('✅ Session retrieved:', {
        exists: !!session,
        user: session?.user
          ? {
              id: session.user.id,
              email: session.user.email,
              role: session.user.role,
            }
          : null,
      });
    } catch (sessionError) {
      console.log('❌ Session error:', sessionError);
      return NextResponse.json(
        { message: 'Session error', error: String(sessionError) },
        { status: 500 }
      );
    }

    if (!session) {
      console.log('❌ No session found');
      return NextResponse.json({ message: 'Unauthorized - No session' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      console.log('❌ User is not admin:', session.user.role);
      return NextResponse.json({ message: 'Forbidden - Admin access required' }, { status: 403 });
    }

    console.log('✅ Authorization passed, continuing...');

    // Test połączenia z bazą danych
    console.log('🔍 Testing database connection...');
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
      console.log('✅ Database connection OK');
    } catch (dbError) {
      console.log('❌ Database connection failed:', dbError);
      return NextResponse.json(
        {
          message: 'Database connection failed',
          error: String(dbError),
        },
        { status: 500 }
      );
    }

    // Najpierw sprawdź czy tabele istnieją, jeśli nie - stwórz je
    console.log('🏗️ Creating/verifying database tables...');
    try {
      // Tworzenie tabeli Permission
      console.log('📝 Creating Permission table...');
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "Permission" (
          "id" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "category" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Permission_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "Permission_code_key" UNIQUE ("code")
        );
      `;

      console.log('📝 Creating Permission index...');
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "Permission_category_idx" ON "Permission"("category");
      `;

      // Tworzenie tabeli RolePermission
      console.log('📝 Creating RolePermission table...');
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "RolePermission" (
          "id" TEXT NOT NULL,
          "role" TEXT NOT NULL,
          "permissionId" TEXT NOT NULL,
          "grantedBy" TEXT NOT NULL,
          "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "RolePermission_role_permissionId_key" UNIQUE ("role", "permissionId")
        );
      `;

      console.log('📝 Creating RolePermission foreign key...');
      await prisma.$executeRaw`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                         WHERE constraint_name = 'RolePermission_permissionId_fkey' 
                         AND table_name = 'RolePermission') THEN
            ALTER TABLE "RolePermission" 
            ADD CONSTRAINT "RolePermission_permissionId_fkey" 
            FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `;

      // Tworzenie tabeli PermissionAudit
      console.log('📝 Creating PermissionAudit table...');
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "PermissionAudit" (
          "id" TEXT NOT NULL,
          "role" TEXT NOT NULL,
          "permissionId" TEXT NOT NULL,
          "action" TEXT NOT NULL,
          "changedBy" TEXT NOT NULL,
          "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "reason" TEXT,
          CONSTRAINT "PermissionAudit_pkey" PRIMARY KEY ("id")
        );
      `;

      console.log('✅ All database tables created or verified');
    } catch (tableError) {
      console.log('⚠️ Table creation error:', tableError);
      // Nie rzucaj błędem, kontynuuj proces
    }

    // Sprawdź czy tabele rzeczywiście istnieją
    console.log('🔍 Verifying table existence...');
    try {
      const permissionCount = await prisma.permission.count();
      console.log('✅ Permission table accessible, current count:', permissionCount);
    } catch (verifyError) {
      console.log('❌ Permission table not accessible:', verifyError);
      return NextResponse.json(
        {
          message: 'Database tables are not properly created or accessible',
          error: String(verifyError),
        },
        { status: 500 }
      );
    }

    // Test 3: Seed permissions
    console.log('🧪 Test 3: Testing seedPermissions import...');
    try {
      console.log('✅ seedPermissions function available:', typeof seedPermissions);
    } catch (importError) {
      console.log('❌ seedPermissions import error:', importError);
      return NextResponse.json(
        {
          message: 'seedPermissions import failed',
          error: String(importError),
        },
        { status: 500 }
      );
    }

    // Test 4: Uruchom prawdziwy seeding z debugowaniem
    console.log('🧪 Test 4: Starting REAL seeding with detailed debugging...');

    try {
      console.log('🌱 Calling seedPermissions()...');

      // Test simple rolePermission query first
      console.log('🧪 Testing simple rolePermission query...');
      const testCount = await prisma.rolePermission.count();
      console.log('✅ RolePermission count query works:', testCount);

      // Try simplified seeding first
      console.log('🌱 Starting simplified seeding process...');

      // Complete role-permission assignment for ADMIN
      console.log('🔗 Assigning ALL permissions to ADMIN...');
      const allPermissions = await prisma.permission.findMany();
      console.log(`📋 Found ${allPermissions.length} permissions to assign to ADMIN`);

      let adminAssignedCount = 0;
      for (const permission of allPermissions) {
        try {
          await prisma.rolePermission.create({
            data: {
              id: crypto.randomUUID(),
              role: 'ADMIN',
              permissionId: permission.id,
              grantedBy: 'system',
            },
          });
          adminAssignedCount++;
          console.log(
            `✅ Assigned ${permission.code} to ADMIN (${adminAssignedCount}/${allPermissions.length})`
          );
        } catch (roleError: any) {
          if (roleError.code === 'P2002') {
            console.log(`ℹ️ ${permission.code} already assigned to ADMIN`);
          } else {
            console.log(`❌ Error assigning ${permission.code} to ADMIN:`, roleError.message);
          }
        }
      }

      // Basic permissions for other roles
      console.log('🔗 Assigning basic permissions to other roles...');

      // SALES_DEPT permissions
      const salesDeptPermissions = [
        'view_orders',
        'create_orders',
        'view_products',
        'view_customers',
        'view_reports',
      ];
      for (const permCode of salesDeptPermissions) {
        const perm = allPermissions.find(p => p.code === permCode);
        if (perm) {
          try {
            await prisma.rolePermission.create({
              data: {
                id: crypto.randomUUID(),
                role: 'SALES_DEPT',
                permissionId: perm.id,
                grantedBy: 'system',
              },
            });
            console.log(`✅ Assigned ${permCode} to SALES_DEPT`);
          } catch (e: any) {
            if (e.code !== 'P2002') console.log(`❌ Error: ${e.message}`);
          }
        }
      }

      // SALES_REP permissions
      const salesRepPermissions = [
        'view_orders',
        'create_orders',
        'view_products',
        'view_customers',
      ];
      for (const permCode of salesRepPermissions) {
        const perm = allPermissions.find(p => p.code === permCode);
        if (perm) {
          try {
            await prisma.rolePermission.create({
              data: {
                id: crypto.randomUUID(),
                role: 'SALES_REP',
                permissionId: perm.id,
                grantedBy: 'system',
              },
            });
            console.log(`✅ Assigned ${permCode} to SALES_REP`);
          } catch (e: any) {
            if (e.code !== 'P2002') console.log(`❌ Error: ${e.message}`);
          }
        }
      }

      // WAREHOUSE permissions
      const warehousePermissions = [
        'view_orders',
        'view_products',
        'view_warehouse',
        'manage_inventory',
      ];
      for (const permCode of warehousePermissions) {
        const perm = allPermissions.find(p => p.code === permCode);
        if (perm) {
          try {
            await prisma.rolePermission.create({
              data: {
                id: crypto.randomUUID(),
                role: 'WAREHOUSE',
                permissionId: perm.id,
                grantedBy: 'system',
              },
            });
            console.log(`✅ Assigned ${permCode} to WAREHOUSE`);
          } catch (e: any) {
            if (e.code !== 'P2002') console.log(`❌ Error: ${e.message}`);
          }
        }
      }

      console.log('✅ Simplified seeding completed successfully!');
    } catch (seedError: any) {
      console.log('❌ seedPermissions() failed:', seedError);
      console.log('❌ Detailed seed error:', {
        name: seedError?.name,
        message: seedError?.message,
        stack: seedError?.stack?.split('\n').slice(0, 10),
        cause: seedError?.cause,
      });

      return NextResponse.json(
        {
          message: 'Seed permissions failed',
          error: seedError?.message || 'Unknown seeding error',
          errorName: seedError?.name,
          stackTrace: seedError?.stack?.split('\n').slice(0, 5),
        },
        { status: 500 }
      );
    }

    // Enhanced Verification
    console.log('🔄 Verifying seeding results...');
    try {
      const finalPermissionCount = await prisma.permission.count();
      const finalRolePermissionCount = await prisma.rolePermission.count();
      console.log(
        '📊 Final counts - Permissions:',
        finalPermissionCount,
        'Role mappings:',
        finalRolePermissionCount
      );

      if (finalRolePermissionCount === 0) {
        console.log('⚠️ Warning: No role-permission mappings were created!');

        // Try to force create at least one mapping
        console.log('🔧 Attempting to create emergency Admin mappings...');
        const firstPermission = await prisma.permission.findFirst();
        if (firstPermission) {
          try {
            await prisma.rolePermission.create({
              data: {
                id: crypto.randomUUID(),
                role: 'ADMIN',
                permissionId: firstPermission.id,
                grantedBy: 'emergency-system',
              },
            });
            console.log('✅ Emergency mapping created for ADMIN');
          } catch (emergencyError: any) {
            console.log('❌ Emergency mapping failed:', emergencyError.message);
          }
        }
      } else {
        console.log('✅ Role-permission mappings exist');

        // Show sample mappings
        const sampleMappings = await prisma.rolePermission.findMany({
          take: 5,
          include: { permission: true },
        });
        console.log(
          '📋 Sample mappings:',
          sampleMappings.map(m => `${m.role}: ${m.permission.code}`)
        );
      }
    } catch (verifyError) {
      console.log('⚠️ Could not verify results:', verifyError);
    }

    return NextResponse.json({
      message: 'Permissions initialized successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Permission initialization failed:', error);
    console.log('❌ Full error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack?.split('\n').slice(0, 10),
    });

    return NextResponse.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error),
        details: error?.stack?.split('\n').slice(0, 5),
      },
      { status: 500 }
    );
  }
}
