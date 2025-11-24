import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'deactivate';

    if (action === 'delete') {
      // Prawdziwe usunięcie z bazy danych
      await prisma.product.delete({
        where: { id: params.id },
      });
      return NextResponse.json({ message: 'Product permanently deleted' });
    } else if (action === 'activate') {
      // Aktywacja produktu
      const product = await prisma.product.update({
        where: { id: params.id },
        data: { isActive: true },
      });
      return NextResponse.json(product);
    } else {
      // Dezaktywacja (domyślne zachowanie)
      const product = await prisma.product.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return NextResponse.json(product);
    }
  } catch (error) {
    console.error('Error deleting/deactivating product:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { identifier, index, description, price, imageUrl, category, productionPath } =
      await request.json();

    if (!identifier || !index || !price || !category) {
      return NextResponse.json(
        { message: 'Identifier, index, price, and category are required' },
        { status: 400 }
      );
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        identifier,
        index,
        description,
        price: parseFloat(price),
        imageUrl,
        category,
        productionPath,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
