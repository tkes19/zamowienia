'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Menu } from 'lucide-react';
import { USER_ROLE_LABELS } from '@/lib/types';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();

  if (!session) return null;

  const handleSignOut = () => {
    // Po wylogowaniu wróć do katalogu publicznego
    signOut({ callbackUrl: '/' });
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h1 className="text-lg lg:text-xl font-semibold text-gray-900">
            System zarządzania zamówieniami
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">
                {session.user?.name || 'Użytkownik'}
              </span>
              <span className="text-xs text-gray-500">
                {USER_ROLE_LABELS[session.user?.role as keyof typeof USER_ROLE_LABELS] ||
                  'Nieznana rola'}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Wyloguj</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
