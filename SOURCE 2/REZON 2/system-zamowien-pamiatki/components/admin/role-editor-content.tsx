'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'react-hot-toast';
import {
  Shield,
  Users,
  CheckCircle,
  XCircle,
  Crown,
  Briefcase,
  ShoppingBag,
  Warehouse,
  UserPlus,
  AlertTriangle,
  Loader2,
  History,
  Lock,
  Unlock,
  Settings,
} from 'lucide-react';
import { PermissionChangeDialog } from './permission-change-dialog';
import { AuditLogsDialog } from './audit-logs-dialog';

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

interface Role {
  code: string;
  name: string;
  description: string;
  color: string;
}

interface RoleEditorData {
  roles: Role[];
  permissionsByCategory: Record<string, Permission[]>;
  rolePermissions: Record<string, Permission[]>;
  totalPermissions: number;
  totalCategories: number;
}

export function RoleEditorContent() {
  const { data: session } = useSession();
  const [data, setData] = useState<RoleEditorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('ADMIN');
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    role: string;
    permission: Permission;
    action: 'GRANT' | 'REVOKE';
  } | null>(null);

  // Pobierz dane o rolach i uprawnieniach
  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching role editor data...');

      const response = await fetch('/api/role-editor');
      console.log('📡 API Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('📊 API Response data:', {
          totalPermissions: result.totalPermissions,
          totalCategories: result.totalCategories,
          rolesCount: result.roles?.length,
          initialized: result.initialized,
        });

        // Jeśli system nie jest zainicjalizowany lub nie ma uprawnień lub role nie mają uprawnień
        if (result.initialized === false || result.totalPermissions === 0) {
          console.log('⚠️ System not initialized or no permissions found');
          setData(null);
        } else if (
          result.roles &&
          result.roles.every((role: any) => {
            const rolePermissions = result.rolePermissions[role.code] || [];
            return rolePermissions.length === 0;
          })
        ) {
          console.log('⚠️ System has permissions but no role assignments - need re-initialization');
          setData(null);
        } else {
          setData(result);
        }
      } else if (response.status === 500) {
        console.log('❌ Server error - system might not be initialized');
        setData(null);
      } else {
        const error = await response.json();
        console.log('❌ API Error:', error);
        toast.error(error.message || 'Błąd podczas pobierania danych o rolach');
      }
    } catch (error) {
      console.error('❌ Network error fetching role editor data:', error);
      toast.error('Błąd podczas pobierania danych o rolach');
    } finally {
      setLoading(false);
    }
  };

  // Inicjalizuj uprawnienia
  const initializePermissions = async () => {
    try {
      setLoading(true);
      console.log('🚀 Starting permission initialization...');

      const response = await fetch('/api/role-editor/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 API Response:', { status: response.status, ok: response.ok });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Success response:', result);
        toast.success('Uprawnienia zostały zainicjalizowane pomyślnie');
        await fetchData(); // Odśwież dane
      } else {
        const error = await response.json();
        console.log('❌ Error response:', error);
        toast.error(error.message || 'Błąd podczas inicjalizacji uprawnień');
      }
    } catch (error: any) {
      console.error('❌ Network/JS Error initializing permissions:', error);
      toast.error(`Błąd podczas inicjalizacji uprawnień: ${error?.message || 'Nieznany błąd'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRoleIcon = (roleCode: string) => {
    switch (roleCode) {
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'orders':
        return ShoppingBag;
      case 'users':
        return Users;
      case 'products':
        return Settings;
      case 'customers':
        return Users;
      case 'warehouse':
        return Warehouse;
      case 'reports':
        return History;
      case 'admin':
        return Crown;
      default:
        return Shield;
    }
  };

  const hasPermission = (roleCode: string, permissionId: string): boolean => {
    if (!data) return false;
    const rolePermissions = data.rolePermissions[roleCode] || [];
    return rolePermissions.some(p => p.id === permissionId);
  };

  const handlePermissionChange = (role: string, permission: Permission, hasIt: boolean) => {
    const action = hasIt ? 'REVOKE' : 'GRANT';
    setPendingChange({ role, permission, action });
    setChangeDialogOpen(true);
  };

  const handlePermissionChangeConfirm = async (reason?: string) => {
    if (!pendingChange) return;

    const { role, permission, action } = pendingChange;

    try {
      const response = await fetch('/api/role-editor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role,
          permissionId: permission.id,
          action,
          reason,
        }),
      });

      if (response.ok) {
        await fetchData(); // Odśwież dane
        toast.success(
          action === 'GRANT'
            ? `Przyznano uprawnienie "${permission.name}" dla roli ${role}`
            : `Odebrano uprawnienie "${permission.name}" dla roli ${role}`
        );
      } else {
        const error = await response.json();
        toast.error(error.message || 'Błąd podczas zmiany uprawnienia');
      }
    } catch (error) {
      console.error('Error changing permission:', error);
      toast.error('Błąd podczas zmiany uprawnienia');
    } finally {
      setChangeDialogOpen(false);
      setPendingChange(null);
    }
  };

  if (!session || session.user.role !== 'ADMIN') {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-center space-y-2">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <p className="text-lg font-medium">Brak uprawnień</p>
            <p className="text-muted-foreground">
              Tylko administratorzy mogą zarządzać uprawnieniami ról.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Ładowanie edytora ról...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <div className="text-center space-y-4">
            <Settings className="h-12 w-12 text-blue-500 mx-auto" />
            <div>
              <p className="text-lg font-medium">System uprawnień wymaga inicjalizacji</p>
              <p className="text-muted-foreground">
                System uprawnień wymaga inicjalizacji lub przypisania uprawnień do ról. Kliknij
                poniżej, aby utworzyć domyślne uprawnienia i przypisać je do ról.
              </p>
            </div>
            <div className="space-x-2">
              <Button
                onClick={initializePermissions}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Inicjalizuję...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Zainicjalizuj system uprawnień
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={fetchData} disabled={loading}>
                Odśwież
              </Button>
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-sm mb-2 text-blue-800">
                Co zostanie utworzone/naprawione:
              </h4>
              <ul className="text-xs text-blue-700 space-y-1 text-left">
                <li>• 30+ uprawnień w 7 kategoriach</li>
                <li>• Domyślne przypisania uprawnień dla każdej roli</li>
                <li>• Administrator: wszystkie 30+ uprawnień</li>
                <li>• Inne role: odpowiednia liczba uprawnień</li>
                <li>
                  • Kategorie: Zamówienia, Użytkownicy, Produkty, Klienci, Magazyn, Raporty,
                  Administracja
                </li>
                <li>• Automatyczny audyt zmian</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statystyki */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Całkowita liczba ról</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.roles.length}</div>
            <p className="text-xs text-muted-foreground">ról w systemie</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Całkowita liczba uprawnień</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalPermissions}</div>
            <p className="text-xs text-muted-foreground">uprawnień zdefiniowanych</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kategorie uprawnień</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalCategories}</div>
            <p className="text-xs text-muted-foreground">kategorii uprawnień</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logi audytu</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAuditDialogOpen(true)}
              className="w-full"
            >
              <History className="h-3 w-3 mr-1" />
              Pokaż logi
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Edytor uprawnień */}
      <Tabs value={selectedRole} onValueChange={setSelectedRole}>
        <TabsList className="grid w-full grid-cols-5">
          {data.roles.map(role => {
            const Icon = getRoleIcon(role.code);
            const rolePermissions = data.rolePermissions[role.code] || [];
            return (
              <TabsTrigger
                key={role.code}
                value={role.code}
                className="flex items-center space-x-2"
                onClick={() => setSelectedRole(role.code)}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{role.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {rolePermissions.length}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {data.roles.map(role => (
          <TabsContent key={role.code} value={role.code}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const Icon = getRoleIcon(role.code);
                      return <Icon className="h-6 w-6" />;
                    })()}
                    <div>
                      <CardTitle>{role.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <Badge className={role.color}>
                    {(data.rolePermissions[role.code] || []).length} / {data.totalPermissions}{' '}
                    uprawnień
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(data.permissionsByCategory).map(([category, permissions]) => {
                    const CategoryIcon = getCategoryIcon(category);
                    const categoryPermissions = permissions.length;
                    const assignedPermissions = permissions.filter(p =>
                      hasPermission(role.code, p.id)
                    ).length;

                    return (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CategoryIcon className="h-5 w-5 text-gray-500" />
                            <h4 className="font-medium capitalize">
                              {category === 'admin'
                                ? 'Administracja'
                                : category === 'orders'
                                  ? 'Zamówienia'
                                  : category === 'users'
                                    ? 'Użytkownicy'
                                    : category === 'products'
                                      ? 'Produkty'
                                      : category === 'customers'
                                        ? 'Klienci'
                                        : category === 'warehouse'
                                          ? 'Magazyn'
                                          : category === 'reports'
                                            ? 'Raporty'
                                            : category}
                            </h4>
                          </div>
                          <Badge variant="outline">
                            {assignedPermissions} / {categoryPermissions}
                          </Badge>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {permissions.map(permission => {
                            const hasIt = hasPermission(role.code, permission.id);
                            return (
                              <div
                                key={permission.id}
                                className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <Checkbox
                                  checked={hasIt}
                                  onCheckedChange={() =>
                                    handlePermissionChange(role.code, permission, hasIt)
                                  }
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <p className="text-sm font-medium">{permission.name}</p>
                                    {hasIt ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-gray-400" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    Kod: {permission.code}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Dialogi */}
      {pendingChange && (
        <PermissionChangeDialog
          open={changeDialogOpen}
          onClose={() => {
            setChangeDialogOpen(false);
            setPendingChange(null);
          }}
          onConfirm={handlePermissionChangeConfirm}
          role={pendingChange.role}
          permission={pendingChange.permission}
          action={pendingChange.action}
        />
      )}

      <AuditLogsDialog open={auditDialogOpen} onClose={() => setAuditDialogOpen(false)} />
    </div>
  );
}
