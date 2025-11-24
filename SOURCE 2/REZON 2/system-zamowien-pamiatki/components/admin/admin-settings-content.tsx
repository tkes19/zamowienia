'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings,
  Shield,
  Mail,
  Database,
  Save,
  DollarSign,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export function AdminSettingsContent() {
  const [isPriceUpdateLoading, setIsPriceUpdateLoading] = useState(false);
  const [priceUpdateResult, setPriceUpdateResult] = useState<any>(null);

  const handleUpdatePrices = async () => {
    setIsPriceUpdateLoading(true);
    setPriceUpdateResult(null);

    try {
      const response = await fetch('/api/admin/update-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setPriceUpdateResult(result);
        toast.success(`Zaktualizowano ${result.updated} produktów!`);
      } else {
        throw new Error(result.error || 'Nieznany błąd');
      }
    } catch (error) {
      console.error('Błąd aktualizacji cen:', error);
      toast.error(
        `Błąd aktualizacji cen: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
      );
      setPriceUpdateResult({
        success: false,
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      });
    } finally {
      setIsPriceUpdateLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ustawienia systemu</h1>
          <p className="text-gray-600">Konfiguruj parametry systemu i opcje ogólne</p>
        </div>
        <Button onClick={() => alert('Ustawienia zapisane pomyślnie!')}>
          <Save className="h-4 w-4 mr-2" />
          Zapisz zmiany
        </Button>
      </div>

      {/* Ustawienia ogólne */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Ustawienia ogólne</span>
          </CardTitle>
          <CardDescription>Podstawowa konfiguracja systemu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nazwa firmy</Label>
              <Input
                id="company-name"
                defaultValue="Pamiątki Turystyczne Sp. z o.o."
                placeholder="Wprowadź nazwę firmy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Email kontaktowy</Label>
              <Input
                id="company-email"
                type="email"
                defaultValue="kontakt@pamiatki.pl"
                placeholder="Wprowadź email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone">Telefon</Label>
              <Input
                id="company-phone"
                defaultValue="+48 123 456 789"
                placeholder="Wprowadź numer telefonu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-address">Adres</Label>
              <Input
                id="company-address"
                defaultValue="ul. Turystyczna 15, 31-000 Kraków"
                placeholder="Wprowadź adres"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ustawienia bezpieczeństwa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Bezpieczeństwo</span>
          </CardTitle>
          <CardDescription>Konfiguracja zabezpieczeń systemu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-timeout">Czas sesji (minuty)</Label>
              <Input id="session-timeout" type="number" defaultValue="60" placeholder="60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-login-attempts">Maksymalne próby logowania</Label>
              <Input id="max-login-attempts" type="number" defaultValue="5" placeholder="5" />
            </div>
          </div>

          <div className="pt-4">
            <h4 className="font-semibold mb-3">Uprawnienia domyślne</h4>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-sm">Automatyczna aktywacja nowych kont handlowców</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Wymagaj weryfikacji email przy rejestracji</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-sm">Logowanie aktywności użytkowników</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ustawienia powiadomień */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Powiadomienia</span>
          </CardTitle>
          <CardDescription>Konfiguracja systemu powiadomień</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-server">Serwer SMTP</Label>
              <Input
                id="smtp-server"
                defaultValue="smtp.gmail.com"
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port SMTP</Label>
              <Input id="smtp-port" type="number" defaultValue="587" placeholder="587" />
            </div>
          </div>

          <div className="pt-4">
            <h4 className="font-semibold mb-3">Rodzaje powiadomień</h4>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-sm">Powiadomienia o nowych zamówieniach</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-sm">Powiadomienia o zmianie statusu zamówienia</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Powiadomienia o nowych użytkownikach</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Raporty sprzedaży tygodniowe</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ustawienia bazy danych */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Baza danych</span>
          </CardTitle>
          <CardDescription>Zarządzanie bazą danych i backupami</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <Database className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h4 className="font-semibold mb-2">Backup bazy danych</h4>
              <p className="text-sm text-gray-600 mb-4">Utwórz kopię zapasową</p>
              <Button size="sm" onClick={() => alert('Backup utworzony pomyślnie!')}>
                Utwórz backup
              </Button>
            </div>

            <div className="p-4 border rounded-lg text-center">
              <Database className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <h4 className="font-semibold mb-2">Optymalizacja</h4>
              <p className="text-sm text-gray-600 mb-4">Optymalizuj bazę danych</p>
              <Button size="sm" variant="outline" onClick={() => alert('Optymalizacja ukończona!')}>
                Optymalizuj
              </Button>
            </div>

            <div className="p-4 border rounded-lg text-center">
              <Database className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h4 className="font-semibold mb-2">Statystyki</h4>
              <p className="text-sm text-gray-600 mb-4">Zobacz statystyki bazy</p>
              <Button size="sm" variant="outline" onClick={() => alert('Wyświetlanie logów...')}>
                Zobacz
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zarządzanie cenami */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Zarządzanie cenami</span>
          </CardTitle>
          <CardDescription>Operacje na cenach produktów w bazie danych</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Aktualizacja cen produktów
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  Zmień ceny wszystkich produktów z wartości 0 na 99 PLN
                </p>
                {priceUpdateResult?.success === false && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                      <span className="text-red-800 text-sm font-medium">
                        Błąd: {priceUpdateResult.error}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <Button
                onClick={handleUpdatePrices}
                disabled={isPriceUpdateLoading}
                className="shrink-0"
              >
                {isPriceUpdateLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                {isPriceUpdateLoading ? 'Aktualizacja...' : 'Aktualizuj ceny'}
              </Button>
            </div>

            {priceUpdateResult?.success && (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-800 text-sm font-medium">
                    ✅ {priceUpdateResult.message}
                  </p>
                </div>

                {priceUpdateResult.updated > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">
                      Zaktualizowane produkty ({priceUpdateResult.updated}):
                    </h5>
                    <div className="max-h-32 overflow-y-auto text-xs bg-gray-50 p-2 rounded border">
                      {priceUpdateResult.products.map((product: any, index: number) => (
                        <div key={index} className="py-1">
                          <span className="font-mono">{product.identifier}</span>
                          <span className="text-gray-600"> ({product.index})</span>
                          {product.description && (
                            <span className="text-gray-500"> - {product.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {priceUpdateResult.priceStats && priceUpdateResult.priceStats.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Statystyki cen po aktualizacji:</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {priceUpdateResult.priceStats.map((stat: any, index: number) => (
                        <div key={index} className="bg-blue-50 p-2 rounded border text-center">
                          <div className="font-semibold">{stat.price} PLN</div>
                          <div className="text-gray-600">{stat.count} produktów</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
