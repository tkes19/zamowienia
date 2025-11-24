'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, Building2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  _count: {
    users: number;
  };
}

interface EditDepartmentDialogProps {
  department: Department;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditDepartmentDialog({
  department,
  open,
  onClose,
  onSuccess,
}: EditDepartmentDialogProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  // Ustaw nazwę działu przy otwieraniu dialogu
  useEffect(() => {
    if (open && department) {
      setName(department.name);
    }
  }, [open, department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Nazwa działu jest wymagana');
      return;
    }

    if (name.trim() === department.name) {
      toast.error('Nazwa działu nie została zmieniona');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/departments/${department.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas aktualizacji działu');
      }
    } catch (error) {
      console.error('Error updating department:', error);
      toast.error('Błąd podczas aktualizacji działu');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName(department.name); // Reset do oryginalnej nazwy
      onClose();
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Edytuj Dział</span>
          </DialogTitle>
          <DialogDescription>
            Zmień nazwę działu &quot;{department.name}&quot;.
            {department._count.users > 0 && (
              <span className="block mt-1 text-yellow-600">
                Ten dział ma {department._count.users} przypisanych użytkowników.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nazwa Działu *</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="np. Sprzedaż, Marketing, IT"
              required
              disabled={loading}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Aktualizuję...
                </>
              ) : (
                'Zaktualizuj'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
