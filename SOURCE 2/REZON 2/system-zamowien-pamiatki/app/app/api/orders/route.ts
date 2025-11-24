import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    let orders;

    if (session.user.role === 'SALES_REP') {
      // Sales reps can only see their own orders
      orders = await prisma.order.findMany({
        where: {
          userId: session.user.id,
        },
        include: {
          Customer: true,
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          OrderItem: {
            include: {
              Product: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else if (['ADMIN', 'SALES_DEPT', 'WAREHOUSE'].includes(session.user.role)) {
      // Admins and other roles can see all orders
      orders = await prisma.order.findMany({
        include: {
          Customer: true,
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          OrderItem: {
            include: {
              Product: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log('=== Creating order - START ===');
    console.log('POST /api/orders called at:', new Date().toISOString());

    const session = await getServerSession(authOptions);
    console.log('Session:', session?.user?.email, 'Role:', session?.user?.role);

    // Write to file for debugging
    require('fs').appendFileSync(
      '/tmp/api-debug.log',
      `[${new Date().toISOString()}] POST /api/orders - User: ${session?.user?.email}\n`
    );

    // Sprawdź czy użytkownik może tworzyć zamówienia
    if (!session || !['SALES_REP', 'SALES_DEPT'].includes(session.user.role)) {
      console.log(
        'Permission denied - role required: SALES_REP or SALES_DEPT, got:',
        session?.user?.role
      );
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const requestBody = await request.json();
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    const { customerId, items, total, notes } = requestBody;

    // Check if customer ID is fallback
    if (customerId?.startsWith('fallback-customer-')) {
      console.warn('🟡 WARNING: Using fallback customer ID:', customerId);
      console.warn('This indicates database connection issues!');
    }

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json({ message: 'Customer and items are required' }, { status: 400 });
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

    console.log('Creating order with number:', orderNumber);
    console.log('Items to create:', items.length);

    // Create order with items
    let order;

    try {
      order = await prisma.order.create({
        data: {
          id: crypto.randomUUID(),
          orderNumber,
          userId: session.user.id,
          customerId,
          total: parseFloat(total),
          notes,
          status: 'PENDING', // Set status explicitly
          updatedAt: new Date(),
          OrderItem: {
            create: items.map((item: any) => ({
              id: crypto.randomUUID(),
              productId: item.productId,
              quantity: parseInt(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              customization: item.customization,
              source: item.source,
              locationName: item.locationName,
              projectName: item.projectName,
              // Nowe pola dla systemu projektów
              selectedProjects: item.selectedProjects || null,
              projectQuantities: item.projectQuantities || null,
              totalQuantity: item.totalQuantity ? parseInt(item.totalQuantity) : null,
              productionNotes: item.productionNotes || null,
            })),
          },
        },
        include: {
          OrderItem: {
            include: {
              Product: true,
            },
          },
        },
      });

      // Try to include Customer separately - may fail for fallback customers
      try {
        const orderWithCustomer = await prisma.order.findUnique({
          where: { id: order.id },
          include: {
            Customer: true,
            OrderItem: {
              include: {
                Product: true,
              },
            },
          },
        });

        if (orderWithCustomer) {
          order = orderWithCustomer;
        }
      } catch (customerError) {
        console.warn(
          'Could not load customer for order (probably fallback customer):',
          customerError
        );
        // Add fallback customer info for response
        if (customerId?.startsWith('fallback-customer-')) {
          (order as any).Customer = {
            id: customerId,
            name: 'Klient fallback',
            notes: 'Baza danych niedostępna',
          };
        }
      }
    } catch (createError) {
      console.error('Failed to create order:', createError);
      throw createError;
    }

    console.log('Order created successfully:', order.orderNumber);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
