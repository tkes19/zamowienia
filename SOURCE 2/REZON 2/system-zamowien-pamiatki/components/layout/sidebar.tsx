'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  Home,
  Package,
  ShoppingCart,
  Users,
  ClipboardList,
  Settings,
  Warehouse,
  UserCheck,
  Plus,
  X,
  Database,
  TestTube,
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/zamowienia',
    icon: Home,
    roles: ['ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT'],
  },
  {
    name: 'Produkty',
    href: '/produkty',
    icon: Package,
    roles: ['ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT'],
  },
  {
    name: 'Nowe zamówienie',
    href: '/nowe-zamowienie',
    icon: Plus,
    roles: ['SALES_REP', 'SALES_DEPT'],
  }, // ✅ DODANO SALES_DEPT
  {
    name: 'Zamówienia',
    href: '/zamowienia/lista',
    icon: ClipboardList,
    roles: ['ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT'],
  },
  { name: 'Klienci', href: '/klienci', icon: Users, roles: ['SALES_REP', 'SALES_DEPT'] }, // ✅ DODANO SALES_DEPT
  { name: 'Magazyn', href: '/magazyn', icon: Warehouse, roles: ['ADMIN', 'WAREHOUSE'] },
  { name: 'Użytkownicy', href: '/uzytkownicy', icon: UserCheck, roles: ['ADMIN'] },
  {
    name: 'Test OCR',
    href: '/test-ocr',
    icon: TestTube,
    roles: ['ADMIN', 'SALES_REP', 'SALES_DEPT'],
  }, // ✅ DODANO SALES_DEPT
  {
    name: 'Moje ustawienia',
    href: '/ustawienia',
    icon: Settings,
    roles: ['ADMIN', 'SALES_REP', 'WAREHOUSE', 'SALES_DEPT'],
  }, // ✅ NOWE
  { name: 'Status bazy', href: '/admin/database-status', icon: Database, roles: ['ADMIN'] },
  { name: 'Administracja', href: '/admin', icon: Settings, roles: ['ADMIN'] },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export function Sidebar({ isOpen = true, onClose, className }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(session?.user?.role || '')
  );

  const handleLinkClick = () => {
    // Close sidebar on mobile after clicking a link
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gray-50 border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">System zamówienia</span>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-2">
            {filteredNavigation.map(item => {
              const isActive = pathname === item.href;
              const linkElement = (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={handleLinkClick}
                  className={cn(
                    'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );

              return linkElement;
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
