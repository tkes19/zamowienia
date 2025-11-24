import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { RegisterForm } from '@/components/auth/register-form';

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-4">
            <img
              src="/logo.webp"
              alt="REZON - Personalised gifts & fashion accessories"
              className="h-16 w-auto"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Zarejestruj nowe konto
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Dołącz do systemu zarządzania zamówieniami
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
