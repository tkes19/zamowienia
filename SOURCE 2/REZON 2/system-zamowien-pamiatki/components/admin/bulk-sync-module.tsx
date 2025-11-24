'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Database, Download, AlertTriangle, CheckCircle, XCircle, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface BulkSyncModuleProps {
  onSyncCompleted: () => void;
}

interface SyncResults {
  total: number;
  processed: number;
  created: number;
  updated: number;
  errors: Array<{ product: string; error: string }>;
}

export function BulkSyncModule({ onSyncCompleted }: BulkSyncModuleProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [batchSize, setBatchSize] = useState('10');
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SyncResults | null>(null);
  const [currentStatus, setCurrentStatus] = useState('');

  const handleBulkSync = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults(null);
    setCurrentStatus('Przygotowywanie synchronizacji...');

    try {
      const response = await fetch('/api/admin/bulk-sync-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchSize: parseInt(batchSize),
          onlyChanged,
          includeImages,
        }),
      });

      setCurrentStatus('Pobieranie danych z API...');
      setProgress(20);

      const data = await response.json();

      if (response.ok && data.success) {
        setProgress(100);
        setResults(data.results);
        setCurrentStatus('Synchronizacja zakończona!');

        if (data.results.errors.length === 0) {
          toast.success(
            `✅ Synchronizacja zakończona! Utworzono: ${data.results.created}, Zaktualizowano: ${data.results.updated}`
          );
        } else {
          toast.success(
            `⚠️ Synchronizacja zakończona z ${data.results.errors.length} błędami. Przetworzono: ${data.results.processed}/${data.results.total}`
          );
        }

        onSyncCompleted();
      } else {
        toast.error(data.error || 'Wystąpił błąd podczas synchronizacji');
        setCurrentStatus('Błąd synchronizacji');
      }
    } catch (error) {
      toast.error('Błąd połączenia z serwerem');
      setCurrentStatus('Błąd połączenia');
      console.error('Bulk sync error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const resetResults = () => {
    setResults(null);
    setProgress(0);
    setCurrentStatus('');
  };

  return (
    <Card className="bg-purple-50 border-purple-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Database className="h-5 w-5 text-purple-600" />
          Masowa Synchronizacja Produktów
        </CardTitle>
        <CardDescription>
          Synchronizuj wiele produktów jednocześnie z API Rezon używając inteligentnej detekcji
          zmian
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Ustawienia */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="batch-size" className="text-sm font-medium">
              Wielkość partii
            </Label>
            <Select value={batchSize} onValueChange={setBatchSize} disabled={isRunning}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 produktów</SelectItem>
                <SelectItem value="10">10 produktów</SelectItem>
                <SelectItem value="20">20 produktów</SelectItem>
                <SelectItem value="50">50 produktów</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="only-changed" className="text-sm font-medium">
              Tylko zmienione
            </Label>
            <Switch
              id="only-changed"
              checked={onlyChanged}
              onCheckedChange={setOnlyChanged}
              disabled={isRunning}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="include-images" className="text-sm font-medium">
              Wgrywaj obrazy
            </Label>
            <Switch
              id="include-images"
              checked={includeImages}
              onCheckedChange={setIncludeImages}
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Informacje o strategii */}
        <div className="bg-blue-100 p-3 rounded-md border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-1">
            💡 Jak działa inteligentna synchronizacja:
          </h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>
              • <strong>Hash Detection:</strong> Porównuje zawartość produktów (cena, opis, spec.)
            </li>
            <li>
              • <strong>Tylko zmiany:</strong> Synchronizuje tylko produkty, które się rzeczywiście
              zmieniły
            </li>
            <li>
              • <strong>Obrazy do R2:</strong> Automatycznie wgrywa i organizuje obrazy w Cloudflare
            </li>
            <li>
              • <strong>Wsadowość:</strong> Przetwarza produkty partiami dla lepszej wydajności
            </li>
          </ul>
        </div>

        {/* Przycisk Start */}
        <div className="flex gap-3">
          <Button
            onClick={handleBulkSync}
            disabled={isRunning}
            className="bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            {isRunning ? (
              <>
                <Download className="h-4 w-4 mr-2 animate-pulse" />
                Synchronizuję...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Rozpocznij Masową Synchronizację
              </>
            )}
          </Button>

          {results && (
            <Button onClick={resetResults} variant="outline" size="lg">
              Resetuj Wyniki
            </Button>
          )}
        </div>

        {/* Pasek postępu */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{currentStatus}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Wyniki */}
        {results && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-100 p-3 rounded text-center">
                <div className="text-2xl font-bold text-gray-700">{results.total}</div>
                <div className="text-xs text-gray-600">Do sprawdzenia</div>
              </div>
              <div className="bg-green-100 p-3 rounded text-center">
                <div className="text-2xl font-bold text-green-700">{results.created}</div>
                <div className="text-xs text-green-600">Utworzono</div>
              </div>
              <div className="bg-blue-100 p-3 rounded text-center">
                <div className="text-2xl font-bold text-blue-700">{results.updated}</div>
                <div className="text-xs text-blue-600">Zaktualizowano</div>
              </div>
              <div className="bg-red-100 p-3 rounded text-center">
                <div className="text-2xl font-bold text-red-700">{results.errors.length}</div>
                <div className="text-xs text-red-600">Błędy</div>
              </div>
            </div>

            {/* Błędy */}
            {results.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Produkty z błędami ({results.errors.length}):
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {results.errors.map((error, index) => (
                    <div key={index} className="text-xs text-red-700">
                      <strong>{error.product}:</strong> {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sukces */}
            {results.errors.length === 0 && results.processed > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Wszystkie produkty zostały pomyślnie zsynchronizowane! 🎉
                </span>
              </div>
            )}
          </div>
        )}

        {/* Porady */}
        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
          <h4 className="text-sm font-medium text-yellow-800 mb-1">⚡ Porady optymalizacji:</h4>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>
              • <strong>Pierwsza synchronizacja:</strong> Wyłącz "Tylko zmienione" i ustaw małą
              partię (5-10)
            </li>
            <li>
              • <strong>Codzienne aktualizacje:</strong> Włącz "Tylko zmienione" i zwiększ partię
              (20-50)
            </li>
            <li>
              • <strong>Bez obrazów:</strong> Wyłącz wgrywanie obrazów dla szybszej synchronizacji
              danych
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
