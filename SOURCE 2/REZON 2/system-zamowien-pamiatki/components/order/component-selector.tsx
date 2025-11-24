'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, User, Type, Hash, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OrderComponent =
  | 'MIEJSCOWOŚCI'
  | 'KLIENCI_INDYWIDUALNI'
  | 'IMIENNE'
  | 'HASŁA'
  | 'OKOLICZNOŚCIOWE';

interface ComponentSelectorProps {
  onComponentSelected: (component: OrderComponent) => void;
}

interface ComponentOption {
  id: OrderComponent;
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  comingSoon?: boolean;
}

export function ComponentSelector({ onComponentSelected }: ComponentSelectorProps) {
  const components: ComponentOption[] = [
    {
      id: 'MIEJSCOWOŚCI',
      title: 'Projekty miejscowości',
      description: 'Pamiątki personalizowane dla konkretnych miejscowości i miast',
      icon: <MapPin className="h-6 w-6" />,
      enabled: true,
    },
    {
      id: 'KLIENCI_INDYWIDUALNI',
      title: 'Klienci indywidualni',
      description: 'Pamiątki personalizowane dla konkretnych klientów i firm',
      icon: <User className="h-6 w-6" />,
      enabled: true,
    },
    {
      id: 'IMIENNE',
      title: 'Imienne',
      description: 'Pamiątki personalizowane imieniem osoby',
      icon: <Type className="h-6 w-6" />,
      enabled: false,
      comingSoon: true,
    },
    {
      id: 'HASŁA',
      title: 'Hasła',
      description: 'Pamiątki z hasłami, sloganami lub tekstami',
      icon: <Hash className="h-6 w-6" />,
      enabled: false,
      comingSoon: true,
    },
    {
      id: 'OKOLICZNOŚCIOWE',
      title: 'Okolicznościowe',
      description: 'Pamiątki na specjalne okazje i wydarzenia',
      icon: <Calendar className="h-6 w-6" />,
      enabled: false,
      comingSoon: true,
    },
  ];

  const handleComponentClick = (component: ComponentOption) => {
    if (!component.enabled) return;
    // Od razu przejdź do kolejnego kroku bez dodatkowego przycisku
    onComponentSelected(component.id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Nowe zamówienie</h1>
        <p className="text-lg text-gray-600">Wybierz typ personalizacji dla Twojego zamówienia</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
        {components.map(component => (
          <Card
            key={component.id}
            className={cn(
              'cursor-pointer transition-all duration-200 relative h-40',
              component.enabled
                ? 'hover:shadow-lg hover:scale-105 hover:bg-gray-50'
                : 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => handleComponentClick(component)}
          >
            {component.comingSoon && (
              <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                Wkrótce
              </div>
            )}

            <CardHeader className="text-center pb-2 px-3">
              <div className="mx-auto mb-2 p-2 rounded-full bg-gray-100 text-gray-600 w-fit">
                {component.icon}
              </div>
              <CardTitle className="text-sm font-semibold leading-tight">
                {component.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="text-center px-3 py-0">
              <CardDescription className="text-xs leading-tight">
                {component.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center text-sm text-gray-500 max-w-2xl mx-auto">
        <p>
          💡 <strong>Wskazówka:</strong> Każdy komponent umożliwia różne typy personalizacji. Możesz
          łączyć różne komponenty w jednym zamówieniu podczas dalszych kroków.
        </p>
      </div>
    </div>
  );
}
