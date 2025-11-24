'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface APIProductSyncModuleProps {
  onProductUpdated: () => void;
}

export function APIProductSyncModule({ onProductUpdated }: APIProductSyncModuleProps) {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    action: 'created' | 'updated';
    productName: string;
  } | null>(null);

  const handleSync = async () => {
    if (!identifier.trim()) {
      toast.error('Wprowadź identyfikator produktu');
      return;
    }

    setIsLoading(true);
    setLastResult(null);

    try {
      const response = await fetch('/api/admin/update-product-from-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setLastResult({
          success: true,
          action: data.action,
          productName: data.product.name,
        });

        if (data.action === 'created') {
          toast.success(`✅ Dodano nowy produkt: ${data.product.name}`);
        } else {
          toast.success(`🔄 Zaktualizowano produkt: ${data.product.name}`);
        }

        setIdentifier(''); // Wyczyść pole
        onProductUpdated(); // Odśwież listę produktów
      } else {
        toast.error(data.error || 'Wystąpił błąd podczas synchronizacji');
      }
    } catch (error) {
      toast.error('Błąd połączenia z serwerem');
      console.error('Sync error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSync();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Label htmlFor="sync-identifier" className="text-sm font-medium">
            Identyfikator produktu
          </Label>
          <Input
            id="sync-identifier"
            placeholder="np. PORTFEL PUSZKA"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">Wprowadź dokładną nazwę produktu z API Rezon</p>
        </div>
        <Button
          onClick={handleSync}
          disabled={isLoading || !identifier.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Synchronizuję...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Aktualizuj z API
            </>
          )}
        </Button>
      </div>

      {/* Status ostatniej synchronizacji */}
      {lastResult && (
        <div
          className={`flex items-center gap-2 p-3 rounded-md text-sm ${
            lastResult.success
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {lastResult.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>
            {lastResult.action === 'created'
              ? `✨ Dodano nowy produkt: ${lastResult.productName}`
              : `🔄 Zaktualizowano: ${lastResult.productName}`}
          </span>
        </div>
      )}

      {/* Przykłady identyfikatorów */}
      <div className="bg-gray-50 p-3 rounded-md">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Przykłady identyfikatorów:</h4>
        <div className="flex flex-wrap gap-2">
          {['PORTFEL PUSZKA', 'BRELOK SZKŁO STER', 'MAGNES WAKACJE', 'KUBEK SUB NIEBIESKI'].map(
            example => (
              <button
                key={example}
                onClick={() => setIdentifier(example)}
                disabled={isLoading}
                className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
              >
                {example}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
