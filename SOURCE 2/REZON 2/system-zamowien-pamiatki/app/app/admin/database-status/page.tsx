'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Database, Server, Users, Package } from 'lucide-react';

interface DatabaseInfo {
  source: string;
  connected: boolean;
  connectionType?: string;
  userCount: number;
  productCount: number;
  customerCount: number;
  lastUser?: {
    email: string;
    createdAt: string;
  };
}

export default function DatabaseStatusPage() {
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkDatabaseStatus() {
      try {
        const response = await fetch('/api/admin/database-status');
        const data = await response.json();
        setDbInfo(data);
      } catch (error) {
        console.error('Błąd sprawdzania statusu bazy:', error);
      } finally {
        setLoading(false);
      }
    }

    checkDatabaseStatus();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center p-6">
            <div className="text-center">
              <Database className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Sprawdzanie połączenia z bazą danych...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSupabase = dbInfo?.source?.includes('supabase') || false;

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Status Bazy Danych</h1>
          <p className="text-muted-foreground">Sprawdź, z której bazy danych korzysta aplikacja</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Połączenie z bazą
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {dbInfo?.connected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span>{dbInfo?.connected ? 'Połączono' : 'Brak połączenia'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  <span className="font-medium">Źródło danych:</span>
                  <Badge variant={isSupabase ? 'default' : 'secondary'}>
                    {isSupabase ? '🟢 Supabase' : '🔴 Lokalna baza'}
                  </Badge>
                </div>

                {dbInfo?.connectionType && (
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    <span className="font-medium">Typ połączenia:</span>
                    <Badge variant={dbInfo.connected ? 'default' : 'destructive'}>
                      {dbInfo.connectionType === 'Direct Connection'
                        ? '🔗 Bezpośrednie'
                        : '⚡ Pooler'}
                    </Badge>
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  <strong>URL połączenia:</strong>
                  <br />
                  <code className="text-xs bg-muted p-1 rounded">
                    {dbInfo?.source?.substring(0, 50)}...
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Statystyki danych
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Użytkownicy:</span>
                  <Badge variant="outline">{dbInfo?.userCount || 0}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Produkty:</span>
                  <Badge variant="outline">{dbInfo?.productCount || 0}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Klienci:</span>
                  <Badge variant="outline">{dbInfo?.customerCount || 0}</Badge>
                </div>

                {dbInfo?.lastUser && (
                  <div className="pt-3 border-t text-sm">
                    <p className="font-medium">Ostatnio dodany użytkownik:</p>
                    <p className="text-muted-foreground">{dbInfo.lastUser.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(dbInfo.lastUser.createdAt).toLocaleString('pl-PL')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>🔍 Jak sprawdzić czy dane pochodzą z Supabase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. Panel Supabase</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Zaloguj się do panelu Supabase i sprawdź tabelę "User":
              </p>
              <a
                href="https://supabase.com/dashboard/projects/cpcbkfhatpevfskuetuc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm"
              >
                🔗 Otwórz panel Supabase
              </a>
            </div>

            <div>
              <h4 className="font-medium mb-2">2. Test dodania danych</h4>
              <p className="text-sm text-muted-foreground">
                Dodaj nowego użytkownika lub produkt - powinien pojawić się w panelu Supabase w
                czasie rzeczywistym.
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-2">3. URL bazy danych</h4>
              <p className="text-sm text-muted-foreground">
                Sprawdź plik .env - adres zawiera "supabase.com" zamiast "localhost"
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
