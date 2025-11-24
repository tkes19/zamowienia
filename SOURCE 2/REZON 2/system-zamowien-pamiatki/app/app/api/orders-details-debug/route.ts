import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(
      `🔍 DEBUG: Getting order details for user ${session.user.email} (${session.user.role})`
    );

    let orders: any[] = [];

    // Użyj tej samej logiki co w /api/orders
    if (session.user.role === 'SALES_REP') {
      orders = await prisma.order.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          userId: true,
          Customer: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Tylko pierwszych 10 dla debugowania
      });
    } else if (['ADMIN', 'SALES_DEPT', 'WAREHOUSE'].includes(session.user.role)) {
      orders = await prisma.order.findMany({
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          userId: true,
          Customer: {
            select: {
              name: true,
            },
          },
          User: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Tylko pierwszych 10 dla debugowania
      });
    }

    return NextResponse.json({
      success: true,
      userInfo: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      },
      ordersCount: orders.length,
      totalCount: await prisma.order.count(),
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        customer: order.Customer?.name,
        assignedTo: order.User?.name || 'N/A',
        createdAt: order.createdAt.toISOString().split('T')[0], // Tylko data
        isOwnOrder: order.userId === session.user.id,
      })),
    });
  } catch (error: any) {
    console.error('❌ DEBUG Orders details error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
