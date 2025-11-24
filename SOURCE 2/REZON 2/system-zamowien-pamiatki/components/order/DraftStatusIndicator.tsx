'use client';

import { useOrderDraft } from '@/hooks/useOrderDraft';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Loader2, Save, AlertTriangle, ShoppingCart, Clock } from 'lucide-react';

export const DraftStatusIndicator = () => {
  const { draft, isLoading, isSaving, error, completeDraft, cancelDraft } = useOrderDraft();

  if (isLoading) {
    return (
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Ładowanie zamówienia...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!draft) {
    return null;
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default' as const;
      case 'draft':
        return 'secondary' as const;
      case 'completed':
        return 'outline' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Aktywne';
      case 'draft':
        return 'Projekt';
      case 'completed':
        return 'Zakończone';
      default:
        return status;
    }
  };

  return (
    <Card className="sticky top-4 z-50 shadow-md mb-6">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <span className="font-medium text-lg">Bieżące zamówienie</span>
              <Badge variant={getStatusVariant(draft.status)}>{getStatusText(draft.status)}</Badge>
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{draft.items.length}</span> pozycji |
              <span className="font-medium ml-1">{draft.totalValue.toFixed(2)} zł</span>
            </div>

            {isSaving && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Save className="h-3 w-3 animate-pulse text-orange-500" />
                <span>Zapisywanie...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={cancelDraft} disabled={isSaving}>
              Anuluj
            </Button>
            <Button
              onClick={completeDraft}
              disabled={isSaving || draft.items.length === 0}
              size="sm"
            >
              {draft.items.length === 0 ? 'Brak pozycji' : 'Złóż zamówienie'}
            </Button>
          </div>
        </div>

        {/* Dodatkowe informacje o zamówieniu */}
        <div className="mt-3 pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {draft.locationName && (
            <div className="text-muted-foreground">
              <span className="font-medium">
                {draft.clientType === 'PM' ? 'Miejscowość' : 'Folder'}:
              </span>{' '}
              {draft.locationName}
            </div>
          )}

          <div className="text-muted-foreground">
            <span className="font-medium">Typ klienta:</span>{' '}
            {draft.clientType === 'PM' && 'Projekty Miejscowości'}
            {draft.clientType === 'KI' && 'Klienci Indywidualni'}
            {draft.clientType === 'IM' && 'Imienne'}
            {draft.clientType === 'HA' && 'Hasła'}
            {draft.clientType === 'OK' && 'Okolicznościowe'}
          </div>

          <div className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="font-medium">Ostatnia aktualizacja:</span>{' '}
            {new Date(draft.updatedAt).toLocaleString('pl-PL', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>

          {draft.notes && (
            <div className="text-muted-foreground">
              <span className="font-medium">Uwagi:</span> {draft.notes}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
