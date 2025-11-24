import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Sprawdź uprawnienia użytkownika
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: session.user.role,
      },
      include: {
        permission: {
          select: {
            code: true,
          },
        },
      },
    });

    const permissions = rolePermissions.map(rp => rp.permission.code);

    if (!permissions.includes('delete_orders')) {
      return NextResponse.json(
        { message: 'Nie masz uprawnień do usuwania zamówień' },
        { status: 403 }
      );
    }

    // Znajdź zamówienie
    const order = await prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ message: 'Zamówienie nie zostało znalezione' }, { status: 404 });
    }

    // Sprawdź czy status pozwala na usunięcie
    const deletableStatuses = ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!deletableStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          message:
            'Nie można usunąć zamówienia w tym statusie. Dozwolone statusy: Złożone, Wysłane, Dostarczone, Anulowane',
        },
        { status: 400 }
      );
    }

    // Usuń pozycje zamówienia najpierw (cascade)
    await prisma.orderItem.deleteMany({
      where: { orderId: params.id },
    });

    // Usuń zamówienie
    await prisma.order.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'Zamówienie zostało pomyślnie usunięte',
      deletedOrderId: params.id,
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { message: 'Wystąpił błąd podczas usuwania zamówienia' },
      { status: 500 }
    );
  }
}
