import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// PUT /api/order-drafts/items/[id] - Aktualizacja pozycji
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const itemId = params.id;

    // Sprawdź czy pozycja należy do użytkownika (poprzez draft)
    const existingItem = await prisma.orderDraftItem.findFirst({
      where: {
        id: itemId,
        draft: {
          userId: session.user.id,
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Przelicz totalPrice jeśli zmieniono quantity lub unitPrice
    const totalPrice =
      (body.quantity !== undefined ? body.quantity : existingItem.quantity) *
      (body.unitPrice !== undefined ? body.unitPrice : existingItem.unitPrice);

    const updatedItem = await prisma.orderDraftItem.update({
      where: { id: itemId },
      data: {
        ...body,
        totalPrice,
      },
      include: {
        product: {
          select: {
            id: true,
            identifier: true,
            index: true,
            description: true,
            price: true,
            category: true,
            imageUrl: true,
          },
        },
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/order-drafts/items/[id] - Usunięcie pozycji
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const itemId = params.id;

    // Sprawdź czy pozycja należy do użytkownika (poprzez draft)
    const existingItem = await prisma.orderDraftItem.findFirst({
      where: {
        id: itemId,
        draft: {
          userId: session.user.id,
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await prisma.orderDraftItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
