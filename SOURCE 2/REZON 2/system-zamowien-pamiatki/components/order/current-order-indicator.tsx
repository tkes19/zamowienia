'use client';

import React from 'react';
import { useCurrentOrder } from '@/hooks/useCurrentOrder';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, X } from 'lucide-react';
import Link from 'next/link';

export function CurrentOrderIndicator() {
  const { order, isLoading, getTotalValue, getItemCount, clearOrder } = useCurrentOrder();

  if (isLoading || !order || getItemCount() === 0) {
    return null;
  }

  return (
    <Card className="mb-4 bg-blue-50 border-blue-200">
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Bieżące zamówienie</span>
              <Badge variant="default" className="bg-blue-600 text-xs">
                Aktywne
              </Badge>
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{getItemCount()}</span> pozycji |
              <span className="font-medium ml-1">{getTotalValue().toFixed(2)} zł</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={clearOrder}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-gray-500 hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </Button>

            <Link href="/nowe-zamowienie">
              <Button size="sm" className="h-7 text-xs">
                Złóż zamówienie
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
