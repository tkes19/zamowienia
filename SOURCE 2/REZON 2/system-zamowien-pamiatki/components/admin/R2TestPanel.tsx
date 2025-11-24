'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Upload, RefreshCw } from 'lucide-react';

interface TestResult {
  success: boolean;
  message: string;
  timestamp: string;
}

export function R2TestPanel() {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/r2/test');
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testFileUpload = async () => {
    setIsLoading(true);
    setUploadStatus('Przygotowanie testu...');

    try {
      // Utworzenie testowego pliku
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Rysowanie prostego testu
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 300, 200);
        ctx.fillStyle = '#333';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Test R2', 150, 100);
        ctx.fillText('Warszawa Test', 150, 130);
      }

      setUploadStatus('Konwertowanie pliku...');

      canvas.toBlob(
        async blob => {
          if (!blob) {
            throw new Error('Nie można utworzyć pliku testowego');
          }

          setUploadStatus('Upload do R2...');

          const formData = new FormData();
          formData.append('file', blob, 'warszawa_test_r2.jpg');
          formData.append('key', 'projekty-miejscowosci/warszawa_test_r2.jpg');

          const response = await fetch('/api/r2/upload', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          if (result.success) {
            setUploadStatus(`✅ Test zakończony pomyślnie! Plik: ${result.key}`);
          } else {
            setUploadStatus(`❌ Błąd: ${result.message}`);
          }
        },
        'image/jpeg',
        0.9
      );
    } catch (error) {
      setUploadStatus(
        `❌ Błąd uploadu: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Panel testowy Cloudflare R2
          </CardTitle>
          <CardDescription>
            Testowanie połączenia i funkcjonalności R2 storage przed migracją plików Warszawa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test połączenia */}
          <div className="flex items-center gap-4">
            <Button onClick={testConnection} disabled={isLoading} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Test połączenia R2
            </Button>

            {testResult && (
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Połączono
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    Błąd
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Wyniki testu połączenia */}
          {testResult && (
            <Alert
              className={
                testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }
            >
              <AlertDescription>
                <strong>Status:</strong> {testResult.message}
                <br />
                <small className="text-gray-500">
                  Sprawdzono: {new Date(testResult.timestamp).toLocaleString('pl-PL')}
                </small>
              </AlertDescription>
            </Alert>
          )}

          {/* Test uploadu */}
          {testResult?.success && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-4 mb-3">
                <Button onClick={testFileUpload} disabled={isLoading} variant="default">
                  <Upload className={`mr-2 h-4 w-4 ${isLoading ? 'animate-bounce' : ''}`} />
                  Test uploadu pliku
                </Button>
              </div>

              {uploadStatus && (
                <Alert>
                  <AlertDescription>{uploadStatus}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Instrukcje */}
          <div className="border-t pt-4 text-sm text-gray-600">
            <h4 className="font-semibold mb-2">Instrukcja testowania:</h4>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Najpierw przetestuj połączenie z R2</li>
              <li>Jeśli połączenie działa, przetestuj upload testowego pliku</li>
              <li>Po pomyślnym teście możemy przejść do migracji plików Warszawa</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
