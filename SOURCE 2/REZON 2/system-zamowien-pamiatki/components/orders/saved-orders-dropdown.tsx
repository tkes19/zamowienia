'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useOrderStore } from '@/lib/cart';
import { ChevronDown, Plus, Copy, Trash2, Star, StarIcon, Package, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface SavedOrdersDropdownProps {
  className?: string;
}

export function SavedOrdersDropdown({ className }: SavedOrdersDropdownProps) {
  const {
    activeOrder,
    savedOrders,
    createNewOrder,
    loadSavedOrder,
    copySavedOrder,
    deleteSavedOrder,
    toggleOrderFavorite,
    saveActiveOrder,
  } = useOrderStore();

  const [isOpen, setIsOpen] = useState(false);

  const handleNewOrder = async () => {
    try {
      await createNewOrder();
      toast.success('Utworzono nowe zamówienie');
      setIsOpen(false);
    } catch (error) {
      toast.error('Nie udało się utworzyć zamówienia');
      console.error('Error creating new order:', error);
    }
  };

  const handleLoadOrder = (orderId: string) => {
    loadSavedOrder(orderId);
    toast.success('Zamówienie zostało wczytane');
    setIsOpen(false);
  };

  const handleCopyOrder = (orderId: string) => {
    copySavedOrder(orderId);
    toast.success('Zamówienie zostało skopiowane');
    setIsOpen(false);
  };

  const handleDeleteOrder = (orderId: string) => {
    deleteSavedOrder(orderId);
    toast.success('Zamówienie zostało usunięte');
  };

  const handleToggleFavorite = (orderId: string) => {
    const order = savedOrders.find(o => o.id === orderId);
    if (order?.isFavorite) {
      toggleOrderFavorite(orderId);
      toast.success('Usunięto z ulubionych');
    } else {
      const favoriteName = prompt('Nazwa dla ulubionego zamówienia:');
      if (favoriteName) {
        toggleOrderFavorite(orderId, favoriteName);
        toast.success('Dodano do ulubionych');
      }
    }
  };

  const handleSaveActiveOrder = () => {
    if (!activeOrder || activeOrder.items.length === 0) {
      toast.error('Brak pozycji do zapisania');
      return;
    }

    const shouldMarkAsFavorite = confirm('Czy oznaczyć to zamówienie jako ulubione?');
    let favoriteName;

    if (shouldMarkAsFavorite) {
      favoriteName = prompt('Nazwa dla ulubionego zamówienia:');
      if (!favoriteName) return;
    }

    saveActiveOrder(favoriteName);
    toast.success(
      shouldMarkAsFavorite ? 'Zamówienie zapisane jako ulubione' : 'Zamówienie zapisane'
    );
  };

  const favoriteOrders = savedOrders.filter(order => order.isFavorite);
  const regularOrders = savedOrders.filter(order => !order.isFavorite);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={`w-full justify-between ${className}`}>
          <div className="flex items-center">
            <Package className="mr-3 h-5 w-5" />
            <span>Zamówienia</span>
          </div>
          <div className="flex items-center gap-2">
            {activeOrder && (
              <Badge variant="secondary" className="text-xs">
                {activeOrder.totalItems}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4" />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80" align="start">
        {/* Aktywne zamówienie */}
        <DropdownMenuLabel>Aktywne zamówienie</DropdownMenuLabel>
        {activeOrder ? (
          <div className="px-2 py-1 mb-2">
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm">{activeOrder.orderNumber}</div>
                <div className="text-xs text-gray-500">
                  {activeOrder.totalItems} pozycji • {activeOrder.totalPrice.toFixed(2)} zł
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSaveActiveOrder}>
                Zapisz
              </Button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem onClick={handleNewOrder}>
            <Plus className="mr-2 h-4 w-4" />
            Nowe zamówienie
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Ulubione zamówienia */}
        {favoriteOrders.length > 0 && (
          <>
            <DropdownMenuLabel>
              <div className="flex items-center">
                <Star className="mr-2 h-4 w-4 text-yellow-500" />
                Ulubione
              </div>
            </DropdownMenuLabel>
            {favoriteOrders.map(order => (
              <DropdownMenuSub key={order.id}>
                <DropdownMenuSubTrigger>
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {order.favoriteName || order.orderNumber}
                    </div>
                    <div className="text-xs text-gray-500">
                      {order.totalItems} pozycji • {order.totalPrice.toFixed(2)} zł
                    </div>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleLoadOrder(order.id)}>
                    <Package className="mr-2 h-4 w-4" />
                    Wczytaj
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCopyOrder(order.id)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Kopiuj
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleFavorite(order.id)}>
                    <StarIcon className="mr-2 h-4 w-4" />
                    Usuń z ulubionych
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteOrder(order.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Usuń
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Zapisane zamówienia */}
        {regularOrders.length > 0 && (
          <>
            <DropdownMenuLabel>
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4" />
                Ostatnie ({regularOrders.length})
              </div>
            </DropdownMenuLabel>
            {regularOrders.slice(0, 5).map(order => (
              <DropdownMenuSub key={order.id}>
                <DropdownMenuSubTrigger>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{order.orderNumber}</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(order.createdAt), 'dd MMM yyyy', { locale: pl })} •
                      {order.totalItems} pozycji • {order.totalPrice.toFixed(2)} zł
                    </div>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleLoadOrder(order.id)}>
                    <Package className="mr-2 h-4 w-4" />
                    Wczytaj
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCopyOrder(order.id)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Kopiuj
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleFavorite(order.id)}>
                    <Star className="mr-2 h-4 w-4" />
                    Dodaj do ulubionych
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteOrder(order.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Usuń
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Akcje */}
        {!activeOrder && (
          <DropdownMenuItem onClick={handleNewOrder}>
            <Plus className="mr-2 h-4 w-4" />
            Nowe zamówienie
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
