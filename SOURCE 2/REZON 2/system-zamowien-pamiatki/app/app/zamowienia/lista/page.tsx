import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AppLayout } from '@/components/layout/app-layout';
import { OrdersContent } from '@/components/orders/orders-content';

export default async function OrdersListPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <AppLayout>
      <OrdersContent />
    </AppLayout>
  );
}
