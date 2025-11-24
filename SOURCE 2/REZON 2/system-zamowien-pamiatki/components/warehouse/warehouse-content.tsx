'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types';
import { Package, Clock, CheckCircle, AlertTriangle, Truck } from 'lucide-react';
import { toast } from 'sonner';

export function WarehouseContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(
          data.filter(
            (order: Order) => order.status !== 'DELIVERED' && order.status !== 'CANCELLED'
          )
        );
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success('Status zamówienia został zaktualizowany');
        fetchOrders();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas aktualizacji statusu');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Wystąpił błąd podczas aktualizacji statusu');
    }
  };

  const getOrdersByStatus = (status: string) => {
    return orders.filter(order => order.status === status);
  };

  const pendingOrders = getOrdersByStatus('PENDING');
  const processingOrders = getOrdersByStatus('PROCESSING');
  const shippedOrders = getOrdersByStatus('SHIPPED');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'PROCESSING':
        return <Package className="h-4 w-4" />;
      case 'SHIPPED':
        return <Truck className="h-4 w-4" />;
      case 'DELIVERED':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel magazynu</h1>
        <p className="text-gray-600">Zarządzaj realizacją zamówień i stanami magazynowymi</p>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Oczekujące</p>
                <p className="text-2xl font-bold text-blue-600">{pendingOrders.length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">W realizacji</p>
                <p className="text-2xl font-bold text-orange-600">{processingOrders.length}</p>
              </div>
              <Package className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Wysłane</p>
                <p className="text-2xl font-bold text-purple-600">{shippedOrders.length}</p>
              </div>
              <Truck className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Łącznie aktywnych</p>
                <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista zamówień do realizacji */}
      <Card>
        <CardHeader>
          <CardTitle>Zamówienia do realizacji</CardTitle>
          <CardDescription>Lista wszystkich aktywnych zamówień wymagających uwagi</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Brak zamówień do realizacji
              </h3>
              <p className="text-gray-600">
                Wszystkie zamówienia zostały już zrealizowane lub dostarczone.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer zamówienia</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Handlowiec</TableHead>
                    <TableHead>Data złożenia</TableHead>
                    <TableHead>Pozycje</TableHead>
                    <TableHead>Wartość</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.Customer?.name || 'Brak klienta'}</TableCell>
                      <TableCell>{order.User?.name || 'Nieznany'}</TableCell>
                      <TableCell>{new Date(order.createdAt).toLocaleDateString('pl-PL')}</TableCell>
                      <TableCell>{order.OrderItem?.length || 0} pozycji</TableCell>
                      <TableCell>{order.total.toFixed(2)} zł</TableCell>
                      <TableCell>
                        <Badge className={ORDER_STATUS_COLORS[order.status]}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(order.status)}
                            <span>{ORDER_STATUS_LABELS[order.status]}</span>
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={order.status}
                          onValueChange={newStatus => handleStatusUpdate(order.id, newStatus)}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Złożone</SelectItem>
                            <SelectItem value="PROCESSING">W realizacji</SelectItem>
                            <SelectItem value="SHIPPED">Wysłane</SelectItem>
                            <SelectItem value="DELIVERED">Dostarczone</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Priorytetowe zamówienia */}
      {pendingOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span>Zamówienia priorytetowe</span>
            </CardTitle>
            <CardDescription>Najstarsze zamówienia oczekujące na realizację</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingOrders
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .slice(0, 5)
                .map(order => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border border-orange-200 rounded-lg bg-orange-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium">{order.orderNumber}</p>
                        <p className="text-sm text-gray-600">
                          {order.Customer?.name} •{' '}
                          {new Date(order.createdAt).toLocaleDateString('pl-PL')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {order.total.toFixed(2)} zł
                      </span>
                      <Button size="sm" onClick={() => handleStatusUpdate(order.id, 'PROCESSING')}>
                        Rozpocznij realizację
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
