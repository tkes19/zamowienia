import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AppLayout } from '@/components/layout/app-layout';
import { UserFolderManagement } from '@/components/admin/user-folder-management';

export default async function FolderyKlientowPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/auth/login');
  }

  // Sprawdź rolę z bazy danych
  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (!user || !['ADMIN', 'SALES_MANAGER'].includes(user.role)) {
      redirect('/zamowienia');
    }
  } catch (error) {
    console.error('Error checking user role:', error);
    redirect('/katalog');
  }

  return (
    <AppLayout>
      <UserFolderManagement />
    </AppLayout>
  );
}
