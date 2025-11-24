import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          session: !!session,
          user: !!session?.user,
        },
        { status: 401 }
      );
    }

    console.log(`🔍 DEBUG: Computing stats for user ${session.user.email} (${session.user.role})`);

    let orderCount = 0;
    let debugInfo = {
      userId: session.user.id,
      userRole: session.user.role,
      userEmail: session.user.email,
      query: '',
      rawCount: 0,
      timestamp: new Date().toISOString(),
    };

    // Użyj tej samej logiki co w /api/orders
    if (session.user.role === 'SALES_REP') {
      // Sales reps can only see their own orders
      debugInfo.query = `SALES_REP: Orders where userId = ${session.user.id}`;

      orderCount = await prisma.order.count({
        where: {
          userId: session.user.id,
        },
      });
    } else if (['ADMIN', 'SALES_DEPT', 'WAREHOUSE'].includes(session.user.role)) {
      // Admins and other roles can see all orders
      debugInfo.query = `${session.user.role}: All orders`;

      orderCount = await prisma.order.count();
    } else {
      // For other roles, no orders
      debugInfo.query = `${session.user.role}: No access to orders`;
      orderCount = 0;
    }

    debugInfo.rawCount = orderCount;

    console.log(`📊 DEBUG Stats:`, debugInfo);

    // Sprawdź zamówienia z ostatniego tygodnia
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Sprawdź zamówienia z dzisiaj
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let recentOrderCount = 0;
    let todayOrderCount = 0;
    let clientsCount = 0;
    let newClientsCount = 0;

    if (session.user.role === 'SALES_REP') {
      recentOrderCount = await prisma.order.count({
        where: {
          userId: session.user.id,
          createdAt: {
            gte: weekAgo,
          },
        },
      });

      todayOrderCount = await prisma.order.count({
        where: {
          userId: session.user.id,
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });

      // Liczba klientów przypisanych do handlowca
      clientsCount = await prisma.customer.count({
        where: {
          salesRepId: session.user.id,
        },
      });

      // Nowi klienci w tym tygodniu
      newClientsCount = await prisma.customer.count({
        where: {
          salesRepId: session.user.id,
          createdAt: {
            gte: weekAgo,
          },
        },
      });
    } else if (['ADMIN', 'SALES_DEPT', 'WAREHOUSE'].includes(session.user.role)) {
      recentOrderCount = await prisma.order.count({
        where: {
          createdAt: {
            gte: weekAgo,
          },
        },
      });

      todayOrderCount = await prisma.order.count({
        where: {
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });

      // Wszystkich klientów
      clientsCount = await prisma.customer.count();

      // Nowych klientów w tym tygodniu
      newClientsCount = await prisma.customer.count({
        where: {
          createdAt: {
            gte: weekAgo,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalOrders: orderCount,
        recentOrders: recentOrderCount,
        todayOrders: todayOrderCount,
        weeklyChange: recentOrderCount,
        clientsCount: clientsCount,
        newClientsCount: newClientsCount,
      },
      debugInfo,
      message: `Found ${orderCount} total orders, ${recentOrderCount} from last week, ${todayOrderCount} today, ${clientsCount} clients, ${newClientsCount} new clients`,
      comparison: {
        currentDashboardValue: orderCount,
        realValue: orderCount,
        difference: 0,
      },
    });
  } catch (error: any) {
    console.error('❌ DEBUG Stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
