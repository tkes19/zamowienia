import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DepartmentsContent } from '@/components/admin/departments-content';

export const metadata = {
  title: 'Zarządzanie Działami - REZON',
  description: 'Panel administracyjny do zarządzania działami w systemie REZON',
};

export default async function DepartmentsPage() {
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

    if (user?.role !== 'ADMIN') {
      redirect('/zamowienia');
    }
  } catch (error) {
    console.error('Error checking user role:', error);
    redirect('/katalog');
  }

  return (
    <div className="container mx-auto py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zarządzanie Działami</h1>
          <p className="text-muted-foreground">
            Twórz, edytuj i usuwaj działy w systemie. Zarządzaj strukturą organizacyjną.
          </p>
        </div>

        <DepartmentsContent />
      </div>
    </div>
  );
}
