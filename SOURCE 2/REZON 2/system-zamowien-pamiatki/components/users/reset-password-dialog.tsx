'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from '@/lib/types';
import { toast } from 'sonner';
import { Key, Loader2 } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function ResetPasswordDialog({ open, onOpenChange, user }: ResetPasswordDialogProps) {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!password) {
      toast.error('Hasło jest wymagane');
      return;
    }

    if (password.length < 6) {
      toast.error('Hasło musi mieć co najmniej 6 znaków');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Hasła nie są identyczne');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        toast.success('Hasło zostało zmienione pomyślnie');
        setPassword('');
        setConfirmPassword('');
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas zmiany hasła');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Wystąpił błąd podczas zmiany hasła');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPassword('');
      setConfirmPassword('');
    }
    onOpenChange(open);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Resetuj hasło
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <p className="text-sm">
            <span className="font-medium">Użytkownik:</span> {user.name || 'Bez nazwy'}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Email:</span> {user.email}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nowe hasło */}
          <div>
            <Label htmlFor="password">Nowe hasło</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 6 znaków"
              minLength={6}
              required
            />
          </div>

          {/* Potwierdzenie hasła */}
          <div>
            <Label htmlFor="confirmPassword">Potwierdź hasło</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Powtórz nowe hasło"
              minLength={6}
              required
            />
          </div>

          {/* Przyciski */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zmienianie...
                </>
              ) : (
                'Zmień hasło'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
