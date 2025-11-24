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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'react-hot-toast';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  department: {
    id: string;
    name: string;
  } | null;
}

interface Role {
  role: string;
  name: string;
  description: string;
  color: string;
  permissions: string[];
  userCount: number;
  users: User[];
}

interface ChangeRoleDialogProps {
  user: User;
  roles: Role[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangeRoleDialog({ user, roles, open, onClose, onSuccess }: ChangeRoleDialogProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>(user.role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRole === user.role) {
      toast.error('Wybrana rola jest taka sama jak aktualna');
      return;
    }

    // Sprawdź czy nie próbuje zmienić własnej roli
    if (user.id === session?.user.id) {
      toast.error('Nie możesz zmienić własnej roli');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/users/${user.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: selectedRole,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas zmiany roli');
      }
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error('Błąd podczas zmiany roli');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedRole(user.role); // Reset do oryginalnej roli
      onClose();
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  const currentRole = roles.find(r => r.role === user.role);
  const newRole = roles.find(r => r.role === selectedRole);
  const isOwnAccount = user.id === session.user.id;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Zmień Rolę Użytkownika</span>
          </DialogTitle>
          <DialogDescription>
            Zmień rolę dla użytkownika {user.name || user.email}. To wpłynie na uprawnienia
            użytkownika w systemie.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informacje o użytkowniku */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{user.name || 'Bez nazwy'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {user.department && (
                <p className="text-xs text-muted-foreground">Dział: {user.department.name}</p>
              )}
            </div>
          </div>

          {/* Aktualna rola */}
          <div>
            <Label>Aktualna rola</Label>
            <div className="mt-1">
              <Badge className={currentRole?.color || 'bg-gray-100 text-gray-800'}>
                {currentRole?.name || user.role}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">{currentRole?.description}</p>
            </div>
          </div>

          {/* Nowa rola */}
          <div>
            <Label htmlFor="role">Nowa rola *</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz nową rolę" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.role} value={role.role}>
                    <div className="flex items-center justify-between w-full">
                      <span>{role.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        {role.userCount} użytkowników
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {newRole && newRole.role !== user.role && (
              <p className="text-xs text-muted-foreground mt-1">{newRole.description}</p>
            )}
          </div>

          {/* Ostrzeżenia */}
          {isOwnAccount && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nie możesz zmienić własnej roli ze względów bezpieczeństwa.
              </AlertDescription>
            </Alert>
          )}

          {selectedRole === 'ADMIN' && !isOwnAccount && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Przyznanie roli Administrator da użytkownikowi pełny dostęp do systemu. Upewnij się,
                że jest to właściwa osoba.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading || selectedRole === user.role || isOwnAccount}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Zmieniam...
                </>
              ) : (
                'Zmień Rolę'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
