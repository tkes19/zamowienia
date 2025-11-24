import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(
      `🔍 Pobieranie ostatnich zamówień dla ${session.user.email} (${session.user.role})`
    );

    let recentOrders: any[] = [];

    if (session.user.role === 'SALES_REP') {
      // Dla handlowców - tylko ich zamówienia
      recentOrders = await prisma.order.findMany({
        where: {
          userId: session.user.id,
        },
        include: {
          Customer: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 3,
      });
    } else if (['ADMIN', 'SALES_DEPT', 'WAREHOUSE'].includes(session.user.role)) {
      // Dla adminów - wszystkie zamówienia
      recentOrders = await prisma.order.findMany({
        include: {
          Customer: {
            select: {
              name: true,
            },
          },
          User: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 3,
      });
    }

    console.log(`✅ Znaleziono ${recentOrders.length} ostatnich zamówień`);

    return NextResponse.json({
      success: true,
      orders: recentOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.Customer?.name || 'Klient nieznany',
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
        salesRep: order.User ? order.User.name : undefined,
      })),
    });
  } catch (error: any) {
    console.error('❌ Recent orders error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        orders: [],
      },
      { status: 500 }
    );
  }
}
