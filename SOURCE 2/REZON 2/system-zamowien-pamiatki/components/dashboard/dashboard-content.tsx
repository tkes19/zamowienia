'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Package,
  ShoppingCart,
  Users,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  CheckCircle,
} from 'lucide-react';
import { DebugPanel } from './debug-panel';
import { useOrdersStats } from '@/hooks/use-orders-stats';
import { useRecentOrders } from '@/hooks/use-recent-orders';

export function DashboardContent() {
  const { data: session } = useSession();
  const { stats: ordersStats, loading: statsLoading, error: statsError } = useOrdersStats();
  const { orders: recentOrders, loading: ordersLoading, error: ordersError } = useRecentOrders();

  if (!session) return null;

  const renderAdminDashboard = () => {
    // Tylko dla admina używamy prawdziwych danych z API
    const todayOrdersCount = statsLoading ? '...' : (ordersStats?.todayOrders ?? 12);

    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zamówienia dziś</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayOrdersCount}</div>
              <p className="text-xs text-muted-foreground">
                {statsLoading ? 'Ładowanie...' : '+20% w porównaniu do wczoraj'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktywni handlowcy</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">3 nowych w tym miesiącu</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produkty w katalogu</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">287</div>
              <p className="text-xs text-muted-foreground">13 nowych produktów</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Przychód miesiąc</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">45.231 zł</div>
              <p className="text-xs text-muted-foreground">
                +15% w porównaniu do poprzedniego miesiąca
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ostatnie zamówienia</CardTitle>
              <CardDescription>Przegląd najnowszych zamówień w systemie</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <ClipboardList className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Zamówienie #{2024000 + i}</p>
                        <p className="text-sm text-gray-500">Hotel Górski</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">W realizacji</Badge>
                      <p className="text-sm text-gray-500 mt-1">1,234 zł</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button asChild className="w-full">
                  <Link href="/zamowienia">Zobacz wszystkie zamówienia</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Akcje administracyjne</CardTitle>
              <CardDescription>Szybki dostęp do najważniejszych funkcji</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button asChild variant="outline" className="h-20 flex flex-col">
                  <Link href="/admin/produkty">
                    <Package className="h-6 w-6 mb-2" />
                    Zarządzaj produktami
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col">
                  <Link href="/uzytkownicy">
                    <UserPlus className="h-6 w-6 mb-2" />
                    Zarządzaj użytkownikami
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col">
                  <Link href="/zamowienia">
                    <ClipboardList className="h-6 w-6 mb-2" />
                    Wszystkie zamówienia
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col">
                  <Link href="/magazyn">
                    <AlertTriangle className="h-6 w-6 mb-2" />
                    Status magazynu
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DEBUG PANEL - tylko dla adminów */}
        <DebugPanel />
      </div>
    );
  };

  const renderSalesRepDashboard = () => {
    // Dla handlowców używamy prawdziwych danych z API (tylko ich zamówienia)
    const myOrdersCount = statsLoading ? '...' : (ordersStats?.totalOrders ?? 24);
    const myClientsCount = statsLoading ? '...' : (ordersStats?.clientsCount ?? 15);
    const newClientsCount = ordersStats?.newClientsCount ?? 2;

    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moje zamówienia</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myOrdersCount}</div>
              <p className="text-xs text-muted-foreground">
                {statsLoading
                  ? 'Ładowanie...'
                  : `${(ordersStats?.recentOrders || 0) > 0 ? '+' : ''}${ordersStats?.recentOrders || 0} nowe w tym tygodniu`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moi klienci</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myClientsCount}</div>
              <p className="text-xs text-muted-foreground">
                {statsLoading ? 'Ładowanie...' : `${newClientsCount} nowych klientów`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produkty w koszyku</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">7</div>
              <p className="text-xs text-muted-foreground">Wartość: 456 zł</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Szybkie akcje</CardTitle>
              <CardDescription>Najczęściej wykonywane operacje</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button asChild className="h-20 flex flex-col">
                  <Link href="/produkty">
                    <Package className="h-6 w-6 mb-2" />
                    Przeglądaj produkty
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col">
                  <Link href="/koszyk">
                    <ShoppingCart className="h-6 w-6 mb-2" />
                    Mój koszyk
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col">
                  <Link href="/klienci">
                    <Users className="h-6 w-6 mb-2" />
                    Moi klienci
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-20 flex flex-col">
                  <Link href="/zamowienia">
                    <ClipboardList className="h-6 w-6 mb-2" />
                    Moje zamówienia
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ostatnie zamówienia</CardTitle>
              <CardDescription>Twoje najnowsze zamówienia</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ordersLoading ? (
                  <div className="text-center py-4 text-gray-500">Ładowanie zamówień...</div>
                ) : ordersError ? (
                  <div className="text-center py-4 text-red-500">
                    Błąd podczas ładowania zamówień
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">Brak ostatnich zamówień</div>
                ) : (
                  recentOrders.map(order => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-sm text-gray-500">{order.customerName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">
                          {order.status === 'DELIVERED'
                            ? 'Dostarczone'
                            : order.status === 'PENDING'
                              ? 'Oczekuje'
                              : order.status === 'IN_PROGRESS'
                                ? 'W realizacji'
                                : order.status}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">{order.total} zł</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderWarehouseDashboard = () => (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Do przygotowania</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
            <p className="text-xs text-muted-foreground">Zamówienia oczekujące</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">W realizacji</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Obecnie pakowane</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wysłane dziś</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">Gotowe do dostarczenia</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zamówienia do realizacji</CardTitle>
          <CardDescription>Najstarsze zamówienia wymagające uwagi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium">Zamówienie #{2024000 + i}</p>
                    <p className="text-sm text-gray-500">Hotel Górski - {3 - i} dni temu</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline">Oczekuje</Badge>
                  <p className="text-sm text-gray-500 mt-1">15 pozycji</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderDefaultDashboard = () => (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Witaj w systemie</CardTitle>
          <CardDescription>
            Skontaktuj się z administratorem, aby uzyskać odpowiednie uprawnienia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Twoje konto wymaga aktywacji przez administratora systemu.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  switch (session.user.role) {
    case 'ADMIN':
      return renderAdminDashboard();
    case 'SALES_REP':
      return renderSalesRepDashboard();
    case 'WAREHOUSE':
      return renderWarehouseDashboard();
    case 'SALES_DEPT':
      return renderSalesRepDashboard(); // Similar to sales rep
    default:
      return renderDefaultDashboard();
  }
}
