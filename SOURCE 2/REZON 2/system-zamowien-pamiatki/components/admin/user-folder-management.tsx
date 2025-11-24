'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, FolderPlus, Trash2, Edit3, Save, X, Plus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface UserFolderAccess {
  id: number;
  userId: string;
  folderName: string;
  isActive: boolean;
  assignedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  assignedByUser?: User;
}

interface FolderAssignment {
  userId: string;
  folderName: string;
  notes?: string;
}

export function UserFolderManagement() {
  const [assignments, setAssignments] = useState<UserFolderAccess[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Form states
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] = useState<UserFolderAccess | null>(null);
  const [formData, setFormData] = useState<FolderAssignment>({
    userId: '',
    folderName: '',
    notes: '',
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadAssignments(), loadUsers()]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Błąd ładowania danych');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      const response = await fetch('/api/admin/user-folder-access');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setAssignments(data.assignments || []);
      } else {
        throw new Error(data.error || 'Failed to load assignments');
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
      toast.error('Błąd ładowania przypisań folderów');
      setAssignments([]);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        throw new Error(data.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Błąd ładowania użytkowników');
      setUsers([]);
    }
  };

  const handleCreateAssignment = async () => {
    if (!formData.userId || !formData.folderName) {
      toast.error('Wybierz użytkownika i podaj nazwę folderu');
      return;
    }

    try {
      const response = await fetch('/api/admin/user-folder-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        toast.success('Przypisanie zostało utworzone');
        setIsDialogOpen(false);
        resetForm();
        await loadAssignments();
      } else {
        throw new Error(result.error || 'Failed to create assignment');
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Błąd tworzenia przypisania');
    }
  };

  const handleUpdateAssignment = async (id: number, updates: Partial<UserFolderAccess>) => {
    try {
      const response = await fetch(`/api/admin/user-folder-access/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        toast.success('Przypisanie zostało zaktualizowane');
        await loadAssignments();
      } else {
        throw new Error(result.error || 'Failed to update assignment');
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('Błąd aktualizacji przypisania');
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć to przypisanie?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/user-folder-access/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        toast.success('Przypisanie zostało usunięte');
        await loadAssignments();
      } else {
        throw new Error(result.error || 'Failed to delete assignment');
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Błąd usuwania przypisania');
    }
  };

  const handleToggleActive = async (assignment: UserFolderAccess) => {
    await handleUpdateAssignment(assignment.id, {
      isActive: !assignment.isActive,
    });
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      folderName: '',
      notes: '',
    });
    setEditingAssignment(null);
  };

  const openEditDialog = (assignment: UserFolderAccess) => {
    setEditingAssignment(assignment);
    setFormData({
      userId: assignment.userId,
      folderName: assignment.folderName,
      notes: assignment.notes || '',
    });
    setIsDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pl-PL');
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name || user.email : 'Nieznany użytkownik';
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      ADMIN: 'Administrator',
      SALES_REP: 'Handlowiec',
      SALES_MANAGER: 'Kierownik sprzedaży',
      WAREHOUSE: 'Magazyn',
    };
    return roleLabels[role] || role;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderPlus className="h-6 w-6 text-blue-600" />
            Zarządzanie folderami klientów
          </h1>
          <p className="text-gray-600 mt-1">
            Przypisuj foldery klientów indywidualnych do handlowców
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Dodaj przypisanie
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAssignment ? 'Edytuj przypisanie' : 'Nowe przypisanie folderu'}
              </DialogTitle>
              <DialogDescription>
                {editingAssignment
                  ? 'Zmodyfikuj szczegóły przypisania'
                  : 'Przypisz folder klienta do użytkownika'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user">Użytkownik</Label>
                <Select
                  value={formData.userId}
                  onValueChange={value => setFormData(prev => ({ ...prev, userId: value }))}
                  disabled={!!editingAssignment}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz użytkownika..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          {user.name || user.email}
                          <Badge variant="secondary" className="text-xs">
                            {getRoleLabel(user.role)}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="folderName">Nazwa folderu</Label>
                <Input
                  id="folderName"
                  value={formData.folderName}
                  onChange={e => setFormData(prev => ({ ...prev, folderName: e.target.value }))}
                  placeholder="np. Estera Giemza"
                />
                <p className="text-sm text-gray-500">
                  Podaj nazwę folderu dokładnie tak, jak występuje w R2
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Uwagi (opcjonalne)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Dodatkowe informacje..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                <X className="h-4 w-4 mr-2" />
                Anuluj
              </Button>
              <Button onClick={handleCreateAssignment}>
                <Save className="h-4 w-4 mr-2" />
                {editingAssignment ? 'Zapisz zmiany' : 'Utwórz przypisanie'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Przypisania folderów</CardTitle>
          <CardDescription>
            Lista wszystkich przypisań folderów do użytkowników ({assignments.length} pozycji)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FolderPlus className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Brak przypisań folderów</p>
              <p className="text-sm">Dodaj pierwsze przypisanie używając przycisku powyżej</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Użytkownik</TableHead>
                    <TableHead>Folder</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Utworzono</TableHead>
                    <TableHead>Uwagi</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map(assignment => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{getUserName(assignment.userId)}</div>
                          <div className="text-sm text-gray-500">
                            {users.find(u => u.id === assignment.userId)?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm bg-gray-50 px-2 py-1 rounded">
                          {assignment.folderName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={assignment.isActive ? 'default' : 'secondary'}>
                          {assignment.isActive ? 'Aktywny' : 'Nieaktywny'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(assignment.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {assignment.notes ? (
                            <p className="text-sm text-gray-600 truncate" title={assignment.notes}>
                              {assignment.notes}
                            </p>
                          ) : (
                            <span className="text-gray-400">Brak uwag</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(assignment)}
                          >
                            {assignment.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(assignment)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Aktywne przypisania</p>
                <p className="text-2xl font-bold text-green-600">
                  {assignments.filter(a => a.isActive).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Użytkowników z dostępem</p>
                <p className="text-2xl font-bold text-blue-600">
                  {new Set(assignments.filter(a => a.isActive).map(a => a.userId)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FolderPlus className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Przypisanych folderów</p>
                <p className="text-2xl font-bold text-purple-600">
                  {new Set(assignments.filter(a => a.isActive).map(a => a.folderName)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
