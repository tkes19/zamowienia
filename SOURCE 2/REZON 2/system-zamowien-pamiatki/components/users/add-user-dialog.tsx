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
import { useSession } from 'next-auth/react';
import { Department, UserRole } from '@/lib/types';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded: () => void;
}

export function AddUserDialog({ open, onOpenChange, onUserAdded }: AddUserDialogProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '' as UserRole | '',
    departmentId: 'none',
  });

  // Pobierz działy
  useEffect(() => {
    if (open) {
      fetchDepartments();
      // Reset formularza
      setFormData({
        name: '',
        email: '',
        password: '',
        role: '',
        departmentId: 'none',
      });
    }
  }, [open]);

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

    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      toast.error('Wypełnij wszystkie wymagane pola');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          departmentId: formData.departmentId === 'none' ? null : formData.departmentId,
        }),
      });

      if (response.ok) {
        toast.success('Użytkownik został utworzony pomyślnie');
        onUserAdded();
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas tworzenia użytkownika');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Wystąpił błąd podczas tworzenia użytkownika');
    } finally {
      setLoading(false);
    }
  };

  // Dozwolone role na podstawie uprawnień użytkownika
  const allowedRoles =
    session?.user?.role === 'ADMIN'
      ? ['ADMIN', 'SALES_DEPT', 'SALES_REP', 'WAREHOUSE', 'NEW_USER']
      : session?.user?.role === 'SALES_DEPT'
        ? ['SALES_REP', 'NEW_USER']
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Dodaj nowego użytkownika
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

          {/* Hasło */}
          <div>
            <Label htmlFor="password">Hasło *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Minimum 6 znaków"
              minLength={6}
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
                  Tworzenie...
                </>
              ) : (
                'Utwórz użytkownika'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
