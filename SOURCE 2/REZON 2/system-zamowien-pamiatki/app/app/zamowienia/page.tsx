import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AppLayout } from '@/components/layout/app-layout';
import { DashboardContent } from '@/components/dashboard/dashboard-content';

// System Zamówień - główna strona z Dashboard
export default async function OrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  );
}
