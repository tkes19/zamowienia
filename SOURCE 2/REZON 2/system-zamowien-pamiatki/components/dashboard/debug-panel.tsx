'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bug, RefreshCw, CheckCircle } from 'lucide-react';

interface DebugStats {
  totalOrders: number;
  recentOrders: number;
  todayOrders: number;
  weeklyChange: number;
  clientsCount: number;
  newClientsCount: number;
  debugInfo: {
    userRole: string;
    userEmail: string;
    query: string;
  };
  comparison: {
    currentDashboardValue: number;
    realValue: number;
    difference: number;
  };
}

export function DebugPanel() {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/orders-debug');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setStats(data);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Debug Panel Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card className="mt-6 border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <Bug className="h-5 w-5" />
            🔧 DEBUG PANEL (tylko Admin)
          </CardTitle>
          <CardDescription>Ładowanie danych debug...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Pobieranie prawdziwych statystyk...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-6 border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            🔧 DEBUG PANEL - BŁĄD
          </CardTitle>
          <CardDescription>Wystąpił problem z pobraniem danych debug</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 mb-3">❌ {error}</p>
          <Button
            onClick={fetchStats}
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Spróbuj ponownie
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const { comparison, debugInfo } = stats;
  const isDifferent = comparison.difference !== 0;

  return (
    <Card className="mt-6 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Bug className="h-5 w-5" />
          🔧 DEBUG PANEL (tylko Admin)
        </CardTitle>
        <CardDescription>
          Porównanie wartości dashboardu z prawdziwymi danymi z bazy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Prawdziwa wartość */}
          <div className="p-3 bg-white rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-600">Prawdziwa wartość</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-700">{comparison.realValue}</div>
            <p className="text-xs text-green-600">z bazy danych</p>
          </div>

          {/* Dashboard wartość */}
          <div className="p-3 bg-white rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-orange-600">Dashboard pokazuje</span>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-700">
              {comparison.currentDashboardValue}
            </div>
            <p className="text-xs text-orange-600">hardcoded</p>
          </div>

          {/* Różnica */}
          <div className="p-3 bg-white rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Różnica</span>
              <Badge variant={isDifferent ? 'destructive' : 'secondary'}>
                {isDifferent ? 'BŁĄD' : 'OK'}
              </Badge>
            </div>
            <div
              className={`text-2xl font-bold ${
                comparison.difference > 0
                  ? 'text-green-700'
                  : comparison.difference < 0
                    ? 'text-red-700'
                    : 'text-gray-700'
              }`}
            >
              {comparison.difference > 0 ? '+' : ''}
              {comparison.difference}
            </div>
            <p className="text-xs text-gray-600">
              {isDifferent ? 'wymaga naprawy' : 'wartości zgodne'}
            </p>
          </div>
        </div>

        {/* Dodatkowe statystyki */}
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">
            📊 Dodatkowe statystyki do testowania:
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-yellow-700">Nowe zamówienia w tym tygodniu:</span>
              <strong className="ml-2 text-yellow-800">{stats.recentOrders}</strong>
            </div>
            <div>
              <span className="text-yellow-700">Zamówienia dzisiaj:</span>
              <strong className="ml-2 text-yellow-800">{stats.todayOrders}</strong>
            </div>
            <div>
              <span className="text-yellow-700">Liczba klientów:</span>
              <strong className="ml-2 text-yellow-800">{stats.clientsCount}</strong>
            </div>
            <div>
              <span className="text-yellow-700">Nowi klienci (tydzień):</span>
              <strong className="ml-2 text-yellow-800">{stats.newClientsCount}</strong>
            </div>
          </div>
        </div>

        {/* Debug info */}
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <div className="text-xs text-gray-600 space-y-1">
            <div>
              <strong>Użytkownik:</strong> {debugInfo.userEmail} ({debugInfo.userRole})
            </div>
            <div>
              <strong>Zapytanie:</strong> {debugInfo.query}
            </div>
            <div>
              <strong>Ostatnia aktualizacja:</strong> {lastUpdated?.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <div className="mt-4 flex justify-end">
          <Button onClick={fetchStats} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Odśwież dane
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
