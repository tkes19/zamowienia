import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RolesContent } from '@/components/admin/roles-content';

export const metadata = {
  title: 'Zarządzanie Rolami - REZON',
  description: 'Panel administracyjny do zarządzania rolami użytkowników w systemie REZON',
};

export default async function RolesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role) {
    redirect('/auth/login');
  }

  // Sprawdź rolę z sesji - middleware już sprawdza dostęp
  if (session.user.role !== 'ADMIN') {
    redirect('/zamowienia');
  }

  return (
    <div className="container mx-auto py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zarządzanie Rolami</h1>
          <p className="text-muted-foreground">
            Przeglądaj i zarządzaj rolami użytkowników w systemie. Przypisuj odpowiednie
            uprawnienia.
          </p>
        </div>

        <RolesContent />
      </div>
    </div>
  );
}
