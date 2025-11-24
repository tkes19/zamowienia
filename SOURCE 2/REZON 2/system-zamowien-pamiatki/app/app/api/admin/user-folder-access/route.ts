import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import 'dotenv/config';

export const dynamic = 'force-dynamic';

// GET - List all user folder assignments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !['ADMIN', 'SALES_MANAGER'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Fetch all assignments with user details
    const assignments = await prisma.$queryRaw`
      SELECT 
        ufa."id",
        ufa."userId",
        ufa."folderName",
        ufa."isActive",
        ufa."assignedBy",
        ufa."notes",
        ufa."createdAt",
        ufa."updatedAt",
        u."name" as "userName",
        u."email" as "userEmail",
        u."role" as "userRole",
        assignedByUser."name" as "assignedByName",
        assignedByUser."email" as "assignedByEmail"
      FROM "UserFolderAccess" ufa
      INNER JOIN "User" u ON ufa."userId" = u."id"
      LEFT JOIN "User" assignedByUser ON ufa."assignedBy" = assignedByUser."id"
      ORDER BY ufa."createdAt" DESC
    `;

    const formattedAssignments = Array.isArray(assignments)
      ? assignments.map((assignment: any) => ({
          id: assignment.id,
          userId: assignment.userId,
          folderName: assignment.folderName,
          isActive: assignment.isActive,
          assignedBy: assignment.assignedBy,
          notes: assignment.notes,
          createdAt: assignment.createdAt.toISOString(),
          updatedAt: assignment.updatedAt.toISOString(),
          user: {
            id: assignment.userId,
            name: assignment.userName,
            email: assignment.userEmail,
            role: assignment.userRole,
          },
          assignedByUser: assignment.assignedBy
            ? {
                id: assignment.assignedBy,
                name: assignment.assignedByName,
                email: assignment.assignedByEmail,
              }
            : null,
        }))
      : [];

    return NextResponse.json({
      success: true,
      assignments: formattedAssignments,
      count: formattedAssignments.length,
    });
  } catch (error) {
    console.error('Error fetching user folder assignments:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch assignments',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST - Create new user folder assignment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !['ADMIN', 'SALES_MANAGER'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { userId, folderName, notes } = await request.json();

    if (!userId || !folderName) {
      return NextResponse.json(
        { success: false, error: 'userId and folderName are required' },
        { status: 400 }
      );
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.$queryRaw`
      SELECT id FROM "UserFolderAccess"
      WHERE "userId" = ${userId} AND "folderName" = ${folderName}
    `;

    if (Array.isArray(existingAssignment) && existingAssignment.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment already exists' },
        { status: 409 }
      );
    }

    // Create new assignment
    const newAssignment = await prisma.$queryRaw`
      INSERT INTO "UserFolderAccess" ("userId", "folderName", "isActive", "assignedBy", "notes", "createdAt", "updatedAt")
      VALUES (${userId}, ${folderName}, true, ${session.user.id}, ${notes || null}, NOW(), NOW())
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      assignment: Array.isArray(newAssignment) ? newAssignment[0] : newAssignment,
      message: 'Assignment created successfully',
    });
  } catch (error) {
    console.error('Error creating user folder assignment:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create assignment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
