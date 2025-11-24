import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'SALES_REP') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Generate order number in format: YYYY/NNN/III
    const currentYear = new Date().getFullYear();

    // Get user name to generate initials
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
    });

    // Generate initials from user name (first letter + 2 letters from last name)
    let initials = 'XXX';
    if (user?.name) {
      const nameParts = user.name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        initials = (firstName.charAt(0) + lastName.substring(0, 2)).toUpperCase();
      } else {
        initials = user.name.substring(0, 3).toUpperCase();
      }
    }

    // Find last order for current year to get next sequence number
    const thisYearOrders = await prisma.order.findMany({
      where: {
        orderNumber: {
          startsWith: `${currentYear}/`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    });
    const lastOrderThisYear = thisYearOrders[0];

    let sequenceNumber = 1;
    if (lastOrderThisYear) {
      const parts = lastOrderThisYear.orderNumber.split('/');
      if (parts.length >= 2) {
        sequenceNumber = parseInt(parts[1]) + 1;
      }
    }

    const orderNumber = `${currentYear}/${sequenceNumber}/${initials}`;

    // Create draft order (without items, no customer yet)
    const draftOrder = await prisma.order.create({
      data: {
        id: crypto.randomUUID(),
        orderNumber,
        userId: session.user.id,
        customerId: null, // Will be set later when customer is selected
        total: 0,
        status: 'DRAFT', // Mark as draft
        notes: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(draftOrder, { status: 201 });
  } catch (error) {
    console.error('Error creating draft order:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
