'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Unlock, AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

interface PermissionChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
  role: string;
  permission: Permission;
  action: 'GRANT' | 'REVOKE';
}

export function PermissionChangeDialog({
  open,
  onClose,
  onConfirm,
  role,
  permission,
  action,
}: PermissionChangeDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onConfirm(reason.trim() || undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      onClose();
    }
  };

  const roleNames: Record<string, string> = {
    ADMIN: 'Administrator',
    SALES_DEPT: 'Kierownik Sprzedaży',
    SALES_REP: 'Przedstawiciel Handlowy',
    WAREHOUSE: 'Magazynier',
    NEW_USER: 'Nowy Użytkownik',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {action === 'GRANT' ? (
              <Unlock className="h-5 w-5 text-green-600" />
            ) : (
              <Lock className="h-5 w-5 text-red-600" />
            )}
            <span>{action === 'GRANT' ? 'Przyznanie' : 'Odebranie'} uprawnienia</span>
          </DialogTitle>
          <DialogDescription>
            {action === 'GRANT'
              ? 'Czy na pewno chcesz przyznać to uprawnienie tej roli?'
              : 'Czy na pewno chcesz odebrać to uprawnienie tej roli?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informacje o roli */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Rola</h4>
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{roleNames[role] || role}</span>
              <Badge variant="outline">{role}</Badge>
            </div>
          </div>

          {/* Informacje o uprawnieniu */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Uprawnienie</h4>
            <div className="space-y-1">
              <p className="font-medium">{permission.name}</p>
              <p className="text-sm text-muted-foreground">{permission.description}</p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {permission.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {permission.code}
                </Badge>
              </div>
            </div>
          </div>

          {/* Ostrzeżenia */}
          {action === 'REVOKE' && role === 'ADMIN' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Uwaga! Odbierasz uprawnienie roli Administrator. Upewnij się, że nie ograniczysz
                dostępu do krytycznych funkcji systemu.
              </AlertDescription>
            </Alert>
          )}

          {action === 'GRANT' && permission.category === 'admin' && role !== 'ADMIN' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Przyznujesz uprawnienie administratorskie roli {roleNames[role]}. To może dać
                użytkownikom tej roli dostęp do zaawansowanych funkcji systemu.
              </AlertDescription>
            </Alert>
          )}

          {/* Pole na powód */}
          <div>
            <Label htmlFor="reason">Powód zmiany (opcjonalny)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Opisz powód dokonania tej zmiany..."
              className="mt-1"
              disabled={loading}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Anuluj
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              variant={action === 'GRANT' ? 'default' : 'destructive'}
            >
              {loading
                ? 'Przetwarzanie...'
                : action === 'GRANT'
                  ? 'Przyznaj uprawnienie'
                  : 'Odbierz uprawnienie'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
