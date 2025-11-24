'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AddCustomerDialog } from '@/components/customers/add-customer-dialog';
import { Customer } from '@/lib/types';
import { Search, Users, UserPlus, Phone, Mail, MapPin, Calendar } from 'lucide-react';

export function CustomersContent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    customer =>
      customer.name?.toLowerCase()?.includes(searchTerm?.toLowerCase() || '') ||
      customer.email?.toLowerCase()?.includes(searchTerm?.toLowerCase() || '') ||
      customer.phone?.includes(searchTerm || '') ||
      false
  );

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
          <h1 className="text-2xl font-bold text-gray-900">Moi klienci</h1>
          <p className="text-gray-600">Zarządzaj bazą swoich klientów</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Dodaj klienta
        </Button>
      </div>

      {/* Wyszukiwarka */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Szukaj klientów po nazwie, emailu lub telefonie..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista klientów */}
      <Card>
        <CardHeader>
          <CardTitle>Lista klientów</CardTitle>
          <CardDescription>
            {filteredCustomers.length} {filteredCustomers.length === 1 ? 'klient' : 'klientów'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'Brak wyników' : 'Brak klientów'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm
                  ? 'Nie znaleziono klientów spełniających kryteria wyszukiwania.'
                  : 'Dodaj pierwszego klienta, aby rozpocząć pracę z systemem.'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Dodaj pierwszego klienta
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">{customer.name}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-gray-600">
                        {customer.address && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4" />
                            <span>{customer.address}</span>
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4" />
                            <span>{customer.email}</span>
                          </div>
                        )}
                      </div>
                      {customer.notes && (
                        <p className="text-sm text-gray-600 mt-2 italic">{customer.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/zamowienia?customer=${customer.id}`}>Historia zamówień</a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog dodawania klienta */}
      <AddCustomerDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onCustomerAdded={fetchCustomers}
      />
    </div>
  );
}
