'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserSettings {
  name: string;
  email: string;
  role: string;
}

export function UserSettingsContent() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<UserSettings>({
    name: '',
    email: '',
    role: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings({
          name: data.name,
          email: data.email,
          role: data.role,
        });
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      toast.error('Błąd podczas pobierania ustawień');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Settings className="h-8 w-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">Ustawienia konta</h1>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informacje o koncie</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nazwa użytkownika
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700">
                {settings.name || 'Nie podano'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700">
                {settings.email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700">
                {settings.role === 'SALES_REP'
                  ? 'Handlowiec'
                  : settings.role === 'ADMIN'
                    ? 'Administrator'
                    : settings.role === 'WAREHOUSE'
                      ? 'Magazynier'
                      : settings.role}
              </div>
            </div>
          </div>
        </div>

        {/* Future Settings Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dodatkowe ustawienia</h2>

          <p className="text-gray-600 text-sm">
            Więcej opcji konfiguracji będzie dostępnych w przyszłych aktualizacjach.
          </p>

          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-gray-600 text-xs">
              💡 <strong>Nawigacja:</strong>
              Używaj menu po lewej stronie aby przechodzić między różnymi sekcjami systemu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
