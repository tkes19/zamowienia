import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// POST /api/order-drafts/complete - Finalizacja draftu jako pełne zamówienie
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { draftId } = body;

    // Sprawdź czy draft istnieje i należy do użytkownika
    const draft = await prisma.orderDraft.findFirst({
      where: {
        id: draftId,
        userId: session.user.id,
        status: { in: ['draft', 'active'] },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!draft || draft.items.length === 0) {
      return NextResponse.json({ error: 'Draft not found or empty' }, { status: 404 });
    }

    // Transakcja: utworzenie zamówienia i oznaczenie draftu jako zakończony
    const result = await prisma.$transaction(async tx => {
      // Generowanie numeru zamówienia
      const orderCount = await tx.order.count();
      const orderNumber = `ORD-${Date.now()}-${orderCount + 1}`;

      // Tworzenie finalnego zamówienia
      const order = await tx.order.create({
        data: {
          id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          orderNumber,
          userId: draft.userId,
          customerId: draft.clientId || null,
          total: Number(draft.totalValue),
          status: 'PENDING',
          notes: draft.notes || null,
          updatedAt: new Date(),
        },
      });

      // Przeniesienie pozycji z draftu do finalnego zamówienia
      const orderItems = await Promise.all(
        draft.items.map((item, index) =>
          tx.orderItem.create({
            data: {
              id: `item_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              customization: item.customization || null,
              locationName: draft.locationName || null,
              selectedProjects: item.projects?.join(',') || null,
              totalQuantity: item.quantity,
              productionNotes: item.customization || null,
              source: item.source as any, // Mapowanie na enum
            },
          })
        )
      );

      // Oznaczenie draftu jako zakończonego
      await tx.orderDraft.update({
        where: { id: draftId },
        data: {
          status: 'completed',
          notes: `Converted to Order #${order.orderNumber}`,
        },
      });

      return { order, orderItems };
    });

    return NextResponse.json({
      success: true,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      message: 'Zamówienie zostało utworzone pomyślnie',
    });
  } catch (error) {
    console.error('Error completing draft:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
