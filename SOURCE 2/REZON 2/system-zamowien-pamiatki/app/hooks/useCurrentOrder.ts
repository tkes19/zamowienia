'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export interface CurrentOrderItem {
  id: string;
  component: 'MIEJSCOWOŚCI' | 'KLIENCI_INDYWIDUALNI' | 'IMIENNE' | 'HASŁA' | 'OKOLICZNOŚCIOWE';
  product: {
    id: string;
    identifier: string;
    index: string;
    description: string;
    price: number;
    imageUrl?: string;
    category: string;
    productionPath: string;
    isActive: boolean;
    new: boolean;
  };
  customization: string;
  locationData?: any;
  clientData?: any;
  quantity: number;
  totalPrice: number;
}

export interface CurrentOrder {
  items: CurrentOrderItem[];
  selectedCustomer: string;
  lastUpdated: string;
}

// Hook do sprawdzania uprawnień użytkownika
export const usePermissions = () => {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!session?.user?.id) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/user/permissions');
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 usePermissions fetched data:', data);
          setPermissions(data.permissions || []);
        } else {
          console.error('❌ Failed to fetch permissions:', response.status, response.statusText);
          setPermissions([]);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions([]);
      }
      setIsLoading(false);
    };

    fetchPermissions();
  }, [session?.user?.id]);

  const hasPermission = (permissionCode: string): boolean => {
    const result = permissions.includes(permissionCode);
    console.log(
      `🔐 hasPermission('${permissionCode}'): ${result}, available permissions:`,
      permissions
    );
    return result;
  };

  return {
    permissions,
    hasPermission,
    isLoading,
  };
};

export const useCurrentOrder = () => {
  const [order, setOrder] = useState<CurrentOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Funkcja do odświeżania zamówienia z localStorage
  const refreshOrder = () => {
    // Sprawdź czy localStorage jest dostępny (client-side only)
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      setOrder(null);
      setIsLoading(false);
      return;
    }

    try {
      const savedOrder = localStorage.getItem('currentOrder');
      if (savedOrder) {
        const parsedOrder = JSON.parse(savedOrder);
        setOrder(parsedOrder);
      } else {
        setOrder(null);
      }
    } catch (error) {
      console.error('Błąd podczas ładowania zamówienia:', error);
      setOrder(null);
    }
    setIsLoading(false);
  };

  // Ładowanie przy inicjalizacji
  useEffect(() => {
    refreshOrder();

    // Sprawdź czy window jest dostępny (client-side only)
    if (typeof window === 'undefined') {
      return;
    }

    // Nasłuchuj zmian w localStorage (np. z innych kart)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentOrder') {
        refreshOrder();
      }
    };

    // Nasłuchuj zmian w localStorage w tej samej karcie
    const handleLocalStorageChange = () => {
      refreshOrder();
    };

    window.addEventListener('storage', handleStorageChange);
    // Custom event dla zmian w tej samej karcie
    window.addEventListener('currentOrderChanged', handleLocalStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('currentOrderChanged', handleLocalStorageChange);
    };
  }, []);

  const getTotalValue = () => {
    if (!order || !order.items) return 0;
    return order.items.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const getItemCount = () => {
    if (!order || !order.items) return 0;
    return order.items.length;
  };

  const clearOrder = () => {
    // Sprawdź czy localStorage jest dostępny
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem('currentOrder');
      window.dispatchEvent(new CustomEvent('currentOrderChanged'));
    }
    setOrder(null);
  };

  return {
    order,
    isLoading,
    getTotalValue,
    getItemCount,
    clearOrder,
    refreshOrder,
  };
};
