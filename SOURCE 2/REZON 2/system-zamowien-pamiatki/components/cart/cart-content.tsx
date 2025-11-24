'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useOrderStore } from '@/lib/cart';
import { Customer, PRODUCT_SOURCE_LABELS } from '@/lib/types';
import { ShoppingCart, Trash2, Plus, Minus, Package, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export function CartContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const {
    activeOrder,
    setCustomerForActiveOrder,
    clearActiveOrder,
    removeItemFromActiveOrder,
    updateItemInActiveOrder,
    getTotalPrice,
    getTotalItems,
    getGroupedItems,
  } = useOrderStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const placeOrder = async () => {
    if (!activeOrder?.selectedCustomerId) {
      toast.error('Wybierz klienta przed złożeniem zamówienia');
      return;
    }

    if (!activeOrder?.items || activeOrder.items.length === 0) {
      toast.error('Zamówienie jest puste');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: activeOrder.selectedCustomerId,
          items: activeOrder.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            customization: item.customization,
            unitPrice: item.product?.price || 0,
            source: item.source,
            locationName: item.locationName,
            projectName: item.projectName,
            selectedProjects: item.selectedProjects,
            projectQuantities: item.projectQuantities,
            totalQuantity: item.totalQuantity,
            productionNotes: item.productionNotes,
          })),
          total: getTotalPrice(),
        }),
      });

      if (response.ok) {
        const order = await response.json();
        clearActiveOrder();
        toast.success('Zamówienie zostało złożone pomyślnie!');
        router.push('/zamowienia');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas składania zamówienia');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Wystąpił błąd podczas składania zamówienia');
    } finally {
      setLoading(false);
    }
  };

  if (!activeOrder?.items || activeOrder.items.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Brak aktywnego zamówienia</h3>
            <p className="text-gray-600 mb-4">
              Utwórz nowe zamówienie lub dodaj produkty do aktywnego zamówienia.
            </p>
            <Button asChild>
              <a href="/produkty">Przeglądaj produkty</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aktywne zamówienie</h1>
          <p className="text-gray-600">
            {getTotalItems()} {getTotalItems() === 1 ? 'produkt' : 'produkty'} w zamówieniu
          </p>
        </div>
        <Button variant="outline" onClick={clearActiveOrder}>
          <Trash2 className="h-4 w-4 mr-2" />
          Wyczyść zamówienie
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista produktów */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Produkty w zamówieniu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(getGroupedItems()).map(([sourceKey, sourceItems]) => (
                  <div key={sourceKey}>
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {PRODUCT_SOURCE_LABELS[sourceKey as keyof typeof PRODUCT_SOURCE_LABELS] ||
                          sourceKey}
                      </h3>
                      <Badge variant="secondary">
                        {sourceItems.length} {sourceItems.length === 1 ? 'pozycja' : 'pozycji'}
                      </Badge>
                    </div>

                    <div className="space-y-3 pl-4">
                      {sourceItems.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center space-x-4 p-4 border rounded-lg bg-gray-50"
                        >
                          <div className="relative w-16 h-16 flex-shrink-0 aspect-square bg-muted rounded">
                            <Image
                              src={item.product?.imageUrl || '/placeholder-product.jpg'}
                              alt={item.product?.identifier || 'Product'}
                              fill
                              className="object-cover rounded"
                            />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{item.product?.identifier}</h4>
                              <span className="text-xs text-gray-500 font-mono">
                                [{item.product?.index}]
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {item.product?.price?.toFixed(2)} zł za sztukę
                            </p>
                            {item.locationName && (
                              <p className="text-sm text-green-600">📍 {item.locationName}</p>
                            )}
                            {item.projectName && (
                              <p className="text-sm text-purple-600">🎯 {item.projectName}</p>
                            )}
                            {item.customization && (
                              <p className="text-sm text-blue-600">✏️ {item.customization}</p>
                            )}
                            {item.selectedProjects && (
                              <p className="text-sm text-indigo-600">
                                📋 Projekty: {item.selectedProjects}
                              </p>
                            )}
                            {item.productionNotes && (
                              <p className="text-sm text-orange-600">
                                📝 Notatka: {item.productionNotes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                updateItemInActiveOrder(item.id, {
                                  quantity: Math.max(1, item.quantity - 1),
                                })
                              }
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                updateItemInActiveOrder(item.id, {
                                  quantity: item.quantity + 1,
                                })
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => removeItemFromActiveOrder(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="text-right">
                            <p className="font-semibold">
                              {((item.product?.price || 0) * item.quantity).toFixed(2)} zł
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Podsumowanie zamówienia */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Podsumowanie zamówienia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Liczba pozycji:</span>
                  <span>{getTotalItems()}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Razem:</span>
                  <span>{getTotalPrice().toFixed(2)} zł</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Wybierz klienta:</label>
                <Select
                  value={activeOrder?.selectedCustomerId || ''}
                  onValueChange={value => setCustomerForActiveOrder(value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz klienta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={placeOrder}
                className="w-full"
                disabled={loading || !activeOrder?.selectedCustomerId}
              >
                {loading ? (
                  <>
                    <Package className="mr-2 h-4 w-4 animate-spin" />
                    Składanie zamówienia...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Złóż zamówienie
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
