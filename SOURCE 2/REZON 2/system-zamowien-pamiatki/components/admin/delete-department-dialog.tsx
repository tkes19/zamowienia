'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Department {
  id: string;
  name: string;
  _count: {
    users: number;
  };
}

interface DeleteDepartmentDialogProps {
  department: Department;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteDepartmentDialog({
  department,
  open,
  onClose,
  onSuccess,
}: DeleteDepartmentDialogProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (department._count.users > 0) {
      toast.error('Nie można usunąć działu, który ma przypisanych użytkowników');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/departments/${department.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas usuwania działu');
      }
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error('Błąd podczas usuwania działu');
    } finally {
      setLoading(false);
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  const canDelete = department._count.users === 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            <span>Usuń Dział</span>
          </DialogTitle>
          <DialogDescription>
            Czy na pewno chcesz usunąć dział &quot;{department.name}&quot;?
            {!canDelete && ' Tej akcji nie można cofnąć.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!canDelete && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nie można usunąć tego działu, ponieważ ma {department._count.users}
                przypisanych użytkowników. Najpierw przenieś użytkowników do innych działów lub usuń
                ich przypisanie.
              </AlertDescription>
            </Alert>
          )}

          {canDelete && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Ten dział jest pusty i może zostać bezpiecznie usunięty. Tej akcji nie można cofnąć.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Anuluj
            </Button>
            <Button onClick={handleDelete} disabled={loading || !canDelete} variant="destructive">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Usuwam...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Usuń Dział
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
