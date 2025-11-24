'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { toast } from 'react-hot-toast';
import {
  History,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  User,
  Calendar,
} from 'lucide-react';

interface AuditLog {
  id: string;
  role: string;
  permissionId: string;
  action: string;
  changedBy: string;
  changedAt: string;
  reason: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  permission: {
    id: string;
    code: string;
    name: string;
    category: string;
  } | null;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface AuditLogsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AuditLogsDialog({ open, onClose }: AuditLogsDialogProps) {
  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    role: 'all',
    action: 'all',
    page: 1,
  });

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const roleParam = filters.role === 'all' ? '' : filters.role;
      const actionParam = filters.action === 'all' ? '' : filters.action;

      if (roleParam) params.set('role', roleParam);
      if (actionParam) params.set('action', actionParam);
      params.set('page', filters.page.toString());
      params.set('limit', '20');

      const response = await fetch(`/api/role-editor/audit?${params}`);

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error('Błąd podczas pobierania logów audytu');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Błąd podczas pobierania logów audytu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchAuditLogs();
    }
  }, [open, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? '' : value, // Konwertuj "all" na pusty string dla API
      page: 1, // Reset page when filters change
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: newPage,
    }));
  };

  const roleNames: Record<string, string> = {
    ADMIN: 'Administrator',
    SALES_DEPT: 'Kierownik Sprzedaży',
    SALES_REP: 'Przedstawiciel Handlowy',
    WAREHOUSE: 'Magazynier',
    NEW_USER: 'Nowy Użytkownik',
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Logi Audytu Uprawnień</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filtry */}
          <div className="flex flex-wrap items-center gap-4 p-4 border-b">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium">Filtry:</span>
            </div>

            <Select value={filters.role} onValueChange={value => handleFilterChange('role', value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Wszystkie role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie role</SelectItem>
                {Object.entries(roleNames).map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.action}
              onValueChange={value => handleFilterChange('action', value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Wszystkie akcje" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie akcje</SelectItem>
                <SelectItem value="GRANTED">Przyznano</SelectItem>
                <SelectItem value="REVOKED">Odebrano</SelectItem>
              </SelectContent>
            </Select>

            {(filters.role !== 'all' || filters.action !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ role: 'all', action: 'all', page: 1 })}
              >
                Wyczyść filtry
              </Button>
            )}
          </div>

          {/* Tabela logów */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Ładowanie logów...</span>
              </div>
            ) : data?.logs.length === 0 ? (
              <div className="text-center py-10">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium">Brak logów audytu</p>
                <p className="text-gray-600">
                  {filters.role || filters.action
                    ? 'Brak logów pasujących do wybranych filtrów.'
                    : 'Nie wykonano jeszcze żadnych zmian uprawnień.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Uprawnienie</TableHead>
                    <TableHead>Akcja</TableHead>
                    <TableHead>Użytkownik</TableHead>
                    <TableHead>Powód</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{formatDate(log.changedAt)}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{roleNames[log.role] || log.role}</Badge>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-sm">
                            {log.permission?.name || 'Nieznane uprawnienie'}
                          </p>
                          <p className="text-xs text-muted-foreground">{log.permission?.code}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {log.action === 'GRANTED' ? (
                            <Unlock className="h-4 w-4 text-green-600" />
                          ) : (
                            <Lock className="h-4 w-4 text-red-600" />
                          )}
                          <Badge variant={log.action === 'GRANTED' ? 'default' : 'destructive'}>
                            {log.action === 'GRANTED' ? 'Przyznano' : 'Odebrano'}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                              {log.user?.name?.charAt(0)?.toUpperCase() ||
                                log.user?.email?.charAt(0)?.toUpperCase() ||
                                'S'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {log.user?.name || log.changedBy === 'system' ? 'System' : 'Nieznany'}
                            </p>
                            {log.user?.email && (
                              <p className="text-xs text-muted-foreground">{log.user.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <p className="text-sm">
                          {log.reason ||
                            (log.changedBy === 'system'
                              ? 'Inicjalizacja systemu'
                              : 'Brak podanego powodu')}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Paginacja */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Strona {data.pagination.page} z {data.pagination.totalPages}({data.pagination.total}{' '}
                logów)
              </p>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.pagination.page - 1)}
                  disabled={!data.pagination.hasPrev || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Poprzednia
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.pagination.page + 1)}
                  disabled={!data.pagination.hasNext || loading}
                >
                  Następna
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Zamknij</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
