import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AppLayout } from '@/components/layout/app-layout';
import { AdminContent } from '@/components/admin/admin-content';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role) {
    redirect('/auth/login');
  }

  // Sprawdź rolę z sesji - middleware już sprawdza dostęp
  if (session.user.role !== 'ADMIN') {
    redirect('/zamowienia');
  }

  return (
    <AppLayout>
      <AdminContent />
    </AppLayout>
  );
}
