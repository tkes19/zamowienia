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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, Building2 } from 'lucide-react';

interface AddDepartmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDepartmentDialog({ open, onClose, onSuccess }: AddDepartmentDialogProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Nazwa działu jest wymagana');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      if (response.ok) {
        onSuccess();
        setName('');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas tworzenia działu');
      }
    } catch (error) {
      console.error('Error creating department:', error);
      toast.error('Błąd podczas tworzenia działu');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
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
            <span>Dodaj Nowy Dział</span>
          </DialogTitle>
          <DialogDescription>
            Utwórz nowy dział w systemie. Podaj unikalną nazwę działu.
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
                  Tworzenie...
                </>
              ) : (
                'Utwórz Dział'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
