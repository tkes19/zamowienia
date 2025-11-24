'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Users,
  Package,
  ClipboardList,
  Settings,
  BarChart3,
  UserCheck,
  ShoppingBag,
  Warehouse,
  Cloud,
  Building2,
  Shield,
  FolderPlus,
} from 'lucide-react';
import { R2TestPanel } from './R2TestPanel';

export function AdminContent() {
  const adminSections = [
    {
      title: 'Zarządzanie użytkownikami',
      description: 'Dodawaj, edytuj i przypisuj role użytkownikom',
      icon: Users,
      href: '/uzytkownicy',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Zarządzanie działami',
      description: 'Twórz, edytuj i usuwaj działy organizacyjne',
      icon: Building2,
      href: '/admin/departments',
      color: 'bg-teal-100 text-teal-600',
    },
    {
      title: 'Zarządzanie rolami',
      description: 'Przypisuj role i zarządzaj uprawnieniami użytkowników',
      icon: Shield,
      href: '/admin/roles',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Foldery klientów indywidualnych',
      description: 'Przypisuj foldery klientów do handlowców',
      icon: FolderPlus,
      href: '/admin/foldery-klientow',
      color: 'bg-cyan-100 text-cyan-600',
    },
    {
      title: 'Edytor ról i uprawnień',
      description: 'Zaawansowane zarządzanie uprawnieniami dla każdej roli',
      icon: Settings,
      href: '/admin/role-editor',
      color: 'bg-pink-100 text-pink-600',
    },
    {
      title: 'Zarządzanie produktami',
      description: 'Dodawaj nowe produkty i edytuj istniejące',
      icon: Package,
      href: '/admin/produkty',
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Wszystkie zamówienia',
      description: 'Przeglądaj i zarządzaj wszystkimi zamówieniami',
      icon: ClipboardList,
      href: '/zamowienia/lista',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Status magazynu',
      description: 'Monitoruj stany magazynowe i realizację',
      icon: Warehouse,
      href: '/magazyn',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      title: 'Raporty i statystyki',
      description: 'Analizuj sprzedaż i wydajność systemu',
      icon: BarChart3,
      href: '/admin/raporty',
      color: 'bg-indigo-100 text-indigo-600',
    },
    {
      title: 'Konfiguracja systemu',
      description: 'Ustawienia ogólne i konfiguracja',
      icon: Settings,
      href: '/admin/ustawienia',
      color: 'bg-gray-100 text-gray-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel administracyjny</h1>
        <p className="text-gray-600">Zarządzaj wszystkimi aspektami systemu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map(section => {
          const Icon = section.icon;
          return (
            <Card key={section.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg ${section.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">{section.description}</CardDescription>
                <Button asChild className="w-full">
                  <Link href={section.href}>Przejdź do sekcji</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Szybkie statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Łączna liczba użytkowników</p>
                <p className="text-2xl font-bold text-gray-900">24</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Produkty w katalogu</p>
                <p className="text-2xl font-bold text-gray-900">287</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Zamówienia w tym miesiącu</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
              <ClipboardList className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Przychód miesiąc</p>
                <p className="text-2xl font-bold text-gray-900">45.231 zł</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel R2 Storage */}
      <R2TestPanel />

      {/* Ostatnie aktywności */}
      <Card>
        <CardHeader>
          <CardTitle>Ostatnie aktywności w systemie</CardTitle>
          <CardDescription>Przegląd najnowszych zdarzeń w systemie</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                action: 'Nowy użytkownik zarejestrowany',
                user: 'Anna Kowalska',
                time: '2 minuty temu',
              },
              { action: 'Zamówienie zostało złożone', user: 'Jan Nowak', time: '15 minut temu' },
              {
                action: 'Produkt został dodany do katalogu',
                user: 'Admin',
                time: '1 godzina temu',
              },
              {
                action: 'Status zamówienia został zaktualizowany',
                user: 'Magazyn',
                time: '2 godziny temu',
              },
            ].map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-600">przez {activity.user}</p>
                </div>
                <p className="text-sm text-gray-500">{activity.time}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
