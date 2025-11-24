import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AppLayout } from '@/components/layout/app-layout';
import { CustomersContent } from '@/components/customers/customers-content';

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  if (session.user.role !== 'SALES_REP') {
    redirect('/');
  }

  return (
    <AppLayout>
      <CustomersContent />
    </AppLayout>
  );
}
