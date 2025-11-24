import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AppLayout } from '@/components/layout/app-layout';
import { OrderWizard } from '@/components/order/order-wizard';

export default async function NewOrderPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  // Tylko handlowcy mogą składać zamówienia
  if (session.user.role !== 'SALES_REP') {
    redirect('/');
  }

  return (
    <AppLayout>
      <OrderWizard />
    </AppLayout>
  );
}
