import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import 'dotenv/config';

export const dynamic = 'force-dynamic';

// PUT - Update user folder assignment
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    const assignmentId = parseInt(params.id);
    if (isNaN(assignmentId)) {
      return NextResponse.json({ success: false, error: 'Invalid assignment ID' }, { status: 400 });
    }

    const updates = await request.json();
    const allowedUpdates = ['folderName', 'isActive', 'notes'];

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        updateFields.push(`"${key}" = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add updatedAt field
    updateFields.push(`"updatedAt" = $${paramIndex}`);
    updateValues.push(new Date());
    paramIndex++;

    // Add assignment ID for WHERE clause
    updateValues.push(assignmentId);

    const updateQuery = `
      UPDATE "UserFolderAccess" 
      SET ${updateFields.join(', ')} 
      WHERE "id" = $${paramIndex}
      RETURNING *
    `;

    const updatedAssignment = await prisma.$queryRawUnsafe(updateQuery, ...updateValues);

    return NextResponse.json({
      success: true,
      assignment: Array.isArray(updatedAssignment) ? updatedAssignment[0] : updatedAssignment,
      message: 'Assignment updated successfully',
    });
  } catch (error) {
    console.error('Error updating user folder assignment:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update assignment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete user folder assignment
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    const assignmentId = parseInt(params.id);
    if (isNaN(assignmentId)) {
      return NextResponse.json({ success: false, error: 'Invalid assignment ID' }, { status: 400 });
    }

    // Delete the assignment
    const deletedAssignment = await prisma.$queryRaw`
      DELETE FROM "UserFolderAccess"
      WHERE "id" = ${assignmentId}
      RETURNING *
    `;

    if (!Array.isArray(deletedAssignment) || deletedAssignment.length === 0) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user folder assignment:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete assignment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
