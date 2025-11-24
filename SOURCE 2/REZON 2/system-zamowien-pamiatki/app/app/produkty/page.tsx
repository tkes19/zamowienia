import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AppLayout } from '@/components/layout/app-layout';
import { ProductsContent } from '@/components/products/products-content';

export default async function ProductsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <AppLayout>
      <ProductsContent />
    </AppLayout>
  );
}
