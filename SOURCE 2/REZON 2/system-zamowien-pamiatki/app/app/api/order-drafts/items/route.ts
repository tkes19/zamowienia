import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// POST /api/order-drafts/items - Dodanie pozycji do draftu
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      draftId,
      productId,
      quantity,
      unitPrice,
      customization,
      projects,
      projectsDetails,
      source,
    } = body;

    // Weryfikacja że draft należy do użytkownika
    const draft = await prisma.orderDraft.findFirst({
      where: {
        id: draftId,
        userId: session.user.id,
      },
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Pobierz następny numer sortowania
    const maxSortOrder = await prisma.orderDraftItem.aggregate({
      where: { draftId },
      _max: { sortOrder: true },
    });

    const totalPrice = quantity * unitPrice;

    const item = await prisma.orderDraftItem.create({
      data: {
        draftId,
        productId,
        quantity,
        unitPrice,
        totalPrice,
        customization,
        projects: projects || [],
        projectsDetails,
        source,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
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

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error adding item to draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
