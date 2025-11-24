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
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, Building2, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { AddDepartmentDialog } from './add-department-dialog';
import { EditDepartmentDialog } from './edit-department-dialog';
import { DeleteDepartmentDialog } from './delete-department-dialog';

interface Department {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
  };
}

export function DepartmentsContent() {
  const { data: session } = useSession();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const [deleteDepartment, setDeleteDepartment] = useState<Department | null>(null);

  // Pobierz działy
  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/departments');

      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      } else {
        toast.error('Błąd podczas pobierania działów');
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Błąd podczas pobierania działów');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleDepartmentAdded = () => {
    fetchDepartments();
    setAddDialogOpen(false);
    toast.success('Dział został dodany pomyślnie');
  };

  const handleDepartmentUpdated = () => {
    fetchDepartments();
    setEditDepartment(null);
    toast.success('Dział został zaktualizowany pomyślnie');
  };

  const handleDepartmentDeleted = () => {
    fetchDepartments();
    setDeleteDepartment(null);
    toast.success('Dział został usunięty pomyślnie');
  };

  if (!session || session.user.role !== 'ADMIN') {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-center space-y-2">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <p className="text-lg font-medium">Brak uprawnień</p>
            <p className="text-muted-foreground">Tylko administratorzy mogą zarządzać działami.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statystyki */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Łączna liczba działów</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
            <p className="text-xs text-muted-foreground">wszystkie działy w systemie</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Działy z użytkownikami</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {departments.filter(d => d._count.users > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">działy mające przypisanych użytkowników</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Puste działy</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {departments.filter(d => d._count.users === 0).length}
            </div>
            <p className="text-xs text-muted-foreground">działy bez przypisanych użytkowników</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista działów */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Działów</CardTitle>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj Dział
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Ładowanie działów...</span>
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-10">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">Brak działów</p>
              <p className="text-gray-600 mb-4">Nie masz jeszcze żadnych działów w systemie.</p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj pierwszy dział
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazwa Działu</TableHead>
                  <TableHead>Liczba Użytkowników</TableHead>
                  <TableHead>Data Utworzenia</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map(department => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>{department.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{department._count.users}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(department.createdAt).toLocaleDateString('pl-PL')}
                    </TableCell>
                    <TableCell>
                      {department._count.users > 0 ? (
                        <Badge variant="default">Aktywny</Badge>
                      ) : (
                        <Badge variant="secondary">Pusty</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditDepartment(department)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteDepartment(department)}
                          disabled={department._count.users > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogi */}
      <AddDepartmentDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={handleDepartmentAdded}
      />

      {editDepartment && (
        <EditDepartmentDialog
          department={editDepartment}
          open={!!editDepartment}
          onClose={() => setEditDepartment(null)}
          onSuccess={handleDepartmentUpdated}
        />
      )}

      {deleteDepartment && (
        <DeleteDepartmentDialog
          department={deleteDepartment}
          open={!!deleteDepartment}
          onClose={() => setDeleteDepartment(null)}
          onSuccess={handleDepartmentDeleted}
        />
      )}
    </div>
  );
}
