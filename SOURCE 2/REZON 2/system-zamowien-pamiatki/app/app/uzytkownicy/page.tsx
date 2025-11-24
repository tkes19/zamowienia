import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AppLayout } from '@/components/layout/app-layout';
import { UsersContent } from '@/components/users/users-content';

export default async function UsersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <AppLayout>
      <UsersContent />
    </AppLayout>
  );
}
