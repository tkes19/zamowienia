'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { toast } from 'react-hot-toast';
import {
  Shield,
  Users,
  Crown,
  Briefcase,
  ShoppingBag,
  Warehouse,
  UserPlus,
  AlertTriangle,
  Loader2,
  Edit2,
  Eye,
  BarChart3,
} from 'lucide-react';
import { ChangeRoleDialog } from './change-role-dialog';
import { RoleDetailsDialog } from './role-details-dialog';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

interface RolesData {
  roles: Role[];
  totalUsers: number;
  allUsers: User[];
}

export function RolesContent() {
  const { data: session } = useSession();
  const [rolesData, setRolesData] = useState<RolesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [changeRoleUser, setChangeRoleUser] = useState<User | null>(null);
  const [viewRoleDetails, setViewRoleDetails] = useState<Role | null>(null);

  // Pobierz dane o rolach
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/roles');

      if (response.ok) {
        const data = await response.json();
        setRolesData(data);
      } else {
        toast.error('Błąd podczas pobierania danych o rolach');
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Błąd podczas pobierania danych o rolach');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleRoleChanged = () => {
    fetchRoles();
    setChangeRoleUser(null);
    toast.success('Rola użytkownika została zmieniona pomyślnie');
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return Crown;
      case 'SALES_DEPT':
        return Briefcase;
      case 'SALES_REP':
        return ShoppingBag;
      case 'WAREHOUSE':
        return Warehouse;
      case 'NEW_USER':
        return UserPlus;
      default:
        return Shield;
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-center space-y-2">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <p className="text-lg font-medium">Brak uprawnień</p>
            <p className="text-muted-foreground">Tylko administratorzy mogą zarządzać rolami.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Ładowanie danych o rolach...</span>
      </div>
    );
  }

  if (!rolesData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-center space-y-2">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="text-lg font-medium">Błąd ładowania danych</p>
            <p className="text-muted-foreground">Nie udało się pobrać danych o rolach.</p>
            <Button onClick={fetchRoles}>Spróbuj ponownie</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statystyki */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wszystkich użytkowników</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rolesData.totalUsers}</div>
            <p className="text-xs text-muted-foreground">w systemie</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dostępne role</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rolesData.roles.length}</div>
            <p className="text-xs text-muted-foreground">różnych ról</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administratorzy</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rolesData.roles.find(r => r.role === 'ADMIN')?.userCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">użytkowników</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nowi użytkownicy</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rolesData.roles.find(r => r.role === 'NEW_USER')?.userCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">oczekuje na przypisanie</p>
          </CardContent>
        </Card>
      </div>

      {/* Przegląd ról */}
      <Card>
        <CardHeader>
          <CardTitle>Przegląd Ról</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rolesData.roles.map(role => {
              const Icon = getRoleIcon(role.role);
              return (
                <Card key={role.role} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`p-2 rounded-lg ${role.color.replace('text-', 'text-').replace('bg-', 'bg-')}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{role.name}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {role.userCount} użytkowników
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewRoleDetails(role)}
                        className="flex-1"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Szczegóły
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lista wszystkich użytkowników */}
      <Card>
        <CardHeader>
          <CardTitle>Wszyscy Użytkownicy</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Użytkownik</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Dział</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rolesData.allUsers.map(user => {
                const userRole = rolesData.roles.find(r => r.role === user.role);
                const Icon = getRoleIcon(user.role);

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name || 'Bez nazwy'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4 text-gray-400" />
                        <Badge className={userRole?.color || 'bg-gray-100 text-gray-800'}>
                          {userRole?.name || user.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.department ? (
                        <span className="text-sm">{user.department.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Brak działu</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Aktywny' : 'Nieaktywny'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setChangeRoleUser(user)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        Zmień rolę
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogi */}
      {changeRoleUser && (
        <ChangeRoleDialog
          user={changeRoleUser}
          roles={rolesData.roles}
          open={!!changeRoleUser}
          onClose={() => setChangeRoleUser(null)}
          onSuccess={handleRoleChanged}
        />
      )}

      {viewRoleDetails && (
        <RoleDetailsDialog
          role={viewRoleDetails}
          open={!!viewRoleDetails}
          onClose={() => setViewRoleDetails(null)}
        />
      )}
    </div>
  );
}
