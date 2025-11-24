'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePermissions } from '@/hooks/useCurrentOrder';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types';
import { Package, User, Calendar, DollarSign, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { OrderStatus, ProductSource } from '@prisma/client';

// Mapowanie źródeł na skróty dla łatwej identyfikacji w produkcji
const SOURCE_LABELS: Record<ProductSource, string> = {
  MIEJSCOWOSCI: 'PM',
  KLIENCI_INDYWIDUALNI: 'KI',
  IMIENNE: 'Im',
  HASLA: 'H',
  OKOLICZNOSCIOWE: 'Ok',
};

const SOURCE_COLORS: Record<ProductSource, string> = {
  MIEJSCOWOSCI: 'bg-blue-100 text-blue-800',
  KLIENCI_INDYWIDUALNI: 'bg-green-100 text-green-800',
  IMIENNE: 'bg-purple-100 text-purple-800',
  HASLA: 'bg-orange-100 text-orange-800',
  OKOLICZNOSCIOWE: 'bg-red-100 text-red-800',
};

interface OrderDetailsDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdate: () => void;
}

export function OrderDetailsDialog({
  order,
  open,
  onOpenChange,
  onOrderUpdate,
}: OrderDetailsDialogProps) {
  const { data: session } = useSession();
  const [newStatus, setNewStatus] = useState<OrderStatus>(order.status);
  const [updating, setUpdating] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);

  const { hasPermission } = usePermissions();

  // TYMCZASOWO PRZYWRACAM STARE WARUNKI ŻEBY NIE PSUĆ DRUKOWANIA
  const canUpdateStatus = session?.user?.role === 'ADMIN' || session?.user?.role === 'WAREHOUSE';
  const canPrint =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'SALES_REP' ||
    session?.user?.role === 'SALES_DEPT' ||
    session?.user?.role === 'WAREHOUSE';
  const canDeleteOrder = hasPermission('delete_orders');

  // Zamknij menu po kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(event.target as Node)) {
        setShowPrintOptions(false);
      }
    };

    if (showPrintOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPrintOptions]);

  const handlePrint = (mode: 'full' | 'production-path' | 'production-order') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Nie można otworzyć okna drukowania');
      return;
    }

    const printContent = generatePrintContent(mode);
    printWindow.document.write(printContent);
    printWindow.document.close();

    // Czekaj na załadowanie i uruchom druk
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };

    setShowPrintOptions(false);
  };

  const generatePrintContent = (mode: 'full' | 'production-path' | 'production-order') => {
    const includePrices = mode !== 'production-order';
    const groupByProduction = mode === 'production-path' || mode === 'production-order';

    // Grupowanie pozycji według productionPath jeśli wymagane
    const groupedItems = groupByProduction
      ? groupItemsByProductionPath()
      : { 'Wszystkie pozycje': order.OrderItem || [] };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${mode === 'production-order' ? 'Zlecenie Produkcyjne' : 'Zamówienie'} ${order.orderNumber}</title>
        <style>
          ${getPrintStyles()}
        </style>
      </head>
      <body>
        ${generatePrintHeader(mode)}
        ${generatePrintBody(groupedItems, includePrices, mode)}
        ${includePrices ? generatePrintFooter() : ''}
      </body>
      </html>
    `;
  };

  const groupItemsByProductionPath = () => {
    const grouped: Record<string, any[]> = {};
    (order.OrderItem || []).forEach(item => {
      const path = item.Product?.productionPath || 'Nieokreślona';
      if (!grouped[path]) grouped[path] = [];
      grouped[path].push(item);
    });
    return grouped;
  };

  const generatePrintHeader = (
    mode: 'full' | 'production-path' | 'production-order',
    customOrderNumber?: string
  ) => {
    const docTitle = mode === 'production-order' ? 'ZLECENIE PRODUKCYJNE' : 'ZAMÓWIENIE';
    const displayNumber = customOrderNumber || order.orderNumber;

    return `
      <div class="header">
        <h1>${docTitle}</h1>
        <div class="order-info">
          <div><strong>Numer:</strong> ${displayNumber}</div>
          <div><strong>Data:</strong> ${new Date(order.createdAt).toLocaleDateString('pl-PL')}</div>
          <div><strong>Klient:</strong> ${order.Customer?.name || 'Brak danych'}</div>
          <div><strong>Handlowiec:</strong> ${order.User?.name || 'Nieznany'}</div>
        </div>
      </div>
    `;
  };

  const generatePrintBody = (
    groupedItems: Record<string, any[]>,
    includePrices: boolean,
    mode: string
  ) => {
    return Object.entries(groupedItems)
      .map(([productionPath, items], index) => {
        // Generuj numer zlecenia w formacie zamówienie/ścieżka
        const productionOrderNumber = order.orderNumber + '/' + (index + 1);

        // Header dla kolejnych ścieżek produkcyjnych
        const headerSection =
          Object.keys(groupedItems).length > 1 && index > 0
            ? generatePrintHeader(
                mode as 'full' | 'production-path' | 'production-order',
                productionOrderNumber
              )
            : '';

        // Numer zlecenia dla trybu produkcyjnego
        const orderNumberSection =
          Object.keys(groupedItems).length > 1
            ? '<div class="production-order-number">' + productionOrderNumber + '</div>'
            : '';

        // Generuj wiersze tabeli
        const tableRows = items
          .map(item => {
            const productCell =
              '<div class="product-identifier">' +
              (item.Product?.identifier || 'Nieznany') +
              '</div>' +
              (item.Product?.index
                ? '<div class="product-index">[' + item.Product.index + ']</div>'
                : '');

            const sourceCell =
              '<span class="source-badge source-' +
              item.source +
              '">' +
              (SOURCE_LABELS[item.source as ProductSource] || item.source) +
              '</span>';

            const priceColumns = includePrices
              ? '<td class="text-right">' +
                item.unitPrice.toFixed(2) +
                ' zł</td>' +
                '<td class="text-right"><strong>' +
                (item.quantity * item.unitPrice).toFixed(2) +
                ' zł</strong></td>'
              : '';

            const notesColumn =
              mode === 'production-order'
                ? '<td>' + (item.productionNotes || 'Brak') + '</td>'
                : '';

            return (
              '<tr>' +
              '<td>' +
              productCell +
              '</td>' +
              '<td>' +
              (item.customization || 'Brak') +
              '</td>' +
              '<td>' +
              sourceCell +
              '</td>' +
              '<td class="text-center">' +
              item.quantity +
              '</td>' +
              priceColumns +
              notesColumn +
              '</tr>'
            );
          })
          .join('');

        const priceHeaders = includePrices ? '<th>Cena jedn.</th><th>Razem</th>' : '';
        const notesHeader = mode === 'production-order' ? '<th>Uwagi produkcyjne</th>' : '';

        const pageBreak =
          Object.keys(groupedItems).length > 1 ? '<div class="page-break"></div>' : '';

        return (
          headerSection +
          orderNumberSection +
          '<table class="items-table">' +
          '<thead><tr>' +
          '<th>Produkt</th><th>Personalizacja</th><th>Źródło</th><th>Ilość</th>' +
          priceHeaders +
          notesHeader +
          '</tr></thead>' +
          '<tbody>' +
          tableRows +
          '</tbody>' +
          '</table>' +
          pageBreak
        );
      })
      .join('');
  };

  const generatePrintFooter = () => {
    return `
      <div class="footer">
        <div class="total-section">
          <strong>Łączna wartość zamówienia: ${order.total.toFixed(2)} zł</strong>
        </div>
        <div class="signatures">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Handlowiec</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Klient</div>
          </div>
        </div>
      </div>
    `;
  };

  const getPrintStyles = () => {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000; }
      
      .header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
      .header h1 { font-size: 24px; text-align: center; margin-bottom: 10px; }
      .order-info { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
      .order-info div { padding: 2px 0; }
      
      .production-path { 
        margin: 20px 0 10px 0; 
        padding: 8px 12px; 
        background-color: #f0f0f0; 
        border-left: 4px solid #007acc; 
        font-size: 16px; 
      }
      
      .items-table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-bottom: 20px; 
      }
      .items-table th, .items-table td { 
        border: 1px solid #ccc; 
        padding: 6px; 
        text-align: left; 
        vertical-align: top; 
        line-height: 1.3;
      }
      .items-table th { 
        background-color: #f5f5f5; 
        font-weight: bold; 
        text-align: center; 
        padding: 8px 6px;
        font-size: 11px;
      }
      .items-table td {
        font-size: 11px;
      }
      
      .product-identifier { font-size: 12px; font-weight: bold; color: #000; }
      .product-index { font-size: 12px; color: #666; font-weight: normal; }
      
      .production-order-number { 
        font-size: 14px; 
        font-weight: bold; 
        margin: 15px 0 10px 0; 
        padding: 8px; 
        background-color: #e3f2fd; 
        border: 1px solid #1976d2; 
        text-align: center; 
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      
      .source-badge { 
        padding: 2px 6px; 
        border-radius: 3px; 
        font-size: 10px; 
        font-weight: bold; 
        color: white; 
      }
      .source-MIEJSCOWOSCI { background-color: #007acc; }
      .source-KLIENCI_INDYWIDUALNI { background-color: #28a745; }
      .source-IMIENNE { background-color: #6f42c1; }
      .source-HASLA { background-color: #fd7e14; }
      .source-OKOLICZNOSCIOWE { background-color: #dc3545; }
      
      .footer { margin-top: 30px; }
      .total-section { 
        text-align: right; 
        font-size: 16px; 
        margin-bottom: 30px; 
        padding: 10px; 
        background-color: #f9f9f9; 
      }
      
      .signatures { 
        display: flex; 
        justify-content: space-between; 
        margin-top: 40px; 
      }
      .signature-box { text-align: center; width: 200px; }
      .signature-line { 
        border-bottom: 1px solid #000; 
        height: 40px; 
        margin-bottom: 5px; 
      }
      .signature-label { font-size: 12px; }
      
      .page-break { page-break-after: always; }
      
      @media print {
        body { margin: 0; }
        .page-break { page-break-after: always; }
      }
    `;
  };

  const handleStatusUpdate = async () => {
    if (newStatus === order.status) {
      toast.info('Status nie został zmieniony');
      return;
    }

    setUpdating(true);

    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success('Status zamówienia został zaktualizowany');
        onOrderUpdate();
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas aktualizacji statusu');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Wystąpił błąd podczas aktualizacji statusu');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!canDeleteOrder) {
      toast.error('Nie masz uprawnień do usuwania zamówień');
      return;
    }

    // Sprawdź czy status pozwala na usunięcie
    const deletableStatuses = ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!deletableStatuses.includes(order.status)) {
      toast.error('Nie można usunąć zamówienia w tym statusie');
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
      setUpdating(true);
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Zamówienie zostało usunięte');
        onOpenChange(false);
        // Odśwież listę zamówień jeśli jest callback
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas usuwania zamówienia');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Wystąpił błąd podczas usuwania zamówienia');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle>Szczegóły zamówienia {order.orderNumber}</DialogTitle>
              <DialogDescription>
                Zamówienie złożone {new Date(order.createdAt).toLocaleDateString('pl-PL')}
              </DialogDescription>
            </div>
            {canPrint && (
              <div className="relative" ref={printMenuRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPrintOptions(!showPrintOptions)}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Drukuj
                </Button>
                {showPrintOptions && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border rounded-lg shadow-lg z-50 p-2">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left"
                        onClick={() => handlePrint('full')}
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Pełne zamówienie (z cenami)
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left"
                        onClick={() => handlePrint('production-path')}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Podział według ścieżek produkcyjnych
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left"
                        onClick={() => handlePrint('production-order')}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Zlecenie produkcyjne (bez cen)
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informacje podstawowe */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Klient</p>
                    <p className="text-sm text-gray-600">
                      {order.Customer?.name || 'Brak klienta'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Data złożenia</p>
                    <p className="text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString('pl-PL')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <Badge className={ORDER_STATUS_COLORS[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Wartość</p>
                    <p className="text-sm text-gray-600">{order.total.toFixed(2)} zł</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Zmiana statusu */}
          {canUpdateStatus && (
            <Card>
              <CardHeader>
                <CardTitle>Zmień status zamówienia</CardTitle>
                <CardDescription>
                  Aktualizuj status zamówienia w zależności od etapu realizacji
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <Select
                    value={newStatus}
                    onValueChange={value => setNewStatus(value as OrderStatus)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Złożone</SelectItem>
                      <SelectItem value="PROCESSING">W realizacji</SelectItem>
                      <SelectItem value="SHIPPED">Wysłane</SelectItem>
                      <SelectItem value="DELIVERED">Dostarczone</SelectItem>
                      <SelectItem value="CANCELLED">Anulowane</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={updating || newStatus === order.status}
                  >
                    {updating ? 'Aktualizowanie...' : 'Aktualizuj status'}
                  </Button>
                  {canDeleteOrder &&
                    ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status) && (
                      <Button variant="destructive" onClick={handleDeleteOrder} disabled={updating}>
                        {updating ? 'Usuwanie...' : 'Usuń zamówienie'}
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pozycje zamówienia */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Pozycje zamówienia</CardTitle>
                  <CardDescription>
                    {order.OrderItem?.length || 0}{' '}
                    {(order.OrderItem?.length || 0) === 1 ? 'pozycja' : 'pozycje'}
                  </CardDescription>
                </div>
                {/* Informacja o folderach klientów indywidualnych */}
                {(() => {
                  const clientFolders =
                    order.OrderItem?.filter(
                      item => item.source === 'KLIENCI_INDYWIDUALNI' && item.locationName
                    )
                      .map(item => item.locationName)
                      .filter((folder, index, arr) => arr.indexOf(folder) === index) || []; // unikalne

                  if (clientFolders.length === 0) return null;

                  return (
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {clientFolders.length === 1 ? 'Folder:' : 'Foldery:'}
                      </p>
                      <p className="text-sm font-medium text-blue-600">
                        {clientFolders.join(', ')}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produkt</TableHead>
                    <TableHead>Personalizacja</TableHead>
                    <TableHead className="w-16">Źródło</TableHead>
                    <TableHead>Ilość</TableHead>
                    <TableHead>Cena jednostkowa</TableHead>
                    <TableHead>Razem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.OrderItem?.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.Product?.identifier}</p>
                            <span className="text-xs text-gray-500 font-mono">
                              [{item.Product?.index}]
                            </span>
                          </div>
                          {/* Usunięto długi opis produktu - wystarczy identyfikator i indeks */}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.customization ? (
                          <span className="text-blue-600">{item.customization}</span>
                        ) : (
                          <span className="text-gray-400">Brak</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs px-2 py-1 ${SOURCE_COLORS[item.source]}`}>
                          {SOURCE_LABELS[item.source]}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.totalQuantity || item.quantity}</TableCell>
                      <TableCell>{item.unitPrice.toFixed(2)} zł</TableCell>
                      <TableCell className="font-medium">
                        {((item.totalQuantity || item.quantity) * item.unitPrice).toFixed(2)} zł
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>Razem:</span>
                  <span>{order.total.toFixed(2)} zł</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informacje o kliencie */}
          {order.Customer && (
            <Card>
              <CardHeader>
                <CardTitle>Informacje o kliencie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nazwa</p>
                    <p className="text-sm">{order.Customer.name}</p>
                  </div>
                  {order.Customer.address && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Adres</p>
                      <p className="text-sm">{order.Customer.address}</p>
                    </div>
                  )}
                  {order.Customer.phone && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Telefon</p>
                      <p className="text-sm">{order.Customer.phone}</p>
                    </div>
                  )}
                  {order.Customer.email && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <p className="text-sm">{order.Customer.email}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notatki */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notatki do zamówienia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
