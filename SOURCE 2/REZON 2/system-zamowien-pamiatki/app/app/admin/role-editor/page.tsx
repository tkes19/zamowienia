import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RoleEditorContent } from '@/components/admin/role-editor-content';

export const metadata = {
  title: 'Edytor Ról i Uprawnień - REZON',
  description: 'Panel administracyjny do zarządzania uprawnieniami ról w systemie REZON',
};

export default async function RoleEditorPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Edytor Ról i Uprawnień</h1>
          <p className="text-muted-foreground">
            Zarządzaj uprawnieniami przypisanymi do poszczególnych ról w systemie. Wszystkie zmiany
            są automatycznie logowane.
          </p>
        </div>

        <RoleEditorContent />
      </div>
    </div>
  );
}
