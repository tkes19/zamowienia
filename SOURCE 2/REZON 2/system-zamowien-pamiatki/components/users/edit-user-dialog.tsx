'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSession } from 'next-auth/react';
import { Department, User, UserRole } from '@/lib/types';
import { toast } from 'sonner';
import { Edit, Loader2 } from 'lucide-react';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUserUpdated: () => void;
}

export function EditUserDialog({ open, onOpenChange, user, onUserUpdated }: EditUserDialogProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '' as UserRole | '',
    departmentId: '',
    isActive: true,
  });

  // Pobierz działy i wstaw dane użytkownika
  useEffect(() => {
    if (open && user) {
      fetchDepartments();
      setFormData({
        name: user.name || '',
        email: user.email,
        role: user.role,
        departmentId: user.departmentId || 'none',
        isActive: user.isActive,
      });
    }
  }, [open, user]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !formData.name || !formData.email || !formData.role) {
      toast.error('Wypełnij wszystkie wymagane pola');
      return;
    }

    setLoading(true);

    const requestData = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      departmentId: formData.departmentId === 'none' ? null : formData.departmentId,
      isActive: formData.isActive,
    };

    console.log('[Frontend] Submitting user update:', requestData);
    console.log('[Frontend] User ID:', user.id);
    console.log('[Frontend] Form data:', formData);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('[Frontend] Response status:', response.status);
      console.log('[Frontend] Response ok:', response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log('[Frontend] Update successful, result:', result);
        toast.success('Użytkownik został zaktualizowany pomyślnie');
        onUserUpdated();
        onOpenChange(false);
      } else {
        const error = await response.json();
        console.log('[Frontend] Update failed, error:', error);
        toast.error(error.message || 'Błąd podczas aktualizacji użytkownika');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Wystąpił błąd podczas aktualizacji użytkownika');
    } finally {
      setLoading(false);
    }
  };

  // Dozwolone role na podstawie uprawnień użytkownika
  const allowedRoles =
    session?.user?.role === 'ADMIN'
      ? ['ADMIN', 'SALES_DEPT', 'SALES_REP', 'WAREHOUSE', 'NEW_USER']
      : session?.user?.role === 'SALES_DEPT'
        ? ['SALES_REP', 'NEW_USER'] // SALES_DEPT może edytować SALES_REP i NEW_USER
        : [];

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      ADMIN: 'Administrator',
      SALES_DEPT: 'Dział Sprzedaży',
      SALES_REP: 'Handlowiec',
      WAREHOUSE: 'Magazyn',
      NEW_USER: 'Nowy Użytkownik',
    };
    return labels[role] || role;
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edytuj użytkownika
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Imię i nazwisko */}
          <div>
            <Label htmlFor="name">Imię i nazwisko *</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Jan Kowalski"
              required
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="jan.kowalski@firma.pl"
              required
            />
          </div>

          {/* Rola */}
          <div>
            <Label htmlFor="role">Rola *</Label>
            <Select
              value={formData.role}
              onValueChange={value => setFormData(prev => ({ ...prev, role: value as UserRole }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz rolę" />
              </SelectTrigger>
              <SelectContent>
                {allowedRoles.map(role => (
                  <SelectItem key={role} value={role}>
                    {getRoleLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dział */}
          <div>
            <Label htmlFor="department">Dział</Label>
            <Select
              value={formData.departmentId}
              onValueChange={value => setFormData(prev => ({ ...prev, departmentId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz dział (opcjonalne)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Brak działu</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status aktywności */}
          {session?.user?.role === 'ADMIN' && (
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={checked => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Konto aktywne</Label>
            </div>
          )}

          {/* Przyciski */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aktualizowanie...
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
