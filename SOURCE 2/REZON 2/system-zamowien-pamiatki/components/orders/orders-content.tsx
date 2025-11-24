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
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types';
import { Search, ClipboardList, Eye } from 'lucide-react';
import { OrderDetailsDialog } from '@/components/orders/order-details-dialog';
import { usePermissions } from '@/hooks/useCurrentOrder';

export function OrdersContent() {
  const { data: session } = useSession();
  const { hasPermission } = usePermissions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm?.toLowerCase() || '';
    const matchesSearch =
      !searchTerm ||
      (order.orderNumber && order.orderNumber.toLowerCase().includes(searchLower)) ||
      (order.Customer?.name && order.Customer.name.toLowerCase().includes(searchLower));
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!hasPermission('delete_orders')) {
      alert('Nie masz uprawnień do usuwania zamówień');
      return;
    }

    // Sprawdź czy status pozwala na usunięcie
    const deletableStatuses = ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!deletableStatuses.includes(order.status)) {
      alert('Nie można usunąć zamówienia w tym statusie');
      return;
    }

    if (
      !confirm(
        `Czy na pewno chcesz usunąć zamówienie ${order.orderNumber}? Ta operacja jest nieodwracalna.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Zamówienie zostało usunięte');
        // Odśwież listę zamówień
        fetchOrders();
      } else {
        const error = await response.json();
        alert(error.message || 'Błąd podczas usuwania zamówienia');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Wystąpił błąd podczas usuwania zamówienia');
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zamówienia</h1>
          <p className="text-gray-600">Zarządzaj zamówieniami i śledź ich status</p>
        </div>
        {session?.user?.role === 'SALES_REP' && (
          <Button asChild>
            <a href="/nowe-zamowienie">Złóż nowe zamówienie</a>
          </Button>
        )}
      </div>

      {/* Filtry */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Szukaj po numerze zamówienia lub kliencie..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="lg:w-64">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtruj po statusie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie statusy</SelectItem>
                  <SelectItem value="DRAFT">Robocze</SelectItem>
                  <SelectItem value="PENDING">Złożone</SelectItem>
                  <SelectItem value="PROCESSING">W realizacji</SelectItem>
                  <SelectItem value="SHIPPED">Wysłane</SelectItem>
                  <SelectItem value="DELIVERED">Dostarczone</SelectItem>
                  <SelectItem value="CANCELLED">Anulowane</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela zamówień */}
      <Card>
        <CardHeader>
          <CardTitle>Lista zamówień</CardTitle>
          <CardDescription>
            {filteredOrders.length} {filteredOrders.length === 1 ? 'zamówienie' : 'zamówienia'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center">
              <ClipboardList className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Brak zamówień</h3>
              <p className="text-gray-600">
                Nie znaleziono zamówień spełniających kryteria wyszukiwania.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer zamówienia</TableHead>
                    <TableHead>Klient</TableHead>
                    {session?.user?.role !== 'SALES_REP' && <TableHead>Handlowiec</TableHead>}
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Wartość</TableHead>
                    <TableHead>Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.orderNumber || 'Brak numeru'}
                      </TableCell>
                      <TableCell>{order.Customer?.name || 'Brak klienta'}</TableCell>
                      {session?.user?.role !== 'SALES_REP' && (
                        <TableCell>{order.User?.name || 'Nieznany'}</TableCell>
                      )}
                      <TableCell>{new Date(order.createdAt).toLocaleDateString('pl-PL')}</TableCell>
                      <TableCell>
                        <Badge className={ORDER_STATUS_COLORS[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.total?.toFixed(2)} zł</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(order)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Szczegóły
                          </Button>
                          {hasPermission('delete_orders') &&
                            ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(
                              order.status
                            ) && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteOrder(order)}
                              >
                                Usuń
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog szczegółów zamówienia */}
      {selectedOrder && (
        <OrderDetailsDialog
          order={selectedOrder}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          onOrderUpdate={fetchOrders}
        />
      )}
    </div>
  );
}
