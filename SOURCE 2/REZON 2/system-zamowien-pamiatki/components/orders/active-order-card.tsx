'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSession } from 'next-auth/react';
import { Plus, Package } from 'lucide-react';

interface ActiveOrderCardProps {
  className?: string;
}

export function ActiveOrderCard({ className }: ActiveOrderCardProps) {
  const { data: session } = useSession();

  // Generuj prosty numer zamówienia - jeśli brak to domyślny format
  const getOrderNumber = () => {
    const currentYear = new Date().getFullYear();

    // Pobierz inicjały z nazwy użytkownika lub użyj XXX jako domyślne
    let initials = 'XXX';
    if (session?.user?.name) {
      const nameParts = session.user.name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        initials = (firstName.charAt(0) + lastName.substring(0, 2)).toUpperCase();
      } else {
        initials = session.user.name.substring(0, 3).toUpperCase();
      }
    }

    // Zwróć domyślny format - w przyszłości można dodać logikę pobierania z bazy
    return `${currentYear}/1/${initials}`;
  };

  return (
    <div className={`px-4 ${className}`}>
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Numer zamówienia</span>
            </div>

            {/* Numer zamówienia */}
            <div className="text-center py-2">
              <div className="text-lg font-bold text-blue-900">{getOrderNumber()}</div>
            </div>

            {/* Przycisk nowego zamówienia */}
            <Button size="sm" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Nowe zamówienie
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
