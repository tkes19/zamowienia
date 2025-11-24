import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AppLayout } from '@/components/layout/app-layout';
import { UserSettingsContent } from '@/components/user/user-settings-content';

export default async function UserSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <AppLayout>
      <UserSettingsContent />
    </AppLayout>
  );
}
