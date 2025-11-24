import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/order-drafts - Pobranie aktywnego draftu użytkownika
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const draft = await prisma.orderDraft.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['draft', 'active'] },
      },
      include: {
        items: {
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
          orderBy: {
            sortOrder: 'asc',
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/order-drafts - Utworzenie nowego draftu
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clientType, clientId, locationName, customClientData, sessionId } = body;

    // Sprawdź czy użytkownik nie ma już aktywnego draftu
    const existingDraft = await prisma.orderDraft.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['draft', 'active'] },
      },
    });

    if (existingDraft) {
      return NextResponse.json({ error: 'Active draft already exists' }, { status: 409 });
    }

    const draft = await prisma.orderDraft.create({
      data: {
        userId: session.user.id,
        clientType,
        clientId,
        locationName,
        customClientData,
        sessionId,
        status: 'active',
      },
      include: {
        items: {
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
        },
      },
    });

    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    console.error('Error creating draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/order-drafts - Aktualizacja draftu
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    const draft = await prisma.orderDraft.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: updateData,
      include: {
        items: {
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
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error updating draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/order-drafts - Usunięcie draftu
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('id');

    if (!draftId) {
      return NextResponse.json({ error: 'Draft ID is required' }, { status: 400 });
    }

    await prisma.orderDraft.delete({
      where: {
        id: draftId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
