'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  Users,
  CheckCircle,
  Crown,
  Briefcase,
  ShoppingBag,
  Warehouse,
  UserPlus,
} from 'lucide-react';

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

interface RoleDetailsDialogProps {
  role: Role;
  open: boolean;
  onClose: () => void;
}

export function RoleDetailsDialog({ role, open, onClose }: RoleDetailsDialogProps) {
  const getRoleIcon = (roleType: string) => {
    switch (roleType) {
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

  const Icon = getRoleIcon(role.role);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <div className={`p-2 rounded-lg ${role.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <span>Szczegóły roli: {role.name}</span>
          </DialogTitle>
          <DialogDescription>
            Szczegółowe informacje o roli, uprawnieniach i przypisanych użytkownikach.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Podstawowe informacje */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informacje o roli</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Opis</h4>
                <p className="text-sm">{role.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">
                    Liczba użytkowników
                  </h4>
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-lg font-semibold">{role.userCount}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Kod roli</h4>
                  <Badge variant="outline">{role.role}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Uprawnienia */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Uprawnienia</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {role.permissions.map((permission, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{permission}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lista użytkowników */}
          {role.users.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Użytkownicy z tą rolą ({role.users.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Użytkownik</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Dział</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {role.users.map(user => (
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
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell className="text-sm">
                          {user.department ? (
                            <span>{user.department.name}</span>
                          ) : (
                            <span className="text-muted-foreground">Brak działu</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'default' : 'secondary'}>
                            {user.isActive ? 'Aktywny' : 'Nieaktywny'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {role.users.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">Brak użytkowników</p>
                <p className="text-gray-600">
                  Żaden użytkownik nie ma jeszcze przypisanej tej roli.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose}>Zamknij</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
