'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, PieChart, Download } from 'lucide-react';

export function AdminReportsContent() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raporty i statystyki</h1>
          <p className="text-gray-600">Analizy sprzedaży i wydajności systemu</p>
        </div>
        <Button onClick={() => alert('Raport został wyeksportowany!')}>
          <Download className="h-4 w-4 mr-2" />
          Eksportuj raport
        </Button>
      </div>

      {/* Statystyki podstawowe */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sprzedaż w tym miesiącu</p>
                <p className="text-2xl font-bold text-gray-900">45.231 zł</p>
                <p className="text-xs text-green-600">+15% vs poprzedni miesiąc</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Zamówienia w miesiącu</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
                <p className="text-xs text-blue-600">+8% vs poprzedni miesiąc</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Średnia wartość zamówienia</p>
                <p className="text-2xl font-bold text-gray-900">290 zł</p>
                <p className="text-xs text-green-600">+7% vs poprzedni miesiąc</p>
              </div>
              <PieChart className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Aktywni handlowcy</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
                <p className="text-xs text-gray-600">Bez zmian</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Raporty */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Popularne produkty</CardTitle>
            <CardDescription>Najczęściej zamawiane produkty w tym miesiącu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Magnes z nazwą miasta', orders: 45, revenue: '2,250 zł' },
                { name: 'Kubek z logo miejscowości', orders: 38, revenue: '3,420 zł' },
                { name: 'Koszulka z nadrukiem', orders: 22, revenue: '1,890 zł' },
                { name: 'Brelok z imieniem', orders: 31, revenue: '987 zł' },
              ].map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-600">{product.orders} zamówień</p>
                  </div>
                  <p className="font-semibold text-green-600">{product.revenue}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wydajność handlowców</CardTitle>
            <CardDescription>Statystyki sprzedaży według handlowców</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Jan Kowalski', orders: 42, revenue: '12,340 zł' },
                { name: 'Anna Nowak', orders: 38, revenue: '11,890 zł' },
                { name: 'Piotr Wiśniewski', orders: 35, revenue: '10,250 zł' },
                { name: 'Maria Kozłowska', orders: 28, revenue: '8,920 zł' },
              ].map((rep, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{rep.name}</p>
                    <p className="text-sm text-gray-600">{rep.orders} zamówień</p>
                  </div>
                  <p className="font-semibold text-blue-600">{rep.revenue}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dostępne raporty */}
      <Card>
        <CardHeader>
          <CardTitle>Dostępne raporty</CardTitle>
          <CardDescription>Generuj szczegółowe raporty dla różnych okresów</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h3 className="font-semibold mb-2">Raport sprzedaży</h3>
              <p className="text-sm text-gray-600 mb-4">
                Szczegółowy raport sprzedaży według okresów
              </p>
              <Button size="sm" onClick={() => alert('Raport sprzedaży generowany...')}>
                Generuj
              </Button>
            </div>

            <div className="p-4 border rounded-lg text-center">
              <PieChart className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <h3 className="font-semibold mb-2">Analiza produktów</h3>
              <p className="text-sm text-gray-600 mb-4">Popularność i rentowność produktów</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => alert('Analiza produktów generowana...')}
              >
                Generuj
              </Button>
            </div>

            <div className="p-4 border rounded-lg text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h3 className="font-semibold mb-2">Trendy sprzedaży</h3>
              <p className="text-sm text-gray-600 mb-4">Analiza trendów i prognoz</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => alert('Raport trendów generowany...')}
              >
                Generuj
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
