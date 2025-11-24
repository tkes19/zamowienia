'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { User, USER_ROLE_LABELS } from '@/lib/types';
import { useSession } from 'next-auth/react';
import { AddUserDialog } from './add-user-dialog';
import { EditUserDialog } from './edit-user-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';
import {
  Search,
  Users,
  Shield,
  Calendar,
  UserPlus,
  Edit,
  Trash2,
  Key,
  Building,
} from 'lucide-react';
import { toast } from 'sonner';

export function UsersContent() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Dialogi
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        toast.success('Rola użytkownika została zmieniona');
        fetchUsers();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas zmiany roli');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Wystąpił błąd podczas zmiany roli');
    }
  };

  // Funkcje dla dialogów
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditUserOpen(true);
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setResetPasswordOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Użytkownik został usunięty pomyślnie');
        fetchUsers();
        setDeleteDialogOpen(false);
        setSelectedUser(null);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas usuwania użytkownika');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Wystąpił błąd podczas usuwania użytkownika');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name?.toLowerCase()?.includes(searchTerm?.toLowerCase() || '') ||
      user.email?.toLowerCase()?.includes(searchTerm?.toLowerCase() || '') ||
      false;
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    const matchesDepartment =
      selectedDepartment === 'all' ||
      (selectedDepartment === 'none' && !user.department) ||
      user.department?.id === selectedDepartment;
    return matchesSearch && matchesRole && matchesDepartment;
  });

  // Pobierz unikalne działy z użytkowników
  const departments = Array.from(
    new Set(users.map(user => user.department).filter(Boolean))
  ) as Array<{ id: string; name: string }>;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      case 'SALES_REP':
        return 'bg-blue-100 text-blue-800';
      case 'WAREHOUSE':
        return 'bg-orange-100 text-orange-800';
      case 'SALES_DEPT':
        return 'bg-green-100 text-green-800';
      case 'NEW_USER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zarządzanie użytkownikami</h1>
          <p className="text-gray-600">Przypisuj role i zarządzaj uprawnieniami użytkowników</p>
        </div>
        {session?.user && ['ADMIN', 'SALES_DEPT'].includes(session.user.role) && (
          <Button onClick={() => setAddUserOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Dodaj użytkownika
          </Button>
        )}
      </div>

      {/* Filtry */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Szukaj użytkowników po nazwie lub emailu..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="lg:w-64">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtruj po roli" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie role</SelectItem>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                  <SelectItem value="SALES_REP">Handlowiec</SelectItem>
                  <SelectItem value="WAREHOUSE">Magazyn</SelectItem>
                  <SelectItem value="SALES_DEPT">Dział Sprzedaży</SelectItem>
                  <SelectItem value="NEW_USER">Nowy Użytkownik</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:w-64">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtruj po dziale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie działy</SelectItem>
                  <SelectItem value="none">Bez działu</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela użytkowników */}
      <Card>
        <CardHeader>
          <CardTitle>Lista użytkowników</CardTitle>
          <CardDescription>
            {filteredUsers.length} {filteredUsers.length === 1 ? 'użytkownik' : 'użytkowników'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Brak użytkowników</h3>
              <p className="text-gray-600">
                Nie znaleziono użytkowników spełniających kryteria wyszukiwania.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Użytkownik</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Dział</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data rejestracji</TableHead>
                    <TableHead>Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {user.name?.charAt(0)?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name || 'Bez nazwy'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {USER_ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building className="h-4 w-4 text-gray-400" />
                          <span>{user.department?.name || 'Brak działu'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Aktywny' : 'Nieaktywny'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{new Date(user.createdAt).toLocaleDateString('pl-PL')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {(session?.user?.role === 'ADMIN' ||
                            (session?.user?.role === 'SALES_DEPT' &&
                              user.role === 'SALES_REP')) && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              {session.user.role === 'ADMIN' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleResetPassword(user)}
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteUser(user)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </>
                          )}
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

      {/* Informacje o rolach */}
      <Card>
        <CardHeader>
          <CardTitle>Informacje o rolach</CardTitle>
          <CardDescription>Opis uprawnień dla każdej roli w systemie</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-red-800">Administrator</h4>
              </div>
              <p className="text-sm text-gray-600">
                Pełny dostęp do wszystkich funkcji systemu, zarządzanie użytkownikami i produktami.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-800">Handlowiec</h4>
              </div>
              <p className="text-sm text-gray-600">
                Składanie zamówień, zarządzanie swoimi klientami, przeglądanie katalogu produktów.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-orange-600" />
                <h4 className="font-semibold text-orange-800">Magazyn</h4>
              </div>
              <p className="text-sm text-gray-600">
                Zarządzanie stanami magazynowymi, aktualizacja statusów zamówień.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-green-800">Dział Sprzedaży</h4>
              </div>
              <p className="text-sm text-gray-600">
                Nadzór nad procesem sprzedaży, dostęp do wszystkich zamówień i klientów.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-gray-600" />
                <h4 className="font-semibold text-gray-800">Nowy Użytkownik</h4>
              </div>
              <p className="text-sm text-gray-600">
                Ograniczony dostęp, wymaga aktywacji przez administratora.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogi */}
      <AddUserDialog open={addUserOpen} onOpenChange={setAddUserOpen} onUserAdded={fetchUsers} />

      <EditUserDialog
        open={editUserOpen}
        onOpenChange={setEditUserOpen}
        user={selectedUser}
        onUserUpdated={fetchUsers}
      />

      <ResetPasswordDialog
        open={resetPasswordOpen}
        onOpenChange={setResetPasswordOpen}
        user={selectedUser}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć tego użytkownika?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja jest nieodwracalna. Użytkownik <strong>{selectedUser?.name}</strong> zostanie
              trwale usunięty z systemu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} className="bg-red-600 hover:bg-red-700">
              Usuń użytkownika
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
